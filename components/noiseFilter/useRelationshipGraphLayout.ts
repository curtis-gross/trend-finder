import { useMemo } from 'react';
import {
    RawComment, Stage2FilteredResult, Stage3KeywordResult, NoiseFilterResult, GraphNode, GraphLink
} from '../../services/noiseFilterService';
import { groundGraphNodesWithComments } from './useGraphNodeCommentMatcher';

export type EnhancedGraphLink = GraphLink & {
    kind: 'hub' | 'comment-cooccurrence' | 'semantic-overlap' | 'sentiment-affinity';
    reason: string;
    badge: string;
    sharedComments?: number;
};

const STOPWORDS = new Set([
    'the', 'and', 'for', 'with', 'from', 'that', 'this', 'have', 'more', 'very',
    'just', 'like', 'into', 'over', 'some', 'what', 'when', 'your', 'they', 'them',
    'game', 'mode', 'modes', 'player', 'players', 'experience'
]);

const CONCEPT_FAMILIES: { name: string; terms: string[] }[] = [
    { name: 'Platform Reliability & Performance', terms: ['server', 'latency', 'delay', 'lag', 'online', 'ping', 'disconnect', 'performance', 'speed', 'stability', 'uptime'] },
    { name: 'Pricing, Value & Loyalty', terms: ['price', 'cost', 'worth', 'value', 'reward', 'tier', 'membership', 'promotion', 'discount', 'bundle'] },
    { name: 'Product Quality & Design', terms: ['quality', 'design', 'material', 'durability', 'craftsmanship', 'finish', 'detail', 'fit', 'sizing', 'style'] },
    { name: 'Customer Experience & Journey', terms: ['onboarding', 'checkout', 'navigation', 'journey', 'account', 'profile', 'community', 'event', 'feedback'] },
    { name: 'Fulfillment, Delivery & Support', terms: ['shipping', 'delivery', 'packaging', 'return', 'exchange', 'support', 'service', 'tracking', 'inventory'] },
    { name: 'Digital Innovation & Features', terms: ['feature', 'update', 'app', 'mobile', 'interface', 'search', 'personalization', 'recommendation', 'optimization'] }
];

const extractTokens = (text: string): string[] =>
    String(text || '')
        .toLowerCase()
        .replace(/[^a-z0-9\s-]/g, ' ')
        .split(/\s+/)
        .map(w => w.replace(/^-+|-+$/g, ''))
        .filter(w => w.length >= 3 && !STOPWORDS.has(w));

const getStem = (word: string) => (word.length >= 5 ? word.slice(0, 5) : word);

