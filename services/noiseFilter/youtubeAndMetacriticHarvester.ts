import {
    GEMINI_MODELS,
    callGenAiProxy,
    extractGroundingWebChunks,
    extractTextFromResponse,
    safeJsonParse,
} from '../geminiService';
import { fetchYouTubeCommentsWithMeta, searchYouTubeVideos, type YouTubeCommentsResult } from '../youtubeService';
import {
    type HarvestSourceError,
    type NoiseSourceConfig,
    type RawComment,
} from './noiseTypes';
import {
    detectCommentLanguage,
    extractCommentYear,
    formatCommentTimestamp,
} from './languageAndTimeUtils';
import {
    collectAndDedupeMetacriticReviews,
    extractMetacriticSlugFromTarget,
    extractSteamAppId,
    extractYouTubeId,
} from './listenTableBlocklist';
import { sendTerminalLog } from './stageGcsCacheClient';

export type { HarvestSourceError } from './noiseTypes';

const YT_WATCH = 'https://www.youtube.com/watch?v=';
const SYNTHETIC_URL_RE = /(example\.(com|org|net)|placeholder|localhost|127\.0\.0\.1|your[-_]?(url|link)|lorem|\.\.\.|\{|\})/i;
type GroundingChunk = { uri: string; title?: string };

/** True only for well-formed http(s) URLs that are not synthetic/example placeholders. */
export const isVerifiedSourceUrl = (u: unknown): u is string =>
    typeof u === 'string' && /^https?:\/\/[^\s/]+\.[^\s]+$/i.test(u.trim()) && !SYNTHETIC_URL_RE.test(u);

const hostOf = (u: string): string => {
    try { return new URL(u).hostname.replace(/^www\./i, '').toLowerCase(); } catch { return ''; }
};

/**
 * Resolve a grounded item's URL. Accept the model's URL only when grounding metadata cites the same URL
 * or domain; otherwise fall back to a verified grounding chunk URI, then a real source URL. Never invents one.
 */
export const resolveGroundedSourceUrl = (
    candidate: unknown,
    chunks: GroundingChunk[],
    domainHint?: RegExp,
    fallbackUrl?: string
): string | undefined => {
    const verified = chunks.filter(c => isVerifiedSourceUrl(c?.uri));
    if (isVerifiedSourceUrl(candidate)) {
        const host = hostOf(candidate);
        const cited = verified.some(c => c.uri === candidate || (host && (hostOf(c.uri) === host || String(c.title || '').toLowerCase().includes(host))));
        if (cited) return candidate.trim();
    }
    const domainChunk = domainHint ? verified.find(c => domainHint.test(c.uri) || domainHint.test(String(c.title || ''))) : undefined;
    if (domainChunk) return domainChunk.uri;
    if (verified[0]) return verified[0].uri;
    return isVerifiedSourceUrl(fallbackUrl) ? fallbackUrl : undefined;
};

/** Google Search grounded generation that also returns the verified grounding web chunks. */
export const generateGroundedWithSources = async (
    prompt: string,
    model: string = GEMINI_MODELS.FLASH_LITE
): Promise<{ text: string; chunks: GroundingChunk[] }> => {
    const response = await callGenAiProxy('generateContent', {
        model,
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        config: { tools: [{ googleSearch: {} }] }
    });
    return { text: extractTextFromResponse(response) || '', chunks: extractGroundingWebChunks(response) };
};

const readHttpErrorMessage = async (res: Response, context: string): Promise<string> => {
    const raw = await res.text().catch(() => '');
    if (!raw) return `${context} (HTTP ${res.status})`;
    try {
        const parsed = JSON.parse(raw);
        const detail = parsed?.detail?.error ?? parsed?.detail ?? parsed?.error ?? parsed?.message ?? parsed;
        const msg = typeof detail === 'string' ? detail : (detail?.message || JSON.stringify(detail));
        return `${context} (HTTP ${res.status}): ${msg}`;
    } catch {
        return `${context} (HTTP ${res.status}): ${raw.slice(0, 300)}`;
    }
};

