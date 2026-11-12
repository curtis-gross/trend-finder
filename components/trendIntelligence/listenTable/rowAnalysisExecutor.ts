import {
    analyzeAdVideo, analyzeRedditSentiment, analyzeSteamReviews,
    analyzeTikTokSentiment, analyzeTrustpilotSentiment, analyzeWebsite, analyzeYouTubeSentiment,
    generateCompetitiveAnalysis, groundedSearch
} from '../../../services/geminiService';
import { buildRichMetacriticAnalysis } from '../metacritic/metacriticNormalizer';

export const extractCommentsFromAnalysisPayload = (payload: any, fallbackRow?: any): any[] => {
    if (!payload && !fallbackRow) return [];
    const src = payload || fallbackRow?.result || fallbackRow?.preloadedResult || {};
    const candidates = [
        src.comments,
        src.commentsResult?.comments,
        src.commentsSentiment?.comments,
        src.rawComments,
        src.reviews,
        src.criticReviews && src.userReviews ? [...src.criticReviews, ...src.userReviews] : null,
        src.posts,
        fallbackRow?.preloadedResult?.comments,
        fallbackRow?.result?.comments
    ];
    for (const list of candidates) {
        if (Array.isArray(list) && list.length > 0) {
            return list.map((c: any, idx: number) => {
                if (typeof c === 'string') {
                    return { id: `c_${idx}`, author: 'Community Member', text: c, sentiment: 'neutral' };
                }
                return {
                    id: c.id || `c_${idx}`,
                    author: c.author || c.user || c.username || c.publication || c.channel || (fallbackRow?.type === 'reddit' ? 'u/CommunityMember' : 'Viewer'),
                    text: c.text || c.rawText || c.comment || c.body || c.quote || c.content || c.review || c.summary || '',
                    sentiment: c.sentiment || (typeof c.score === 'number' && c.score >= 70 ? 'positive' : 'neutral'),
                    score: c.score ?? c.upvotes ?? c.likes ?? c.likeCount,
                    timestamp: c.timestamp || c.date || c.publishedAt || '',
                    subreddit: c.subreddit || fallbackRow?.subreddit || src.subreddit || ''
                };
            }).filter((c: any) => c.text && String(c.text).trim().length > 0);
        }
    }
    return [];
};

export const fetchRowPreviewData = async ({
    row,
    companyName,
    getVideoId,
    fetchVideoTitle
}: {
    row: any;
    companyName: string;
    getVideoId: (url: string) => string;
    fetchVideoTitle: (videoId: string, type?: string) => Promise<void>;
}) => {
    const activeBrand = companyName || 'test-company';
    const firstVid = String((Array.isArray(row?.videos) && row.videos[0]) || row?.url || '').trim();
    const ytId = getVideoId(firstVid);
    const isValidYtId = /^[a-zA-Z0-9_-]{11}$/.test(ytId);

    const initialAnalysis = row.result || row.preloadedResult || null;
    let loadedAnalysis = initialAnalysis;
    let loadedAbcdAnalysis = row.type === 'abcd' ? initialAnalysis : null;
    const targetAnalysisId = row.analysisId || `analysis_${String(row.id).replace(/[^a-zA-Z0-9_-]/g, '_')}`;

    if (!loadedAnalysis && targetAnalysisId) {
        const aRes = await fetch(`/api/insights/analysis?companyName=${encodeURIComponent(activeBrand)}&analysisId=${encodeURIComponent(targetAnalysisId)}`);
        if (aRes.ok) {
            loadedAnalysis = await aRes.json().catch(() => null);
        }
    }

    const abcdIdToFetch = row.abcdAnalysisId || (row.type === 'abcd' ? (row.analysisId || `analysis_abcd_${ytId}`) : (isValidYtId ? `analysis_abcd_${ytId}` : null));
    if (!loadedAbcdAnalysis && abcdIdToFetch) {
        const abcdRes = await fetch(`/api/insights/analysis?companyName=${encodeURIComponent(activeBrand)}&analysisId=${encodeURIComponent(abcdIdToFetch)}`).catch(() => null);
        if (abcdRes && abcdRes.ok) {
            const abcdData = await abcdRes.json().catch(() => null);
            if (abcdData && (abcdData.abcd_scores || abcdData.scores || abcdData.type === 'abcd')) {
                loadedAbcdAnalysis = abcdData;
                if (row.type === 'abcd' && !loadedAnalysis) loadedAnalysis = abcdData;
            }
        }
    }

    let extractedComments = extractCommentsFromAnalysisPayload(loadedAnalysis, row);
    let commentError: string | null = null;

    if (extractedComments.length === 0 && isValidYtId) {
        try {
            fetchVideoTitle(ytId, row.type);
            const cRes = await fetch(`/api/youtube/comments?videoId=${encodeURIComponent(ytId)}&maxResults=40`);
            if (cRes.ok) {
                const cJson = await cRes.json().catch(() => []);
                const rawArr = Array.isArray(cJson) ? cJson : (Array.isArray(cJson?.comments) ? cJson.comments : []);
                extractedComments = rawArr.map((c: any, idx: number) => ({
                    id: c.id || `yt_${ytId}_${idx}`,
                    author: c.author || c.authorDisplayName || 'YouTube Viewer',
                    text: typeof c === 'string' ? c : (c.text || c.textDisplay || c.rawText || c.comment || ''),
                    sentiment: c.sentiment || 'neutral',
                    score: c.likeCount ?? c.likes ?? c.score,
                    timestamp: c.publishedAt || c.timestamp || ''
                })).filter((c: any) => c.text && String(c.text).trim().length > 0);
            } else {
                const errData = await cRes.json().catch(() => null);
                const detail = errData?.detail?.error || errData?.detail || errData?.error || `YouTube Comments API error (HTTP ${cRes.status})`;
                commentError = typeof detail === 'object' ? JSON.stringify(detail) : String(detail);
            }
        } catch (cFetchErr: any) {
            commentError = cFetchErr?.message || 'Failed to fetch YouTube comments.';
        }
    }

    if (extractedComments.length === 0) {
        try {
            const rawRunRes = await fetch(`/api/load-run/noise_filter_raw_comments?companyName=${encodeURIComponent(activeBrand)}`);
            if (rawRunRes.ok) {
                const rawRunJson = await rawRunRes.json().catch(() => null);
                const rawPool: any[] = rawRunJson?.runData?.rawComments || rawRunJson?.data?.rawComments || rawRunJson?.rawComments || [];
                if (Array.isArray(rawPool) && rawPool.length > 0) {
                    const matched = rawPool.filter((c: any) => {
                        if (!c) return false;
                        if (row.type === 'reddit') {
                            return String(c.source || '').toLowerCase().includes('reddit') || String(c.sourceLabel || '').toLowerCase().includes('reddit');
                        }
                        if (isValidYtId) {
                            return String(c.sourceUrl || c.videoId || c.id || '').includes(ytId);
                        }
                        return false;
                    });
                    if (matched.length > 0) {
                        extractedComments = matched.slice(0, 40).map((c: any, idx: number) => ({
                            id: c.id || `raw_${idx}`,
                            author: c.author || 'Community Member',
                            text: c.rawText || c.text || '',
                            sentiment: c.sentiment || 'neutral',
                            score: c.likes ?? c.score,
                            timestamp: c.timestamp || ''
                        })).filter((c: any) => c.text);
                    }
                }
            }
        } catch {}
    }

    return {
        loading: false,
        analysis: loadedAnalysis,
        abcdAnalysis: loadedAbcdAnalysis,
        comments: extractedComments,
        error: commentError || undefined
    };
};

