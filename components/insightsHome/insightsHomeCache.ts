import { detectCommentLanguage, getLanguageInfo } from '../../services/noiseFilterService';
import { getIDBCacheSync, setIDBCache, deleteIDBCache } from '../../services/gcsCacheService';
import type { TopicSourceRef } from '../../services/noiseFilter/noiseTypes';

export type { TopicSourceRef };

export interface TopicItem {
    id: string;
    rank: number;
    title: string;
    commentFrequency: number;
    frequencyPercentage: number;
    velocityChange: number;
    isBreakout?: boolean;
    category?: string;
    channel?: string;
    country?: string;
    sourceUrl?: string;
    videoUrl?: string;
    sourceTitle?: string;
    sourceUrls?: TopicSourceRef[];
}

export interface FeatureClusterOverview {
    category: string;
    keywordCount: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
    topKeywords: string[];
}

export interface InsightsHomeProps {
    initialSelectedTopic?: string | null;
    onNavigateToTopic?: (topicName: string) => void;
    onNavigateToTab?: (tabName: 'listen' | 'filter' | 'topic_graph' | 'topic_trajectory' | 'ad_opportunities' | 'summarize') => void;
}

export interface InsightsCachePayload {
    topTopics: TopicItem[];
    risingTopics: TopicItem[];
    featureClusters?: FeatureClusterOverview[];
    enrichedComments?: any[];
    totalComments?: number;
    timestamp: number;
    _idbOverflow?: boolean;
}

export const DEFAULT_FEATURE_CLUSTERS: FeatureClusterOverview[] = [];
export const DEFAULT_INITIAL_TOP_TOPICS: TopicItem[] = [];
export const DEFAULT_INITIAL_RISING_TOPICS: TopicItem[] = [];

export const detectAccurateCommentLanguage = (text?: string, rawLang?: string): string => {
    return detectCommentLanguage(text, rawLang);
};

export const getCountryFlag = (langOrCountry?: string, text?: string): { language: string; flag: string; label: string } => {
    return getLanguageInfo(langOrCountry, text);
};

const insightsMemoryCache = new Map<string, InsightsCachePayload>();
const mirroredLocalStorageKeys = new Set<string>();

export const getInsightsCacheKey = (company: string): string => `insights_home_cache_${company || 'test-company'}`;

export const isDefaultClusterList = (clusters: any): boolean => {
    return !Array.isArray(clusters) || clusters.length === 0;
};

const isDefaultTopTopicList = (topics: any): boolean => {
    return Boolean(
        Array.isArray(topics) &&
        topics.length > 0 &&
        topics[0]?.id === 'top-1' &&
        topics[0]?.commentFrequency === 1420
    );
};

export const GENERIC_FILLER_TOPIC_TITLES = new Set([
    'positive reception',
    'fun factor',
    'general approval',
    'high satisfaction',
    'positive impression',
    'positive feedback',
    'positive sentiment',
    'general satisfaction',
    'customer feedback',
    'negative feedback',
    'negative sentiment',
    'general complaint',
    'mixed reception',
    'overall quality'
]);

export const DEFAULT_MACRO_CATEGORY_TITLES = new Set([
    'product quality & performance',
    'pricing & value',
    'customer service & support',
    'features & capabilities',
    'design & presentation',
    'fulfillment & reliability',
    'bugs & stability',
    'general'
]);