export const harvestYouTubeSource = async (
    src: NoiseSourceConfig,
    companyName: string = 'test-company',
    _errors: HarvestSourceError[] = []
): Promise<RawComment[]> => {
    const sourceComments: RawComment[] = [];
    let videoId = extractYouTubeId(src.target);
    const ytTarget = src.targetCount || 950;
    const fourteenDaysAgoIso = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
    const cleanSearchQuery = String(src.target || src.label || companyName)
        .replace(/^youtube(\s+abcd)?\s*:\s*/i, '')
        .trim();

    if (!videoId && cleanSearchQuery) {
        await sendTerminalLog(`[YouTube Ingest] Resolving YouTube topic query "${cleanSearchQuery}" via YouTube Search...`, 'worker');
        const searchRes = await searchYouTubeVideos(cleanSearchQuery, { maxResults: 5, order: 'relevance' });
        const candidates = [
            ...(searchRes.videos || []),
            ...(searchRes.trending || []),
            ...(searchRes.topYear || []),
            ...(searchRes.shorts || [])
        ];
        for (const cand of candidates) {
            const candId = extractYouTubeId(String(cand?.videoId || cand?.id || cand?.url || ''));
            if (candId) {
                videoId = candId;
                await sendTerminalLog(`[YouTube Ingest] Resolved topic "${cleanSearchQuery}" to YouTube Video ID: ${videoId} ("${cand.title || cleanSearchQuery}")`, 'info');
                break;
            }
        }
    }

    if (videoId) {
        await sendTerminalLog(`[YouTube Ingest] Fetching up to ${ytTarget} comments from YouTube (14-Day Window): ${videoId}`, 'worker');

        let ytResult: YouTubeCommentsResult;
        try {
            ytResult = await fetchYouTubeCommentsWithMeta(videoId, {
                maxResults: ytTarget,
                publishedAfter: fourteenDaysAgoIso,
                allowBackfill: true,
                order: 'time'
            });
        } catch (ytErr: any) {
            const message = ytErr?.message || String(ytErr);
            console.error(`[YouTube Ingest Error] ${src.label} (${videoId}):`, message);
            await sendTerminalLog(`[YouTube Ingest Error] ${src.label}: ${message.slice(0, 300)}`, 'error');
            throw ytErr instanceof Error ? ytErr : new Error(message);
        }

        const commentsList = ytResult.comments;
        const recentCount = ytResult.recentCount ?? commentsList.filter((c: any) => !c.isHistoricalBackfill).length;
        const backfillCount = ytResult.backfillCount ?? commentsList.filter((c: any) => Boolean(c.isHistoricalBackfill)).length;
        const totalVideoComments = ytResult.totalVideoComments;
        const statusDetail = totalVideoComments !== undefined
            ? `(Video has ${totalVideoComments} total comments on YouTube • Harvested ${commentsList.length}${commentsList.length >= ytTarget ? ` [Cap: ${ytTarget}]` : ' [All Available]'})`
            : `(Harvested ${commentsList.length} • Target: ${ytTarget})`;
        await sendTerminalLog(`[YouTube Ingest] Fetched ${commentsList.length} comments from YouTube (${videoId}) "${ytResult.videoTitle || src.label}" [14-Day Window + Adaptive Backfill] ${statusDetail} • ${ytResult.quotaUnits ?? '?'} quota units`, 'info');
        await sendTerminalLog(`[Harvest] ${recentCount} recent (<14d), ${backfillCount} historical backfill comments`, 'worker');
        if (commentsList.length === 0) {
            await sendTerminalLog(`[YouTube Ingest] 0 comments returned for ${src.label}. The video has ${totalVideoComments ?? 'unknown'} comments on YouTube; none matched the 14-day window.`, 'worker');
        }
        const videoUrl = `${YT_WATCH}${videoId}`;
        const sourceUrl = isVerifiedSourceUrl(src.url) ? src.url : videoUrl;
        const videoTitle = ytResult.videoTitle || src.label;
        commentsList.forEach((c: any, cIdx: number) => {
            const commentYear = extractCommentYear(c.publishedAt || c.publishedTime || c.date) || '2026';
            const commentText = c.text || c.content || '';
            const detectedLang = detectCommentLanguage(c.country, commentText);
            sourceComments.push({
                id: `yt-${c.id || Math.random().toString(36).substr(2, 7)}`,
                rawText: commentText,
                author: c.author || 'YouTube Viewer',
                release: commentYear,
                period: commentYear,
                source: 'YouTube Comments',
                sourceLabel: src.label,
                timestamp: formatCommentTimestamp(c.publishedAt || c.publishedTime || c.date, commentYear, cIdx),
                language: detectedLang,
                country: detectedLang,
                isHistoricalBackfill: Boolean(c.isHistoricalBackfill),
                videoId: videoId!,
                videoUrl,
                sourceUrl,
                videoTitle,
                channelTitle: src.channelTitle
            });
        });
    } else {
        await sendTerminalLog(`[YouTube Ingest] Grounding YouTube community comments via Gemini Search for topic: "${cleanSearchQuery || src.label}"...`, 'worker');
        const ytGroundPrompt = `You are a YouTube community intelligence extractor for ${companyName}.
Search and extract authentic viewer comments, reactions, complaints, and praise from YouTube videos posted in the LAST 14 DAYS regarding:
"${cleanSearchQuery || src.label}" for ${companyName}.

Extract up to 35 authentic viewer quotes with author handles, relative timestamp within the last 14 days (e.g. "today", "2 days ago", "5 days ago"), language ("English", "Spanish", etc.), and sentiment ("positive" | "negative" | "neutral").
Return a valid JSON array of objects:
[
  {
    "author": "@YouTubeViewer",
    "text": "Authentic viewer comment regarding ${cleanSearchQuery || companyName}",
    "sentiment": "positive" | "negative" | "neutral",
    "timestamp": "3 days ago",
    "language": "English",
    "sourceUrl": "Real YouTube video URL the comment came from, or null if unknown"
  }
]
Return JSON array only.`;

        const { text: ytText, chunks } = await generateGroundedWithSources(ytGroundPrompt, GEMINI_MODELS.FLASH_LITE);
        const parsedYt = safeJsonParse(ytText);
        if (!Array.isArray(parsedYt)) {
            throw new Error(`YouTube grounded extraction failed to return JSON array for "${cleanSearchQuery || src.label}"`);
        }
        if (parsedYt.length > 0) {
            await sendTerminalLog(`[YouTube Ingest] Grounded ${parsedYt.length} YouTube community comments for "${cleanSearchQuery || src.label}"`, 'info');
            parsedYt.forEach((item: any, fIdx: number) => {
                const commentYear = extractCommentYear(item.timestamp || item.date) || '2026';
                const commentText = String(item.text || '').trim();
                if (!commentText) return;
                const detectedLang = item.language || detectCommentLanguage(item.country, commentText);
                const groundedUrl = resolveGroundedSourceUrl(item.sourceUrl || item.url, chunks, /youtube\.com|youtu\.be/i);
                const groundedId = groundedUrl ? extractYouTubeId(groundedUrl) : '';
                const groundedVideoId = groundedId && /^[A-Za-z0-9_-]{11}$/.test(groundedId) && /youtube\.com|youtu\.be/i.test(groundedUrl!) ? groundedId : undefined;
                sourceComments.push({
                    id: `yt-ground-${Math.random().toString(36).substr(2, 7)}`,
                    rawText: commentText,
                    author: item.author || 'YouTube Viewer',
                    release: commentYear,
                    period: commentYear,
                    source: 'YouTube Comments',
                    sourceLabel: src.label,
                    timestamp: formatCommentTimestamp(item.timestamp || item.date, commentYear, fIdx),
                    language: detectedLang,
                    country: detectedLang,
                    ...(groundedUrl ? { sourceUrl: groundedUrl } : {}),
                    ...(groundedVideoId ? { videoId: groundedVideoId, videoUrl: `${YT_WATCH}${groundedVideoId}` } : {})
                });
            });
        }
    }

    return sourceComments;
};

