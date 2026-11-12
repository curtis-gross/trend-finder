/**
 * Reddit URL Sanitization, Target Parsing, and Grounded Reddit Sentiment Analysis.
 */
import { GEMINI_MODELS } from "./coreClientAndProxies";
import { runGroundedResearchAndStructure } from "./tiktokAndMultiChannelSocial";

interface RedditTargetInfo {
    isUrl: boolean;
    isThread: boolean;
    subreddit: string; // e.g. "r/ProductReviews"
    cleanSubreddit: string; // e.g. "ProductReviews"
    threadId?: string; // e.g. "1heodjj"
    slugTitle?: string; // e.g. "Customer Experience Review Thread"
    canonicalUrl: string; // 100% clean direct URL
    displayTitle: string; // e.g. "r/ProductReviews • Customer Experience Review Thread"
    cleanQuery: string; // human search topic without URL artifacts
}

function sanitizeRedditUrl(url?: string): string {
    if (!url || typeof url !== 'string') return '';
    let cleaned = url.trim();
    cleaned = cleaned.replace(/^Reddit:\s*/i, '');
    cleaned = cleaned.replace(/^r\/(https?:\/\/)/i, '$1');
    cleaned = cleaned.replace(/^r\/www\./i, 'https://www.');
    cleaned = cleaned.replace(/https?:\/\/www\.reddit\.com\/r\/(https?:\/\/)/i, '$1');
    
    if (cleaned.startsWith('http://') || cleaned.startsWith('https://')) {
        return cleaned;
    }
    if (cleaned.startsWith('reddit.com') || cleaned.startsWith('www.reddit.com')) {
        return `https://${cleaned}`;
    }
    if (cleaned.startsWith('r/') || cleaned.startsWith('/r/')) {
        const sub = cleaned.replace(/^\/?r\//, '');
        return `https://www.reddit.com/r/${sub}/`;
    }
    return cleaned;
}

export function parseRedditTarget(raw: string): RedditTargetInfo {
    if (!raw || typeof raw !== 'string') {
        return {
            isUrl: false,
            isThread: false,
            subreddit: 'r/all',
            cleanSubreddit: 'all',
            canonicalUrl: 'https://www.reddit.com/',
            displayTitle: 'Reddit Community Discussions',
            cleanQuery: ''
        };
    }

    const cleanInput = sanitizeRedditUrl(raw.trim());

    // 1. Check if direct Reddit thread URL: e.g. /r/:sub/comments/:id/:slug?
    const threadMatch = cleanInput.match(/(?:https?:\/\/(?:www\.)?reddit\.com)?\/r\/([a-zA-Z0-9_]+)\/comments\/([a-zA-Z0-9_]+)(?:\/([^/?#\s]+))?/i);
    if (threadMatch) {
        const cleanSub = threadMatch[1];
        const threadId = threadMatch[2];
        const rawSlug = threadMatch[3] || '';
        
        const slugTitle = rawSlug
            ? rawSlug
                .replace(/[-_]+/g, ' ')
                .trim()
                .split(' ')
                .filter(Boolean)
                .map(word => {
                    const lower = word.toLowerCase();
                    if (['and', 'or', 'the', 'in', 'on', 'at', 'to', 'for', 'of', 'from', 'with', 'by'].includes(lower)) {
                        return lower;
                    }
                    return word.charAt(0).toUpperCase() + word.slice(1);
                })
                .join(' ')
                .replace(/^(\w)/, c => c.toUpperCase())
            : '';

        const canonicalUrl = `https://www.reddit.com/r/${cleanSub}/comments/${threadId}/${rawSlug ? rawSlug + '/' : ''}`;
        const displayTitle = slugTitle 
            ? `r/${cleanSub} • ${slugTitle}`
            : `r/${cleanSub} • Thread #${threadId}`;

        return {
            isUrl: true,
            isThread: true,
            subreddit: `r/${cleanSub}`,
            cleanSubreddit: cleanSub,
            threadId,
            slugTitle: slugTitle || undefined,
            canonicalUrl,
            displayTitle,
            cleanQuery: slugTitle || cleanSub
        };
    }

    // 2. Check if subreddit URL: e.g. https://www.reddit.com/r/:sub
    const subUrlMatch = cleanInput.match(/(?:https?:\/\/(?:www\.)?reddit\.com)?\/r\/([a-zA-Z0-9_]+)/i);
    if (subUrlMatch) {
        const cleanSub = subUrlMatch[1];
        return {
            isUrl: cleanInput.includes('http') || cleanInput.includes('reddit.com'),
            isThread: false,
            subreddit: `r/${cleanSub}`,
            cleanSubreddit: cleanSub,
            canonicalUrl: `https://www.reddit.com/r/${cleanSub}/`,
            displayTitle: `r/${cleanSub}`,
            cleanQuery: cleanSub
        };
    }

    // 3. Shorthand subreddit e.g. "r/ProductReviews"
    const cleanedSh = cleanInput.replace(/^#/, '').trim();
    if (cleanedSh.startsWith('r/')) {
        const cleanSub = cleanedSh.replace(/^r\//, '');
        return {
            isUrl: false,
            isThread: false,
            subreddit: `r/${cleanSub}`,
            cleanSubreddit: cleanSub,
            canonicalUrl: `https://www.reddit.com/r/${cleanSub}/`,
            displayTitle: `r/${cleanSub}`,
            cleanQuery: cleanSub
        };
    }

    // 4. Regular topic query, e.g. "test-company" or "product quality"
    const isSingleWord = !cleanedSh.includes(' ') && cleanedSh.length > 2 && !cleanedSh.includes('http');
    const subreddit = isSingleWord ? `r/${cleanedSh}` : `r/${cleanedSh.toLowerCase().replace(/[^a-z0-9_]/g, '') || 'all'}`;

    return {
        isUrl: false,
        isThread: false,
        subreddit: isSingleWord ? subreddit : 'r/all',
        cleanSubreddit: isSingleWord ? cleanedSh : 'all',
        canonicalUrl: `https://www.reddit.com/search/?q=${encodeURIComponent(cleanedSh)}`,
        displayTitle: isSingleWord ? `r/${cleanedSh}` : `Reddit: ${cleanedSh}`,
        cleanQuery: cleanedSh
    };
}

export function getRedditDisplayTitle(raw: string, fallbackTitle?: string): string {
    if (!raw) return fallbackTitle || 'Reddit Community Discussions';
    const parsed = parseRedditTarget(raw);
    return parsed.displayTitle || fallbackTitle || 'Reddit Community Discussions';
}

export const analyzeRedditSentiment = async (
    queryOrData: string | any,
    companyName: string = 'test-company',
    guidance: string = ''
): Promise<any> => {
    const queryStr = typeof queryOrData === 'object' && queryOrData !== null
        ? (queryOrData.url || (Array.isArray(queryOrData.videos) ? queryOrData.videos[0] : null) || queryOrData.tag || queryOrData.query || 'general')
        : String(queryOrData || 'general');
    
    const targetInfo = parseRedditTarget(queryStr);
    const cleanTag = targetInfo.isThread 
        ? (targetInfo.slugTitle || targetInfo.cleanSubreddit) 
        : (targetInfo.cleanSubreddit || queryStr.replace(/^#/, '').replace(/^r\//, '').trim());
    const inferredSubreddit = targetInfo.subreddit;

    const searchQueriesDescription = targetInfo.isThread
        ? `- "site:reddit.com/r/${targetInfo.cleanSubreddit}/comments/${targetInfo.threadId}/"
- "${targetInfo.slugTitle || targetInfo.threadId}" site:reddit.com
- "${targetInfo.slugTitle || targetInfo.threadId}" comments discussion
- "site:reddit.com/${targetInfo.subreddit} ${companyName}"`
        : inferredSubreddit && inferredSubreddit !== 'r/all'
        ? `- "site:reddit.com/${inferredSubreddit} ${companyName} ${cleanTag}"
- "site:reddit.com/${inferredSubreddit} ${cleanTag}"
- "site:reddit.com ${companyName} ${cleanTag} reviews"`
        : `- "site:reddit.com ${companyName} ${cleanTag} reviews"
- "site:reddit.com ${companyName} customer reviews comments"
- "site:reddit.com ${companyName} ${cleanTag} discussion"`;

    const researchPrompt = `
Conduct live Google Search grounded research on real-world Reddit threads and community discourse for:
Topic / Query: "${targetInfo.isThread ? (targetInfo.slugTitle || targetInfo.displayTitle) : queryStr}"
${targetInfo.isThread ? `Specific Reddit Thread URL: ${targetInfo.canonicalUrl}\nSubreddit: ${targetInfo.subreddit}\n` : ''}Company / Brand: "${companyName}"
${guidance ? `Focus Guidance: "${guidance}"` : ''}

CRITICAL REQUIREMENT:
1. Target authentic Reddit discussions, user opinions, complaints, and praise.
2. If researching a specific thread, thoroughly extract at least 15 to 25 authentic, verbatim-style comments and replies from community members in that thread.
3. Capture diverse sentiments (positive, negative, neutral), specific product or service issues mentioned, estimated upvotes, and author perspectives.
4. Analyze how comments connect multiple topics together (cross-topic co-occurrence).
5. Summarize the key discussion threads found with direct titles, upvotes, sentiments, and active community debates.

Search queries to prioritize:
${searchQueriesDescription}
`;

    const schemaPrompt = `
Extract the Reddit community discussions and cross-topic relationships into this JSON structure:
{
    "summary": "2-3 sentence executive overview of Reddit discourse, customer sentiment, and interconnected themes.",
    "sentiment_score": 75,
    "counts": { "positive": 15, "negative": 5, "neutral": 8 },
    "threads": [
        {
            "id": "th-1",
            "title": "${targetInfo.isThread && targetInfo.slugTitle ? targetInfo.slugTitle : 'Exact discussion thread title'}",
            "subreddit": "${targetInfo.subreddit}",
            "threadUrl": "${targetInfo.canonicalUrl || 'Verified direct Reddit thread URL'}",
            "upvotes": 120,
            "commentCount": 35,
            "sentiment": "positive",
            "summary": "1-2 sentence thread summary",
            "keyTakeaway": "Main community takeaway from this thread"
        }
    ],
    "comments": [
        {
            "id": "c-1",
            "author": "u/RedditUsername",
            "threadTitle": "${targetInfo.isThread && targetInfo.slugTitle ? targetInfo.slugTitle : 'Exact thread title this comment is posted in'}",
            "threadUrl": "${targetInfo.canonicalUrl || 'Direct Reddit thread URL'}",
            "text": "Authentic verbatim-style customer comment reflecting community feedback",
            "sentiment": "positive",
            "upvotes": 38,
            "category": "Durability & Quality",
            "relatedTopics": ["Pricing & Value", "Customer Service"]
        }
    ],
    "thematic_findings": [
        {
            "theme": "Build Quality & Materials",
            "sentiment": "positive",
            "score": 80,
            "summary": "Redditors consistently praise the core product construction and reliability.",
            "evidenceQuotes": ["Quote from comment"],
            "relatedThemes": ["Pricing & Value", "Delivery & Support"]
        }
    ],
    "topic_relationships": [
        {
            "source": "Build Quality & Materials",
            "target": "Pricing & Value",
            "strength": 0.86,
            "sharedCommentCount": 7,
            "reason": "Redditors frequently evaluate long-term material durability against upfront purchase price."
        }
    ],
    "debates": [
        {
            "topic": "Core customer debate or talking point",
            "consensus": "Community stance or prevailing opinion",
            "urgency": "medium"
        }
    ],
    "strategic_recommendations": [
        {
            "area": "Product Quality & Care",
            "recommendation": "Provide clearer durability guides and support documentation.",
            "priority": "High",
            "expected_impact": "Reduces return friction and improves long-term sentiment"
        }
    ],
    "word_cloud": ["quality", "design", "service", "materials", "delivery", "sturdy"]
}

CRITICAL RULES FOR EXTRACTION:
1. In the "comments" array, return at least 15 to 25 detailed, authentic customer comments representing real user voices from the thread and discussion.
2. For each comment, populate "category" with its primary topic and "relatedTopics" with 1 to 3 connected topics also referenced or implied in that comment so the topic graph captures cross-comment links.
3. In "topic_relationships", extract at least 6 to 10 cross-topic relationship edges based on co-occurrence across comments.
4. Include varied sentiments (positive, negative, neutral) with authentic Reddit usernames and realistic upvote counts.
5. Every comment's "threadUrl" MUST be a valid direct Reddit URL (e.g. "${targetInfo.canonicalUrl || 'https://www.reddit.com/r/...'}") and MUST NEVER be prepended with "Reddit: r/" or "r/https://".
6. "subreddit" MUST be a clean subreddit identifier (e.g. "${targetInfo.subreddit}") and NEVER contain a URL or "r/https://".
`;

    try {
        const { data, searchQueries, rawGroundedLinks, rawResearchText } = await runGroundedResearchAndStructure({
            researchPrompt,
            schemaPrompt,
            fallbackValue: null,
            agentName: "Reddit Community Intelligence",
            searchModel: GEMINI_MODELS.FLASH,
            extractModel: GEMINI_MODELS.FLASH
        });

        if (!data) {
            throw new Error(`Failed to extract structured Reddit sentiment for "${cleanTag}".`);
        }

        const rawSub = data.threads?.[0]?.subreddit || targetInfo.subreddit;
        const resolvedSubreddit = parseRedditTarget(rawSub).subreddit;

        const threads = (Array.isArray(data.threads) ? data.threads : []).map((th: any, idx: number) => {
            const threadSub = parseRedditTarget(th.subreddit || resolvedSubreddit).subreddit;
            const threadUrl = sanitizeRedditUrl(th.threadUrl) || (targetInfo.isThread ? targetInfo.canonicalUrl : `https://www.reddit.com/${threadSub}/`);
            return {
                ...th,
                id: th.id || `th-${idx + 1}`,
                subreddit: threadSub,
                threadUrl,
                title: th.title || (targetInfo.isThread && targetInfo.slugTitle ? targetInfo.slugTitle : 'Reddit Community Thread')
            };
        });

        const comments = (Array.isArray(data.comments) ? data.comments : []).map((c: any, i: number) => {
            const author = c.author && !c.author.startsWith('u/') && !c.author.startsWith('@') 
                ? `u/${c.author}` 
                : (c.author || `u/redditor_${i + 1}`);
            const threadUrl = sanitizeRedditUrl(c.threadUrl) || (targetInfo.isThread ? targetInfo.canonicalUrl : (threads[0]?.threadUrl || ''));
            return {
                id: c.id || `c-${i + 1}`,
                author,
                text: c.text || '',
                sentiment: c.sentiment || 'neutral',
                upvotes: typeof c.upvotes === 'number' ? c.upvotes : (c.likes || 14),
                likes: typeof c.upvotes === 'number' ? c.upvotes : (c.likes || 14),
                threadTitle: c.threadTitle || threads[0]?.title || cleanTag,
                threadUrl,
                category: c.category || 'Customer Experience',
                relatedTopics: Array.isArray(c.relatedTopics) ? c.relatedTopics : [],
                channel: 'Reddit',
                source: 'Reddit'
            };
        });

        return {
            type: 'reddit',
            query: targetInfo.canonicalUrl || queryStr,
            tag: cleanTag,
            subreddit: resolvedSubreddit,
            companyName,
            summary: data.summary || `Reddit community discussions regarding ${companyName} (${cleanTag}).`,
            sentiment_score: typeof data.sentiment_score === 'number' ? data.sentiment_score : 70,
            counts: data.counts || { positive: 0, negative: 0, neutral: 0 },
            threads,
            debates: Array.isArray(data.debates) ? data.debates : [],
            comments,
            thematic_findings: Array.isArray(data.thematic_findings) ? data.thematic_findings : [],
            topic_relationships: Array.isArray(data.topic_relationships) ? data.topic_relationships : [],
            strategic_recommendations: Array.isArray(data.strategic_recommendations) ? data.strategic_recommendations : [],
            word_cloud: Array.isArray(data.word_cloud) ? data.word_cloud : [],
            activeChannels: ['Reddit'],
            rawTrace: {
                reddit: {
                    searchQueries,
                    rawGroundedLinks,
                    rawResearchText,
                    promptSent: researchPrompt
                }
            },
            timestamp: new Date().toISOString()
        };
    } catch (err: any) {
        console.error("Grounded Reddit sentiment analysis failed:", err);
        throw new Error(`Reddit analysis failed for "${cleanTag}": ${err?.message || 'Grounded search error'}`);
    }
};
