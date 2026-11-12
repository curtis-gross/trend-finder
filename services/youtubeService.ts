/**
 * YouTube API Data Service
 * 
 * Provides unified, typed access to YouTube Data API endpoints routed through the backend:
 * - /api/youtube/search: Searches YouTube videos with ordering and filters.
 * - /api/youtube/comments: Retrieves audience comments for a video.
 * 
 * ENFORCES ZERO SILENT FALLBACKS:
 * Real errors (quota limits, missing keys, invalid requests) are thrown directly
 * and preserved with status codes and raw server diagnostics.
 */

export interface YouTubeVideoItem {
    videoId: string;
    id?: string;
    title: string;
    description: string;
    channelTitle: string;
    publishedAt: string;
    thumbnail: string;
    image?: string;
    videoUrl: string;
    url?: string;
    isShort: boolean;
    viewCount?: string;
    rawViewCount?: number;
    views?: string;
    formattedViews?: string;
    likeCount?: string;
    commentCount?: string;
    duration?: string;
    durationSeconds?: number;
    embeddable?: boolean;
    commentsEnabled?: boolean;
}

export interface YouTubeTrendsResponse {
    query: string;
    trending: YouTubeVideoItem[];
    topYear: YouTubeVideoItem[];
    shorts: YouTubeVideoItem[];
    videos?: YouTubeVideoItem[];
    monthlyBreakouts?: YouTubeVideoItem[];
    topShorts?: YouTubeVideoItem[];
    totalResults?: number;
    quotaUnits?: number;
    apiCalls?: number;
}

/**
 * Normalizes a video object across both backend schema variations
 * (Node Express schema vs Python schema vs direct YouTube Data API snippet)
 */
export function normalizeYouTubeVideo(raw: any, isShortHint: boolean = false): YouTubeVideoItem {
    if (!raw) {
        throw new Error("[YouTube Service] Attempted to normalize null or undefined video object.");
    }

    const vId = raw.videoId || raw.id?.videoId || raw.id || '';
    const durationSeconds = typeof raw.durationSeconds === 'number' ? raw.durationSeconds : undefined;
    const isShort = Boolean(
        raw.isShort ?? 
        (durationSeconds !== undefined && durationSeconds > 0 ? durationSeconds <= 60 : undefined) ??
        isShortHint ?? 
        raw.videoUrl?.includes('/shorts/') ?? 
        raw.url?.includes('/shorts/')
    );

    const videoUrl = raw.videoUrl || raw.url || (vId ? (isShort ? `https://www.youtube.com/shorts/${vId}` : `https://www.youtube.com/watch?v=${vId}`) : '');
    const viewsStr = raw.formattedViews || raw.views || (raw.viewCount ? `${raw.viewCount} views` : undefined);
    const rawViews = typeof raw.rawViewCount === 'number' 
        ? raw.rawViewCount 
        : (raw.viewCount ? parseInt(raw.viewCount, 10) || 0 : 0);

    const thumb = raw.thumbnail || raw.image || raw.snippet?.thumbnails?.high?.url || raw.snippet?.thumbnails?.medium?.url || raw.snippet?.thumbnails?.default?.url || '';

    return {
        videoId: vId,
        id: vId,
        title: raw.title || raw.snippet?.title || 'Untitled Video',
        description: raw.description || raw.snippet?.description || '',
        channelTitle: raw.channelTitle || raw.snippet?.channelTitle || 'YouTube Creator',
        publishedAt: raw.publishedAt || raw.snippet?.publishedAt || '',
        thumbnail: thumb,
        image: thumb,
        videoUrl,
        url: videoUrl,
        isShort,
        viewCount: raw.viewCount || (rawViews > 0 ? String(rawViews) : '0'),
        rawViewCount: rawViews,
        views: viewsStr,
        formattedViews: viewsStr,
        likeCount: raw.likeCount || '0',
        commentCount: raw.commentCount || '0',
        duration: raw.duration || (isShort ? '0:30' : 'Video'),
        durationSeconds,
        embeddable: raw.embeddable !== false,
        commentsEnabled: raw.commentsEnabled !== false
    };
}

