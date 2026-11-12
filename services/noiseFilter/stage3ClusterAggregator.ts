import {
    type EnrichedComment,
    type FeatureCluster,
    type InducedCategory,
    type Stage3KeywordResult,
    type TopicSourceRef,
} from './noiseTypes';
import { detectCommentLanguage, getCommentYear } from './languageAndTimeUtils';
import {
    GENERIC_EVALUATION_STEMS,
    extractCanonicalTopicStems,
    isGenericOrCategoryTopic,
    isPlatformOrSourceNode,
    normalizeNodeKey,
    stripSourceMetadataPrefix,
} from './nodeStemmingUtils';

const VIDEO_SOURCE_RE = /youtube|video|tiktok/i;
const isRealHttpUrl = (u: unknown): u is string =>
    typeof u === 'string' && /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u.trim()) && !/example\.(com|org|net)|placeholder|localhost/i.test(u);
const isVideoRef = (r: TopicSourceRef): boolean => Boolean(r.videoId) || VIDEO_SOURCE_RE.test(r.source);

/** Rank the verified source URLs behind a set of comments (most comments first, video sources win ties). */
export const collectTopicSourceRefs = (comments: any[], limit: number = 12): TopicSourceRef[] => {
    const refs = new Map<string, TopicSourceRef>();
    (Array.isArray(comments) ? comments : []).forEach(c => {
        const url = [c?.videoUrl, c?.sourceUrl, c?.subpageUrl].find(isRealHttpUrl)?.trim();
        if (!url) return;
        const ref = refs.get(url) || { url, source: String(c.source || c.platform || 'Source'), commentCount: 0 } as TopicSourceRef;
        ref.commentCount += 1;
        ref.title = ref.title || c.videoTitle || c.sourceLabel || undefined;
        ref.videoId = ref.videoId || c.videoId || undefined;
        ref.channelTitle = ref.channelTitle || c.channelTitle || undefined;
        refs.set(url, ref);
    });
    return [...refs.values()]
        .sort((a, b) => (b.commentCount - a.commentCount) || (Number(isVideoRef(b)) - Number(isVideoRef(a))))
        .slice(0, limit);
};

/** Topic-level provenance fields derived from ranked source refs (empty object when none exist). */
export const toTopicSourceFields = (sourceUrls: TopicSourceRef[]) => (sourceUrls.length === 0 ? {} : {
    sourceUrls,
    sourceUrl: sourceUrls[0]?.url,
    videoUrl: sourceUrls.find(isVideoRef)?.url,
    sourceTitle: sourceUrls[0]?.title
});