const normalizeCacheTopicStr = (raw: any): string => {
    const str = typeof raw === 'string' ? raw : (raw?.keyword || raw?.title || raw?.name || raw?.topic || '');
    return str.replace(/^#+/, '').replace(/[_-]/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase();
};

export const normalizeTopicTitle = (raw: any): string => {
    return normalizeCacheTopicStr(raw);
};

export const unwrapRunPayload = (raw: any): any | null => {
    if (!raw || typeof raw !== 'object') return null;
    if (!Array.isArray(raw)) {
        if (
            raw.status === 'empty' ||
            raw.notModified === true ||
            raw.status === 'not_modified' ||
            raw.unchanged === true
        ) {
            return null;
        }
        if ('data' in raw) {
            if (raw.data === null || raw.data === undefined) return null;
            if (typeof raw.data === 'object') {
                if (!Array.isArray(raw.data) && Object.keys(raw.data).length === 0) return null;
                return raw.data;
            }
        }
        if (Object.keys(raw).length === 0) return null;
    }
    return raw;
};

const LEGACY_ROUND_ROBIN_COUNTRIES = new Set([
    'germany',
    'japan',
    'brazil',
    'france',
    'united kingdom',
    'canada',
    'australia',
    'united states'
]);

const hasStaleOrUniformTopics = (topics: any): boolean => {
    if (!Array.isArray(topics) || topics.length === 0) return true;
    const countAtOrBelow15 = topics.filter((t: any) => (t?.commentFrequency ?? 0) <= 15).length;
    if (countAtOrBelow15 >= 3) return true;
    const sample = topics.slice(0, Math.min(6, topics.length));
    if (sample.length >= 3) {
        const distinctCounts = new Set(sample.map((t: any) => t?.commentFrequency));
        if (distinctCounts.size <= 2) return true;
    }
    return topics.some((t: any) => {
        const cleanTitle = normalizeCacheTopicStr(t?.title);
        const cleanCat = normalizeCacheTopicStr(t?.category);
        const rawCountryLower = String(t?.country || '').toLowerCase().trim();
        const isLegacyRoundRobin = LEGACY_ROUND_ROBIN_COUNTRIES.has(rawCountryLower);
        return (
            GENERIC_FILLER_TOPIC_TITLES.has(cleanTitle) ||
            DEFAULT_MACRO_CATEGORY_TITLES.has(cleanTitle) ||
            (cleanTitle && cleanCat && cleanTitle === cleanCat) ||
            isLegacyRoundRobin
        );
    });
};

export const isValidInsightsCache = (data: any): data is InsightsCachePayload => {
    return Boolean(
        data &&
        typeof data === 'object' &&
        Array.isArray(data.topTopics) &&
        data.topTopics.length > 0 &&
        !isDefaultTopTopicList(data.topTopics) &&
        !hasStaleOrUniformTopics(data.topTopics) &&
        Array.isArray(data.risingTopics) &&
        data.risingTopics.length > 0 &&
        !hasStaleOrUniformTopics(data.risingTopics) &&
        Array.isArray(data.featureClusters) &&
        data.featureClusters.length > 0 &&
        !isDefaultClusterList(data.featureClusters)
    );
};

const evictStaleLocalStorageCaches = (preserveKey: string): void => {
    try {
        const candidates: { key: string; size: number; priority: number }[] = [];
        for (let i = 0; i < localStorage.length; i++) {
            const k = localStorage.key(i);
            if (!k || k === preserveKey) continue;
            const isInsightsCache = k.startsWith('insights_home_cache_');
            const isGcsCache = k.startsWith('gcs_cache_') || k.startsWith('noise_filter_');
            if (isInsightsCache || isGcsCache) {
                const rawVal = localStorage.getItem(k) || '';
                candidates.push({
                    key: k,
                    size: rawVal.length,
                    priority: isInsightsCache ? 2 : rawVal.length > 50_000 ? 1 : 0
                });
            }
        }
        candidates.sort((a, b) => (b.priority - a.priority) || (b.size - a.size));
        for (const item of candidates.slice(0, 6)) {
            localStorage.removeItem(item.key);
            mirroredLocalStorageKeys.delete(item.key);
        }
    } catch {}
};

export const getCachedInsights = (company: string): InsightsCachePayload | null => {
    const cacheKey = getInsightsCacheKey(company);

    try {
        if (mirroredLocalStorageKeys.has(cacheKey) && localStorage.getItem(cacheKey) === null) {
            insightsMemoryCache.delete(cacheKey);
            mirroredLocalStorageKeys.delete(cacheKey);
            void deleteIDBCache(cacheKey);
            return null;
        }
    } catch {}

    const memHit = insightsMemoryCache.get(cacheKey);
    if (isValidInsightsCache(memHit)) {
        return memHit;
    }

    const idbSyncHit = getIDBCacheSync<InsightsCachePayload>(cacheKey);
    if (idbSyncHit && isValidInsightsCache(idbSyncHit.data)) {
        insightsMemoryCache.set(cacheKey, idbSyncHit.data);
        return idbSyncHit.data;
    }

    try {
        const raw = localStorage.getItem(cacheKey);
        if (raw) {
            const data = JSON.parse(raw);
            if (isValidInsightsCache(data)) {
                insightsMemoryCache.set(cacheKey, data);
                return data;
            }
            localStorage.removeItem(cacheKey);
        }
    } catch {}
    return null;
};

export const setMemoryCachedInsights = (cacheKey: string, payload: InsightsCachePayload): void => {
    insightsMemoryCache.set(cacheKey, payload);
};

export const clearCachedInsights = (company: string): void => {
    const cacheKey = getInsightsCacheKey(company);
    insightsMemoryCache.delete(cacheKey);
    try {
        localStorage.removeItem(cacheKey);
    } catch {}
};

const isHttpUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim());

/** Keep topic provenance (capped) so Overview links survive cache round-trips. */
const compactTopic = (t: TopicItem): TopicItem => ({
    ...t,
    sourceUrl: isHttpUrl(t?.sourceUrl) ? t.sourceUrl : undefined,
    videoUrl: isHttpUrl(t?.videoUrl) ? t.videoUrl : undefined,
    sourceTitle: t?.sourceTitle,
    sourceUrls: Array.isArray(t?.sourceUrls) ? t.sourceUrls.filter(r => isHttpUrl(r?.url)).slice(0, 8) : undefined
});

/**
 * Legacy backfill: attach real source URLs to cached comments that predate provenance tracking,
 * by matching subpageUrl, a known YouTube video ID inside sourceLabel, or an exact label/title match
 * against configured sources. Unmatched comments stay without a URL (no fabrication).
 */
