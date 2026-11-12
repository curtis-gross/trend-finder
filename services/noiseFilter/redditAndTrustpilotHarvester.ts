import { GEMINI_MODELS, parseRedditTarget, safeJsonParse } from '../geminiService';
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
    generateGroundedWithSources,
    harvestMetacriticSource,
    harvestSteamSource,
    harvestYouTubeSource,
    isVerifiedSourceUrl,
    resolveGroundedSourceUrl,
} from './youtubeAndMetacriticHarvester';

const REDDIT_DOMAIN_RE = /reddit\.com|redd\.it/i;
import { sendTerminalLog } from './stageGcsCacheClient';

const harvestRedditSource = async (
    src: NoiseSourceConfig,
    companyName: string = 'test-company'
): Promise<RawComment[]> => {
    const sourceComments: RawComment[] = [];
    const redditTarget = src.targetCount || 25;
    await sendTerminalLog(`[Reddit Ingest] Mining up to ${redditTarget} Reddit comments for: "${src.label || src.target}" spanning the last 14 days (2 weeks)...`, 'worker');

    const targetInfo: any = parseRedditTarget(src.target);
    const fourteenDaysAgoSec = Math.floor((Date.now() - 14 * 86400 * 1000) / 1000);

    // Direct Reddit API fetch only on server side (typeof window === 'undefined') to avoid browser CORS 403 blocks from www.reddit.com
    if (typeof window === 'undefined' && targetInfo.cleanSubreddit) {
        try {
            const redditUrl = `https://www.reddit.com/r/${targetInfo.cleanSubreddit}/top.json?t=month&limit=50`;
            const rRes = await fetch(redditUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 TrendFinder/1.0'
                }
            });
            if (rRes.ok) {
                const rData = await rRes.json();
                const children = rData?.data?.children || [];
                const posts14Days = children.filter((c: any) => (c.data?.created_utc || 0) >= fourteenDaysAgoSec);
                await sendTerminalLog(`[Reddit Ingest] Harvested ${posts14Days.length} direct Reddit posts from r/${targetInfo.cleanSubreddit} within 14-day rolling window`, 'info');
                posts14Days.forEach((p: any, pIdx: number) => {
                    if (sourceComments.length < redditTarget) {
                        const createdUtc = p.data?.created_utc;
                        const commentYear = createdUtc ? String(new Date(createdUtc * 1000).getFullYear()) : '2026';
                        const postText = p.data?.selftext ? `${p.data.title}: ${p.data.selftext}` : (p.data?.title || '');
                        const detectedLang = detectCommentLanguage(undefined, postText);
                        sourceComments.push({
                            id: `reddit-${p.data?.id || Math.random().toString(36).substr(2, 7)}`,
                            rawText: postText,
                            author: p.data?.author ? `u/${p.data.author}` : 'Reddit Community Member',
                            release: commentYear,
                            period: commentYear,
                            source: 'Reddit Discussion',
                            sourceLabel: src.label || `r/${targetInfo.cleanSubreddit}`,
                            timestamp: formatCommentTimestamp(createdUtc, commentYear, pIdx),
                            language: detectedLang,
                            country: detectedLang,
                            videoTitle: p.data?.title || targetInfo.displayLabel || src.label,
                            sourceUrl: p.data?.permalink
                                ? `https://www.reddit.com${p.data.permalink}`
                                : (redditUrl.startsWith('http') ? redditUrl : undefined)
                        });
                    }
                });
            }
        } catch (redditDirectErr: any) {
            console.warn(`[Reddit Ingest Direct] Fallback to Gemini Grounding for r/${targetInfo.cleanSubreddit}:`, redditDirectErr?.message || redditDirectErr);
        }
    }

    const subName = targetInfo.cleanSubreddit || 'technology';
    const topicKeywords = (targetInfo.slugTitle || targetInfo.cleanQuery || src.label || companyName)
        .replace(/reddit|megathread|thread/gi, '')
        .replace(/\s+/g, ' ')
        .trim();

    const subQueries: string[] = [
        `site:reddit.com/r/${subName} ${companyName} ${topicKeywords} comments`,
        `reddit r/${subName} ${companyName} ${topicKeywords} customer feedback discussion`
    ];

    const groundResults: any[] = [];
    const remainingToHarvest = Math.max(0, redditTarget - sourceComments.length);
    if (remainingToHarvest > 0 && subQueries.length > 0) {
        const perQueryTarget = Math.max(15, Math.ceil(remainingToHarvest / subQueries.length) + 3);
        const subQueryOutcomes = await Promise.allSettled(
            subQueries.map(async (query) => {
                const prompt = `You are a Reddit community intelligence extractor for ${companyName} (subreddit r/${subName}).
Search and extract authentic customer comments, complaints, and praise from Reddit discussions (r/${subName} and related community threads) posted in the LAST 14 DAYS (last 2 weeks) regarding:
"${query}" (Thread focus: "${src.label || topicKeywords}").

Extract ${perQueryTarget} authentic quotes in their original source language (defaulting to "English" for r/${subName}; do NOT translate or synthesize foreign-language quotes unless the source Reddit comment itself is written in that language) with Reddit author handles (e.g. "u/Username"), relative timestamp spanning the last 14 days (e.g. "today", "yesterday", "2 days ago", "5 days ago", "11 days ago"), detected natural language, and sentiment.
Return a valid JSON array of objects:
[
  {
    "author": "u/RedditUser",
    "text": "Exact quote from community member discussing product quality, usability, customer support, pricing value, or brand experience",
    "sentiment": "positive" | "negative" | "neutral",
    "timestamp": "e.g. 2 days ago, or relative post timestamp within last 14 days",
    "language": "English",
    "featureCategory": "Product Quality & Design" | "Pricing & Value" | "Service & Reliability" | "User Experience" | "Community Sentiment",
    "sourceUrl": "Real Reddit thread permalink this quote came from, or null if unknown (never invent one)"
  }
]
Return JSON array only.`;

                let text = '';
                let chunks: { uri: string; title?: string }[] = [];
                for (let attempt = 0; attempt <= 2; attempt++) {
                    try {
                        ({ text, chunks } = await generateGroundedWithSources(prompt, GEMINI_MODELS.FLASH_LITE));
                        break;
                    } catch (err: any) {
                        const is429 = err?.status === 429 ||
                                      err?.message?.includes('429') ||
                                      err?.message?.includes('RESOURCE_EXHAUSTED') ||
                                      err?.message?.includes('Resource exhausted');
                        if (is429 && attempt < 2) {
                            const waitMs = 2000 * (attempt + 1);
                            await sendTerminalLog(`[Reddit Ingest] Rate limited (429). Backing off ${waitMs}ms before retry ${attempt + 1}/2...`, 'worker');
                            await new Promise(r => setTimeout(r, waitMs));
                        } else {
                            console.warn(`[Reddit Ingest] Query failed for "${query}":`, err?.message || err);
                            break;
                        }
                    }
                }

                const parsed = safeJsonParse(text);
                return Array.isArray(parsed)
                    ? parsed.map((item: any) => ({
                        ...item,
                        _verifiedUrl: resolveGroundedSourceUrl(item?.sourceUrl || item?.url, chunks, REDDIT_DOMAIN_RE, src.url)
                    }))
                    : [];
            })
        );

        for (const outcome of subQueryOutcomes) {
            if (outcome.status === 'fulfilled' && Array.isArray(outcome.value)) {
                groundResults.push(...outcome.value);
            }
        }
    }

    const flattened = groundResults.slice(0, remainingToHarvest);
    if (flattened.length > 0) {
        await sendTerminalLog(`[Reddit Ingest] Grounded ${flattened.length} 14-day community comments for ${src.label || src.target}`, 'info');

        flattened.forEach((item: any, fIdx: number) => {
            const commentYear = extractCommentYear(item.timestamp || item.date) || '2026';
            const detectedLang = detectCommentLanguage(item.language || item.country, item.text);
            const rawHandle = String(item.author || 'Reddit Community Member').trim();
            const formattedAuthor = rawHandle.startsWith('u/') || rawHandle.includes(' ') ? rawHandle : `u/${rawHandle}`;
            sourceComments.push({
                id: `reddit-${Math.random().toString(36).substr(2, 7)}`,
                rawText: item.text || '',
                author: formattedAuthor,
                release: commentYear,
                period: commentYear,
                source: 'Reddit Discussion',
                sourceLabel: src.label,
                timestamp: formatCommentTimestamp(item.timestamp || item.date, commentYear, sourceComments.length + fIdx),
                language: detectedLang,
                country: detectedLang,
                ...(item._verifiedUrl ? { sourceUrl: item._verifiedUrl } : (isVerifiedSourceUrl(src.url) ? { sourceUrl: src.url } : {}))
            });
        });
    }

    return sourceComments;
};

// Helper to harvest a single source safely with retry, precision queries, and throttling.
export const harvestSingleSource = async (
    src: NoiseSourceConfig,
    companyName: string = 'test-company',
    errors: HarvestSourceError[] = []
): Promise<RawComment[]> => {
    try {
        if (src.type === 'youtube' || src.type === 'youtube_abcd') {
            return await harvestYouTubeSource(src, companyName, errors);
        }
        if (src.type === 'steam') {
            return await harvestSteamSource(src);
        }
        if (src.type === 'metacritic') {
            return await harvestMetacriticSource(src, companyName, errors);
        }
        if (src.type === 'reddit') {
            return await harvestRedditSource(src, companyName);
        }
    } catch (err: any) {
        const message = err?.message || String(err);
        console.error(`[Harvest Error] ${src.label}:`, message);
        await sendTerminalLog(`[Harvest Error] ${src.label} (${src.type}): ${message.slice(0, 300)}`, 'worker');
        errors.push({ sourceLabel: src.label, sourceType: src.type, target: src.target, message });
    }
    return [];
};