export const useRelationshipGraphLayout = ({
    stage4Data, stage3Data, stage2Data, rawComments, allUniqueSignalComments,
    densityMode, graphSearchQuery, selectedSentiment, selectedCategory,
    hoveredNodeId, selectedNode
}: {
    stage4Data: NoiseFilterResult | null;
    stage3Data: Stage3KeywordResult | null;
    stage2Data: Stage2FilteredResult | null;
    rawComments: RawComment[];
    allUniqueSignalComments: any[];
    densityMode: 'all' | 'core';
    graphSearchQuery: string;
    selectedSentiment: 'ALL' | 'positive' | 'negative' | 'mixed';
    selectedCategory: string;
    hoveredNodeId: string | null;
    selectedNode: GraphNode | null;
}) => {
    const availableCategories = useMemo(() => {
        if (!stage4Data?.nodes) return [];
        const cats = new Set<string>();
        stage4Data.nodes.forEach(n => {
            if (n.category) cats.add(n.category);
        });
        return Array.from(cats);
    }, [stage4Data]);

    const positionedNodes = useMemo(() => {
        if (!stage4Data?.nodes || !Array.isArray(stage4Data.nodes)) return [];
        const totalDataset = stage4Data.totalHarvested || allUniqueSignalComments.length || rawComments.length || 1000;
        const nodes = groundGraphNodesWithComments(stage4Data.nodes, totalDataset, stage3Data, allUniqueSignalComments);

        const centerX = 480;
        const centerY = 290;
        const releaseNodes = nodes.filter(n => n.type === 'release' || n.type === 'category').sort((a, b) => (b.size || 0) - (a.size || 0));
        const featureNodes = nodes.filter(n => n.type === 'feature');

        releaseNodes.forEach((node, i) => {
            const angle = (i / (releaseNodes.length || 1)) * 2 * Math.PI - Math.PI / 2;
            const r = 90;
            node.x = centerX + r * Math.cos(angle);
            node.y = centerY + r * Math.sin(angle) * 0.75;
        });

        const categories = Array.from(new Set(featureNodes.map(n => n.category || 'General')));
        const catCount = categories.length || 1;

        featureNodes.forEach((node) => {
            const catIdx = categories.indexOf(node.category || 'General');
            const sectorAngleStart = (catIdx / catCount) * 2 * Math.PI - Math.PI / 2;
            const sectorAngleWidth = (2 * Math.PI) / catCount;
            const nodesInCat = featureNodes.filter(n => (n.category || 'General') === (node.category || 'General'));
            const nodeIdxInCat = nodesInCat.indexOf(node);
            const intraAngle = sectorAngleStart + ((nodeIdxInCat + 0.5) / (nodesInCat.length || 1)) * sectorAngleWidth * 0.85;
            const ringTier = nodeIdxInCat % 3;
            const r = ringTier === 0 ? 175 : ringTier === 1 ? 245 : 310;
            node.x = centerX + r * Math.cos(intraAngle);
            node.y = centerY + r * Math.sin(intraAngle) * 0.85;
        });

        return [...releaseNodes, ...featureNodes];
    }, [stage4Data, stage3Data, rawComments, allUniqueSignalComments]);

    const filteredNodes = useMemo(() => {
        return (positionedNodes || []).filter(n => {
            if (!n) return false;
            if (densityMode === 'core' && n.tier === 'micro') return false;
            if (graphSearchQuery && !String(n.label || '').toLowerCase().includes(graphSearchQuery.toLowerCase())) return false;
            if (selectedSentiment !== 'ALL' && n.type === 'feature' && n.sentiment !== selectedSentiment) return false;
            if (selectedCategory !== 'ALL' && n.type === 'feature' && n.category !== selectedCategory) return false;
            return true;
        });
    }, [positionedNodes, graphSearchQuery, selectedSentiment, selectedCategory, densityMode]);

    const enhancedGraphLinks = useMemo(() => {
        const nodes = filteredNodes || [];
        if (nodes.length === 0) return [];

        const nodeById = new Map<string, GraphNode>();
        const nodeByNormLabel = new Map<string, GraphNode>();
        nodes.forEach(n => {
            nodeById.set(n.id, n);
            nodeByNormLabel.set(String(n.label || '').toLowerCase().replace(/^#/, '').trim(), n);
        });

        const resolveEndpoint = (val: string): GraphNode | undefined => {
            if (!val) return undefined;
            if (nodeById.has(val)) return nodeById.get(val);
            const norm = String(val).toLowerCase().replace(/^#/, '').trim();
            if (nodeByNormLabel.has(norm)) return nodeByNormLabel.get(norm);
            return nodes.find(n => {
                const l = String(n.label || '').toLowerCase().replace(/^#/, '').trim();
                return l.includes(norm) || norm.includes(l);
            });
        };

        const pairKey = (a: string, b: string) => (a < b ? `${a}::${b}` : `${b}::${a}`);
        const linkMap = new Map<string, EnhancedGraphLink>();

        const addOrUpgradeLink = (link: EnhancedGraphLink) => {
            if (!link.source || !link.target || link.source === link.target) return;
            const k = pairKey(link.source, link.target);
            const existing = linkMap.get(k);
            if (!existing) {
                linkMap.set(k, link);
                return;
            }
            const rank = { 'comment-cooccurrence': 4, 'semantic-overlap': 3, 'sentiment-affinity': 2, 'hub': 1 };
            if (rank[link.kind] > rank[existing.kind] || link.weight > existing.weight) {
                linkMap.set(k, {
                    ...existing,
                    ...link,
                    weight: Math.max(existing.weight, link.weight),
                    sharedComments: Math.max(existing.sharedComments || 0, link.sharedComments || 0)
                });
            }
        };

        (stage4Data?.links || []).forEach(l => {
            const srcNode = resolveEndpoint(l.source);
            const tgtNode = resolveEndpoint(l.target);
            if (!srcNode || !tgtNode || srcNode.id === tgtNode.id) return;
            const isHub = srcNode.type === 'category' || srcNode.type === 'release' || tgtNode.type === 'category' || tgtNode.type === 'release';
            addOrUpgradeLink({
                source: srcNode.id,
                target: tgtNode.id,
                weight: l.weight || (isHub ? 10 : 12),
                sentiment: l.sentiment || (tgtNode.sentiment as any) || 'mixed',
                kind: isHub ? 'hub' : 'semantic-overlap',
                reason: isHub ? `Category Pillar (${srcNode.type === 'category' || srcNode.type === 'release' ? srcNode.label : tgtNode.label})` : 'Cross-topic network correlation',
                badge: isHub ? 'Pillar' : 'Topic Link'
            });
        });

        const hubNodes = nodes.filter(n => n.type === 'category' || n.type === 'release');
        const featureNodes = nodes.filter(n => n.type === 'feature');

        featureNodes.forEach(fn => {
            if (!fn.category) return;
            const catClean = fn.category.toLowerCase().trim();
            const parentHub = hubNodes.find(h =>
                String(h.label || '').toLowerCase().trim() === catClean ||
                String(h.category || '').toLowerCase().trim() === catClean ||
                catClean.includes(String(h.label || '').toLowerCase().trim())
            );
            if (parentHub) {
                addOrUpgradeLink({
                    source: parentHub.id,
                    target: fn.id,
                    weight: 10,
                    sentiment: (fn.sentiment as any) || 'mixed',
                    kind: 'hub',
                    reason: `Belongs to ${parentHub.label} domain`,
                    badge: 'Domain Hub'
                });
            }
        });

        const commentPool: any[] = [];
        const seenCommentKeys = new Set<string>();
        [
            ...(Array.isArray(stage3Data?.enrichedComments) ? stage3Data!.enrichedComments : []),
            ...(Array.isArray(stage2Data?.filteredComments) ? stage2Data!.filteredComments.filter(c => !c.isNoise) : []),
            ...(Array.isArray(stage4Data?.comments) ? stage4Data!.comments : []),
            ...(Array.isArray(rawComments) ? rawComments : [])
        ].forEach(c => {
            if (!c) return;
            const key = String(c.id || c.rawText || '').trim();
            if (key && !seenCommentKeys.has(key)) {
                seenCommentKeys.add(key);
                commentPool.push(c);
            }
        });

        const nodeProfiles = new Map<string, {
            node: GraphNode;
            labelNorm: string;
            tokens: string[];
            stems: Set<string>;
            matchedComments: Set<number>;
            threads: Set<string>;
            commentVocab: Set<string>;
            families: Set<string>;
        }>();

        featureNodes.forEach(fn => {
            const labelNorm = String(fn.label || '').toLowerCase().replace(/^#/, '').trim();
            const tokens = extractTokens(labelNorm);
            const stems = new Set(tokens.map(getStem));
            const families = new Set<string>();
            CONCEPT_FAMILIES.forEach(fam => {
                if (fam.terms.some(t => labelNorm.includes(t) || tokens.some(tok => tok.includes(t) || t.includes(tok)))) {
                    families.add(fam.name);
                }
            });
            nodeProfiles.set(fn.id, {
                node: fn,
                labelNorm,
                tokens,
                stems,
                matchedComments: new Set<number>(),
                threads: new Set<string>(),
                commentVocab: new Set<string>(tokens),
                families
            });
        });

        commentPool.forEach((c, cIdx) => {
            const combinedText = `${String(c.rawText || '')} ${String(c.constructiveSummary || '')} ${String(c.actionableSuggestion || '')}`.toLowerCase();
            const kws = [...(c.keywords || []), ...(c.structuredKeywords || []), ...(c.discoveredTopics || [])]
                .map((k: any) => String(typeof k === 'string' ? k : k?.keyword || k?.name || '').toLowerCase().replace(/^#/, '').trim())
                .filter(Boolean);
            const threadKey = String(c.sourceLabel || c.source || '').toLowerCase().trim();

            nodeProfiles.forEach((prof) => {
                let matched = false;
                if (prof.labelNorm && (combinedText.includes(prof.labelNorm) || kws.some(k => k === prof.labelNorm || k.includes(prof.labelNorm) || prof.labelNorm.includes(k)))) {
                    matched = true;
                } else if (prof.tokens.length > 0) {
                    const hitCount = prof.tokens.filter(t => combinedText.includes(t) || kws.some(k => k.includes(t))).length;
                    if (hitCount >= Math.min(2, prof.tokens.length)) matched = true;
                }
                if (matched) {
                    prof.matchedComments.add(cIdx);
                    if (threadKey) prof.threads.add(threadKey);
                    kws.forEach(k => extractTokens(k).forEach(t => { prof.commentVocab.add(t); prof.stems.add(getStem(t)); }));
                }
            });
        });

        for (let i = 0; i < featureNodes.length; i++) {
            for (let j = i + 1; j < featureNodes.length; j++) {
                const nodeA = featureNodes[i];
                const nodeB = featureNodes[j];
                const profA = nodeProfiles.get(nodeA.id);
                const profB = nodeProfiles.get(nodeB.id);
                if (!profA || !profB) continue;

                let sharedComments = 0;
                profA.matchedComments.forEach(cIdx => { if (profB.matchedComments.has(cIdx)) sharedComments++; });
                const sharedTerms: string[] = [];
                profA.commentVocab.forEach(term => { if (profB.commentVocab.has(term) && sharedTerms.length < 3) sharedTerms.push(term); });
                let sharedFamily: string | null = null;
                profA.families.forEach(fam => { if (profB.families.has(fam) && !sharedFamily) sharedFamily = fam; });

                const score = (sharedComments * 18) + (sharedTerms.length * 14) + (sharedFamily ? 22 : 0);
                if (score < 22) continue;

                const crossCategory = (nodeA.category || '') !== (nodeB.category || '');
                const edgeSentiment: 'positive' | 'negative' | 'mixed' =
                    nodeA.sentiment === 'positive' && nodeB.sentiment === 'positive' ? 'positive' : nodeA.sentiment === 'negative' && nodeB.sentiment === 'negative' ? 'negative' : 'mixed';
                const kind = sharedComments > 0 ? 'comment-cooccurrence' : 'semantic-overlap';
                const reason = sharedComments > 0
                    ? `co_mentioned • Co-mentioned in ${sharedComments} comment${sharedComments === 1 ? '' : 's'}`
                    : `${crossCategory ? 'cross_category_bridge' : 'semantic_affinity'} • ${sharedFamily || `Shared vocabulary (#${sharedTerms.slice(0, 2).join(', #')})`}`;
                const badge = sharedComments > 0 ? `co_mentioned (${sharedComments})` : crossCategory ? 'cross_category_bridge' : 'semantic_affinity';

                addOrUpgradeLink({
                    source: nodeA.id,
                    target: nodeB.id,
                    weight: Math.min(26, Math.max(8, Math.round(score / 3))),
                    sentiment: edgeSentiment,
                    kind,
                    reason,
                    badge,
                    sharedComments
                });
            }
        }

        return Array.from(linkMap.values());
    }, [filteredNodes, stage4Data, stage3Data, stage2Data, rawComments]);

    const activeGraphFocusNodeId = hoveredNodeId || selectedNode?.id || null;

    const connectedNeighborIds = useMemo(() => {
        const set = new Set<string>();
        if (!activeGraphFocusNodeId) return set;
        set.add(activeGraphFocusNodeId);
        enhancedGraphLinks.forEach(l => {
            if (l.source === activeGraphFocusNodeId) set.add(l.target);
            else if (l.target === activeGraphFocusNodeId) set.add(l.source);
        });
        return set;
    }, [activeGraphFocusNodeId, enhancedGraphLinks]);

    const selectedNodeConnections = useMemo(() => {
        if (!selectedNode) return [];
        const nodeById = new Map<string, GraphNode>();
        (positionedNodes || []).forEach(n => nodeById.set(n.id, n));

        return enhancedGraphLinks
            .filter(l => l.source === selectedNode.id || l.target === selectedNode.id)
            .map(l => {
                const otherId = l.source === selectedNode.id ? l.target : l.source;
                const otherNode = nodeById.get(otherId);
                if (!otherNode) return null;
                return {
                    node: otherNode,
                    kind: l.kind,
                    reason: l.reason,
                    badge: l.badge,
                    weight: l.weight,
                    sharedComments: l.sharedComments || 0
                };
            })
            .filter((item): item is NonNullable<typeof item> => item !== null)
            .sort((a, b) => b.weight - a.weight);
    }, [selectedNode, enhancedGraphLinks, positionedNodes]);

    return {
        availableCategories,
        positionedNodes,
        filteredNodes,
        enhancedGraphLinks,
        activeGraphFocusNodeId,
        connectedNeighborIds,
        selectedNodeConnections
    };
};