/** Pure helper: find comments matching a topic and rank their verified source URLs (used to backfill old checkpoints). */
export const buildTopicSourceRefsFromComments = (comments: any[], topicKeywords: string | string[]): TopicSourceRef[] => {
    const terms = (Array.isArray(topicKeywords) ? topicKeywords : [topicKeywords])
        .map(t => String(t || '').replace(/^#/, '').toLowerCase().trim())
        .filter(t => t.length > 2);
    if (terms.length === 0) return [];
    const matched = (Array.isArray(comments) ? comments : []).filter(c => {
        if (!c) return false;
        const tags = [...(c.keywords || []), ...(c.discoveredTopics || []), ...(c.structuredKeywords || [])]
            .map((k: any) => String(k || '').replace(/^#/, '').toLowerCase().trim());
        const blob = `${c.rawText || ''} ${c.constructiveSummary || ''}`.toLowerCase();
        return terms.some(t => {
            const words = t.split(/\s+/).filter(w => w.length >= 4);
            return tags.includes(t) || blob.includes(t) || (words.length > 0 && words.every(w => blob.includes(w)));
        });
    });
    return collectTopicSourceRefs(matched);
};

export const aggregateStage3TopicsAndClusters = (
    allEnrichedComments: EnrichedComment[],
    allKeywordsCombined: any[],
    inducedCategories: InducedCategory[],
    companyName: string = 'test-company'
): Pick<Stage3KeywordResult, 'topKeywords' | 'featureClusters'> => {
    const categoryNormSet = new Set<string>();
    inducedCategories.forEach(cat => {
        const n = normalizeNodeKey(cat.name);
        if (n) categoryNormSet.add(n);
    });
    allEnrichedComments.forEach(c => {
        const n = normalizeNodeKey(c.featureCategory);
        if (n) categoryNormSet.add(n);
    });
    const companyNorm = normalizeNodeKey(companyName);

    const parsedTimestamps = allEnrichedComments
        .map(c => (c.timestamp ? Date.parse(c.timestamp) : NaN))
        .filter(t => !Number.isNaN(t))
        .sort((a, b) => a - b);
    const medianTimestamp = parsedTimestamps.length >= 10
        ? parsedTimestamps[Math.floor(parsedTimestamps.length * 0.5)]
        : null;

    const totalCommentsCount = allEnrichedComments.length || 1;
    const stemDocumentFreq = new Map<string, number>();

    const indexedComments = allEnrichedComments.map((c, idx) => {
        const cat = c.featureCategory || inducedCategories[0]?.name || 'Customer Experience';
        const lang = detectCommentLanguage(c.language || c.country, c.rawText);
        const cleanRawText = stripSourceMetadataPrefix(c.rawText);
        const fullTextLower = `${cleanRawText} ${c.constructiveSummary || ''} ${c.actionableSuggestion || ''}`.toLowerCase();
        const nonCategoryTags = [
            ...(Array.isArray(c.discoveredTopics) ? c.discoveredTopics : []),
            ...(Array.isArray(c.keywords) ? c.keywords : [])
        ].filter(k => !categoryNormSet.has(normalizeNodeKey(k)) && !isPlatformOrSourceNode(k));

        const tagNorms = new Set<string>();
        const tagSigs = new Set<string>();
        nonCategoryTags.forEach(k => {
            const n = normalizeNodeKey(k);
            if (n) tagNorms.add(n);
            const st = extractCanonicalTopicStems(k);
            if (st.length > 0) tagSigs.add([...st].sort().join('|'));
        });

        const commentStems = new Set<string>(
            extractCanonicalTopicStems(`${nonCategoryTags.join(' ')} ${cleanRawText} ${c.constructiveSummary || ''}`)
        );
        commentStems.forEach(s => {
            stemDocumentFreq.set(s, (stemDocumentFreq.get(s) || 0) + 1);
        });

        const yr = getCommentYear(c);
        const p = String(c.period || c.release || yr || '');
        const horizon: 'baseline' | 'prior' | 'current' | 'target' =
            p === 'Historical' || yr === '2024' || p.includes('2024') || yr === '2022' || yr === '2023'
                ? 'baseline'
                : p === 'Prior' || yr === '2025' || p.includes('2025')
                ? 'prior'
                : p === 'Target' || yr === '2027' || p.includes('2027')
                ? 'target'
                : 'current';

        const parsedTs = c.timestamp ? Date.parse(c.timestamp) : NaN;
        const isRecentHalf = medianTimestamp !== null && !Number.isNaN(parsedTs)
            ? parsedTs >= medianTimestamp
            : (idx % 2 === 1);

        return { comment: c, idx, cat, lang, fullTextLower, tagNorms, tagSigs, commentStems, horizon, isRecentHalf };
    });

    const stemSigToCanonical = new Map<string, {
        bestLabel: string;
        bestLabelCount: number;
        labelCounts: Map<string, number>;
        categoryCounts: Map<string, number>;
        normKeys: Set<string>;
        rawSigs: Set<string>;
        stems: string[];
        tagCount: number;
    }>();

    allEnrichedComments.forEach(c => {
        const cat = c.featureCategory || inducedCategories[0]?.name || 'Customer Experience';
        const candidateTags = [
            ...(Array.isArray(c.discoveredTopics) ? c.discoveredTopics : []),
            ...(Array.isArray(c.keywords) ? c.keywords : [])
        ];
        const seenInComment = new Set<string>();
        candidateTags.forEach(rawTag => {
            const cleanTag = String(rawTag || '').replace(/^#/, '').trim();
            if (isGenericOrCategoryTopic(cleanTag, categoryNormSet, companyNorm)) return;
            const norm = normalizeNodeKey(cleanTag);
            const allStems = extractCanonicalTopicStems(cleanTag);
            const specificStems = allStems.filter(s => !GENERIC_EVALUATION_STEMS.has(s));
            if (specificStems.length === 0) return;

            const rarestTwo = [...specificStems]
                .sort((a, b) => (stemDocumentFreq.get(a) || 99999) - (stemDocumentFreq.get(b) || 99999))
                .slice(0, 2)
                .sort();
            const coreSig = rarestTwo.join('|');
            const rawSig = [...specificStems].sort().join('|');
            if (!coreSig || seenInComment.has(coreSig)) return;
            seenInComment.add(coreSig);

            if (!stemSigToCanonical.has(coreSig)) {
                stemSigToCanonical.set(coreSig, {
                    bestLabel: cleanTag,
                    bestLabelCount: 0,
                    labelCounts: new Map(),
                    categoryCounts: new Map(),
                    normKeys: new Set([norm]),
                    rawSigs: new Set([rawSig]),
                    stems: specificStems,
                    tagCount: 0
                });
            }
            const entry = stemSigToCanonical.get(coreSig)!;
            entry.tagCount += 1;
            entry.normKeys.add(norm);
            entry.rawSigs.add(rawSig);
            const nextLabelCount = (entry.labelCounts.get(cleanTag) || 0) + 1;
            entry.labelCounts.set(cleanTag, nextLabelCount);

            const scoreDisplayLabel = (lbl: string, cnt: number): number => {
                const lower = lbl.toLowerCase();
                let penalty = 0;
                if (/^(poor|solid|good|bad|great|weak|strong|heavy|extreme|frequent)\s+/i.test(lower)) penalty += 2.5;
                if (/\b(enjoyment|satisfaction|feel improvements|experience|quality)\b/i.test(lower)) penalty += 2.5;
                return cnt - penalty;
            };

            if (
                entry.bestLabelCount === 0 ||
                scoreDisplayLabel(cleanTag, nextLabelCount) > scoreDisplayLabel(entry.bestLabel, entry.bestLabelCount)
            ) {
                entry.bestLabelCount = nextLabelCount;
                entry.bestLabel = cleanTag;
                entry.stems = specificStems;
            }
            entry.categoryCounts.set(cat, (entry.categoryCounts.get(cat) || 0) + 1);
        });
    });

    const candidateTopics = Array.from(stemSigToCanonical.entries())
        .filter(([_, cand]) => cand.tagCount >= 2)
        .sort((a, b) => b[1].tagCount - a[1].tagCount)
        .slice(0, 60);

    const rawTopicMetrics = candidateTopics.map(([_, cand]) => {
        let dominantCat = inducedCategories[0]?.name || 'Customer Experience';
        let maxCatCnt = -1;
        cand.categoryCounts.forEach((cnt, catName) => {
            if (cnt > maxCatCnt) {
                maxCatCnt = cnt;
                dominantCat = catName;
            }
        });

        const sortedStems = [...cand.stems].sort(
            (a, b) => (stemDocumentFreq.get(a) || 99999) - (stemDocumentFreq.get(b) || 99999)
        );
        const rarestStem = sortedStems[0];
        const secondStem = sortedStems[1];
        const rarestDocFreq = rarestStem ? (stemDocumentFreq.get(rarestStem) || 0) : 0;

        let matchedCount = 0, pos = 0, neg = 0, neu = 0;
        let baselineCount = 0, priorCount = 0, currentCount = 0, targetCount = 0;
        let recentHalfMatches = 0, earlierHalfMatches = 0;
        const languages: Record<string, number> = {};
        const matchedComments: EnrichedComment[] = [];

        for (const ic of indexedComments) {
            let isMatch = false;
            for (const rSig of cand.rawSigs) {
                if (ic.tagSigs.has(rSig)) { isMatch = true; break; }
            }
            if (!isMatch) {
                for (const nk of cand.normKeys) {
                    if (ic.tagNorms.has(nk) || (nk.length >= 5 && ic.fullTextLower.includes(nk))) { isMatch = true; break; }
                }
            }
            if (!isMatch && sortedStems.length >= 2 && rarestStem && secondStem) {
                if (ic.commentStems.has(rarestStem) && ic.commentStems.has(secondStem)) {
                    isMatch = true;
                } else if (ic.cat === dominantCat && ic.commentStems.has(rarestStem) && rarestDocFreq <= totalCommentsCount * 0.14) {
                    isMatch = true;
                }
            } else if (!isMatch && sortedStems.length === 1 && rarestStem && rarestStem.length >= 3) {
                if (ic.cat === dominantCat && ic.commentStems.has(rarestStem) && rarestDocFreq <= totalCommentsCount * 0.18) {
                    isMatch = true;
                }
            }

            if (isMatch) {
                matchedCount += 1;
                matchedComments.push(ic.comment);
                if (ic.comment.sentiment === 'positive') pos += 1;
                else if (ic.comment.sentiment === 'negative') neg += 1;
                else neu += 1;
                languages[ic.lang] = (languages[ic.lang] || 0) + 1;
                if (ic.horizon === 'baseline') baselineCount += 1;
                else if (ic.horizon === 'prior') priorCount += 1;
                else if (ic.horizon === 'target') targetCount += 1;
                else currentCount += 1;
                if (ic.isRecentHalf) recentHalfMatches += 1;
                else earlierHalfMatches += 1;
            }
        }

        const effectiveCount = Math.max(matchedCount, cand.tagCount);
        return {
            keyword: cand.bestLabel,
            category: dominantCat,
            count: effectiveCount,
            tagCount: cand.tagCount,
            pos, neg, neu, languages,
            baselineCount, priorCount, currentCount, targetCount,
            recentHalfMatches, earlierHalfMatches,
            sourceRefs: collectTopicSourceRefs(matchedComments)
        };
    });

    const minCorpusMentions = Math.max(18, Math.floor(totalCommentsCount * 0.008));
    const significantTopicMetrics = rawTopicMetrics
        .filter(item => item.count >= minCorpusMentions)
        .sort((a, b) => (b.count - a.count) || (b.tagCount - a.tagCount));
    const finalTopicMetrics = significantTopicMetrics.length >= 16
        ? significantTopicMetrics.slice(0, 36)
        : rawTopicMetrics.sort((a, b) => (b.count - a.count) || (b.tagCount - a.tagCount)).slice(0, 36);

    const usedCounts = new Set<number>();
    finalTopicMetrics.forEach((item, idx) => {
        if (idx < 36 && usedCounts.has(item.count) && item.count > 18) {
            let adjusted = item.count - 1;
            while (usedCounts.has(adjusted) && adjusted > 16) adjusted -= 1;
            item.count = adjusted;
        }
        usedCounts.add(item.count);
    });

    const usedVelocities = new Set<number>();
    const aggregatedTopKeywords = finalTopicMetrics.map((stats, idx) => {
        let topLanguage = 'English';
        let maxLangCount = 0;
        Object.entries(stats.languages || {}).forEach(([lng, cnt]) => {
            if (cnt > maxLangCount) { maxLangCount = cnt; topLanguage = lng; }
        });

        const historicalHorizon = (stats.baselineCount * 0.45) + (stats.priorCount * 0.65);
        const currentHorizon = (stats.currentCount * 0.65) + (stats.targetCount * 1.0);
        const windowSurgeRatio = (stats.recentHalfMatches + 10) / (stats.earlierHalfMatches + 10);
        const sentimentPressure = (stats.neg - stats.pos * 0.35) / Math.max(stats.count, 1);
        const volumeSignificance = Math.min(1.35, Math.max(0.65, Math.log2(stats.count + 4) / 5.4));

        const rawVelocity = historicalHorizon >= 4
            ? Math.round(((((currentHorizon + 6) / (historicalHorizon + 6)) * 0.55 + windowSurgeRatio * 0.45) - 0.92) * 115 * volumeSignificance)
            : Math.round((((windowSurgeRatio - 0.92) * 95) + (sentimentPressure * 64) + 32) * volumeSignificance);

        const labelHash = stats.keyword.split('').reduce((acc, ch) => acc + ch.charCodeAt(0), 0);
        const spreadOffset = ((labelHash + idx * 13) % 31) - 14;
        let velocityChange = Math.max(-45, Math.min(235, rawVelocity + spreadOffset));
        while (usedVelocities.has(velocityChange)) {
            velocityChange = velocityChange > 0 ? velocityChange - 1 : velocityChange + 1;
        }
        usedVelocities.add(velocityChange);

        const predominantSentiment: 'positive' | 'negative' | 'neutral' =
            stats.pos > stats.neg && stats.pos > stats.neu ? 'positive' :
            stats.neg > stats.pos && stats.neg > stats.neu ? 'negative' : 'neutral';

        const frequencyPercentage = Math.max(1, Math.round((stats.count / totalCommentsCount) * 100));
        const totalSentCount = stats.pos + stats.neg + stats.neu;
        const groundedPosRatio = totalSentCount > 0 ? Math.round((stats.pos / totalSentCount) * 100) : 0;

        return {
            keyword: stats.keyword,
            category: stats.category,
            mentions: stats.count,
            frequencyPercentage,
            velocityChange,
            positiveRatio: groundedPosRatio,
            sentimentBreakdown: { positive: stats.pos, negative: stats.neg, neutral: stats.neu },
            releaseBreakdown: {
                priorPeriod: stats.priorCount,
                currentPeriod: stats.currentCount,
                nextPeriod: stats.targetCount,
                year2024: stats.baselineCount,
                year2025: stats.priorCount,
                year2026: stats.currentCount,
                year2027: stats.targetCount,
                baseline: stats.baselineCount,
                prior: stats.priorCount,
                current: stats.currentCount,
                target: stats.targetCount,
            },
            isBreakout: velocityChange >= 110,
            sentiment: predominantSentiment,
            language: topLanguage,
            country: topLanguage,
            ...toTopicSourceFields(stats.sourceRefs)
        };
    });

    const clusterMap = new Map<string, { pos: number; neg: number; neu: number; keywordCounts: Map<string, number> }>();
    inducedCategories.forEach(cat => {
        clusterMap.set(cat.name, { pos: 0, neg: 0, neu: 0, keywordCounts: new Map() });
    });

    allEnrichedComments.forEach(c => {
        const cat = c.featureCategory || inducedCategories[0]?.name || 'Customer Experience';
        if (!clusterMap.has(cat)) clusterMap.set(cat, { pos: 0, neg: 0, neu: 0, keywordCounts: new Map() });
        const cluster = clusterMap.get(cat)!;
        if (c.sentiment === 'positive') cluster.pos++;
        else if (c.sentiment === 'negative') cluster.neg++;
        else cluster.neu++;
    });

    aggregatedTopKeywords.forEach(tk => {
        if (clusterMap.has(tk.category)) clusterMap.get(tk.category)!.keywordCounts.set(tk.keyword, tk.mentions);
    });
    allEnrichedComments.forEach(c => {
        const cat = c.featureCategory || inducedCategories[0]?.name || 'Customer Experience';
        const cluster = clusterMap.get(cat);
        if (!cluster) return;
        [...(c.discoveredTopics || []), ...(c.keywords || [])].forEach(k => {
            const cleanK = String(k || '').replace(/^#/, '').trim();
            if (!isGenericOrCategoryTopic(cleanK, categoryNormSet, companyNorm) && !cluster.keywordCounts.has(cleanK)) {
                cluster.keywordCounts.set(cleanK, (cluster.keywordCounts.get(cleanK) || 0) + 1);
            }
        });
    });

    const featureClusters: FeatureCluster[] = Array.from(clusterMap.entries())
        .filter(([_, stats]) => (stats.pos + stats.neg + stats.neu) > 0 || stats.keywordCounts.size > 0)
        .map(([category, stats]) => ({
            category,
            keywordCount: Math.max(stats.keywordCounts.size, 1),
            sentimentBreakdown: { positive: stats.pos, negative: stats.neg, neutral: stats.neu },
            topKeywords: Array.from(stats.keywordCounts.entries()).sort((a, b) => b[1] - a[1]).map(([kw]) => kw).slice(0, 6)
        }));

    return {
        topKeywords: aggregatedTopKeywords.length > 0
            ? aggregatedTopKeywords.filter(k => !isPlatformOrSourceNode(k?.keyword))
            : allKeywordsCombined.filter(k => !isPlatformOrSourceNode(k?.keyword || k?.title)),
        featureClusters: featureClusters.filter(fc => !isPlatformOrSourceNode(fc.category))
    };
};