export const executeRowAnalysisRequest = async ({
    row,
    companyName,
    getVideoId
}: {
    row: any;
    companyName: string;
    getVideoId: (url: string) => string;
}): Promise<{ analysisId: string; result: any }> => {
    const activeBrand = companyName || 'test-company';
    const videoUrl = row.videos?.[0] || row.url || '';
    let result: any = null;

    if (row.type === 'abcd') {
        result = await analyzeAdVideo(videoUrl, activeBrand);
    } else if (row.type === 'website_analysis') {
        result = await analyzeWebsite(videoUrl, row.focus || 'General analysis and customer sentiment', activeBrand);
    } else if (row.type === 'grounded_search') {
        result = await groundedSearch(videoUrl, activeBrand);
    } else if (row.type === 'youtube_sentiment' || row.type === 'sentiment_video' || row.type === 'sentiment_comments') {
        result = await analyzeYouTubeSentiment(videoUrl, activeBrand);
    } else if (row.type === 'fashion_analysis') {
        const { analyzeFashionTrends } = await import('../../../services/geminiService');
        result = await analyzeFashionTrends(videoUrl, activeBrand);
    } else if (row.type === 'trend_analysis') {
        const { analyzeGeneralTrends } = await import('../../../services/geminiService');
        result = await analyzeGeneralTrends(videoUrl, activeBrand);
    } else if (row.type === 'video_metadata') {
        const { extractVideoMetadata } = await import('../../../services/geminiService');
        result = await extractVideoMetadata(videoUrl, activeBrand);
    } else if (row.type === 'creator_partner') {
        const { analyzeCreatorPartnerVideo } = await import('../../../services/geminiService');
        result = await analyzeCreatorPartnerVideo(videoUrl, activeBrand);
    } else if (row.type === 'steam_reviews') {
        const reviewsRes = await fetch(`/api/steam/reviews?appId=${encodeURIComponent(videoUrl)}&maxReviews=250`);
        const contentType = reviewsRes.headers.get("content-type");
        if (reviewsRes.ok) {
            if (contentType && contentType.includes("application/json")) {
                const reviews = await reviewsRes.json();
                result = await analyzeSteamReviews(reviews, activeBrand);
            } else {
                const text = await reviewsRes.text();
                throw new Error(`Expected JSON from Steam reviews but received ${contentType}. Content: ${text.substring(0, 50)}`);
            }
        } else {
            const rawErr = await reviewsRes.text().catch(() => '');
            let detail = `HTTP ${reviewsRes.status}`;
            try {
                const parsedErr = rawErr ? JSON.parse(rawErr) : null;
                const errVal = parsedErr?.detail?.error ?? parsedErr?.detail ?? parsedErr?.error;
                if (errVal) detail = typeof errVal === 'string' ? errVal : JSON.stringify(errVal);
            } catch {
                if (rawErr) detail = `${detail}: ${rawErr.slice(0, 200)}`;
            }
            throw new Error(`Failed to fetch Steam reviews: ${detail}`);
        }
    } else if (row.type === 'metacritic_reviews') {
        if (row.preloadedResult && row.preloadedResult.reviews) {
            result = buildRichMetacriticAnalysis(row.preloadedResult, videoUrl, activeBrand);
        } else {
            const mcRes = await fetch('/api/metacritic/scan', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: videoUrl })
            });
            const mcData = await mcRes.json().catch(() => ({}));
            if (!mcRes.ok) throw new Error(mcData.error || `Metacritic scan failed with HTTP ${mcRes.status}`);
            result = buildRichMetacriticAnalysis(mcData, videoUrl, activeBrand);
        }
    } else if (row.type === 'trustpilot_sentiment') {
        let reviews = [];
        let business: any = {};
        const trustpilotRes = await fetch(`/api/trustpilot/reviews?url=${encodeURIComponent(videoUrl)}&limit=500`);
        const contentType = trustpilotRes.headers.get("content-type");
        if (trustpilotRes.ok && contentType && contentType.includes("application/json")) {
            const data = await trustpilotRes.json();
            reviews = data.reviews || [];
            business = data.business || {};
        } else if (!trustpilotRes.ok) {
            const errTxt = await trustpilotRes.text().catch(() => '');
            console.warn(`Trustpilot reviews fetch failed (HTTP ${trustpilotRes.status}): ${errTxt.slice(0, 200)}`);
        }
        result = await analyzeTrustpilotSentiment(reviews, activeBrand, business, videoUrl);
    } else if (
        row.type === 'reddit' ||
        (videoUrl && videoUrl.includes('reddit.com')) ||
        (typeof row.tag === 'string' && row.tag.includes('r/')) ||
        (typeof row.query === 'string' && row.query.toLowerCase().includes('reddit')) ||
        row.type === 'social_intelligence' ||
        row.type === 'social_feed'
    ) {
        const queryInput = videoUrl || row.tag || row.query || activeBrand;
        if (queryInput.includes('tiktok.com') || (typeof row.tag === 'string' && row.tag.startsWith('#'))) {
            result = await analyzeTikTokSentiment(queryInput, activeBrand, row.focus || row.guidance || '');
        } else {
            result = await analyzeRedditSentiment(queryInput, activeBrand, row.focus || row.guidance || '');
        }
    } else if (row.type === 'tiktok' || row.type === 'tiktok_hashtag' || (videoUrl && videoUrl.includes('tiktok.com'))) {
        const queryInput = videoUrl || row.tag || row.query || activeBrand;
        result = await analyzeTikTokSentiment(queryInput, activeBrand, row.focus || row.guidance || '');
    } else if (row.type === 'competitor_abcd') {
        result = await analyzeAdVideo(videoUrl, activeBrand, true);
    } else if (row.type === 'competitor_sentiment_video' || row.type === 'competitor_sentiment_comments' || row.type === 'competitor_youtube_sentiment') {
        result = await analyzeYouTubeSentiment(videoUrl, activeBrand, true);
    } else if (row.type === 'abcd_comparative' && (row.videos || []).length >= 2) {
        const [res1, res2] = await Promise.all([
            analyzeAdVideo(row.videos[0], activeBrand),
            analyzeAdVideo(row.videos[1], activeBrand)
        ]);
        if (res1 && res2) {
            const compResult = await generateCompetitiveAnalysis(res1, res2, activeBrand);
            result = { ...compResult, ad1: res1, ad2: res2 };
        } else {
            throw new Error("Comparative analysis failed: could not analyze both videos.");
        }
    } else if (row.type === 'comparative' && (row.videos || []).length >= 2) {
        const { analyzeVideoInsights, generateGeneralComparison } = await import('../../../services/geminiService');
        const [res1, res2] = await Promise.all([
            analyzeVideoInsights(row.videos[0], activeBrand),
            analyzeVideoInsights(row.videos[1], activeBrand)
        ]);
        if (res1 && res2) {
            result = await generateGeneralComparison(res1, res2, activeBrand);
        } else {
            throw new Error("Comparative analysis failed: could not analyze both videos.");
        }
    } else {
        result = await analyzeAdVideo(videoUrl, activeBrand);
    }

    if (!result) {
        throw new Error(`Analysis produced no result for ${row.type || 'item'}`);
    }

    const cleanId = String(row.id || '').replace(/[^a-zA-Z0-9_\-]/g, '_');
    const analysisId = `analysis_${cleanId}`;

    const saveRes = await fetch('/api/insights/analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            companyName: activeBrand,
            analysisId,
            result: { ...result, type: row.type, videos: row.videos }
        })
    });

    if (!saveRes.ok) {
        throw new Error(`Failed to save analysis to GCS (HTTP ${saveRes.status})`);
    }

    return { analysisId, result };
};
