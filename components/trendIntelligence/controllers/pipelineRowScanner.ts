import {
    analyzeAdVideo, analyzeRedditSentiment, analyzeSteamReviews,
    analyzeTikTokSentiment, analyzeTrustpilotSentiment, analyzeWebsite, analyzeYouTubeSentiment,
    groundedSearch
} from '../../../services/geminiService';
import { buildRichMetacriticAnalysis } from '../metacritic/metacriticNormalizer';
import { getVideoId } from '../typesAndConstants';

export interface PipelineRowScanContext {
    activeComp: string;
    cachedById: Record<string, any>;
    cachedAbcdByVid: Record<string, any>;
    cachedSentByVid: Record<string, any>;
    cachedByTarget: Record<string, any>;
    processedYtIds: Set<string>;
    resultsMap: Record<string, any>;
    queueSaveAnalysis: (analysisId: string, payload: any) => void;
    updateRunningRows: (updater: (prev: any[]) => any[]) => void;
}

export const scanSinglePipelineRow = async (row: any, ctx: PipelineRowScanContext) => {
    const {
        activeComp, cachedById, cachedAbcdByVid, cachedSentByVid, cachedByTarget,
        processedYtIds, resultsMap, queueSaveAnalysis, updateRunningRows
    } = ctx;

    const rawTarget = (Array.isArray(row?.videos) && row.videos[0]) || row?.url || row?.tag || row?.query || '';
    const ytId = getVideoId(String(rawTarget));
    const isYtRow = ['youtube', 'youtube_sentiment', 'sentiment_video', 'sentiment_comments', 'abcd', 'youtube_abcd', 'creator_partner', 'fashion_analysis', 'trend_analysis'].includes(row.type) ||
        String(rawTarget).includes('youtube.com') ||
        String(rawTarget).includes('youtu.be') ||
        /^[a-zA-Z0-9_-]{11}$/.test(ytId);

    const cleanRowId = String(row.id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const rowAnalysisId = `analysis_${cleanRowId}`;

    if (isYtRow && ytId) {
        const fullUrl = ytId.startsWith('http') ? ytId : `https://www.youtube.com/watch?v=${ytId}`;
        const cleanVidId = String(ytId).replace(/[^a-zA-Z0-9_-]/g, '_');
        const abcdAnalysisId = `analysis_abcd_${cleanVidId}`;
        const sentAnalysisId = `analysis_sentiment_${cleanVidId}`;

        let abcdResult: any = cachedAbcdByVid[ytId] || cachedById[abcdAnalysisId] || cachedById[`ad_analysis_${ytId}`] || null;
        let abcdScorePct: number | null = typeof row.abcdScore === 'number' ? row.abcdScore : null;
        let sentResult: any = cachedSentByVid[ytId] || cachedById[sentAnalysisId] || null;
        let sentScorePct: number | null = typeof row.sentimentScore === 'number' ? row.sentimentScore : null;
        let abcdError: string | null = null;
        let sentError: string | null = null;

        const alreadyScanned = processedYtIds.has(ytId) && resultsMap[ytId];
        if (alreadyScanned) {
            abcdResult = resultsMap[ytId].abcd;
            abcdScorePct = resultsMap[ytId].abcdScore ?? abcdScorePct;
            sentResult = resultsMap[ytId].sentiment;
            sentScorePct = resultsMap[ytId].sentimentScore ?? sentScorePct;
        } else {
            processedYtIds.add(ytId);

            const computeAbcdPctFromObj = (obj: any, fallback: number | null): number | null => {
                if (typeof obj?.overallScorePercent === 'number') return Math.round(obj.overallScorePercent);
                const s = obj?.abcd_scores || obj?.scores;
                if (!s) return fallback;
                const vals = [
                    s.attract?.score ?? s.attract,
                    s.brand?.score ?? s.brand,
                    s.connect?.score ?? s.connect,
                    s.direct?.score ?? s.direct
                ]
                    .map((v: any) => Number(v))
                    .filter((n: number) => !Number.isNaN(n));
                if (vals.length === 0) return fallback;
                const avg = vals.reduce((a: number, b: number) => a + b, 0) / vals.length;
                return Math.round(avg <= 10 ? avg * 10 : avg);
            };

            if (abcdResult) abcdScorePct = computeAbcdPctFromObj(abcdResult, abcdScorePct);
            if (sentResult && typeof sentResult.overallScorePercent === 'number') sentScorePct = Math.round(sentResult.overallScorePercent);

            const abcdTask = abcdResult
                ? Promise.resolve(abcdResult)
                : (async () => {
                    try {
                        const res = await analyzeAdVideo(fullUrl, activeComp);
                        if (!res) throw new Error(`ABCD video analysis returned empty result for ${ytId}`);
                        abcdScorePct = computeAbcdPctFromObj(res, abcdScorePct);
                        queueSaveAnalysis(abcdAnalysisId, { ...res, type: 'abcd', videos: [ytId] });
                        return res;
                    } catch (abcdErr: any) {
                        abcdError = abcdErr?.message || String(abcdErr);
                        console.warn(`[Pipeline Scan] ABCD update warning for ${ytId}:`, abcdError);
                        return null;
                    }
                })();

            const hasCachedSentComments = Boolean(
                sentResult &&
                ((Array.isArray(sentResult?.comments) && sentResult.comments.length > 0) ||
                 (Array.isArray(sentResult?.commentsSentiment?.comments) && sentResult.commentsSentiment.comments.length > 0) ||
                 (Array.isArray(sentResult?.commentsResult?.comments) && sentResult.commentsResult.comments.length > 0))
            );

            const sentTask = hasCachedSentComments
                ? Promise.resolve(sentResult)
                : (async () => {
                    try {
                        const freshSent = await analyzeYouTubeSentiment(fullUrl, activeComp);
                        if (freshSent) {
                            if (typeof freshSent.overallScorePercent === 'number') {
                                sentScorePct = Math.round(freshSent.overallScorePercent);
                            }
                            queueSaveAnalysis(sentAnalysisId, { ...freshSent, type: 'youtube_sentiment', videos: [ytId] });
                        }
                        return freshSent;
                    } catch (sentErr: any) {
                        sentError = sentErr?.message || String(sentErr);
                        console.warn(`[Pipeline Scan] Sentiment/comments update warning for ${ytId}:`, sentError);
                        return sentResult;
                    }
                })();

            const [resolvedAbcd, resolvedSent] = await Promise.all([abcdTask, sentTask]);
            abcdResult = resolvedAbcd;
            sentResult = resolvedSent;
        }

        const primaryResult = row.type === 'abcd' ? (abcdResult || sentResult) : (sentResult || abcdResult);
        if (!primaryResult) {
            const combinedErr = [sentError, abcdError].filter(Boolean).join(' | ') || `Analysis failed for YouTube video ${ytId}.`;
            updateRunningRows(prev => prev.map(r => {
                const rVid = getVideoId(String((Array.isArray(r?.videos) && r.videos[0]) || r?.url || ''));
                if (r.id === row.id || (rVid && rVid === ytId)) {
                    return {
                        ...r,
                        status: 'error',
                        abcdStatus: abcdError ? 'error' : r.abcdStatus,
                        sentimentStatus: sentError ? 'error' : r.sentimentStatus,
                        error: combinedErr
                    };
                }
                return r;
            }));
            throw new Error(combinedErr);
        }

        if (!cachedById[rowAnalysisId]) {
            queueSaveAnalysis(rowAnalysisId, { ...primaryResult, type: row.type, videos: [ytId] });
        }

        const combinedEntry = {
            videoId: ytId,
            abcd: abcdResult,
            abcdScore: abcdScorePct,
            abcdAnalysisId,
            sentiment: sentResult,
            sentimentScore: sentScorePct,
            sentimentAnalysisId: sentAnalysisId,
            comments: sentResult?.commentsSentiment || sentResult?.commentsResult || null,
            result: primaryResult
        };
        resultsMap[ytId] = combinedEntry;
        resultsMap[row.id] = combinedEntry;
        resultsMap[rowAnalysisId] = combinedEntry;

        updateRunningRows(prev => prev.map(r => {
            const rVid = getVideoId(String((Array.isArray(r?.videos) && r.videos[0]) || r?.url || ''));
            if (r.id === row.id || (rVid && rVid === ytId)) {
                return {
                    ...r,
                    status: 'completed',
                    analysisId: r.id === row.id ? rowAnalysisId : (r.analysisId || rowAnalysisId),
                    abcdStatus: abcdResult ? 'completed' : (abcdError ? 'error' : r.abcdStatus),
                    abcdAnalysisId,
                    abcdScore: abcdScorePct,
                    sentimentStatus: sentResult ? 'completed' : (sentError ? 'error' : r.sentimentStatus),
                    sentimentAnalysisId: sentAnalysisId,
                    sentimentScore: sentScorePct,
                    result: primaryResult,
                    preloadedResult: r.preloadedResult || sentResult || primaryResult,
                    error: null
                };
            }
            return r;
        }));
        return;
    }

    let nonYtResult: any = null;
    const existingCached =
        row.result ||
        row.preloadedResult ||
        cachedById[rowAnalysisId] ||
        (row.analysisId ? cachedById[row.analysisId] : null) ||
        (rawTarget ? cachedByTarget[String(rawTarget)] : null);

    try {
        if (row.type === 'metacritic_reviews' || String(rawTarget).includes('metacritic.com')) {
            const mcTargetUrl = String(rawTarget || '').startsWith('http') ? String(rawTarget) : 'https://www.metacritic.com/';
            if (existingCached && Array.isArray(existingCached.reviews) && existingCached.reviews.length >= 100) {
                nonYtResult = buildRichMetacriticAnalysis(existingCached, mcTargetUrl, activeComp);
            } else {
                try {
                    const mcRes = await fetch('/api/metacritic/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: mcTargetUrl })
                    });
                    const mcData = await mcRes.json().catch(() => ({}));
                    if (mcRes.ok && Array.isArray(mcData.reviews) && mcData.reviews.length > 0) {
                        nonYtResult = buildRichMetacriticAnalysis(mcData, mcTargetUrl, activeComp);
                    } else if (existingCached && Array.isArray(existingCached.reviews)) {
                        nonYtResult = buildRichMetacriticAnalysis(existingCached, mcTargetUrl, activeComp);
                    } else {
                        throw new Error(mcData.error || `Metacritic scan failed with HTTP ${mcRes.status}`);
                    }
                } catch (mcErr) {
                    if (existingCached && Array.isArray(existingCached.reviews)) {
                        nonYtResult = buildRichMetacriticAnalysis(existingCached, mcTargetUrl, activeComp);
                    } else {
                        throw mcErr;
                    }
                }
            }
        } else if (
            existingCached &&
            (Array.isArray(existingCached.comments) ||
             Array.isArray(existingCached.reviews) ||
             Array.isArray(existingCached.posts) ||
             Array.isArray(existingCached.videos) ||
             existingCached.summary)
        ) {
            nonYtResult = existingCached;
        } else if (row.type === 'steam_reviews') {
            const reviewsRes = await fetch(`/api/steam/reviews?appId=${encodeURIComponent(rawTarget)}&maxReviews=250`);
            if (!reviewsRes.ok) {
                const rawErr = await reviewsRes.text().catch(() => '');
                let detail = `HTTP ${reviewsRes.status}`;
                try {
                    const parsedErr = rawErr ? JSON.parse(rawErr) : null;
                    const rawDetail = parsedErr?.detail?.error ?? parsedErr?.detail ?? parsedErr?.error;
                    if (rawDetail) detail = typeof rawDetail === 'string' ? rawDetail : JSON.stringify(rawDetail);
                } catch {
                    if (rawErr) detail = `${detail}: ${rawErr.slice(0, 200)}`;
                }
                throw new Error(`Failed to fetch Steam reviews: ${detail}`);
            }
            const reviews = await reviewsRes.json();
            nonYtResult = await analyzeSteamReviews(reviews, activeComp);
        } else if (row.type === 'trustpilot_sentiment') {
            let reviews = [];
            let business: any = {};
            const tpRes = await fetch(`/api/trustpilot/reviews?url=${encodeURIComponent(rawTarget)}&limit=500`);
            if (tpRes.ok) {
                const tpData = await tpRes.json();
                reviews = tpData.reviews || [];
                business = tpData.business || {};
            } else {
                const tpErr = await tpRes.text().catch(() => '');
                console.warn(`[Pipeline Scan] Trustpilot fetch failed (HTTP ${tpRes.status}): ${tpErr.slice(0, 200)}`);
            }
            nonYtResult = await analyzeTrustpilotSentiment(reviews, activeComp, business, rawTarget);
        } else if (row.type === 'tiktok' || row.type === 'tiktok_hashtag' || String(rawTarget).includes('tiktok.com')) {
            nonYtResult = await analyzeTikTokSentiment(rawTarget || activeComp, activeComp, row.focus || row.guidance || '');
        } else if (row.type === 'reddit' || row.type === 'social_intelligence' || row.type === 'social_feed' || String(rawTarget).includes('reddit.com') || String(rawTarget).includes('r/')) {
            nonYtResult = await analyzeRedditSentiment(rawTarget || activeComp, activeComp, row.focus || row.guidance || '');
        } else if (row.type === 'website_analysis') {
            nonYtResult = await analyzeWebsite(rawTarget, row.focus || 'General analysis and customer sentiment', activeComp);
        } else if (row.type === 'grounded_search') {
            nonYtResult = await groundedSearch(rawTarget, activeComp);
        }
    } catch (nonYtErr: any) {
        const errMsg = nonYtErr?.message || String(nonYtErr) || `Analysis failed for ${row.type || 'source'}`;
        updateRunningRows(prev => prev.map(r => r.id === row.id ? { ...r, status: 'error', error: errMsg } : r));
        throw nonYtErr instanceof Error ? nonYtErr : new Error(errMsg);
    }

    if (nonYtResult) {
        const persistedPayload = { ...nonYtResult, type: row.type, videos: row.videos || [rawTarget] };
        if (!cachedById[rowAnalysisId] || row.type === 'metacritic_reviews') {
            queueSaveAnalysis(rowAnalysisId, persistedPayload);
        }
        resultsMap[row.id] = nonYtResult;
        resultsMap[rowAnalysisId] = nonYtResult;
        if (rawTarget) resultsMap[String(rawTarget)] = nonYtResult;
        updateRunningRows(prev => prev.map(r => r.id === row.id ? {
            ...r,
            status: 'completed',
            analysisId: rowAnalysisId,
            preloadedResult: row.type === 'metacritic_reviews' ? nonYtResult : (r.preloadedResult || nonYtResult),
            result: nonYtResult,
            error: null
        } : r));
    }
};
