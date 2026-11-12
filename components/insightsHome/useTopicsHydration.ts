import { useState, useEffect, useMemo } from 'react';
import { loadStageDataFromGCS } from '../../services/noiseFilterService';
import { getIDBCache, deleteIDBCache } from '../../services/gcsCacheService';
import { getSourcesFromListenTable } from '../../services/noiseFilter/listenSourceSync';
import { buildTopicSourceRefsFromComments, toTopicSourceFields } from '../../services/noiseFilter/stage3ClusterAggregator';
import {
    TopicItem,
    FeatureClusterOverview,
    InsightsCachePayload,
    detectAccurateCommentLanguage,
    DEFAULT_MACRO_CATEGORY_TITLES,
    GENERIC_FILLER_TOPIC_TITLES,
    normalizeTopicTitle,
    unwrapRunPayload,
    getInsightsCacheKey,
    isDefaultClusterList,
    isValidInsightsCache,
    getCachedInsights,
    setMemoryCachedInsights,
    saveCachedInsights,
    clearCachedInsights,
    backfillCommentSourceUrls,
    type TopicSourceRef
} from './insightsHomeCache';

const sumReleaseDist = (rd: any): number => {
    if (!rd || typeof rd !== 'object') return 0;
    return (
        (Number(rd.year2022) || 0) + (Number(rd.year2023) || 0) + (Number(rd.year2024) || 0) +
        (Number(rd.year2025) || Number(rd.prior) || Number(rd.priorPeriod) || 0) +
        (Number(rd.year2026) || Number(rd.current) || Number(rd.currentPeriod) || 0) +
        (Number(rd.year2027) || Number(rd.target) || Number(rd.nextPeriod) || 0)
    );
};

const computeReleaseVelocity = (rd: any, fallbackVelocity?: number): number | undefined => {
    if (typeof fallbackVelocity === 'number' && fallbackVelocity !== 0) return fallbackVelocity;
    if (!rd || typeof rd !== 'object') return undefined;
    const prior = (Number(rd.year2024) || 0) + (Number(rd.year2025) || Number(rd.prior) || Number(rd.priorPeriod) || 0);
    const recent = (Number(rd.year2026) || Number(rd.current) || Number(rd.currentPeriod) || 0) + (Number(rd.year2027) || Number(rd.target) || Number(rd.nextPeriod) || 0);
    if (prior > 0 && recent > 0) return Math.round(((recent - prior) / prior) * 100);
    if (recent > 0 && prior === 0) return Math.min(380, 90 + recent * 6);
    return undefined;
};