export const harvestSteamSource = async (
    src: NoiseSourceConfig
): Promise<RawComment[]> => {
    const sourceComments: RawComment[] = [];
    let appId = extractSteamAppId(src.target);
    const steamTarget = src.targetCount || 750;
    await sendTerminalLog(`[Steam Ingest] Fetching up to ${steamTarget} reviews for Steam App (14-Day Window): ${appId || src.target}`, 'worker');

    if (!appId || !/^\d+$/.test(String(appId))) {
        const searchTerm = String(src.target || src.label || '').trim();
        if (!searchTerm) {
            throw new Error('Steam source target is empty; provide a Steam App ID, Store URL, or game title.');
        }
        const searchRes = await fetch(`/api/steam/search?term=${encodeURIComponent(searchTerm)}`);
        if (!searchRes.ok) {
            const errMsg = await readHttpErrorMessage(searchRes, `Steam search failed for "${searchTerm}"`);
            await sendTerminalLog(`[Steam Ingest Error] ${errMsg}`, 'error');
            throw new Error(errMsg);
        }
        const searchData = await searchRes.json();
        const apps = Array.isArray(searchData) ? searchData : (Array.isArray(searchData?.apps) ? searchData.apps : []);
        if (apps.length > 0 && apps[0]?.id) {
            appId = String(apps[0].id);
        } else {
            throw new Error(`No Steam app matched query "${searchTerm}".`);
        }
    }

    if (!appId || !/^\d+$/.test(String(appId))) {
        throw new Error(`Invalid Steam App ID resolved for "${src.target}".`);
    }

    const steamUrl = isVerifiedSourceUrl(src.url) ? src.url : `https://store.steampowered.com/app/${appId}`;
    const res = await fetch(`/api/steam/reviews?appId=${encodeURIComponent(appId)}&maxReviews=${steamTarget}&day_range=14`);
    if (!res.ok) {
        const errMsg = await readHttpErrorMessage(res, `Steam reviews fetch failed for App ID ${appId}`);
        await sendTerminalLog(`[Steam Ingest Error] ${errMsg}`, 'error');
        throw new Error(errMsg);
    }

    const data = await res.json();
    const reviewsList = Array.isArray(data) ? data : (Array.isArray(data?.reviews) ? data.reviews : null);
    if (!reviewsList) {
        throw new Error(`Unexpected response shape from /api/steam/reviews for App ID ${appId}.`);
    }

    await sendTerminalLog(`[Steam Ingest] Fetched ${reviewsList.length} reviews from Steam App ${appId} (14-Day Rolling Window)`, 'info');
    reviewsList.forEach((r: any, rIdx: number) => {
        const commentYear = extractCommentYear(r.timestamp_created) || '2026';
        const reviewText = r.review || r.content || '';
        const detectedLang = detectCommentLanguage(r.country, reviewText);
        sourceComments.push({
            id: `steam-${r.id || Math.random().toString(36).substr(2, 7)}`,
            rawText: reviewText,
            author: r.author?.steamid ? `Customer (${String(r.author.steamid).slice(-4)})` : 'Customer Review',
            release: commentYear,
            period: commentYear,
            source: 'Steam Reviews',
            sourceLabel: src.label,
            timestamp: formatCommentTimestamp(r.timestamp_created, commentYear, rIdx),
            language: detectedLang,
            country: detectedLang,
            ...(steamUrl ? { sourceUrl: steamUrl } : {})
        });
    });

    return sourceComments;
};

