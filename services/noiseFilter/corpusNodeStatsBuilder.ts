import { type GraphNode, type Stage3Output } from './noiseTypes';
import { isPlatformOrSourceNode, normalizeNodeKey } from './nodeStemmingUtils';

const GENERIC_NODE_STOPWORDS = new Set([
    'and', 'for', 'the', 'with', 'product', 'service', 'quality',
    'value', 'issue', 'new', 'day', 'one', 'loop'
]);

export const classifyHybridNodeSentiment = (ratio: number): 'positive' | 'negative' | 'mixed' => {
    return ratio >= 50 ? 'positive' : ratio < 36 ? 'negative' : 'mixed';
};

const computeHybridNodeRatio = (
    pos: number,
    neg: number,
    neu: number,
    node?: { positiveRatio?: number; sentiment?: string; _priorPositiveRatio?: number; _priorSentiment?: string }
): number | undefined => {
    const tot = pos + neg + neu;
    if (tot <= 0) return undefined;
    const empConst = Math.round(((pos + 0.5 * neu) / tot) * 100);
    const empPol = (pos + neg) > 0 ? Math.round((pos / (pos + neg)) * 100) : empConst;
    const rawPrior = typeof node?._priorPositiveRatio === 'number'
        ? node._priorPositiveRatio
        : node?.positiveRatio;
    const rawPriorSentiment = node?._priorSentiment ?? node?.sentiment;
    if (typeof rawPrior === 'number' && rawPrior > 0) {
        const priorRatio = Math.max(0, Math.min(100, Math.round(rawPrior)));
        const emp = (priorRatio >= 50 || rawPriorSentiment === 'positive')
            ? Math.max(empConst, empPol)
            : empConst;
        const w = Math.min(tot, 25);
        return Math.round((w * emp + 25 * priorRatio) / (w + 25));
    }
    return empConst;
};

/**
 * Computes corpus-grounded positiveRatio (0-100) and mentionCount for a graph node
 * directly from matching enrichedComments, topKeywords.sentimentBreakdown, or featureClusters
 * using the Hybrid Aspect-Polarity + Constructive Neutral Credit formula with Bayesian prior shrinkage (k = 25).
 */
