/**
 * TikTok Trend Analysis and Two-Stage Grounded Research.
 */
import {
    GEMINI_MODELS,
    callGenAiProxy,
    extractGroundingSearchQueries,
    extractGroundingWebChunks,
    extractTextFromResponse,
    safeJsonParse
} from "./coreClientAndProxies";

export const analyzeTikTokSentiment = async (
    queryOrData: string | any,
    companyName: string = 'test-company',
    guidance: string = ''
): Promise<any> => {
    const queryStr = typeof queryOrData === 'object' && queryOrData !== null
        ? (queryOrData.tag || queryOrData.query || queryOrData.url || 'trends')
        : String(queryOrData || 'trends');
    const cleanTag = queryStr.replace(/^#/, '').trim();

    const prompt = `
    You are a TikTok Trend & Creator Intelligence Analyst for ${companyName}.
    Analyze TikTok creator videos, viral sounds, hooks, and audience comments for hashtag #${cleanTag}.
    ${guidance ? `Focus area: ${guidance}` : ''}

    Output JSON:
    {
        "summary": "2-3 sentence overview of TikTok viral reception.",
        "sentiment_score": 82,
        "counts": { "positive": 20, "negative": 3, "neutral": 5 },
        "clips": [
            { "creator": "@creator", "hook": "Viral video hook", "views": "1.2M", "sentiment": "positive" }
        ],
        "comments": [
            { "author": "@viewer", "text": "Top viral comment", "likes": 3200, "sentiment": "positive", "category": "Viral Hook & Reception", "relatedTopics": ["Creator Authenticity", "Product Appeal"] }
        ]
    }
    `;

    const resp = await callGenAiProxy("generateContent", {
        model: "gemini-3.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: prompt }] }],
        config: { responseMimeType: "application/json", temperature: 0.3 }
    });
    const text = extractTextFromResponse(resp);
    if (!text || !text.trim()) {
        throw new Error(`TikTok sentiment analysis returned an empty response for #${cleanTag}.`);
    }
    const data = safeJsonParse<any>(text, null);
    if (!data || typeof data !== 'object' || Array.isArray(data) || Object.keys(data).length === 0) {
        throw new Error(`Failed to parse TikTok sentiment JSON output for #${cleanTag}.`);
    }

    const clips = Array.isArray(data.clips) ? data.clips : [];
    const comments = Array.isArray(data.comments) ? data.comments : [];
    const summary = typeof data.summary === 'string' ? data.summary.trim() : '';

    const rawCounts = data.counts && typeof data.counts === 'object' ? data.counts : null;
    const counts = rawCounts
        ? {
            positive: Number(rawCounts.positive ?? 0),
            negative: Number(rawCounts.negative ?? 0),
            neutral: Number(rawCounts.neutral ?? 0)
        }
        : (comments.length > 0
            ? {
                positive: comments.filter((c: any) => String(c?.sentiment || '').toLowerCase() === 'positive').length,
                negative: comments.filter((c: any) => String(c?.sentiment || '').toLowerCase() === 'negative').length,
                neutral: comments.filter((c: any) => !['positive', 'negative'].includes(String(c?.sentiment || '').toLowerCase())).length
            }
            : null);

    if (!summary && clips.length === 0 && comments.length === 0 && !counts) {
        throw new Error(`TikTok sentiment response contained no usable analysis data for #${cleanTag}.`);
    }

    const totalCounts = counts ? (counts.positive + counts.negative + counts.neutral) : 0;
    const sentimentScore = typeof data.sentiment_score === 'number' && !Number.isNaN(data.sentiment_score)
        ? data.sentiment_score
        : (totalCounts > 0 && counts ? Math.round((counts.positive / totalCounts) * 100) : null);

    return {
        type: 'tiktok',
        query: queryStr,
        tag: cleanTag,
        hashtag: `#${cleanTag}`,
        companyName,
        summary,
        sentiment_score: sentimentScore,
        counts,
        clips,
        comments,
        timestamp: new Date().toISOString()
    };
};

export const runGroundedResearchAndStructure = async <T = any>(options: {
    researchPrompt: string;
    schemaPrompt: string;
    fallbackValue: T;
    agentName: string;
    searchModel?: string;
    extractModel?: string;
}): Promise<{
    data: T;
    searchQueries: string[];
    rawGroundedLinks: Array<{ uri: string; title: string }>;
    rawResearchText: string;
    rawJsonText: string;
}> => {
    const {
        researchPrompt,
        schemaPrompt,
        fallbackValue,
        searchModel = GEMINI_MODELS.FLASH,
        extractModel = GEMINI_MODELS.FLASH
    } = options;

    // --- Stage 1: Plain Text Grounded Search (No JSON mode) ---
    const searchResponse = await callGenAiProxy("generateContent", {
        model: searchModel,
        contents: [{ role: "user", parts: [{ text: researchPrompt }] }],
        config: {
            maxOutputTokens: 8192,
            temperature: 0.2,
            tools: [{ googleSearch: {} }]
        }
    });

    const rawResearchText = extractTextFromResponse(searchResponse);
    const rawGroundedLinks = extractGroundingWebChunks(searchResponse);
    const searchQueries = extractGroundingSearchQueries(searchResponse);

    // --- Stage 2: Structured JSON Extraction ---
    const verifiedLinksSummary = rawGroundedLinks.length > 0
        ? rawGroundedLinks.map((l, i) => `[Link ${i + 1}] Title: "${l.title}" | URL: ${l.uri}`).join('\n')
        : "No direct external URLs discovered.";

    const jsonExtractionPrompt = `
You are a specialized data structuring agent.
Below is authentic, grounded market research and a list of verified web source URLs discovered from Google Search.

${schemaPrompt}

VERIFIED DISCOVERED WEB SOURCES:
${verifiedLinksSummary}

GROUNDED RESEARCH TEXT:
${rawResearchText}

CRITICAL RULES:
1. Extract the data accurately from the grounded research text above.
2. For URL fields, use ONLY the URLs provided in the VERIFIED DISCOVERED WEB SOURCES list above. Do NOT invent URLs.
3. Output valid raw JSON matching the requested structure. Do NOT use markdown code blocks.
`;

    const jsonResponse = await callGenAiProxy("generateContent", {
        model: extractModel,
        contents: [{ role: "user", parts: [{ text: jsonExtractionPrompt }] }],
        config: {
            responseMimeType: "application/json",
            maxOutputTokens: 8192,
            temperature: 0.1
        }
    });

    const rawJsonText = extractTextFromResponse(jsonResponse);
    const parsedData = safeJsonParse(rawJsonText, fallbackValue);

    return {
        data: parsedData,
        searchQueries,
        rawGroundedLinks,
        rawResearchText,
        rawJsonText
    };
};
