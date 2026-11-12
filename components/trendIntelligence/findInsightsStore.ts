import { brandConfig } from '../../config';
import { normalizeUrlKey } from './typesAndConstants';

export interface FindInsightsModalProps {
    isOpen: boolean;
    prompt: string;
    setPrompt: (val: string) => void;
    enableGroundedSearch: boolean;
    setEnableGroundedSearch: (val: boolean) => void;
    selectedContentTypes: string[];
    setSelectedContentTypes: (val: string[]) => void;
    setIsOpen: (val: boolean) => void;
    foundInsights: any[];
    isFindingInsights: boolean;
    onRunSearch: () => void;
    companyName: string;
    existingRows?: any[];
}

export const findInsightsModalState = {
    isOpen: false,
    prompt: "",
    enableGroundedSearch: true,
    selectedContentTypes: ['reddit', 'tiktok', 'trustpilot_sentiment', 'website_analysis'] as string[],
    foundInsights: [] as any[],
    isFindingInsights: false,
    companyName: "",
    groundingTrace: null as any,
    groundedError: null as string | null,
    redditInsights: [] as any[],
    isFindingReddit: false,
    redditError: null as string | null,
    redditQuery: ""
};

export const triggerModalUpdate = () => {
    window.dispatchEvent(new CustomEvent('find-insights-modal-update'));
};

export const triggerAddSelectedInsights = (selected: any[]) => {
    window.dispatchEvent(new CustomEvent('add-selected-insights', { detail: selected }));
};

/* ---------- Listen dedup contract (mirrors useListenRowsHydration.ts handleAdd) ---------- */

export const getRowDedupFamily = (t?: string): string => {
    const raw = String(t || '').toLowerCase();
    if (raw === 'abcd' || raw === 'youtube_abcd') return 'abcd';
    if (raw === 'competitor_abcd') return 'competitor_abcd';
    if (raw === 'youtube_sentiment' || raw === 'sentiment_video' || raw === 'sentiment_comments' || raw === 'youtube') return 'youtube_sentiment';
    if (raw === 'competitor_sentiment_video' || raw === 'competitor_sentiment_comments' || raw === 'competitor_youtube_sentiment') return 'competitor_sentiment';
    if (raw === 'comparative' || raw === 'abcd_comparative') return 'comparative';
    return raw || 'default';
};

/** Resolves the Listen row type that handleAdd will create for a modal item. */
export const resolveListenRowType = (item: any): string => {
    const t = item?.type;
    const s = item?.subType;
    if (t === 'reddit' || s === 'reddit') return 'reddit';
    if (t === 'tiktok' || s === 'tiktok' || t === 'tiktok_hashtag') return 'tiktok';
    if (t === 'social_intelligence' || s === 'social_intelligence') return 'social_intelligence';
    if (t === 'steam' || s === 'steam_reviews') return 'steam_reviews';
    if (t === 'trustpilot' || s === 'trustpilot_sentiment') return 'trustpilot_sentiment';
    if (t === 'metacritic_reviews' || s === 'metacritic_reviews') return 'metacritic_reviews';
    if (t === 'website' || s === 'website_analysis') return 'website_analysis';
    if (t === 'grounded_search' || s === 'grounded_search') return 'grounded_search';
    if (t === 'youtube') return s || 'youtube_sentiment';
    if (t === 'youtube_sentiment' || s === 'youtube_sentiment') return 'youtube_sentiment';
    return t || 'abcd';
};

/** `${family}::${normalizedTarget}` — the same composite key the Listen table dedups on. */
export const getListenFamilyKey = (item: any): string => {
    if (!item) return '';
    const raw = String(item.url || item.tag || item.query || (item.videos && item.videos[0]) || item.id || item.title || '');
    const k = normalizeUrlKey(raw) || raw.trim().toLowerCase();
    return k ? `${getRowDedupFamily(resolveListenRowType(item))}::${k}` : '';
};