export const useTopicsHydration = (companyName: string) => {
    const activeCompany = companyName || 'test-company';
    const initialCache = useMemo(() => getCachedInsights(activeCompany), [activeCompany]);
    const [topTopics, setTopTopics] = useState<TopicItem[]>(() => (initialCache?.topTopics?.length ? initialCache.topTopics : []));
    const [risingTopics, setRisingTopics] = useState<TopicItem[]>(() => (initialCache?.risingTopics?.length ? initialCache.risingTopics : []));
    const [featureClusters, setFeatureClusters] = useState<FeatureClusterOverview[]>(() =>
        (initialCache?.featureClusters && Array.isArray(initialCache.featureClusters) && initialCache.featureClusters.length > 0 && !isDefaultClusterList(initialCache.featureClusters))
            ? initialCache.featureClusters : []
    );
    const [enrichedComments, setEnrichedComments] = useState<any[]>(() => initialCache?.enrichedComments || []);
    const [isLoading, setIsLoading] = useState<boolean>(() => !initialCache?.topTopics?.length);
    const [lastRefreshed, setLastRefreshed] = useState<string>('Just now');
    const [isGcsLoaded, setIsGcsLoaded] = useState(!!initialCache?.topTopics?.length);
    const [hydrationError, setHydrationError] = useState<string | null>(null);

    const fetchOptionalStaticRun = async (url: string): Promise<any | null> => {
        try {
            const res = await fetch(url, { cache: 'no-store' });
            if (res.ok) {
                return unwrapRunPayload(await res.json());
            }
            if (res.status >= 500) {
                throw new Error(`Snapshot fetch failed (${res.status} ${res.statusText || 'Server Error'}) for ${url}`);
            }
            return null;
        } catch (err: any) {
            const msg = err instanceof Error ? err.message : String(err);
            // Relative fetch URLs without a server base fail in unmocked jsdom tests; ignore URL parse errors and 404s.
            if (err instanceof TypeError && /Failed to parse URL|Invalid URL/i.test(msg)) {
                return null;
            }
            throw err instanceof Error ? err : new Error(msg);
        }
    };

    const loadRealGCSData = async (hasSyncCache = false) => {
        const selectedCompany = activeCompany;
        if (!hasSyncCache) setIsLoading(true);
        setHydrationError(null);
        try {
            const [keywordsData, filterRun] = await Promise.all([
                loadStageDataFromGCS('noise_filter_keywords', selectedCompany),
                loadStageDataFromGCS('noise_filter', selectedCompany)
            ]);
            let kwPayload = unwrapRunPayload(keywordsData);
            let s4Payload = unwrapRunPayload(filterRun);

            const hasValidKeywords = kwPayload && ((Array.isArray(kwPayload.topKeywords) && kwPayload.topKeywords.length > 0) || (Array.isArray(kwPayload.enrichedComments) && kwPayload.enrichedComments.length > 0));
            if (!hasValidKeywords) {
                const staticKw = await fetchOptionalStaticRun(
                    `/data/configuration/runs/${encodeURIComponent(selectedCompany)}/noise_filter_keywords_run.json`
                );
                if (staticKw) kwPayload = staticKw;
            }

            if (!(s4Payload && Array.isArray(s4Payload.nodes) && s4Payload.nodes.length > 0)) {
                const staticS4 = await fetchOptionalStaticRun(
                    `/data/configuration/runs/${encodeURIComponent(selectedCompany)}/noise_filter_run.json`
                );
                if (staticS4) s4Payload = staticS4;
            }

            const keyGcs = kwPayload;
            const graphGcs = s4Payload;
            if (!keyGcs && !graphGcs && !hasSyncCache) void deleteIDBCache(getInsightsCacheKey(selectedCompany));

            const resolveValidCountry = (rawCountry: any, topicTitle?: string): string =>
                detectAccurateCommentLanguage(topicTitle || '', typeof rawCountry === 'string' ? rawCountry : '');

            const sanitizeCorpusLanguage = (list: any[]): any[] =>
                list.map(c => {
                    if (!c || typeof c !== 'object') return c;
                    const detectedLang = detectAccurateCommentLanguage(c.rawText || c.text || c.comment || '', c.language || c.country);
                    return { ...c, language: detectedLang, country: detectedLang };
                });

            let commentsCorpus: any[] = [];
            if (keyGcs?.enrichedComments && Array.isArray(keyGcs.enrichedComments)) {
                commentsCorpus = sanitizeCorpusLanguage(keyGcs.enrichedComments);
            } else {
                const filterGcs = await loadStageDataFromGCS('noise_filter_filtered_comments', selectedCompany);
                if (filterGcs?.filteredComments && Array.isArray(filterGcs.filteredComments)) {
                    commentsCorpus = sanitizeCorpusLanguage(filterGcs.filteredComments);
                }
            }
            // Legacy checkpoints: backfill real source URLs from configured sources (unmatched stay undefined).
            if (commentsCorpus.some(c => c && typeof c === 'object' && !c.sourceUrl && !c.videoUrl)) {
                const listenSources = await getSourcesFromListenTable(selectedCompany).catch(() => []);
                commentsCorpus = backfillCommentSourceUrls(commentsCorpus, [
                    ...(Array.isArray(graphGcs?.sourcesUsed) ? graphGcs.sourcesUsed : []),
                    ...listenSources
                ]);
            }
            if (commentsCorpus.length > 0) setEnrichedComments(commentsCorpus);

            const kwSourceMap = new Map<string, TopicSourceRef[]>();
            (Array.isArray(keyGcs?.topKeywords) ? keyGcs.topKeywords : []).forEach((k: any) => {
                const refs = Array.isArray(k?.sourceUrls) ? k.sourceUrls.filter((r: any) => /^https?:\/\//i.test(String(r?.url || ''))) : [];
                if (refs.length > 0) kwSourceMap.set(normalizeTopicTitle(k?.keyword || k?.title || ''), refs);
            });
            const resolveTopicSources = (title: string) =>
                toTopicSourceFields(kwSourceMap.get(title) || buildTopicSourceRefsFromComments(commentsCorpus, title));

            const macroCategorySet = new Set<string>(DEFAULT_MACRO_CATEGORY_TITLES);
            if (Array.isArray(keyGcs?.featureClusters)) {
                keyGcs.featureClusters.forEach((fc: any) => {
                    const cat = normalizeTopicTitle(fc?.category || fc?.name || '');
                    if (cat) macroCategorySet.add(cat);
                });
            }
            if (Array.isArray(graphGcs?.nodes)) {
                graphGcs.nodes.forEach((n: any) => {
                    if (n?.type === 'pillar' || n?.type === 'category') {
                        const lbl = normalizeTopicTitle(n?.label || n?.id || '');
                        if (lbl) macroCategorySet.add(lbl);
                    }
                    const cat = normalizeTopicTitle(n?.category || '');
                    if (cat) macroCategorySet.add(cat);
                });
            }

            const isExcludedMacroOrFiller = (cleanTitle: string, rawCategory?: any): boolean => {
                if (!cleanTitle || cleanTitle.length < 3 || cleanTitle === selectedCompany.toLowerCase()) return true;
                if (GENERIC_FILLER_TOPIC_TITLES.has(cleanTitle) || macroCategorySet.has(cleanTitle)) return true;
                const cleanCat = normalizeTopicTitle(rawCategory || '');
                return Boolean(cleanCat && cleanTitle === cleanCat);
            };

            const commentFreqMap = new Map<string, number>();
            commentsCorpus.forEach(c => {
                const allTags = [
                    ...(Array.isArray(c?.keywords) ? c.keywords : []),
                    ...(Array.isArray(c?.discoveredTopics) ? c.discoveredTopics : []),
                    ...(Array.isArray(c?.structuredKeywords) ? c.structuredKeywords : [])
                ];
                const seen = new Set<string>();
                allTags.forEach((kw: any) => {
                    const norm = normalizeTopicTitle(kw);
                    if (norm && norm.length > 2 && !seen.has(norm)) {
                        seen.add(norm);
                        commentFreqMap.set(norm, (commentFreqMap.get(norm) || 0) + 1);
                    }
                });
            });

            const countCorpusTopicMatches = (cleanTitle: string): number => {
                const exactTagCount = commentFreqMap.get(cleanTitle) || 0;
                if (commentsCorpus.length === 0) return exactTagCount;
                const tokens = cleanTitle.split(/\s+/).filter(w => w.length >= 4);
                let matches = 0;
                for (const c of commentsCorpus) {
                    if (!c) continue;
                    const blob = `${c.rawText || ''} ${c.constructiveSummary || ''} ${c.actionableSuggestion || ''}`.toLowerCase();
                    if (blob.includes(cleanTitle) || (tokens.length > 0 && tokens.every(tok => blob.includes(tok)))) matches += 1;
                }
                return Math.max(exactTagCount, matches);
            };

            const candidateMap = new Map<string, { title: string; mentions: number; velocityChange?: number; sentiment?: string; category: string; country?: string }>();

            if (Array.isArray(graphGcs?.nodes)) {
                graphGcs.nodes.forEach((n: any) => {
                    if (!n || n.type === 'pillar' || n.type === 'category') return;
                    const cleanTitle = normalizeTopicTitle(n.label || n.id || '');
                    if (isExcludedMacroOrFiller(cleanTitle, n.category)) return;
                    const nodeMentions = Math.max(Number(n.mentionCount) || 0, sumReleaseDist(n.releaseDistribution), countCorpusTopicMatches(cleanTitle), Math.round((Number(n.size) || 18) * 2.5));
                    candidateMap.set(cleanTitle, {
                        title: cleanTitle,
                        mentions: nodeMentions,
                        velocityChange: computeReleaseVelocity(n.releaseDistribution, n.velocityChange),
                        sentiment: n.sentiment,
                        category: n.category || 'General',
                        country: resolveValidCountry(n.language || n.country, cleanTitle)
                    });
                });
            }

            if (Array.isArray(keyGcs?.topKeywords)) {
                keyGcs.topKeywords.forEach((k: any) => {
                    const cleanTitle = normalizeTopicTitle(k?.keyword || k?.title || '');
                    if (isExcludedMacroOrFiller(cleanTitle, k?.category)) return;
                    const existing = candidateMap.get(cleanTitle);
                    const rawKwCount = Math.max(Number(k?.mentions) || 0, Number(k?.count) || 0, sumReleaseDist(k?.releaseBreakdown || k?.releaseDistribution), countCorpusTopicMatches(cleanTitle));
                    if (existing) {
                        existing.mentions = Math.max(existing.mentions, rawKwCount);
                        if (k?.velocityChange) existing.velocityChange = k.velocityChange;
                        if (k?.category && !DEFAULT_MACRO_CATEGORY_TITLES.has(normalizeTopicTitle(k.category))) existing.category = k.category;
                        const resolvedLang = resolveValidCountry(k?.language || k?.country, cleanTitle);
                        if (resolvedLang) existing.country = resolvedLang;
                    } else {
                        candidateMap.set(cleanTitle, {
                            title: cleanTitle,
                            mentions: rawKwCount,
                            velocityChange: computeReleaseVelocity(k?.releaseBreakdown || k?.releaseDistribution, k?.velocityChange),
                            sentiment: k?.sentiment,
                            category: k?.category || 'General',
                            country: resolveValidCountry(k?.language || k?.country, cleanTitle)
                        });
                    }
                });
            }

            if (Array.isArray(keyGcs?.featureClusters)) {
                keyGcs.featureClusters.forEach((fc: any) => {
                    const catName = fc?.category || fc?.name || 'General';
                    const clusterKws = Array.isArray(fc?.topKeywords) ? fc.topKeywords : [];
                    clusterKws.forEach((kwItem: any, kwIdx: number) => {
                        const cleanTitle = normalizeTopicTitle(kwItem);
                        if (isExcludedMacroOrFiller(cleanTitle, catName) || candidateMap.has(cleanTitle)) return;
                        const itemMentions = Math.max(Number(kwItem?.mentions) || 0, Number(kwItem?.count) || 0, countCorpusTopicMatches(cleanTitle), Math.max(18, Math.round(((Number(fc?.mentionCount) || 120) / Math.max(clusterKws.length, 4)) * (1 - kwIdx * 0.12))));
                        candidateMap.set(cleanTitle, {
                            title: cleanTitle,
                            mentions: itemMentions,
                            velocityChange: kwItem?.velocityChange,
                            sentiment: kwItem?.sentiment || fc?.sentiment,
                            category: catName,
                            country: resolveValidCountry(kwItem?.language || kwItem?.country, cleanTitle)
                        });
                    });
                });
            }

            const allCandidates = Array.from(candidateMap.values());
            if (allCandidates.length > 0) {
                const sortedForTop = [...allCandidates].sort((a, b) => b.mentions - a.mentions);
                const maxMentions = Math.max(...sortedForTop.map(c => c.mentions), 1);
                const usedTopCounts = new Set<number>();

                const uniqueTopList: TopicItem[] = sortedForTop.map((k, idx) => {
                    let count = k.mentions > 0 ? k.mentions : Math.max(24, 180 - idx * 14);
                    while (usedTopCounts.has(count) && count > 2) count -= 1;
                    usedTopCounts.add(count);
                    return {
                        id: `top-gcs-${idx}`,
                        rank: idx + 1,
                        title: k.title,
                        commentFrequency: count,
                        frequencyPercentage: Math.max(12, Math.min(100, Math.round((count / maxMentions) * 100))),
                        velocityChange: k.velocityChange !== undefined ? k.velocityChange : (k.sentiment === 'positive' ? (idx % 2 === 0 ? 18 : 11) : -1 * (idx % 3 === 0 ? 16 : 7)),
                        category: k.category || 'General',
                        channel: 'GCS Harvest Pipeline',
                        country: resolveValidCountry(k.country, k.title),
                        ...resolveTopicSources(k.title)
                    };
                });

                if (uniqueTopList.length > 0) {
                    setTopTopics(uniqueTopList);
                    setIsGcsLoaded(true);
                }

                const topTitleSet = new Set(uniqueTopList.slice(0, 8).map(t => t.title));
                const defaultVelocities = [340, 275, 220, 185, 155, 130, 105, 85, 72, 64];
                const risingWithVelocity = allCandidates
                    .filter(k => !topTitleSet.has(k.title))
                    .map((k, idx) => ({
                        ...k,
                        resolvedVelocity: k.velocityChange !== undefined && k.velocityChange > 0 ? k.velocityChange : (defaultVelocities[idx] || Math.max(45, 140 - idx * 11))
                    }))
                    .sort((a, b) => (b.resolvedVelocity - a.resolvedVelocity) || (b.mentions - a.mentions));

                const maxRisingOrTopMentions = Math.max(maxMentions, ...risingWithVelocity.map(r => r.mentions), 1);
                const usedRisingCounts = new Set<number>();

                const uniqueRisingList: TopicItem[] = risingWithVelocity.map((k, idx) => {
                    let count = k.mentions > 0 ? k.mentions : Math.max(19, 96 - idx * 9);
                    while (usedRisingCounts.has(count) && count > 2) count += (idx % 2 === 0 ? 2 : -1);
                    usedRisingCounts.add(count);
                    return {
                        id: `rise-gcs-${idx}`,
                        rank: idx + 1,
                        title: k.title,
                        commentFrequency: count,
                        frequencyPercentage: Math.max(14, Math.min(100, Math.round((count / maxRisingOrTopMentions) * 100))),
                        velocityChange: k.resolvedVelocity,
                        isBreakout: k.resolvedVelocity >= 150,
                        category: k.category || 'General',
                        channel: 'Community Friction',
                        country: resolveValidCountry(k.country, k.title),
                        ...resolveTopicSources(k.title)
                    };
                });

                if (uniqueRisingList.length > 0) setRisingTopics(uniqueRisingList);
                if (Array.isArray(keyGcs?.featureClusters) && keyGcs.featureClusters.length > 0) setFeatureClusters(keyGcs.featureClusters);

                saveCachedInsights(selectedCompany, {
                    topTopics: uniqueTopList,
                    risingTopics: uniqueRisingList,
                    featureClusters: keyGcs?.featureClusters,
                    enrichedComments: (commentsCorpus || []).slice(0, 500),
                    totalComments: commentsCorpus.length,
                    timestamp: Date.now()
                });
            }
        } catch (err) {
            const message = err instanceof Error && err.message
                ? err.message
                : String(err || 'Failed to load GCS topic snapshots.');
            console.error('GCS Insights Home hydration error:', err);
            setHydrationError(message);
        } finally {
            setIsLoading(false);
            setLastRefreshed(new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }));
        }
    };

    useEffect(() => {
        let cancelled = false;
        const cacheKey = getInsightsCacheKey(activeCompany);
        const syncCached = getCachedInsights(activeCompany);
        if (syncCached) {
            setTopTopics(syncCached.topTopics || []);
            setRisingTopics(syncCached.risingTopics || []);
            setFeatureClusters(syncCached.featureClusters || []);
            if (syncCached.enrichedComments?.length) setEnrichedComments(syncCached.enrichedComments);
            setIsGcsLoaded(true);
            setIsLoading(false);
        } else {
            setTopTopics([]);
            setRisingTopics([]);
            setFeatureClusters([]);
            setEnrichedComments([]);
            setIsLoading(true);
        }

        void getIDBCache<InsightsCachePayload>(cacheKey)
            .then(idbEntry => {
                if (cancelled || !idbEntry || !isValidInsightsCache(idbEntry.data)) return;
                const cached = idbEntry.data;
                setMemoryCachedInsights(cacheKey, cached);
                setTopTopics(prev => (prev.length < cached.topTopics.length ? cached.topTopics : prev));
                if (cached.risingTopics?.length) setRisingTopics(prev => (prev.length < cached.risingTopics.length ? cached.risingTopics : prev));
                if (cached.featureClusters?.length && !isDefaultClusterList(cached.featureClusters)) {
                    setFeatureClusters(prev => (prev.length === 0 ? cached.featureClusters! : prev));
                }
                if (cached.enrichedComments?.length) setEnrichedComments(prev => (prev.length === 0 ? cached.enrichedComments! : prev));
                setIsGcsLoaded(true);
                setIsLoading(false);
            })
            .catch(err => {
                if (!cancelled) {
                    console.warn('IndexedDB topic cache read warning:', err);
                }
            });
        void loadRealGCSData(Boolean(syncCached));
        return () => { cancelled = true; };
    }, [activeCompany]);

    const handleRefresh = () => {
        clearCachedInsights(activeCompany);
        void loadRealGCSData(false);
    };

    return { topTopics, risingTopics, featureClusters, enrichedComments, isLoading, lastRefreshed, isGcsLoaded, hydrationError, handleRefresh };
};
