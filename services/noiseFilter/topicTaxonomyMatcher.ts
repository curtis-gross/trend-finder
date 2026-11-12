export interface TopicTaxonomyCandidates {
    categories?: string[];
    featureClusters?: Array<{ category: string; topKeywords?: string[]; keywords?: string[] }>;
    topTopics?: Array<{ title: string; category?: string }>;
    risingTopics?: Array<{ title: string; category?: string }>;
    topKeywords?: Array<string | { keyword?: string; title?: string }>;
}

/**
 * Intelligent topic resolver that matches a deep-link or trending topic candidate
 * against active taxonomy pillars, top/rising topics, or keyword clusters using exact match,
 * substring containment, and token overlap scoring.
 */
export function matchTopicToTaxonomy(
    targetTopic: string | null | undefined,
    candidates: TopicTaxonomyCandidates
): string {
    if (!targetTopic || typeof targetTopic !== 'string') return '';
    const cleanTarget = targetTopic.replace(/^#/, '').trim().toLowerCase();
    if (!cleanTarget) return targetTopic;

    const clusters = candidates.featureClusters || [];
    const topT = candidates.topTopics || [];
    const riseT = candidates.risingTopics || [];
    const allTopics = [...topT, ...riseT];
    const categories = [
        ...(candidates.categories || []),
        ...clusters.map(c => c.category)
    ].filter(Boolean);

    const extractKwStr = (k: any): string => {
        if (!k) return '';
        if (typeof k === 'string') return k;
        return k.keyword || k.title || '';
    };

    const clusterKeywords: string[] = [];
    clusters.forEach(c => {
        const kws = Array.isArray(c.topKeywords) ? c.topKeywords : Array.isArray(c.keywords) ? c.keywords : [];
        kws.forEach(k => {
            const s = extractKwStr(k);
            if (s) clusterKeywords.push(s);
        });
    });

    const topKeywordsList = (candidates.topKeywords || []).map(extractKwStr).filter(Boolean);
    const allKeywords = [...clusterKeywords, ...topKeywordsList];

    // 1. Direct exact match check (case-insensitive)
    for (const cat of categories) {
        if (String(cat ?? '').toLowerCase().trim() === cleanTarget) return cat;
    }
    for (const t of allTopics) {
        if (String(t?.title ?? '').toLowerCase().trim() === cleanTarget) return t.title;
    }
    for (const kw of allKeywords) {
        const kwStr = String(kw ?? '');
        if (kwStr.replace(/^#/, '').toLowerCase().trim() === cleanTarget) {
            return kwStr.replace(/^#/, '').trim();
        }
    }

    // 2. Direct Substring / Containment match
    for (const cat of categories) {
        const cLower = String(cat ?? '').toLowerCase().trim();
        if (cLower && (cleanTarget.includes(cLower) || cLower.includes(cleanTarget))) {
            return cat;
        }
    }
    for (const t of allTopics) {
        const tLower = String(t?.title ?? '').toLowerCase().trim();
        if (tLower && (cleanTarget.includes(tLower) || tLower.includes(cleanTarget))) {
            return t.title;
        }
    }
    for (const kw of allKeywords) {
        const kwStr = String(kw ?? '');
        const cleanKw = kwStr.replace(/^#/, '').toLowerCase().trim();
        if (cleanKw && (cleanTarget.includes(cleanKw) || cleanKw.includes(cleanTarget))) {
            return kwStr.replace(/^#/, '').trim();
        }
    }

    // 3. Token Overlap Scoring
    const STOP_WORDS = new Set([
        'and', 'the', 'in', 'of', 'for', 'to', 'a', 'an', 'on', 'with', 'by', 'at', 'from',
        'or', 'is', 'it', 'this', 'that', '&', '/', '-', 'vs', 'via', 'into', 'over'
    ]);
    const extractTokens = (str?: string | null): string[] =>
        String(str ?? '')
            .toLowerCase()
            .replace(/[^a-z0-9\s]/g, ' ')
            .split(/\s+/)
            .filter(w => w.length >= 2 && !STOP_WORDS.has(w));

    const targetTokens = new Set(extractTokens(cleanTarget));
    if (targetTokens.size === 0) return targetTopic;

    let bestMatch = '';
    let highestScore = 0;

    const scoreCandidate = (candName?: string | null): number => {
        const candTokens = extractTokens(candName);
        let score = 0;
        for (const tok of candTokens) {
            if (targetTokens.has(tok)) {
                score += 2;
            } else {
                for (const targetTok of targetTokens) {
                    if (
                        (tok.length >= 4 && targetTok.length >= 4) &&
                        (tok.startsWith(targetTok.slice(0, 4)) || targetTok.startsWith(tok.slice(0, 4)))
                    ) {
                        score += 1;
                        break;
                    }
                }
            }
        }
        return score;
    };

    for (const kw of allKeywords) {
        const score = scoreCandidate(kw);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = String(kw ?? '').replace(/^#/, '').trim();
        }
    }

    for (const t of allTopics) {
        const score = scoreCandidate(t?.title);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = t.title;
        }
    }

    for (const cat of categories) {
        const score = scoreCandidate(cat);
        if (score > highestScore) {
            highestScore = score;
            bestMatch = cat;
        }
    }

    if (highestScore > 0 && bestMatch) {
        return bestMatch;
    }

    return targetTopic;
}