export const computeCorpusGroundedNodeStats = (
    nodeLabel: string,
    nodeCategory: string | undefined,
    isCategoryHub: boolean,
    stage3Data?: Stage3Output | null,
    node?: { positiveRatio?: number; sentiment?: string; _priorPositiveRatio?: number; _priorSentiment?: string }
): { mentionCount?: number; positiveRatio?: number; sentiment?: 'positive' | 'negative' | 'mixed' } => {
    const comments = Array.isArray(stage3Data?.enrichedComments) ? stage3Data!.enrichedComments : [];
    const labelLower = String(nodeLabel || '').toLowerCase().trim();
    const catLower = String(nodeCategory || '').toLowerCase().trim();

    if (isCategoryHub) {
        const cluster = (stage3Data?.featureClusters || []).find(fc => {
            const fcCat = String(fc?.category || '').toLowerCase().trim();
            return fcCat === labelLower || (catLower && fcCat === catLower);
        });
        if (cluster?.sentimentBreakdown) {
            const pos = cluster.sentimentBreakdown.positive || 0;
            const neg = cluster.sentimentBreakdown.negative || 0;
            const neu = cluster.sentimentBreakdown.neutral || 0;
            const tot = pos + neg + neu;
            if (tot > 0) {
                const ratio = computeHybridNodeRatio(pos, neg, neu, node);
                return {
                    mentionCount: tot,
                    positiveRatio: ratio,
                    sentiment: classifyHybridNodeSentiment(ratio)
                };
            }
        }
        const catMatches = comments.filter(c => {
            const cCat = String(c?.featureCategory || '').toLowerCase().trim();
            return cCat && labelLower && (cCat === labelLower || cCat.includes(labelLower) || labelLower.includes(cCat));
        });
        if (catMatches.length > 0) {
            const pos = catMatches.filter(c => c.sentiment === 'positive').length;
            const neg = catMatches.filter(c => c.sentiment === 'negative').length;
            const neu = Math.max(0, catMatches.length - pos - neg);
            const ratio = computeHybridNodeRatio(pos, neg, neu, node);
            return {
                mentionCount: catMatches.length,
                positiveRatio: ratio,
                sentiment: classifyHybridNodeSentiment(ratio)
            };
        }
        return {};
    }

    const kw: any = (stage3Data?.topKeywords || []).find(k => {
        const kStr = String(k?.keyword || '').toLowerCase().trim();
        return kStr === labelLower || (kStr.length >= 3 && !GENERIC_NODE_STOPWORDS.has(kStr) && (labelLower.includes(kStr) || kStr.includes(labelLower)));
    });
    if (kw?.sentimentBreakdown) {
        const pos = kw.sentimentBreakdown.positive || 0;
        const neg = kw.sentimentBreakdown.negative || 0;
        const neu = kw.sentimentBreakdown.neutral || 0;
        const tot = pos + neg + neu;
        if (tot > 0) {
            const ratio = computeHybridNodeRatio(pos, neg, neu, node);
            return {
                mentionCount: kw.mentions || tot,
                positiveRatio: ratio,
                sentiment: classifyHybridNodeSentiment(ratio)
            };
        }
    }

    if (comments.length > 0 && labelLower) {
        const tokens = labelLower
            .split(/[^a-z0-9]+/)
            .filter(w => w.length >= 3 && !GENERIC_NODE_STOPWORDS.has(w));
        const matchingComments = comments.filter(c => {
            if (!c) return false;
            const raw = String(c.rawText || '').toLowerCase();
            const summary = String(c.constructiveSummary || '').toLowerCase();
            const suggestion = String(c.actionableSuggestion || '').toLowerCase();
            const kws = [
                ...(c.keywords || []),
                ...(c.structuredKeywords || []),
                ...(c.discoveredTopics || [])
            ].map((k: any) => String(typeof k === 'string' ? k : k?.keyword || k?.name || '').toLowerCase());
            if (kws.some(k => k === labelLower || (k.length >= 3 && !GENERIC_NODE_STOPWORDS.has(k) && (k.includes(labelLower) || labelLower.includes(k))))) return true;
            if (labelLower.length >= 3 && !GENERIC_NODE_STOPWORDS.has(labelLower) && (raw.includes(labelLower) || summary.includes(labelLower) || suggestion.includes(labelLower))) return true;
            if (tokens.length > 0) {
                let hit = 0;
                for (const t of tokens) {
                    if (kws.some(k => k.includes(t)) || raw.includes(t) || summary.includes(t)) hit++;
                }
                if (hit >= Math.min(2, tokens.length)) return true;
            }
            return false;
        });

        if (matchingComments.length > 0) {
            const pos = matchingComments.filter(c => c.sentiment === 'positive').length;
            const neg = matchingComments.filter(c => c.sentiment === 'negative').length;
            const neu = Math.max(0, matchingComments.length - pos - neg);
            const ratio = computeHybridNodeRatio(pos, neg, neu, node);
            return {
                mentionCount: kw?.mentions || matchingComments.length,
                positiveRatio: ratio,
                sentiment: classifyHybridNodeSentiment(ratio)
            };
        }
    }

    if (typeof kw?.positiveRatio === 'number') {
        const empConst = Math.max(0, Math.min(100, Math.round(kw.positiveRatio)));
        const rawPrior = typeof node?._priorPositiveRatio === 'number'
            ? node._priorPositiveRatio
            : node?.positiveRatio;
        const tot = Math.max(0, Number(kw?.mentions) || 0);
        const ratio = (tot > 0 && typeof rawPrior === 'number' && rawPrior > 0)
            ? Math.round((Math.min(tot, 25) * empConst + 25 * Math.max(0, Math.min(100, Math.round(rawPrior)))) / (Math.min(tot, 25) + 25))
            : empConst;
        return {
            mentionCount: tot,
            positiveRatio: ratio,
            sentiment: classifyHybridNodeSentiment(ratio)
        };
    }

    return {};
};

/**
 * Ensures Category Hubs and top Stage 3 discovered topics exist in the node set
 * so link enrichment always has a full, grounded node topology.
 */