export const harvestMetacriticSource = async (
    src: NoiseSourceConfig,
    companyName: string = 'test-company',
    errors: HarvestSourceError[] = []
): Promise<RawComment[]> => {
    const sourceComments: RawComment[] = [];
    const slug = extractMetacriticSlugFromTarget(src.target);
    const canonicalUrl = `https://www.metacritic.com/game/${slug}/`;
    const criticSubpageUrl = `https://www.metacritic.com/game/${slug}/critic-reviews/`;
    const userSubpageUrl = `https://www.metacritic.com/game/${slug}/user-reviews/`;

    await sendTerminalLog(`[Metacritic Ingest] Harvesting Critic Reviews (${criticSubpageUrl}) & User Reviews (${userSubpageUrl}) for ${slug.toUpperCase()}...`, 'worker');

    let mcReviews: any[] = collectAndDedupeMetacriticReviews(src);
    let mcMeta: any = src.cachedJsonLdMetadata || null;

    const initialCritics = mcReviews.filter(r => r.reviewType === 'critic').length;
    const initialUsers = mcReviews.filter(r => r.reviewType === 'user').length;

    let scanErrorMessage = '';
    if (mcReviews.length < 50 || initialCritics < 35 || initialUsers < 60) {
        try {
            const scanUrl = `/api/metacritic/scan?url=${encodeURIComponent(canonicalUrl)}&companyName=${encodeURIComponent(companyName || 'test-company')}`;
            const mcRes = await fetch(scanUrl);
            if (mcRes.ok) {
                const mcData = await mcRes.json();
                mcReviews = collectAndDedupeMetacriticReviews(mcReviews, mcData);
                mcMeta = mcData.jsonLdMetadata || mcMeta;
            } else {
                scanErrorMessage = await readHttpErrorMessage(mcRes, `Metacritic scan failed for ${canonicalUrl}`);
                throw new Error(scanErrorMessage);
            }
        } catch (scanErr: any) {
            scanErrorMessage = scanErr?.message || String(scanErr);
            console.warn(`[Metacritic Ingest] Live scan check for ${slug}:`, scanErrorMessage);
        }

        if (mcReviews.length === 0) {
            const message = scanErrorMessage || `Failed to harvest Metacritic critic & user reviews for ${canonicalUrl}`;
            console.error(`[Metacritic Ingest Error] ${src.label} (${canonicalUrl}):`, message);
            await sendTerminalLog(`[Metacritic Ingest Error] ${src.label}: ${message}`, 'error');
            throw new Error(message);
        }
    }

    if (mcMeta && (mcMeta.aggregateRating || mcMeta.description)) {
        const criticReviewCount = mcReviews.filter(r => r.reviewType === 'critic').length;
        const userReviewCount = mcReviews.filter(r => r.reviewType === 'user').length;
        const ratingVal = mcMeta.aggregateRating?.ratingValue ?? mcMeta.metascore;
        const reviewCount = mcMeta.aggregateRating?.reviewCount ?? mcMeta.metascoreCount ?? criticReviewCount;
        const userVal = mcMeta.userScore ?? null;
        const userCount = mcMeta.userScoreCount ?? userReviewCount;
        const releaseYear = extractCommentYear(mcMeta.datePublished || mcMeta.releaseDate) || '2026';
        const scoreSummary = ratingVal !== undefined
            ? `Metascore: ${ratingVal}/100 across ${reviewCount} Critic Reviews (/critic-reviews/)${userVal !== null ? ` • User Score: ${userVal}/10 across ${userCount} User Reviews (/user-reviews/)` : ''}.`
            : '';
        const summaryParts = [
            mcMeta.name ? `${mcMeta.name} (${Array.isArray(mcMeta.gamePlatform) ? mcMeta.gamePlatform.join(', ') : (mcMeta.gamePlatform || 'Multi-Platform')})` : 'Metacritic Aggregate',
            scoreSummary,
            mcMeta.description || ''
        ].filter(Boolean);
        if (summaryParts.length > 0) {
            sourceComments.push({
                id: `metacritic-meta-${slug}`,
                rawText: summaryParts.join(' — '),
                author: 'Metacritic Schema.org JSON-LD',
                release: releaseYear,
                period: releaseYear,
                source: 'Metacritic',
                sourceLabel: src.label,
                likes: typeof ratingVal === 'number' ? ratingVal : undefined,
                timestamp: formatCommentTimestamp(mcMeta.datePublished || mcMeta.releaseDate, releaseYear, 0),
                language: 'English',
                country: 'English',
                videoTitle: mcMeta.name || src.label,
                reviewType: 'json-ld',
                score: typeof ratingVal === 'number' ? ratingVal : undefined,
                maxScore: 100,
                subpageUrl: canonicalUrl,
                sourceUrl: isVerifiedSourceUrl(src.url) ? src.url : canonicalUrl
            });
        }
    }

    const finalCritics = mcReviews.filter(r => r.reviewType === 'critic');
    const finalUsers = mcReviews.filter(r => r.reviewType === 'user');
    await sendTerminalLog(
        `[Metacritic Ingest] Harvested ${mcReviews.length} total reviews for ${slug.toUpperCase()}: ${finalCritics.length} Critic Reviews (/critic-reviews/) + ${finalUsers.length} User Reviews (/user-reviews/)`,
        'info'
    );

    mcReviews.forEach((r: any, rIdx: number) => {
        const reviewText = String(r.text || r.quote || r.body || r.content || '').trim();
        if (!reviewText) return;
        const editionStr = String(r.gameEdition || r._franchiseEdition || r.gameTitle || '');
        const editionYear = /2025/i.test(editionStr) ? '2025' : /2024/i.test(editionStr) ? '2024' : '';
        const commentYear = extractCommentYear(r.date || r.timestamp) || editionYear || '2026';
        const detectedLang = detectCommentLanguage(r.country, reviewText);
        const isCritic = String(r.reviewType || r.type || '').toLowerCase() === 'critic';
        const pubName = r.publication || r.publicationName || (isCritic ? (r.author || 'Metacritic Critic') : null);
        const authorLabel = isCritic
            ? (r.author || pubName || 'Metacritic Critic')
            : (r.author || 'Metacritic User');
        const scoreVal = typeof r.score === 'number' ? r.score : undefined;
        const maxScoreVal = isCritic ? 100 : 10;
        const subpage = isCritic ? (r.subpageUrl || criticSubpageUrl) : (r.subpageUrl || userSubpageUrl);
        const rolePrefix = isCritic
            ? `[Metacritic Critic Review · ${pubName || authorLabel}${scoreVal !== undefined ? ` · Score: ${scoreVal}/100` : ''}] `
            : `[Metacritic User Review · ${authorLabel}${scoreVal !== undefined ? ` · Score: ${scoreVal}/10` : ''}] `;
        const formattedText = /^\[(Metacritic\s+)?(Critic|User)\s+Review/i.test(reviewText)
            ? reviewText
            : `${rolePrefix}${reviewText}`;

        sourceComments.push({
            id: `metacritic-${isCritic ? 'critic' : 'user'}-${r.id || `${rIdx}-${Math.random().toString(36).substr(2, 6)}`}`,
            rawText: formattedText,
            author: authorLabel,
            release: commentYear,
            period: commentYear,
            source: 'Metacritic',
            sourceLabel: isCritic
                ? `Metacritic Critic Reviews (${criticSubpageUrl})`
                : `Metacritic User Reviews (${userSubpageUrl})`,
            likes: scoreVal,
            timestamp: formatCommentTimestamp(r.date || r.timestamp, commentYear, rIdx + 1),
            language: detectedLang,
            country: detectedLang,
            videoTitle: mcMeta?.name || src.label,
            reviewType: isCritic ? 'critic' : 'user',
            score: scoreVal,
            maxScore: maxScoreVal,
            publication: pubName,
            publicationName: pubName,
            subpageUrl: subpage,
            sourceUrl: isVerifiedSourceUrl(subpage) ? subpage : (isVerifiedSourceUrl(src.url) ? src.url : canonicalUrl),
            platform: r.platform || 'Multi-Platform'
        });
    });

    return sourceComments;
};