/**
 * Normalizes a raw response from /api/youtube/search
 */
export function normalizeTrendsResponse(data: any, query: string): YouTubeTrendsResponse {
    if (!data || typeof data !== 'object') {
        throw new Error("[YouTube Service] Malformed API response: expected JSON object from YouTube endpoint.");
    }

    const trendingRaw = Array.isArray(data.trending) 
        ? data.trending 
        : (Array.isArray(data.videos) ? data.videos : (Array.isArray(data.items) ? data.items : []));

    const topYearRaw = Array.isArray(data.topYear) 
        ? data.topYear 
        : (Array.isArray(data.monthlyBreakouts) ? data.monthlyBreakouts : []);

    const shortsRaw = Array.isArray(data.shorts) 
        ? data.shorts 
        : (Array.isArray(data.topShorts) ? data.topShorts : []);

    const trending = trendingRaw.map(v => normalizeYouTubeVideo(v, false)).filter(v => Boolean(v.videoId));
    const topYear = topYearRaw.map(v => normalizeYouTubeVideo(v, false)).filter(v => Boolean(v.videoId));
    const shorts = shortsRaw.map(v => normalizeYouTubeVideo(v, true)).filter(v => Boolean(v.videoId));

    return {
        query: data.query || query,
        trending,
        topYear,
        shorts,
        videos: trending,
        monthlyBreakouts: topYear,
        topShorts: shorts,
        totalResults: trending.length + topYear.length + shorts.length,
        ...(typeof data.quotaUnits === 'number' ? { quotaUnits: data.quotaUnits } : {}),
        ...(typeof data.apiCalls === 'number' ? { apiCalls: data.apiCalls } : {})
    };
}

/**
 * Builds a human-readable error from a failed backend response.
 * FastAPI wraps errors as { detail: ... }; YouTube errors arrive as { error: { code, message, errors[] } }.
 * The upstream payload is preserved verbatim so quotaExceeded is visible in the UI.
 */
async function readYouTubeError(res: Response, context: string): Promise<string> {
    let errMessage = `${context} (HTTP ${res.status})`;
    const rawText = await res.text().catch(() => '');
    if (!rawText) return errMessage;
    try {
        const parsed = JSON.parse(rawText);
        const payload = parsed?.detail ?? parsed;
        const upstream = payload?.error ?? payload;
        if (typeof upstream === 'string') {
            errMessage = `${errMessage}: ${upstream}`;
        } else if (upstream && typeof upstream === 'object') {
            const reason = Array.isArray(upstream.errors) ? upstream.errors[0]?.reason : undefined;
            const msg = upstream.message || JSON.stringify(upstream);
            errMessage = `${errMessage}: ${reason ? `[${reason}] ` : ''}${msg}`;
        }
    } catch {
        errMessage = `${errMessage}: ${rawText.slice(0, 300)}`;
    }
    return errMessage;
}

async function fetchTrendsFromSearch(
    query: string,
    options?: { maxResults?: number; order?: 'viewCount' | 'relevance' | 'date'; publishedAfter?: string }
): Promise<YouTubeTrendsResponse> {
    const trimmed = query.trim();
    if (!trimmed) {
        throw new Error("[YouTube Service] Search query cannot be empty.");
    }

    const params = new URLSearchParams({
        q: trimmed,
        maxResults: String(Math.min(options?.maxResults || 20, 25)),
        order: options?.order || 'relevance'
    });
    if (options?.publishedAfter) {
        params.set('publishedAfter', options.publishedAfter);
    }

    // Quota budget: exactly 1 search.list (100u) + 1 batched videos.list (1u) = 101 units per call.
    const url = `/api/youtube/search?${params.toString()}`;
    console.log(`[YouTube Service] search.list q="${trimmed}" (budget: 101 quota units)`);
    const res = await fetch(url, { headers: { 'Accept': 'application/json' } });

    if (!res.ok) {
        const errMessage = await readYouTubeError(res, 'YouTube Search API error');
        console.error(`[YouTube Service] Search failed for query "${trimmed}":`, errMessage);
        throw new Error(errMessage);
    }

    const json = await res.json();
    if (typeof json?.quotaUnits === 'number') {
        console.log(`[YouTube Service] q="${trimmed}" results=${json.totalResults ?? 0} units=${json.quotaUnits} calls=${json.apiCalls ?? '?'}`);
    }
    return normalizeTrendsResponse(json, trimmed);
}