export const backfillCommentSourceUrls = (comments: any[], sources: any[]): any[] => {
    const byVideoId = new Map<string, any>();
    const byLabel = new Map<string, any>();
    (Array.isArray(sources) ? sources : []).forEach((s: any) => {
        if (!s) return;
        const rawId = String(s.videoId || (String(s.type || '').startsWith('youtube') ? s.target : '') || '');
        const videoId = /^[A-Za-z0-9_-]{11}$/.test(rawId) ? rawId : undefined;
        const url = isHttpUrl(s.url) ? s.url : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : undefined);
        if (!url) return;
        const entry = { url, videoId, channelTitle: s.channelTitle };
        if (videoId) byVideoId.set(videoId, entry);
        [s.label, s.title].forEach(l => { if (l) byLabel.set(String(l).toLowerCase().trim(), entry); });
    });
    return (Array.isArray(comments) ? comments : []).map(c => {
        if (!c || typeof c !== 'object' || isHttpUrl(c.sourceUrl) || isHttpUrl(c.videoUrl)) return c;
        if (isHttpUrl(c.subpageUrl)) return { ...c, sourceUrl: c.subpageUrl };
        const label = String(c.sourceLabel || '');
        const idHit = [...byVideoId.keys()].find(id => label.includes(id));
        const hit = (idHit && byVideoId.get(idHit)) || byLabel.get(label.toLowerCase().trim()) || byLabel.get(String(c.videoTitle || '').toLowerCase().trim());
        if (!hit) return c;
        return {
            ...c,
            sourceUrl: hit.url,
            ...(hit.videoId ? { videoId: hit.videoId, videoUrl: `https://www.youtube.com/watch?v=${hit.videoId}` } : {}),
            ...(hit.channelTitle && !c.channelTitle ? { channelTitle: hit.channelTitle } : {})
        };
    });
};

export const saveCachedInsights = (company: string, payload: InsightsCachePayload): void => {
    const cacheKey = getInsightsCacheKey(company);
    const fullPayload: InsightsCachePayload = {
        topTopics: (payload.topTopics || []).slice(0, 40).map(compactTopic),
        risingTopics: (payload.risingTopics || []).slice(0, 24).map(compactTopic),
        featureClusters: payload.featureClusters && payload.featureClusters.length > 0 && !isDefaultClusterList(payload.featureClusters)
            ? payload.featureClusters
            : [],
        enrichedComments: (payload.enrichedComments || []).slice(0, 500).map((c: any) => {
            const rawTextStr = typeof c?.rawText === 'string' ? c.rawText.slice(0, 500) : '';
            const detectedLang = detectAccurateCommentLanguage(rawTextStr, c?.language || c?.country);
            return {
                id: c?.id,
                author: c?.author,
                source: c?.source,
                release: c?.release,
                timestamp: c?.timestamp,
                country: detectedLang,
                language: detectedLang,
                sentiment: c?.sentiment,
                featureCategory: c?.featureCategory,
                keywords: Array.isArray(c?.keywords) ? c.keywords.slice(0, 8) : [],
                rawText: rawTextStr,
                constructiveSummary: typeof c?.constructiveSummary === 'string' ? c.constructiveSummary.slice(0, 300) : '',
                actionableSuggestion: typeof c?.actionableSuggestion === 'string' ? c.actionableSuggestion.slice(0, 300) : '',
                sourceUrl: c?.sourceUrl,
                videoUrl: c?.videoUrl,
                videoId: c?.videoId,
                videoTitle: c?.videoTitle,
                channelTitle: c?.channelTitle,
                sourceLabel: c?.sourceLabel,
                subpageUrl: c?.subpageUrl
            };
        }),
        totalComments: payload.totalComments ?? payload.enrichedComments?.length ?? 0,
        timestamp: payload.timestamp || Date.now()
    };

    insightsMemoryCache.set(cacheKey, fullPayload);
    void setIDBCache(cacheKey, fullPayload, { timestamp: fullPayload.timestamp });

    const compactPayload: InsightsCachePayload = {
        topTopics: fullPayload.topTopics.slice(0, 16),
        risingTopics: fullPayload.risingTopics.slice(0, 12),
        featureClusters: (fullPayload.featureClusters || []).map(fc => ({
            category: fc.category,
            keywordCount: fc.keywordCount,
            sentimentBreakdown: fc.sentimentBreakdown,
            topKeywords: Array.isArray(fc.topKeywords) ? fc.topKeywords.slice(0, 8) : []
        })),
        enrichedComments: [],
        totalComments: fullPayload.totalComments,
        timestamp: fullPayload.timestamp,
        _idbOverflow: true
    };

    const serializedCompact = JSON.stringify(compactPayload);
    try {
        localStorage.removeItem(cacheKey);
        localStorage.setItem(cacheKey, serializedCompact);
        mirroredLocalStorageKeys.add(cacheKey);
    } catch {
        evictStaleLocalStorageCaches(cacheKey);
        try {
            localStorage.setItem(cacheKey, serializedCompact);
            mirroredLocalStorageKeys.add(cacheKey);
        } catch {
            mirroredLocalStorageKeys.delete(cacheKey);
        }
    }
};
