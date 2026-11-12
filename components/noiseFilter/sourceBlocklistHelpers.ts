import {
    NoiseSourceConfig,
    RawComment,
    EnrichedComment,
    Stage2FilteredResult,
    Stage3KeywordResult,
    NoiseFilterResult
} from '../../services/noiseFilterService';

type MetacriticPipelineReview = EnrichedComment & {
    reviewType: 'critic' | 'user';
    score: number;
    maxScore: number;
    subpageUrl: string;
    platform: string;
};

// Module-level session caches for 0ms instant hydration when switching between Filter Pipe, Categories, Graph, and Trajectory tabs
export const dmlMemoryCache: Record<string, {
    rawComments?: RawComment[];
    stage2?: Stage2FilteredResult;
    stage3?: Stage3KeywordResult;
    stage4?: NoiseFilterResult;
    sources?: NoiseSourceConfig[];
}> = {};

export const cachedMetacriticCorpus: Record<string, {
    enrichedReviews: MetacriticPipelineReview[];
    criticCount: number;
    userCount: number;
    metascore: number;
    userScore: number;
}> = {};

export const fetchMetacriticCorpusForPipeline = async (
    companyName: string,
    allowLiveScan: boolean = false
): Promise<{
    enrichedReviews: MetacriticPipelineReview[];
    criticCount: number;
    userCount: number;
    metascore: number;
    userScore: number;
}> => {
    const activeCompany = companyName || 'test-company';
    const cacheKey = activeCompany.toUpperCase();
    if (!allowLiveScan && cachedMetacriticCorpus[cacheKey]?.enrichedReviews?.length) {
        return cachedMetacriticCorpus[cacheKey];
    }

    const res = await fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeCompany)}`, {
        cache: 'no-store'
    });
    if (!res.ok) {
        if (res.status === 404) {
            return { enrichedReviews: [], criticCount: 0, userCount: 0, metascore: 0, userScore: 0 };
        }
        const errText = await res.text().catch(() => '');
        throw new Error(`Failed to fetch Metacritic cached analyses (HTTP ${res.status})${errText ? `: ${errText.slice(0, 200)}` : ''}`);
    }

    const allAnalyses = await res.json();
    if (!Array.isArray(allAnalyses) || allAnalyses.length === 0) {
        return { enrichedReviews: [], criticCount: 0, userCount: 0, metascore: 0, userScore: 0 };
    }

    const deletedSet = getDeletedListenItemsSet();
    const mcAnalyses = allAnalyses.filter((item: any) => {
        if (!item || typeof item !== 'object') return false;
        const targetUrl = String(item.url || (Array.isArray(item.videos) && item.videos[0]) || '');
        const aId = String(item._analysisId || item.analysisId || '');
        const isMc =
            item.type === 'metacritic_reviews' ||
            aId.includes('metacritic') ||
            targetUrl.includes('metacritic.com');
        if (!isMc) return false;
        return !isSourceDeletedInBlocklist({ id: aId, target: targetUrl, label: item.title }, deletedSet);
    });

    if (mcAnalyses.length === 0) {
        delete cachedMetacriticCorpus[cacheKey];
        return { enrichedReviews: [], criticCount: 0, userCount: 0, metascore: 0, userScore: 0 };
    }

    const enrichedReviews: MetacriticPipelineReview[] = [];
    const seenKeys = new Set<string>();
    let metascore = 0;
    let userScore = 0;

    for (const analysis of mcAnalyses) {
        if (!metascore && typeof analysis.metascore === 'number') metascore = analysis.metascore;
        if (!userScore && typeof analysis.userScore === 'number') userScore = analysis.userScore;

        const baseUrl = String(analysis.url || (Array.isArray(analysis.videos) && analysis.videos[0]) || 'https://www.metacritic.com/');
        const rawList = [
            ...(Array.isArray(analysis.criticReviews) ? analysis.criticReviews.map((r: any) => ({ ...r, _role: 'critic' })) : []),
            ...(Array.isArray(analysis.userReviews) ? analysis.userReviews.map((r: any) => ({ ...r, _role: 'user' })) : []),
            ...(Array.isArray(analysis.metacritic_reviews) ? analysis.metacritic_reviews : []),
            ...(Array.isArray(analysis.reviews) ? analysis.reviews : []),
            ...(Array.isArray(analysis.comments) ? analysis.comments : [])
        ];

        rawList.forEach((r: any, idx: number) => {
            const text = String(r?.quote || r?.text || r?.rawText || r?.body || r?.content || '').trim();
            if (!text) return;
            const roleStr = String(r?._role || r?.reviewType || r?.type || '').toLowerCase();
            const isCritic = roleStr === 'critic' || (typeof r?.maxScore === 'number' && r.maxScore === 100) || (typeof r?.score === 'number' && r.score > 10);
            const reviewType: 'critic' | 'user' = isCritic ? 'critic' : 'user';
            const author = String(r?.author || r?.publication || (isCritic ? 'Metacritic Critic' : 'Metacritic User')).trim();
            const dedupeKey = `${reviewType}::${author.toLowerCase()}::${text.slice(0, 80).toLowerCase()}`;
            if (seenKeys.has(dedupeKey)) return;
            seenKeys.add(dedupeKey);

            const scoreVal = typeof r?.score === 'number' ? r.score : 0;
            const maxScoreVal = isCritic ? 100 : 10;
            const sentiment: 'positive' | 'negative' | 'neutral' =
                r?.sentiment === 'positive' || r?.sentiment === 'negative' || r?.sentiment === 'neutral'
                    ? r.sentiment
                    : 'neutral';
            const subpageUrl = String(r?.subpageUrl || (isCritic ? analysis.criticReviewsUrl : analysis.userReviewsUrl) || baseUrl);

            enrichedReviews.push({
                id: String(r?.id || `mc-${reviewType}-${idx}-${enrichedReviews.length}`),
                rawText: text,
                author,
                source: 'Metacritic',
                sourceLabel: analysis.title ? `Metacritic: ${analysis.title}` : 'Metacritic',
                isNoise: false,
                keywords: [],
                sentiment,
                timestamp: String(r?.date || r?.timestamp || ''),
                reviewType,
                score: scoreVal,
                maxScore: maxScoreVal,
                subpageUrl,
                sourceUrl: subpageUrl,
                platform: String(r?.platform || 'Multi-Platform')
            });
        });
    }

    const criticCount = enrichedReviews.filter(r => r.reviewType === 'critic').length;
    const userCount = enrichedReviews.filter(r => r.reviewType === 'user').length;
    const corpus = { enrichedReviews, criticCount, userCount, metascore, userScore };
    if (enrichedReviews.length > 0) {
        cachedMetacriticCorpus[cacheKey] = corpus;
    } else {
        delete cachedMetacriticCorpus[cacheKey];
    }
    return corpus;
};

export const getDeletedListenItemsSet = (): Set<string> => {
    const set = new Set<string>();
    if (typeof window === 'undefined') return set;
    try {
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key && (key === 'deleted_listen_item_ids' || key.startsWith('dml_deleted_listen_items_'))) {
                const raw = localStorage.getItem(key);
                if (raw) {
                    const parsed = JSON.parse(raw);
                    if (Array.isArray(parsed)) {
                        parsed.forEach(item => {
                            if (item) set.add(String(item).toLowerCase().trim());
                        });
                    }
                }
            }
        }
    } catch {}
    return set;
};

export const isSourceDeletedInBlocklist = (s: { id?: string; target?: string; label?: string }, deletedSet: Set<string>): boolean => {
    if (deletedSet.size === 0) return false;
    const id = String(s.id || '').toLowerCase().trim();
    const target = String(s.target || '').toLowerCase().trim();
    const label = String(s.label || '').toLowerCase().trim();
    if (id && deletedSet.has(id)) return true;
    if (target && deletedSet.has(target)) return true;
    if (label && deletedSet.has(label)) return true;
    if (deletedSet.has('__all_reddit__') && (target.includes('reddit.com') || id.includes('reddit'))) return true;
    return false;
};

export const ensureRedditSourcesInList = (sourcesList: NoiseSourceConfig[]): NoiseSourceConfig[] => {
    const deletedSet = getDeletedListenItemsSet();
    const updated = (sourcesList || []).filter(s => !isSourceDeletedInBlocklist(s, deletedSet));
    return updated.map(s =>
        s.type === 'reddit' ? { ...s, targetCount: s.targetCount === 200 || !s.targetCount ? 25 : s.targetCount } : s
    );
};

export const ensureMetacriticSourceInList = (
    sourcesList: NoiseSourceConfig[],
    _totalReviews: number = 0,
    _preloadedCorpus?: any
): NoiseSourceConfig[] => {
    const deletedSet = getDeletedListenItemsSet();
    const filtered = (sourcesList || []).filter(s => !isSourceDeletedInBlocklist(s, deletedSet));
    return ensureRedditSourcesInList(filtered);
};

export const assignRedditCommentsToThreads = <T extends { id?: string; rawText?: string; source?: string; sourceLabel?: string }>(
    comments: T[]
): T[] => {
    return Array.isArray(comments) ? comments : [];
};

export const mergeMetacriticReviewsIntoArray = <T extends { id?: string; rawText?: string; author?: string; source?: string; sourceLabel?: string }>(
    existingList: T[],
    mcReviews: any[]
): T[] => {
    const normalizedExisting = assignRedditCommentsToThreads(Array.isArray(existingList) ? existingList : []);
    if (!Array.isArray(mcReviews) || mcReviews.length === 0) return normalizedExisting;
    const base = [...normalizedExisting];
    const seenIds = new Set<string>();
    const seenTextKeys = new Set<string>();

    base.forEach(item => {
        if (!item) return;
        if (item.id) seenIds.add(String(item.id));
        const tk = `${String(item.author || '').toLowerCase()}::${String(item.rawText || '').slice(0, 48).toLowerCase()}`;
        seenTextKeys.add(tk);
    });

    mcReviews.forEach(mc => {
        const idStr = String(mc.id || '');
        const tk = `${String(mc.author || '').toLowerCase()}::${String(mc.rawText || '').slice(0, 48).toLowerCase()}`;
        if (!seenIds.has(idStr) && !seenTextKeys.has(tk)) {
            seenIds.add(idStr);
            seenTextKeys.add(tk);
            base.push(mc as T);
        }
    });

    return base;
};