export const ensureTopicNodesHydrated = (
    nodes: GraphNode[],
    categoryHubs: GraphNode[],
    stage3Data?: Stage3Output | null,
    totalHarvested: number = 0
): GraphNode[] => {
    const result: GraphNode[] = (Array.isArray(nodes) ? nodes : [])
        .filter(n => n && !isPlatformOrSourceNode(n.id) && !isPlatformOrSourceNode(n.label))
        .map(n => {
            const isCat = n.type === 'category' || n.type === 'release';
            const grounded = computeCorpusGroundedNodeStats(n.label || n.id, n.category, isCat, stage3Data, n as any);
            const positiveRatio = typeof grounded.positiveRatio === 'number'
                ? grounded.positiveRatio
                : typeof n.positiveRatio === 'number'
                ? Math.max(0, Math.min(100, Math.round(n.positiveRatio)))
                : undefined;
            const mentionCount = typeof grounded.mentionCount === 'number' && grounded.mentionCount > 0
                ? (totalHarvested > 0 ? Math.min(totalHarvested, grounded.mentionCount) : grounded.mentionCount)
                : (typeof n.mentionCount === 'number' ? n.mentionCount : 0);
            const sentiment = grounded.sentiment
                || (typeof positiveRatio === 'number' ? classifyHybridNodeSentiment(positiveRatio) : n.sentiment);
            return {
                ...n,
                ...(typeof positiveRatio === 'number' ? { positiveRatio } : {}),
                mentionCount,
                sentiment
            };
        });
    const seenKeys = new Set<string>();

    result.forEach(n => {
        if (n.id) seenKeys.add(normalizeNodeKey(n.id));
        if (n.label) seenKeys.add(normalizeNodeKey(n.label));
    });

    for (const hub of categoryHubs) {
        if (isPlatformOrSourceNode(hub.id) || isPlatformOrSourceNode(hub.label)) continue;
        const idKey = normalizeNodeKey(hub.id);
        const labelKey = normalizeNodeKey(hub.label);
        if (!seenKeys.has(idKey) && !seenKeys.has(labelKey)) {
            result.unshift({ ...hub });
            seenKeys.add(idKey);
            seenKeys.add(labelKey);
        }
    }

    const featureCount = result.filter(n => n.type !== 'category' && n.type !== 'release').length;
    if (featureCount < 35 && stage3Data?.topKeywords && stage3Data.topKeywords.length > 0) {
        const defaultCategory = categoryHubs[0]?.id || 'General';
        for (const kwObj of stage3Data.topKeywords.slice(0, 45)) {
            const rawKw = String((kwObj as any).keyword || (kwObj as any).title || '').trim();
            if (!rawKw || isPlatformOrSourceNode(rawKw)) continue;
            const kwKey = normalizeNodeKey(rawKw);
            if (!kwKey || seenKeys.has(kwKey)) continue;

            const rawCategory = (kwObj as any).category || defaultCategory;
            const category = isPlatformOrSourceNode(rawCategory) ? defaultCategory : rawCategory;
            const grounded = computeCorpusGroundedNodeStats(rawKw, category, false, stage3Data, kwObj as any);
            const mentions = typeof grounded.mentionCount === 'number'
                ? grounded.mentionCount
                : (Number((kwObj as any).mentions ?? (kwObj as any).count) || 0);
            const positiveRatio = typeof grounded.positiveRatio === 'number'
                ? grounded.positiveRatio
                : typeof (kwObj as any).positiveRatio === 'number'
                ? Math.round((kwObj as any).positiveRatio)
                : undefined;
            const sentiment: 'positive' | 'negative' | 'neutral' | 'mixed' | undefined =
                grounded.sentiment || (typeof positiveRatio === 'number' ? classifyHybridNodeSentiment(positiveRatio) : ((kwObj as any).sentiment as any));

            result.push({
                id: rawKw,
                label: rawKw,
                type: 'feature',
                category,
                tier: mentions >= 18 ? 'core' : 'micro',
                sentiment,
                size: Math.max(14, Math.min(30, 14 + Math.round(Math.sqrt(Math.max(0, mentions)) * 2.2))),
                mentionCount: totalHarvested > 0 ? Math.min(totalHarvested, Math.max(0, mentions)) : Math.max(0, mentions),
                ...(typeof positiveRatio === 'number' ? { positiveRatio } : {}),
                releaseDistribution: (kwObj as any).releaseBreakdown || undefined
            });
            seenKeys.add(kwKey);
        }
    }

    return result;
};
