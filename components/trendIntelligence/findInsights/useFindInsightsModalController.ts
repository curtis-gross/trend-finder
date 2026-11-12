import { useCallback, useEffect, useMemo, useState } from 'react';
import { fetchYouTubeTrends } from '../../../services/youtubeService';
import {
    FindInsightsModalProps, FindInsightsSource, ListenQueueApi, buildExistingFamilyKeys,
    findInsightsModalState, getListenFamilyKey, handleRunRedditInsights, triggerAddSelectedInsights
} from '../findInsightsStore';
import { buildRichMetacriticAnalysis } from '../metacritic/metacriticNormalizer';
import { flattenTrends } from './YouTubeTrendsTab';

export type FindInsightsMode = FindInsightsSource;
type QueueEntry = { item: any; source: FindInsightsSource };
type ResultFilter = 'all' | 'reddit' | 'tiktok' | 'trustpilot' | 'website';

const DEFAULT_TYPES = ['social_intelligence', 'reddit', 'tiktok', 'trustpilot_sentiment', 'website_analysis'];

export function useFindInsightsModalController(props: FindInsightsModalProps) {
    const {
        isOpen, enableGroundedSearch, setEnableGroundedSearch,
        selectedContentTypes, setSelectedContentTypes, setIsOpen,
        foundInsights, companyName, existingRows
    } = props;

    const activeBrand = companyName || 'test-company';
    const [modalMode, setModalModeState] = useState<FindInsightsMode>('grounded');
    const [activeResultFilter, setActiveResultFilter] = useState<ResultFilter>('all');
    const [addedKeys, setAddedKeys] = useState<Set<string>>(new Set());
    const [queueMap, setQueueMap] = useState<Map<string, QueueEntry>>(new Map());
    const [sessionAddedCount, setSessionAddedCount] = useState(0);
    const [guidance, setGuidance] = useState<string>('');
    const [showGroundingTrace, setShowGroundingTrace] = useState<boolean>(false);
    const [, setStoreTick] = useState(0);

    /* Type-aware: `abcd::youtube:ID` and `youtube_sentiment::youtube:ID` are distinct families. */
    const existingKeys = useMemo(() => buildExistingFamilyKeys(existingRows || []), [existingRows]);

    useEffect(() => {
        const onStore = () => setStoreTick(t => t + 1);
        window.addEventListener('find-insights-modal-update', onStore);
        return () => window.removeEventListener('find-insights-modal-update', onStore);
    }, []);

    useEffect(() => {
        if (!isOpen) return;
        setSessionAddedCount(0);
        setQueueMap(new Map());
        setAddedKeys(new Set());
        if (typeof document === 'undefined') return;
        const originalOverflow = document.body.style.overflow;
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = originalOverflow; };
    }, [isOpen]);

    useEffect(() => { if (!enableGroundedSearch) setEnableGroundedSearch(true); }, [enableGroundedSearch, setEnableGroundedSearch]);
    useEffect(() => { if (selectedContentTypes.length === 0) setSelectedContentTypes(DEFAULT_TYPES); }, []);

    const isKeyInListen = useCallback((k: string) => !!k && (existingKeys.has(k) || addedKeys.has(k)), [existingKeys, addedKeys]);

    /** Dispatches new items to Listen without closing the modal. Returns count dispatched. */
    const addNow = useCallback((input: any | any[]): number => {
        const list = (Array.isArray(input) ? input : [input]).filter(Boolean);
        const keys = new Set<string>();
        const fresh = list.filter(item => {
            const k = getListenFamilyKey(item);
            if (!k || isKeyInListen(k) || keys.has(k)) return false;
            keys.add(k);
            return true;
        });
        if (fresh.length === 0) return 0;
        const g = guidance.trim();
        triggerAddSelectedInsights(fresh.map(i => ({ ...i, guidance: i.guidance || g || undefined })));
        setAddedKeys(prev => new Set([...prev, ...keys]));
        setQueueMap(prev => {
            const next = new Map(prev);
            keys.forEach(k => next.delete(k));
            return next;
        });
        setSessionAddedCount(c => c + fresh.length);
        return fresh.length;
    }, [guidance, isKeyInListen]);

    const queueMany = useCallback((items: any[], source: FindInsightsSource) => {
        setQueueMap(prev => {
            const next = new Map(prev);
            (items || []).forEach(item => {
                const k = getListenFamilyKey(item);
                if (k && !isKeyInListen(k)) next.set(k, { item, source });
            });
            return next;
        });
    }, [isKeyInListen]);

    const unqueueMany = useCallback((items: any[]) => {
        setQueueMap(prev => {
            const next = new Map(prev);
            (items || []).forEach(item => next.delete(getListenFamilyKey(item)));
            return next;
        });
    }, []);

    const queue: ListenQueueApi = {
        isInListen: item => isKeyInListen(getListenFamilyKey(item)),
        isQueued: item => queueMap.has(getListenFamilyKey(item)),
        toggleQueue: (item, source) => {
            const k = getListenFamilyKey(item);
            if (queueMap.has(k)) unqueueMany([item]);
            else queueMany([item], source);
        },
        queueMany,
        unqueueMany,
        addNow
    };

    const queuedEntries = Array.from(queueMap.values());
    const queuedCountBySource = queuedEntries.reduce<Record<string, number>>((acc, e) => {
        acc[e.source] = (acc[e.source] || 0) + 1;
        return acc;
    }, {});

    const handleAddQueued = (close: boolean) => {
        addNow(queuedEntries.map(e => e.item));
        setQueueMap(new Map());
        if (close) setIsOpen(false);
    };
    const clearQueue = () => setQueueMap(new Map());

    /* ---------- YouTube (Video tab) ---------- */
    const [youtubeQuery, setYoutubeQuery] = useState<string>(activeBrand);
    const [youtubeLoading, setYoutubeLoading] = useState(false);
    const [youtubeError, setYoutubeError] = useState<string | null>(null);
    const [youtubeTrends, setYoutubeTrends] = useState<{ query: string; trending: any[]; topYear: any[]; shorts: any[] } | null>(null);

    const handleSearchYouTubeTrends = async (customQuery?: string) => {
        const q = (customQuery || youtubeQuery).trim();
        if (!q) return;
        setYoutubeLoading(true);
        setYoutubeError(null);
        try {
            setYoutubeTrends(await fetchYouTubeTrends(q));
        } catch (err: any) {
            setYoutubeError(err?.message || 'Failed to fetch YouTube trends');
        } finally {
            setYoutubeLoading(false);
        }
    };

    /* ---------- ABCD creative search ---------- */
    const [abcdQuery, setAbcdQuery] = useState<string>(`${activeBrand} commercial`);
    const [abcdLoading, setAbcdLoading] = useState(false);
    const [abcdError, setAbcdError] = useState<string | null>(null);
    const [abcdVideos, setAbcdVideos] = useState<any[]>([]);

    const handleSearchAbcd = async (customQuery?: string) => {
        const q = (customQuery || abcdQuery).trim();
        if (!q) return;
        setAbcdLoading(true);
        setAbcdError(null);
        try {
            setAbcdVideos(flattenTrends(await fetchYouTubeTrends(q)));
        } catch (err: any) {
            setAbcdVideos([]);
            setAbcdError(err?.message || 'Failed to search YouTube creatives');
        } finally {
            setAbcdLoading(false);
        }
    };

    useEffect(() => {
        if (!companyName) return;
        setYoutubeQuery(companyName);
        setAbcdQuery(`${companyName} commercial`);
    }, [companyName]);

    /* ---------- Steam ---------- */
    const [steamQuery, setSteamQuery] = useState<string>(activeBrand);
    const [steamLoading, setSteamLoading] = useState(false);
    const [steamError, setSteamError] = useState<string | null>(null);
    const [steamGames, setSteamGames] = useState<any[]>([]);

    const handleSearchSteam = async (customTerm?: string) => {
        const term = (customTerm !== undefined ? customTerm : steamQuery).trim();
        if (!term || /^\d+$/.test(term)) return;
        if (customTerm !== undefined && customTerm !== steamQuery) setSteamQuery(customTerm);
        setSteamLoading(true);
        setSteamError(null);
        try {
            const res = await fetch(`/api/steam/search?term=${encodeURIComponent(term)}`);
            if (!res.ok) {
                const errData = await res.json().catch(() => ({}));
                throw new Error(errData.error || `Steam search returned status ${res.status}`);
            }
            const data = await res.json();
            setSteamGames(Array.isArray(data) ? data : []);
        } catch (err: any) {
            setSteamError(err?.message || 'Failed to search Steam games');
        } finally {
            setSteamLoading(false);
        }
    };

    /* ---------- Metacritic (scan + 1-click add) ---------- */
    const [metacriticUrl, setMetacriticUrl] = useState<string>('https://www.metacritic.com/');
    const [metacriticLoading, setMetacriticLoading] = useState(false);
    const [metacriticError, setMetacriticError] = useState<string | null>(null);
    const [metacriticScans, setMetacriticScans] = useState<any[]>([]);
    const [showRawJsonLd, setShowRawJsonLd] = useState<Record<string, boolean>>({});

    const handleAddAndScanMetacritic = async (overrideUrl?: string) => {
        const targetUrl = (overrideUrl !== undefined ? overrideUrl : metacriticUrl).trim();
        if (!targetUrl) return;
        if (overrideUrl !== undefined && overrideUrl !== metacriticUrl) setMetacriticUrl(overrideUrl);
        setMetacriticLoading(true);
        setMetacriticError(null);
        try {
            const res = await fetch('/api/metacritic/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: targetUrl })
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) throw new Error(data.error || `Metacritic scan failed with HTTP ${res.status}`);

            const pre = buildRichMetacriticAnalysis(data, targetUrl, activeBrand);
            const meta = pre.jsonLdMetadata || {};
            const reviewsList = Array.isArray(pre.reviews) ? pre.reviews : [];
            const canonicalUrl = pre.url || targetUrl;
            const gameTitle = pre.title || 'Metacritic Item';

            setMetacriticScans(prev => [
                { ...data, url: canonicalUrl, title: gameTitle, jsonLdMetadata: meta, reviews: reviewsList, preloadedResult: pre },
                ...prev.filter((p: any) => p.url !== canonicalUrl)
            ]);
            addNow({
                type: 'metacritic_reviews',
                subType: 'metacritic_reviews',
                id: canonicalUrl,
                url: canonicalUrl,
                title: `${gameTitle} (Metacritic)`,
                subtitle: `Metascore: ${pre.metascore ?? 'TBD'} • User Score: ${pre.userScore ?? 'TBD'} • ${reviewsList.length} Reviews`,
                image: meta.image || 'https://www.metacritic.com/favicon.ico',
                rating: pre.metascore ? `Metascore ${pre.metascore}` : `${reviewsList.length} Reviews`,
                reason: meta.description || `Schema.org JSON-LD & ${reviewsList.length} Critic/User reviews extracted from ${canonicalUrl}`,
                tags: ['Metacritic', 'JSON-LD', 'Reviews'],
                context: gameTitle,
                preloadedResult: pre
            });
        } catch (err: any) {
            setMetacriticError(err?.message || 'Failed to scan Metacritic URL');
        } finally {
            setMetacriticLoading(false);
        }
    };

    /* ---------- Tab switching with first-visit auto-discovery ---------- */
    const setModalMode = (mode: FindInsightsMode) => {
        setModalModeState(mode);
        if (mode === 'youtube' && !youtubeTrends && !youtubeLoading) handleSearchYouTubeTrends();
        if (mode === 'abcd' && abcdVideos.length === 0 && !abcdLoading && !abcdError) handleSearchAbcd();
        if (mode === 'steam' && steamGames.length === 0 && !steamLoading) handleSearchSteam();
        if (mode === 'reddit' && findInsightsModalState.redditInsights.length === 0 && !findInsightsModalState.isFindingReddit && !findInsightsModalState.redditError) {
            handleRunRedditInsights(undefined, activeBrand);
        }
    };

    const filteredInsights = foundInsights.filter(item => {
        if (item.type === 'youtube' || item.subType === 'youtube_sentiment') return false;
        if (activeResultFilter === 'all') return true;
        if (activeResultFilter === 'reddit') return item.type === 'reddit';
        if (activeResultFilter === 'tiktok') return item.type === 'tiktok' || item.type === 'tiktok_hashtag';
        if (activeResultFilter === 'trustpilot') return item.type === 'trustpilot' || item.type === 'trustpilot_sentiment';
        return item.type === 'website' || item.type === 'grounded_search' || item.type === 'website_analysis';
    });

    return {
        activeBrand, modalMode, setModalMode, activeResultFilter, setActiveResultFilter,
        existingKeys, addedKeys, queue, queuedEntries, queuedCountBySource, sessionAddedCount,
        handleAddQueued, clearQueue, guidance, setGuidance, showGroundingTrace, setShowGroundingTrace,
        youtubeQuery, setYoutubeQuery, youtubeLoading, youtubeError, youtubeTrends, handleSearchYouTubeTrends,
        abcdQuery, setAbcdQuery, abcdLoading, abcdError, abcdVideos, handleSearchAbcd,
        steamQuery, setSteamQuery, steamLoading, steamError, steamGames, handleSearchSteam,
        metacriticUrl, setMetacriticUrl, metacriticLoading, metacriticError, metacriticScans,
        showRawJsonLd, setShowRawJsonLd, handleAddAndScanMetacritic,
        filteredInsights
    };
}

export type FindInsightsController = ReturnType<typeof useFindInsightsModalController>;