/** Builds the type-aware set of keys already present in the Listen table. */
export const buildExistingFamilyKeys = (rows: any[] = []): Set<string> => {
    const set = new Set<string>();
    rows.forEach((r: any) => {
        if (!r) return;
        const family = getRowDedupFamily(r.type);
        [r.url, r.tag, r.query, r.id, ...(Array.isArray(r.videos) ? r.videos : [])].filter(Boolean).forEach((u: any) => {
            const k = normalizeUrlKey(String(u));
            if (k) set.add(`${family}::${k}`);
        });
    });
    return set;
};

/* ---------- Unified cross-tab Listen queue contract ---------- */

export type FindInsightsSource = 'grounded' | 'youtube' | 'reddit' | 'abcd' | 'steam' | 'metacritic' | 'addsource';

export interface ListenQueueApi {
    /** True when the item's dedup family + target is already in Listen (or added this session). */
    isInListen: (item: any) => boolean;
    isQueued: (item: any) => boolean;
    toggleQueue: (item: any, source: FindInsightsSource) => void;
    queueMany: (items: any[], source: FindInsightsSource) => void;
    unqueueMany: (items: any[]) => void;
    /** 1-click add without closing the modal. Returns the number of new items dispatched. */
    addNow: (items: any | any[]) => number;
}

/* ---------- Grounded discovery core ---------- */

const SOURCE_LABELS: Record<string, string> = {
    social_intelligence: 'social platform discourse',
    reddit: 'Reddit community threads and subreddits',
    tiktok: 'TikTok creator topics and hashtags',
    trustpilot_sentiment: 'Trustpilot consumer reviews',
    website_analysis: 'digital press and industry articles'
};