/**
 * Fetches YouTube videos for a query. One search.list + one videos.list per call.
 * Throws explicit error on API failure, quota limit, or missing configuration.
 */
export async function fetchYouTubeTrends(query: string): Promise<YouTubeTrendsResponse> {
    return fetchTrendsFromSearch(query, { maxResults: 20, order: 'relevance' });
}

/**
 * Searches YouTube videos with custom ordering and options
 */
export async function searchYouTubeVideos(
    query: string, 
    options?: { maxResults?: number; order?: 'viewCount' | 'relevance' | 'date'; publishedAfter?: string }
): Promise<YouTubeTrendsResponse> {
    return fetchTrendsFromSearch(query, options);
}

/**
 * Extracts standard 11-character video ID from any YouTube URL or string
 */
export function extractYouTubeVideoId(input: string): string | null {
    if (!input || typeof input !== 'string') return null;
    const trimmed = input.trim();
    const urlMatch = trimmed.match(
        /(?:https?:\/\/)?(?:www\.|m\.)?(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|live\/|watch\?.+&v=))([\w-]{11})/i
    );
    if (urlMatch && urlMatch[1]) return urlMatch[1];
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    return null;
}

export interface YouTubeCommentsResult {
    comments: any[];
    videoTitle?: string;
    totalVideoComments?: number;
    recentCount?: number;
    backfillCount?: number;
    quotaUnits?: number;
}

/**
 * Fetches audience comments for a YouTube video from /api/youtube/comments.
 * Throws on any non-OK response with the server's error text. Never returns [] on failure.
 */
export async function fetchYouTubeCommentsWithMeta(
    videoId: string,
    options?: { maxResults?: number; publishedAfter?: string; allowBackfill?: boolean; order?: 'time' | 'relevance' }
): Promise<YouTubeCommentsResult> {
    const cleanId = extractYouTubeVideoId(videoId);
    if (!cleanId) {
        throw new Error(`[YouTube Service] "${videoId}" is not a valid YouTube video id or URL.`);
    }
    const params = new URLSearchParams({
        videoId: cleanId,
        maxResults: String(options?.maxResults ?? 100)
    });
    if (options?.publishedAfter) params.set('publishedAfter', options.publishedAfter);
    if (options?.allowBackfill) params.set('allowBackfill', 'true');
    if (options?.order) params.set('order', options.order);

    const res = await fetch(`/api/youtube/comments?${params.toString()}`);
    if (!res.ok) {
        const errMessage = await readYouTubeError(res, `YouTube comments fetch failed for ${cleanId}`);
        console.error(`[YouTube Service] ${errMessage}`);
        throw new Error(errMessage);
    }

    const data = await res.json();
    const comments = Array.isArray(data) ? data : (Array.isArray(data?.comments) ? data.comments : []);
    const header = (name: string) => (typeof res.headers?.get === 'function' ? res.headers.get(name) : null);
    const toInt = (v: string | null | undefined) => (v !== null && v !== undefined && v !== '' ? parseInt(String(v), 10) : undefined);
    const rawTitle = header('x-video-title');

    return {
        comments,
        videoTitle: data?.videoTitle || (rawTitle ? decodeURIComponent(rawTitle) : undefined),
        totalVideoComments: toInt(data?.totalVideoComments ?? header('x-total-video-comments')),
        recentCount: toInt(data?.recentCount ?? header('x-recent-count')),
        backfillCount: toInt(data?.backfillCount ?? header('x-backfill-count')),
        quotaUnits: toInt(data?.quotaUnits ?? header('x-quota-units'))
    };
}

