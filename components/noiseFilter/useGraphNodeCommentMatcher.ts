import { useMemo } from 'react';
import {
    RawComment, Stage3KeywordResult, NoiseFilterResult, GraphNode, getCommentYear
} from '../../services/noiseFilterService';
import {
    normalizeCategoryName, GRAPH_NODE_STOP_WORDS, computeHybridNodeScore
} from './languageAndGraphHelpers';

const matchCommentsForGraphNode = (targetNode: GraphNode, uniqueComments: any[]): any[] => {
    if (!targetNode || !Array.isArray(uniqueComments) || uniqueComments.length === 0) return [];

    if (targetNode.type === 'category' || targetNode.type === 'release') {
        const relKey = String(targetNode.id || '').toLowerCase().trim();
        const relLabel = normalizeCategoryName(String(targetNode.label || targetNode.category || '')).toLowerCase().trim();
        const relTokens = relLabel.split(/[^a-z0-9]+/).filter(w => w.length >= 4 && !GRAPH_NODE_STOP_WORDS.has(w));
        return uniqueComments.filter(c => {
            if (!c) return false;
            const cat = normalizeCategoryName(String(c.featureCategory || '')).toLowerCase().trim();
            const yr = String(getCommentYear(c) || '').toLowerCase().trim();
            if (cat && relLabel && (cat === relLabel || cat.includes(relLabel) || relLabel.includes(cat))) return true;
            if (relKey && yr === relKey) return true;
            if (relTokens.length > 0 && cat) {
                const catHits = relTokens.filter(t => cat.includes(t)).length;
                if (catHits >= Math.min(2, relTokens.length)) return true;
            }
            return false;
        });
    }

    const nodeLabel = String(targetNode.label || '').toLowerCase().replace(/^#/, '').trim();
    const nodeCat = normalizeCategoryName(String(targetNode.category || '')).toLowerCase().trim();
    const tokens = nodeLabel.split(/[^a-z0-9]+/).filter(w => w.length >= 3 && !GRAPH_NODE_STOP_WORDS.has(w));

    const scored = uniqueComments.map(c => {
        if (!c) return { comment: c, score: 0 };
        let score = 0;
        const raw = String(c.rawText || '').toLowerCase();
        const summary = String(c.constructiveSummary || '').toLowerCase();
        const suggestion = String(c.actionableSuggestion || '').toLowerCase();
        const cat = normalizeCategoryName(String(c.featureCategory || '')).toLowerCase().trim();
        const kws = [...(c.discoveredTopics || []), ...(c.keywords || [])]
            .map((k: any) => String(typeof k === 'string' ? k : k?.keyword || k?.name || '').toLowerCase().replace(/^#/, '').trim())
            .filter(k => k && normalizeCategoryName(k).toLowerCase() !== cat);

        if (nodeLabel && kws.some(k => k === nodeLabel || (nodeLabel.length >= 5 && k.length >= 4 && (k.includes(nodeLabel) || nodeLabel.includes(k))))) {
            score += 100;
        }
        if (nodeLabel.length >= 6 && (raw.includes(nodeLabel) || summary.includes(nodeLabel) || suggestion.includes(nodeLabel))) {
            score += 60;
        }

        let tokenHits = 0;
        tokens.forEach(t => {
            const inKw = kws.some(k => k.includes(t));
            const inText = raw.includes(t) || summary.includes(t) || suggestion.includes(t);
            if (inKw || inText) {
                tokenHits++;
                score += inKw ? 20 : 12;
            }
        });

        const minRequiredHits = tokens.length <= 1 ? 1 : 2;
        if (score < 60 && tokenHits < minRequiredHits) return { comment: c, score: 0 };
        if (cat && nodeCat && (nodeCat.includes(cat) || cat.includes(nodeCat))) score += 5;
        return { comment: c, score };
    });

    return scored.filter(s => s.score >= 20).sort((a, b) => b.score - a.score).map(s => s.comment);
};

export const groundGraphNodesWithComments = (
    rawNodes: GraphNode[],
    totalDataset: number,
    stage3Data: Stage3KeywordResult | null,
    allUniqueSignalComments: any[]
): GraphNode[] => {
    const featureScoredNodes = rawNodes.map(n => {
        const copy = { ...n };
        if (copy.type === 'category' || copy.type === 'release') return copy;

        const matchedComments = matchCommentsForGraphNode(copy, allUniqueSignalComments);
        const kw = (stage3Data?.topKeywords || []).find(k => {
            const kName = String(k.keyword || '').toLowerCase().trim();
            const lName = String(copy.label || '').toLowerCase().trim();
            return kName === lName || (kName.length >= 3 && (lName.includes(kName) || kName.includes(lName)));
        });

        const priorRatio = typeof copy.positiveRatio === 'number' && !Number.isNaN(copy.positiveRatio)
            ? copy.positiveRatio
            : typeof (kw as any)?.positiveRatio === 'number' ? (kw as any).positiveRatio : undefined;

        if (matchedComments.length > 0) {
            const pos = matchedComments.filter(c => c.sentiment === 'positive').length;
            const neg = matchedComments.filter(c => c.sentiment === 'negative').length;
            const neu = matchedComments.length - pos - neg;
            const hybrid = computeHybridNodeScore(pos, neg, neu, priorRatio, copy.sentiment);
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
            copy.mentionCount = (kw?.mentions && kw.mentions < totalDataset) ? kw.mentions : matchedComments.length;
        } else if (kw && (kw as any).sentimentBreakdown) {
            const { positive: pos = 0, negative: neg = 0, neutral: neu = 0 } = (kw as any).sentimentBreakdown;
            const hybrid = computeHybridNodeScore(pos, neg, neu, priorRatio, copy.sentiment);
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
            if (kw.mentions && kw.mentions < totalDataset) copy.mentionCount = kw.mentions;
        } else {
            const parentCluster = (stage3Data?.featureClusters || []).find(fc =>
                normalizeCategoryName(fc.category).toLowerCase() === normalizeCategoryName(copy.category || '').toLowerCase()
            );
            const { positive: pos = 0, negative: neg = 0, neutral: neu = 0 } = parentCluster?.sentimentBreakdown || {};
            const hybrid = computeHybridNodeScore(pos, neg, neu, priorRatio, copy.sentiment);
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
        }

        if (!copy.mentionCount || copy.mentionCount >= totalDataset) {
            copy.mentionCount = Math.max(12, Math.min(220, Math.round((copy.size || 18) * 4.2)));
        }
        return copy;
    });

    return featureScoredNodes.map(n => {
        const copy = { ...n };
        if (copy.type !== 'category' && copy.type !== 'release') return copy;

        const matchedComments = matchCommentsForGraphNode(copy, allUniqueSignalComments);
        const cluster = (stage3Data?.featureClusters || []).find(fc =>
            normalizeCategoryName(fc.category).toLowerCase() === normalizeCategoryName(copy.label).toLowerCase() ||
            normalizeCategoryName(fc.category).toLowerCase() === normalizeCategoryName(copy.category || '').toLowerCase()
        );
        const childFeatures = featureScoredNodes.filter(fn =>
            fn.type !== 'category' && fn.type !== 'release' &&
            normalizeCategoryName(fn.category || '').toLowerCase() === normalizeCategoryName(copy.label || copy.category || '').toLowerCase()
        );
        const avgChildRatio = childFeatures.length > 0
            ? Math.round(childFeatures.reduce((acc, fn) => acc + (fn.positiveRatio ?? 50), 0) / childFeatures.length)
            : undefined;

        const hubPrior = typeof copy.positiveRatio === 'number' && !Number.isNaN(copy.positiveRatio)
            ? copy.positiveRatio
            : copy.sentiment === 'positive' ? Math.max(avgChildRatio ?? 56, 56) : avgChildRatio;

        if (matchedComments.length > 0) {
            const pos = matchedComments.filter(c => c.sentiment === 'positive').length;
            const neg = matchedComments.filter(c => c.sentiment === 'negative').length;
            const neu = matchedComments.length - pos - neg;
            const hybrid = computeHybridNodeScore(pos, neg, neu, hubPrior, copy.sentiment);
            copy.mentionCount = matchedComments.length;
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
        } else if (cluster?.sentimentBreakdown) {
            const { positive: pos = 0, negative: neg = 0, neutral: neu = 0 } = cluster.sentimentBreakdown;
            const tot = pos + neg + neu;
            const hybrid = computeHybridNodeScore(pos, neg, neu, hubPrior, copy.sentiment);
            if (tot > 0) copy.mentionCount = tot;
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
        } else {
            const hybrid = computeHybridNodeScore(0, 0, 0, hubPrior, copy.sentiment);
            copy.positiveRatio = hybrid.positiveRatio;
            copy.sentiment = hybrid.sentiment;
        }

        if (!copy.mentionCount || copy.mentionCount >= totalDataset) {
            copy.mentionCount = matchedComments.length > 0 ? matchedComments.length : Math.max(25, Math.round(totalDataset * 0.22));
        }
        return copy;
    });
};

export const useUniqueSignalComments = (
    stage3Data: Stage3KeywordResult | null,
    stage4Data: NoiseFilterResult | null,
    rawComments: RawComment[]
) => {
    return useMemo(() => {
        const pool: any[] = [];
        if (stage3Data?.enrichedComments && Array.isArray(stage3Data.enrichedComments) && stage3Data.enrichedComments.length > 0) {
            pool.push(...stage3Data.enrichedComments);
        }
        if (stage4Data?.comments && Array.isArray(stage4Data.comments) && stage4Data.comments.length > 0) {
            pool.push(...stage4Data.comments);
        }
        if (rawComments && Array.isArray(rawComments) && rawComments.length > 0) {
            pool.push(...rawComments);
        }
        const keyToIndex = new Map<string, number>();
        const unique: any[] = [];
        pool.forEach(c => {
            if (!c || c.isNoise) return;
            if (c.sentiment !== 'positive' && c.sentiment !== 'negative' && c.sentiment !== 'neutral') return;
            const key = String(c.id || c.rawText || '').trim();
            if (!key) return;
            const existingIdx = keyToIndex.get(key);
            if (existingIdx === undefined) {
                keyToIndex.set(key, unique.length);
                unique.push(c);
            } else if (unique[existingIdx].sentiment === 'neutral' && c.sentiment !== 'neutral') {
                unique[existingIdx] = c;
            }
        });
        return unique;
    }, [stage3Data?.enrichedComments, stage4Data?.comments, rawComments]);
};

export const useGraphNodeCommentMatcher = ({
    selectedNode, positionedNodes, stage4Data, stage3Data, allUniqueSignalComments, rawComments
}: {
    selectedNode: GraphNode | null;
    positionedNodes: GraphNode[];
    stage4Data: NoiseFilterResult | null;
    stage3Data: Stage3KeywordResult | null;
    allUniqueSignalComments: any[];
    rawComments: RawComment[];
}) => {
    const selectedNodeComments = useMemo(() => {
        if (!selectedNode) return [];
        const matched = matchCommentsForGraphNode(selectedNode, allUniqueSignalComments);
        if (matched.length > 0) return matched;
        const nodeCat = normalizeCategoryName(String(selectedNode.category || selectedNode.label || '')).toLowerCase().trim();
        return allUniqueSignalComments
            .filter(c => {
                const cCat = normalizeCategoryName(String(c?.featureCategory || '')).toLowerCase().trim();
                return cCat && nodeCat && (nodeCat === cCat || nodeCat.includes(cCat) || cCat.includes(nodeCat));
            })
            .slice(0, 8);
    }, [selectedNode, allUniqueSignalComments]);

    const totalDatasetCount = stage4Data?.totalHarvested || allUniqueSignalComments.length || rawComments.length || 0;

    const effectiveNodeMetrics = useMemo(() => {
        if (!selectedNode) return { mentions: 0, positiveRatio: 50, percentageOfTotal: 0, posCount: 0, negCount: 0, neuCount: 0 };

        const groundedNode = positionedNodes.find(n => n.id === selectedNode.id) || selectedNode;
        const rawNodeFromStage4 = (stage4Data?.nodes || []).find(n => n.id === selectedNode.id);
        const priorRatio = typeof rawNodeFromStage4?.positiveRatio === 'number'
            ? rawNodeFromStage4.positiveRatio
            : typeof selectedNode.positiveRatio === 'number' ? selectedNode.positiveRatio : groundedNode.positiveRatio;
        const priorSentimentHint = rawNodeFromStage4?.sentiment || selectedNode.sentiment || groundedNode.sentiment;

        let mentions = groundedNode.mentionCount || selectedNode.mentionCount || 0;
        let positiveRatio = typeof groundedNode.positiveRatio === 'number' ? groundedNode.positiveRatio : selectedNode.positiveRatio;
        let posCount = 0;
        let negCount = 0;
        let neuCount = 0;

        if (selectedNodeComments.length > 0) {
            posCount = selectedNodeComments.filter(c => c.sentiment === 'positive').length;
            negCount = selectedNodeComments.filter(c => c.sentiment === 'negative').length;
            neuCount = selectedNodeComments.length - posCount - negCount;
            const tot = selectedNodeComments.length;
            positiveRatio = typeof groundedNode.positiveRatio === 'number' && !Number.isNaN(groundedNode.positiveRatio)
                ? groundedNode.positiveRatio
                : computeHybridNodeScore(posCount, negCount, neuCount, priorRatio, priorSentimentHint).positiveRatio;
            if (!mentions || (totalDatasetCount > 0 && mentions >= totalDatasetCount)) mentions = tot;
        } else {
            const kw = (stage3Data?.topKeywords || []).find(k => {
                const kName = String(k.keyword || '').toLowerCase().trim();
                const lName = String(selectedNode.label || '').toLowerCase().trim();
                return kName === lName || (kName.length >= 3 && (lName.includes(kName) || kName.includes(lName)));
            });
            if (kw) {
                if (kw.mentions && (totalDatasetCount === 0 || kw.mentions < totalDatasetCount)) mentions = kw.mentions;
                if ((kw as any).sentimentBreakdown) {
                    const { positive: pos = 0, negative: neg = 0, neutral: neu = 0 } = (kw as any).sentimentBreakdown;
                    if (pos + neg + neu > 0) {
                        posCount = pos; negCount = neg; neuCount = neu;
                        if (typeof groundedNode.positiveRatio !== 'number') {
                            positiveRatio = computeHybridNodeScore(pos, neg, neu, priorRatio, priorSentimentHint).positiveRatio;
                        }
                    }
                }
            }
        }

        if (!mentions || (totalDatasetCount > 0 && mentions >= totalDatasetCount)) {
            mentions = Math.max(1, selectedNodeComments.length || Math.round((groundedNode.size || 20) * 4));
        }
        positiveRatio = typeof positiveRatio === 'number' && !Number.isNaN(positiveRatio)
            ? Math.max(0, Math.min(100, Math.round(positiveRatio)))
            : 50;
        const percentageOfTotal = totalDatasetCount > 0 ? Math.max(1, Math.round((mentions / totalDatasetCount) * 100)) : 0;

        return { mentions, positiveRatio, percentageOfTotal, posCount, negCount, neuCount };
    }, [selectedNode, positionedNodes, stage4Data?.nodes, stage3Data, selectedNodeComments, totalDatasetCount]);

    return { selectedNodeComments, totalDatasetCount, effectiveNodeMetrics };
};
