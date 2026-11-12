import { type NoiseSourceConfig } from './noiseTypes';
import {
    collectAndDedupeMetacriticReviews,
    extractMetacriticSlugFromTarget,
    extractSteamAppId,
    extractYouTubeId,
    getDefaultListenTableRows,
    getDeletedListenItemIds,
    isListenTableItemDeleted,
} from './listenTableBlocklist';

// ============================================================================
// DYNAMIC LISTEN TABLE SOURCE SYNCHRONIZATION
// ============================================================================
export const getSourcesFromListenTable = async (companyName: string = 'test-company'): Promise<NoiseSourceConfig[]> => {
    try {
        const deletedSet = getDeletedListenItemIds(companyName);
        const res = await fetch(`/api/insights/table?companyName=${encodeURIComponent(companyName)}`, { cache: 'no-store' });
        const rawApiRows = res.ok ? await res.json().catch(() => []) : [];
        const apiRowsList = Array.isArray(rawApiRows) ? rawApiRows : [];

        const seededStorageKey = `tc_listen_table_v1_seeded_${companyName}`;
        const hasSeededFlag =
            typeof window !== 'undefined' &&
            window.localStorage &&
            window.localStorage.getItem(seededStorageKey) === 'true';

        let safeRows = apiRowsList.filter(
            r => r && !isListenTableItemDeleted(r, companyName, deletedSet)
        );

        const defaultRows = getDefaultListenTableRows(companyName);
        if (!hasSeededFlag && safeRows.length === 0 && defaultRows.length > 0) {
            safeRows = defaultRows.filter(d => !isListenTableItemDeleted(d, companyName, deletedSet));
            if (typeof window !== 'undefined' && window.localStorage) {
                try {
                    window.localStorage.setItem(seededStorageKey, 'true');
                } catch {}
            }
        }

        const extractedSources: NoiseSourceConfig[] = [];
        const seenKeys = new Set<string>();
        const metacriticSourceByKey = new Map<string, NoiseSourceConfig>();

        safeRows.forEach((row: any, rIdx: number) => {
            if (isListenTableItemDeleted(row, companyName, deletedSet)) return;

            const rawVideos: string[] = Array.isArray(row.videos) && row.videos.length > 0
                ? row.videos
                : [row.url, row.id, row.videoId].filter(Boolean);
            const rowType = String(row.type || '').toLowerCase();
            const rowComments = Array.isArray(row.comments)
                ? row.comments
                : Array.isArray(row.sampleComments)
                ? row.sampleComments
                : Array.isArray(row.preloadedResult?.comments)
                ? row.preloadedResult.comments
                : undefined;
            const rowPreview =
                row.contentPreview ||
                row.overallSummary ||
                row.summary ||
                row.description ||
                row.preloadedResult?.summary ||
                undefined;

            rawVideos.forEach((targetStr: string, vIdx: number) => {
                if (!targetStr || typeof targetStr !== 'string') return;
                const cleanTarget = targetStr.trim();
                if (!cleanTarget) return;

                const isWebsite = rowType.includes('website') || rowType.includes('web') || rowType.includes('article') || rowType === 'grounded_search';
                const isSteam = rowType.includes('steam') || cleanTarget.includes('steampowered.com');
                const isReddit = rowType.includes('reddit') || cleanTarget.includes('reddit.com');
                const isYoutube = rowType.includes('youtube') || rowType === 'abcd' || cleanTarget.includes('youtube.com') || cleanTarget.includes('youtu.be');
                const isMetacritic = rowType.includes('metacritic') || cleanTarget.includes('metacritic.com') || Array.isArray(row.metacritic_reviews) || Array.isArray(row.criticReviews) || Array.isArray(row.userReviews);
                const extractedYtId = extractYouTubeId(cleanTarget);
                const isWebUrl = /^https?:\/\//i.test(cleanTarget) && !isSteam && !isReddit && !isYoutube && !isMetacritic;

                if (isWebUrl || isWebsite) return;

                if (isMetacritic) {
                    const slug = extractMetacriticSlugFromTarget(cleanTarget);
                    const canonicalTarget = slug ? `https://www.metacritic.com/game/${slug}/` : cleanTarget;
                    const key = `metacritic:${slug || cleanTarget}`;
                    const harvestedRowRevs = collectAndDedupeMetacriticReviews(row);
                    const cachedMeta = row?.result?.jsonLdMetadata || row?.analysis?.jsonLdMetadata || row?.jsonLdMetadata;
                    const crawledPages = row?.result?.crawledPages || row?.analysis?.crawledPages || row?.crawledPages;

                    if (!seenKeys.has(key)) {
                        seenKeys.add(key);
                        const mcSource: NoiseSourceConfig = {
                            id: row.id || `src-metacritic-table-${rIdx}-${vIdx}`,
                            type: 'metacritic',
                            target: canonicalTarget,
                            url: /^https?:\/\//i.test(canonicalTarget) ? canonicalTarget : undefined,
                            label: row.title ? `Metacritic: ${row.title}` : `Metacritic Critic & User Reviews (${slug.toUpperCase()})`,
                            targetCount: 250,
                            contentPreview: rowPreview,
                            summary: row.summary || rowPreview,
                            comments: rowComments,
                            ...(harvestedRowRevs.length > 0 ? { cachedReviews: harvestedRowRevs } : {}),
                            ...(cachedMeta ? { cachedJsonLdMetadata: cachedMeta } : {}),
                            ...(crawledPages ? { crawledPages } : {})
                        };
                        if (!isListenTableItemDeleted(mcSource, companyName, deletedSet)) {
                            extractedSources.push(mcSource);
                            metacriticSourceByKey.set(key, mcSource);
                        }
                    } else {
                        const existingMc = metacriticSourceByKey.get(key);
                        if (existingMc && harvestedRowRevs.length > 0) {
                            existingMc.cachedReviews = collectAndDedupeMetacriticReviews(existingMc.cachedReviews, harvestedRowRevs);
                        }
                    }
                } else if (isSteam) {
                    const appId = extractSteamAppId(cleanTarget);
                    const key = `steam:${appId}`;
                    if (appId && !seenKeys.has(key)) {
                        const steamSource: NoiseSourceConfig = {
                            id: row.id || `src-steam-table-${rIdx}-${vIdx}`,
                            type: 'steam',
                            target: appId,
                            url: `https://store.steampowered.com/app/${appId}`,
                            label: row.title ? `Steam: ${row.title}` : `Steam Store Reviews (App ${appId})`,
                            targetCount: 750,
                            contentPreview: rowPreview,
                            summary: row.summary || rowPreview,
                            comments: rowComments
                        };
                        if (!isListenTableItemDeleted(steamSource, companyName, deletedSet)) {
                            seenKeys.add(key);
                            extractedSources.push(steamSource);
                        }
                    }
                } else if (isYoutube || extractedYtId) {
                    const videoId = extractedYtId || cleanTarget;
                    const isAbcdRow = rowType === 'abcd' || rowType === 'youtube_abcd' || rowType === 'competitor_abcd';
                    const ytType: 'youtube' | 'youtube_abcd' = isAbcdRow ? 'youtube_abcd' : 'youtube';
                    const key = `${ytType}:${videoId}`;
                    if (videoId && !seenKeys.has(key)) {
                        const ytSource: NoiseSourceConfig = {
                            id: row.id || `src-${ytType}-table-${rIdx}-${vIdx}`,
                            type: ytType,
                            target: videoId,
                            videoId,
                            url: `https://www.youtube.com/watch?v=${videoId}`,
                            label: row.title
                                ? `${isAbcdRow ? 'YouTube ABCD' : 'YouTube'}: ${row.title}`
                                : `${isAbcdRow ? 'YouTube ABCD Video' : 'YouTube Video'} (${videoId})`,
                            targetCount: 750,
                            abcdScore: isAbcdRow && typeof row.abcdScore === 'number' ? row.abcdScore : undefined,
                            abcdAnalysisId: isAbcdRow ? (row.abcdAnalysisId || row.analysisId) : undefined,
                            abcdResult: isAbcdRow ? (row.abcdResult || row.preloadedResult) : undefined,
                            sentimentScore: !isAbcdRow && typeof row.sentimentScore === 'number' ? row.sentimentScore : undefined,
                            sentimentAnalysisId: !isAbcdRow ? (row.sentimentAnalysisId || row.analysisId) : undefined,
                            contentPreview: rowPreview,
                            summary: row.summary || rowPreview,
                            overallSummary: row.overallSummary || rowPreview,
                            comments: rowComments,
                            sampleComments: rowComments,
                            channelTitle: row.channelTitle,
                            publishedAt: row.publishedAt,
                            preloadedResult: row.preloadedResult || row.abcdResult
                        };
                        if (!isListenTableItemDeleted(ytSource, companyName, deletedSet)) {
                            seenKeys.add(key);
                            extractedSources.push(ytSource);
                        }
                    }
                } else if (!isWebsite && (isReddit || !cleanTarget.startsWith('http'))) {
                    const key = `reddit:${cleanTarget.toLowerCase()}`;
                    const cleanSub = String(row.subreddit || cleanTarget).trim().replace(/^\/?r\//i, '').replace(/\/$/, '');
                    const redditUrl = /^https?:\/\//i.test(cleanTarget)
                        ? cleanTarget
                        : /^[A-Za-z0-9_]{2,21}$/.test(cleanSub) ? `https://www.reddit.com/r/${cleanSub}` : undefined;
                    if (!seenKeys.has(key)) {
                        const redditSource: NoiseSourceConfig = {
                            id: row.id || `src-reddit-table-${rIdx}-${vIdx}`,
                            type: 'reddit',
                            target: cleanTarget,
                            url: redditUrl,
                            subreddit: row.subreddit,
                            sourceStage: row.sourceStage,
                            label: row.title ? `Reddit: ${row.title}` : `Reddit Discussion (${cleanTarget})`,
                            targetCount: 25,
                            sentimentScore: typeof row.sentimentScore === 'number' ? row.sentimentScore : undefined,
                            contentPreview: rowPreview,
                            summary: row.summary || rowPreview,
                            overallSummary: row.overallSummary || rowPreview,
                            comments: rowComments,
                            sampleComments: rowComments,
                            preloadedResult: row.preloadedResult
                        };
                        if (!isListenTableItemDeleted(redditSource, companyName, deletedSet)) {
                            seenKeys.add(key);
                            extractedSources.push(redditSource);
                        }
                    }
                }
            });
        });

        return extractedSources.filter(s => !isListenTableItemDeleted(s, companyName, deletedSet));
    } catch (e) {
        console.warn('Failed to load sources from listen table:', e);
        return [];
    }
};

const normalizeNoiseSource = (s: any, idx: number = 0): NoiseSourceConfig => {
    const rawType = String(s?.type || 'youtube').toLowerCase();
    const rawTarget = String(s?.target || s?.url || (Array.isArray(s?.videos) ? s.videos[0] : '') || s?.id || '').trim();
    const type: 'youtube' | 'youtube_abcd' | 'steam' | 'reddit' | 'metacritic' =
        (rawType.includes('metacritic') || rawTarget.toLowerCase().includes('metacritic.com') || Array.isArray(s?.metacritic_reviews) || Array.isArray(s?.criticReviews) || Array.isArray(s?.userReviews)) ? 'metacritic' :
        rawType === 'steam' ? 'steam' :
        (rawType === 'reddit' || rawType === 'twitter' || rawType === 'twitch') ? 'reddit' :
        (rawType === 'youtube_abcd' || rawType === 'abcd' || rawType === 'competitor_abcd') ? 'youtube_abcd' :
        'youtube';
    const metacriticSlug = type === 'metacritic' ? extractMetacriticSlugFromTarget(rawTarget) : '';
    const target = type === 'metacritic'
        ? (metacriticSlug ? `https://www.metacritic.com/game/${metacriticSlug}/` : rawTarget)
        : rawTarget;
    const label = String(s?.label || s?.title || target || `${type.toUpperCase()} Source ${idx + 1}`).trim();
    const id = String(s?.id || `src-${type}-${idx}-${target.slice(0, 12).replace(/[^a-zA-Z0-9]/g, '') || idx}`);
    const targetCount = Number(s?.targetCount) || (type === 'metacritic' ? 250 : type === 'reddit' ? 25 : 850);
    const combinedMetacriticRevs = type === 'metacritic' ? collectAndDedupeMetacriticReviews(s) : undefined;
    const comments = Array.isArray(s?.comments)
        ? s.comments
        : Array.isArray(s?.sampleComments)
        ? s.sampleComments
        : Array.isArray(s?.preloadedResult?.comments)
        ? s.preloadedResult.comments
        : undefined;
    const contentPreview =
        s?.contentPreview ||
        s?.overallSummary ||
        s?.summary ||
        s?.description ||
        s?.preloadedResult?.summary ||
        undefined;

    return {
        id,
        type,
        target,
        label,
        targetCount,
        ...(typeof s?.abcdScore === 'number' ? { abcdScore: s.abcdScore } : {}),
        ...(s?.abcdAnalysisId ? { abcdAnalysisId: s.abcdAnalysisId } : {}),
        ...(s?.abcdResult ? { abcdResult: s.abcdResult } : {}),
        ...(typeof s?.sentimentScore === 'number' ? { sentimentScore: s.sentimentScore } : {}),
        ...(s?.sentimentAnalysisId ? { sentimentAnalysisId: s.sentimentAnalysisId } : {}),
        ...(contentPreview ? { contentPreview } : {}),
        ...(s?.description ? { description: s.description } : {}),
        ...(s?.summary ? { summary: s.summary } : {}),
        ...(s?.overallSummary ? { overallSummary: s.overallSummary } : {}),
        ...(comments ? { comments, sampleComments: comments } : {}),
        ...(s?.subreddit ? { subreddit: s.subreddit } : {}),
        ...(s?.sourceStage ? { sourceStage: s.sourceStage } : {}),
        ...(s?.channelTitle ? { channelTitle: s.channelTitle } : {}),
        ...(s?.publishedAt ? { publishedAt: s.publishedAt } : {}),
        ...(s?.url ? { url: s.url } : {}),
        ...(s?.videoId ? { videoId: s.videoId } : {}),
        ...(s?.preloadedResult ? { preloadedResult: s.preloadedResult } : {}),
        ...(combinedMetacriticRevs && combinedMetacriticRevs.length > 0 ? { cachedReviews: combinedMetacriticRevs } : (Array.isArray(s?.cachedReviews) ? { cachedReviews: s.cachedReviews } : {})),
        ...(s?.cachedJsonLdMetadata ? { cachedJsonLdMetadata: s.cachedJsonLdMetadata } : {}),
        ...(s?.crawledPages ? { crawledPages: s.crawledPages } : {})
    };
};

export const mergeListenTableSources = (
    currentSources: NoiseSourceConfig[],
    tableSources: NoiseSourceConfig[],
    companyName: string = 'test-company'
): NoiseSourceConfig[] => {
    const deletedSet = getDeletedListenItemIds(companyName);
    const safeCurrent = (Array.isArray(currentSources) ? currentSources : [])
        .filter(s => Boolean(s) && !isListenTableItemDeleted(s, companyName, deletedSet))
        .map((s, idx) => normalizeNoiseSource(s, idx));
    const safeTable = (Array.isArray(tableSources) ? tableSources : [])
        .filter(s => Boolean(s) && !isListenTableItemDeleted(s, companyName, deletedSet))
        .map((s, idx) => normalizeNoiseSource(s, idx + safeCurrent.length));

    const merged: NoiseSourceConfig[] = [...safeCurrent];
    const seen = new Map<string, NoiseSourceConfig>();

    const getNormalizedTarget = (s: NoiseSourceConfig) => {
        const targetStr = String(s.target || '');
        if (s.type === 'youtube' || s.type === 'youtube_abcd') return extractYouTubeId(targetStr) || targetStr.toLowerCase().trim();
        if (s.type === 'steam') return extractSteamAppId(targetStr);
        if (s.type === 'metacritic') return extractMetacriticSlugFromTarget(targetStr);
        return targetStr.toLowerCase().trim();
    };

    safeCurrent.forEach(s => {
        const norm = getNormalizedTarget(s);
        if (norm) seen.set(`${s.type}:${norm}`, s);
    });

    safeTable.forEach(ts => {
        const norm = getNormalizedTarget(ts);
        const key = `${ts.type}:${norm}`;
        if (!seen.has(key) && norm) {
            seen.set(key, ts);
            merged.push(ts);
        } else if (seen.has(key)) {
            const existing = seen.get(key)!;
            if (!existing.contentPreview && ts.contentPreview) existing.contentPreview = ts.contentPreview;
            if (!existing.summary && ts.summary) existing.summary = ts.summary;
            if ((!existing.comments || existing.comments.length === 0) && ts.comments) {
                existing.comments = ts.comments;
                existing.sampleComments = ts.comments;
            }
            if (!existing.abcdResult && ts.abcdResult) existing.abcdResult = ts.abcdResult;
            if (!existing.abcdScore && ts.abcdScore) existing.abcdScore = ts.abcdScore;
            if (!existing.sentimentScore && ts.sentimentScore) existing.sentimentScore = ts.sentimentScore;
            if (ts.type === 'metacritic') {
                const mergedRevs = collectAndDedupeMetacriticReviews(existing, ts);
                if (mergedRevs.length > 0) existing.cachedReviews = mergedRevs;
                if (!existing.cachedJsonLdMetadata && ts.cachedJsonLdMetadata) {
                    existing.cachedJsonLdMetadata = ts.cachedJsonLdMetadata;
                }
            }
        }
    });

    return merged.filter(s => !isListenTableItemDeleted(s, companyName, deletedSet));
};