async function postGenerate(body: any, label: string): Promise<any> {
    const res = await fetch('/api/genai/generateContent', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error(`${label} error: ${res.status} ${res.statusText}`);
    return res.json();
}

export async function discoverGroundedInsights(opts: {
    activeCompany: string;
    userQuery: string;
    types: string[];
    grounded: boolean;
}): Promise<{ items: any[]; trace: any }> {
    const { activeCompany, userQuery, types, grounded } = opts;
    const companySlug = activeCompany.toLowerCase().replace(/[^a-z0-9]/g, '') || 'testcompany';
    const redditOnly = types.length === 1 && types[0] === 'reddit';

    const prompt = `
You are a senior media intelligence and consumer community sentiment research analyst for "${activeCompany}".
Your objective is to find real, active, high-value community sentiment and editorial press coverage based on this research query:
"${userQuery}"

TARGET SOURCES:
${types.map(id => `- ${id}`).join('\n')}

CRITICAL ACCURACY RULES:
1. Return between 8 to 16 REAL, authentic entries across the requested sources.
2. For Reddit ("type": "reddit"):
   - Provide genuine subreddit discussion threads (full reddit.com URLs when known) or topic queries (e.g. "r/${companySlug} - Product Quality & Customer Experience").
   - Set "subType": "reddit".
3. For TikTok ("type": "tiktok"): genuine trending hashtags or creator topics (e.g. "#${companySlug}"). Set "subType": "tiktok".
4. For Trustpilot ("type": "trustpilot"): a valid review URL (e.g. "https://www.trustpilot.com/review/${companySlug}.com"). Set "subType": "trustpilot_sentiment".
5. For Website / Grounded Search ("type": "website" or "grounded_search"): valid press, review, and publication URLs. Set "subType": "website_analysis" or "grounded_search".
${redditOnly ? '6. Return ONLY Reddit entries ("type": "reddit"). No other sources.\n' : ''}
Return ONLY a valid JSON array of objects with the following schema:
[
  {
    "type": "social_intelligence" | "reddit" | "tiktok" | "trustpilot" | "website" | "grounded_search",
    "subType": "social_intelligence" | "reddit" | "tiktok" | "trustpilot_sentiment" | "website_analysis" | "grounded_search",
    "id": "Subreddit name, hashtag, domain, or article slug",
    "url": "full URL or topic query",
    "title": "Clear, informative title",
    "subtitle": "Source or Creator name (e.g. r/subreddit, TikTok, Trustpilot, Industry Press)",
    "rating": "Optional rating or score tag",
    "reason": "1-2 sentence high-impact summary of the key findings, topics covered, or sentiment themes.",
    "tags": ["Tag1", "Tag2"]
  }
]

Do not wrap in markdown or backticks. Return valid JSON only.`;

    const { extractTextFromResponse, extractGroundingWebChunks, extractGroundingSearchQueries, safeJsonParse, resolveRedirectUrls, GEMINI_MODELS } = await import('../../services/geminiService');

    let rawResponseText = '';
    let rawGroundedLinks: Array<{ uri: string; title: string }> = [];
    let searchQueries: string[] = [];
    let data: any[] = [];

    if (grounded) {
        const focus = types.map(t => SOURCE_LABELS[t] || t).join(', ');
        const searchPrompt = `
You are a senior market intelligence researcher for ${activeCompany}.
Conduct live real-world Google search grounded research for the topic / query: "${userQuery}".
Focus on real current content across: ${focus}.
Provide a comprehensive plain text intelligence briefing listing all specific titles, communities, creators, URLs, and key takeaways found.
`;
        const searchRespData = await postGenerate({
            model: GEMINI_MODELS.FLASH,
            contents: [{ role: "user", parts: [{ text: searchPrompt }] }],
            config: { temperature: 0.2, maxOutputTokens: 8192, tools: [{ googleSearch: {} }] }
        }, 'Grounded Search Proxy');
        rawResponseText = extractTextFromResponse(searchRespData);
        rawGroundedLinks = extractGroundingWebChunks(searchRespData);
        searchQueries = extractGroundingSearchQueries(searchRespData);

        const verifiedLinksSummary = (Array.isArray(rawGroundedLinks) && rawGroundedLinks.length > 0)
            ? rawGroundedLinks.map((l, i) => `[Source ${i + 1}] Title: "${l?.title || ''}" | URL: ${l?.uri || ''}`).join('\n')
            : "No direct external URLs discovered.";

        const jsonExtractionPrompt = `
You are a data structuring agent.
Below is authentic, grounded market research and a list of verified web source URLs discovered from Google Search.

${prompt}

VERIFIED DISCOVERED WEB SOURCES:
${verifiedLinksSummary}

GROUNDED RESEARCH TEXT:
${rawResponseText}

CRITICAL RULES:
1. Extract 6-10 high-value intelligence items matching the schema.
2. For URL fields, use ONLY the URLs provided in the VERIFIED DISCOVERED WEB SOURCES list above.
3. Return valid raw JSON array only.
`;
        const jsonRespData = await postGenerate({
            model: GEMINI_MODELS.FLASH,
            contents: [{ role: "user", parts: [{ text: jsonExtractionPrompt }] }],
            config: { responseMimeType: "application/json", temperature: 0.1, maxOutputTokens: 8192 }
        }, 'JSON Extraction Proxy');
        data = safeJsonParse(extractTextFromResponse(jsonRespData), []);
    } else {
        const respData = await postGenerate({
            model: GEMINI_MODELS.FLASH,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { responseMimeType: "application/json", temperature: 0.2 }
        }, 'Proxy');
        rawResponseText = extractTextFromResponse(respData);
        data = safeJsonParse(rawResponseText, []);
    }

    const combined = (Array.isArray(data) ? data : []).filter(item =>
        item && item.type !== 'youtube' && item.subType !== 'youtube_sentiment' && (!redditOnly || item.type === 'reddit' || item.subType === 'reddit')
    );

    const urlsToResolve: string[] = [];
    const isRedirect = (v: any) => typeof v === 'string' && (v.includes('vertexaisearch.cloud.google.com') || v.includes('google.com/url?'));
    combined.forEach(item => {
        if (isRedirect(item.url)) urlsToResolve.push(item.url);
        if (isRedirect(item.id)) urlsToResolve.push(item.id);
    });
    if (urlsToResolve.length > 0) {
        const resolvedMap = await resolveRedirectUrls(urlsToResolve);
        combined.forEach(item => {
            if (item.url && resolvedMap[item.url]) item.url = resolvedMap[item.url];
            if (item.id && resolvedMap[item.id]) item.id = resolvedMap[item.id];
        });
    }

    const seen = new Set<string>();
    const items = combined.filter(item => {
        const rawKey = String(item.url || item.id || item.title || '');
        const normKey = normalizeUrlKey(rawKey) || rawKey.trim().toLowerCase();
        if (!normKey || seen.has(normKey)) return false;
        seen.add(normKey);
        return true;
    });

    return {
        items,
        trace: { searchQueries, rawGroundedLinks, rawResponseText, timestamp: new Date().toISOString() }
    };
}

const resolveCompany = (targetCompany?: string) =>
    targetCompany || findInsightsModalState.companyName || brandConfig.companyName || 'test-company';

export const handleRunFindInsights = async (targetCompany?: string) => {
    findInsightsModalState.isFindingInsights = true;
    findInsightsModalState.groundingTrace = null;
    findInsightsModalState.groundedError = null;
    triggerModalUpdate();
    try {
        const types = findInsightsModalState.selectedContentTypes.length > 0
            ? findInsightsModalState.selectedContentTypes
            : ['social_intelligence', 'reddit', 'tiktok', 'trustpilot_sentiment', 'website_analysis'];
        const activeCompany = resolveCompany(targetCompany);
        const userQuery = findInsightsModalState.prompt.trim() || `Search real-world social topics, Reddit community discussions, TikTok creator trends, and customer sentiment for ${activeCompany}`;
        const { items, trace } = await discoverGroundedInsights({
            activeCompany, userQuery, types, grounded: findInsightsModalState.enableGroundedSearch
        });
        findInsightsModalState.groundingTrace = trace;
        findInsightsModalState.foundInsights = items;
        findInsightsModalState.groundedError = null;
    } catch (error: any) {
        console.error("Failed to find insights:", error);
        findInsightsModalState.groundedError = error?.message || "Failed to find grounded insights. Check console and API configuration.";
    } finally {
        findInsightsModalState.isFindingInsights = false;
        triggerModalUpdate();
    }
};

/** Reddit-scoped grounded discovery. Results live in their own slot so Discover results are untouched. */
export const handleRunRedditInsights = async (query?: string, targetCompany?: string) => {
    const activeCompany = resolveCompany(targetCompany);
    const userQuery = (query ?? findInsightsModalState.redditQuery).trim() || `${activeCompany} Reddit community discussions`;
    findInsightsModalState.redditQuery = userQuery;
    findInsightsModalState.isFindingReddit = true;
    findInsightsModalState.redditError = null;
    triggerModalUpdate();
    try {
        const { items } = await discoverGroundedInsights({ activeCompany, userQuery, types: ['reddit'], grounded: true });
        findInsightsModalState.redditInsights = items.map(i => ({ ...i, type: 'reddit', subType: 'reddit' }));
        if (items.length === 0) findInsightsModalState.redditError = `Gemini grounded search returned no Reddit threads for "${userQuery}".`;
    } catch (error: any) {
        console.error("Failed to find Reddit insights:", error);
        findInsightsModalState.redditInsights = [];
        findInsightsModalState.redditError = error?.message || 'Reddit discovery failed. Check console and API configuration.';
    } finally {
        findInsightsModalState.isFindingReddit = false;
        triggerModalUpdate();
    }
};
