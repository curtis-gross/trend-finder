/**
 * Brand, Product & General Video Trend Analysis, Website Intelligence, and Google Search Grounding.
 */
import {
    GEMINI_MODELS,
    callGenAiProxy,
    extractTextFromResponse,
    safeJsonParse
} from "./coreClientAndProxies";

export const analyzeFashionTrends = async (videoUrl: string, companyName: string = "test-company"): Promise<any> => {
    try {
        const fullUrl = videoUrl.startsWith('http') ? videoUrl : `https://www.youtube.com/watch?v=${videoUrl}`;
        
        const prompt = `
        You are an expert brand and product trend analyst and market research consultant for ${companyName}.
        Your goal is to review the following video for emerging brand, product, and creative trends: ${fullUrl}
        
        Identify specific trends shown or mentioned in the video.
        Try to capture at least 1 trend moment per minute of the video duration, up to a maximum of 15 trends total.
        For each trend:
        1. Identify the timestamp (in format MM:SS) when the trend appears or is discussed.
        2. Calculate the approximate seconds from the start of the video for that timestamp.
        3. Describe the trend identified.
        4. Explain how this trend relates to ${companyName} (e.g., target audience alignment, product opportunities, brand fit).
        
        Also provide the following additional data points:
        5. **Overarching trend summary**: Identify exactly 3 overarching trends. Each should have a title and a description.
        6. **Featured Examples Intelligence**: Provide observations on 2 specific featured products, highlights, or examples in the video.
        7. **Strategy and competitive intelligence**: Provide a breakdown of what to do and what not to do based on this video's insights.
        8. **Video metadata tags**: Extract products/offerings, narrative campaign themes, spokespersons/characters, background soundtracks/audio vibes, dialogue talking points across the ENTIRE video duration (at least 8-12 talking points), and a 15-20 word keyword cloud.
        
        REQUIRED OUTPUT (JSON Schema):
        {
            "trends": [
                {
                    "timestamp": "0:15",
                    "seconds": 15,
                    "trend": "Trend Name",
                    "relation": "How it relates to the company..."
                }
            ],
            "summary": "Overall summary of trends in the video.",
            "collection_trends": [
                {
                    "title": "Trend Title",
                    "description": "Trend description..."
                }
            ],
            "look_by_look": [
                {
                    "look": "Example 1: Title",
                    "description": "Description of the featured example..."
                }
            ],
            "strategy": {
                "do": ["Action to take 1", "Action to take 2"],
                "dont": ["Action to avoid 1", "Action to avoid 2"]
            },
            "products": [
                { "name": "Product Name", "description": "Detailed description of what is visible or said...", "timestamp": "0:15" }
            ],
            "themes": [
                { "name": "Theme Title", "description": "Explanation of this thematic concept in the video..." }
            ],
            "characters": [
                { "name": "Character Name", "role_description": "Description of role/character in the spot...", "appearance_timestamp": "0:05" }
            ],
            "music": [
                { "description": "Acoustic guitar backing track...", "vibe": "Warm, inviting, comforting", "duration": "0:00 - 0:30" }
            ],
            "talking_points": [
                { "point": "Hook statement at the beginning of the video...", "speaker": "Narrator", "timestamp": "0:05" },
                { "point": "Final call to action and concluding remarks...", "speaker": "Narrator", "timestamp": "4:55" }
            ],
            "word_cloud": [
                "Keyword1", "Keyword2"
            ]
        }
        
        Do not use markdown blocks. Output ONLY raw JSON.
        `;

        const videoPart = {
            fileData: {
                mimeType: 'video/mp4',
                fileUri: fullUrl
            }
        };

        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{
                role: "user",
                parts: [videoPart, { text: prompt }]
            }],
            config: {
                responseMimeType: "application/json",
                seed: 0,
                maxOutputTokens: 65535,
                thinkingConfig: {
                    thinkingLevel: 'MINIMAL'
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
                ]
            }
        });

        const text = extractTextFromResponse(response) || "{}";
        return safeJsonParse(text, null);
    } catch (error) {
        console.error("Trend analysis error:", error);
        return null;
    }
};

export const analyzeGeneralTrends = async (videoUrl: string, companyName: string = "test-company"): Promise<any> => {
    try {
        const fullUrl = videoUrl.startsWith('http') ? videoUrl : `https://www.youtube.com/watch?v=${videoUrl}`;
        
        const prompt = `
        You are an expert market research consultant and trend analyst for ${companyName}.
        Your goal is to review the following video for general market trends, consumer behavior shifts, or industry innovations: ${fullUrl}
        
        Identify specific trends shown or mentioned in the video.
        Try to capture at least 1 trend moment per minute of the video duration, up to a maximum of 15 trends total.
        For each trend:
        1. Identify the timestamp (in format MM:SS) when the trend appears or is discussed.
        2. Calculate the approximate seconds from the start of the video for that timestamp.
        3. Describe the trend identified.
        4. Explain how this trend relates to ${companyName} (e.g., target audience alignment, product opportunities, brand fit).
        
        Also provide the following additional data points:
        5. **Overarching Trends**: Identify exactly 3 overarching themes or macro trends. Each should have a title and a description.
        6. **Specific Examples**: Provide observations on 2 specific examples or case studies featured in the video.
        7. **Strategy and Competitive Intelligence**: Provide a breakdown of what to do and what not to do based on this video's insights.
        8. **Video metadata tags**: Extract products, narrative campaign themes, spokespersons/characters, background soundtracks/audio vibes, dialogue talking points across the ENTIRE video duration (at least 8-12 talking points), and a 15-20 word keyword cloud.
        
        REQUIRED OUTPUT (JSON Schema):
        {
            "trends": [
                {
                    "timestamp": "0:15",
                    "seconds": 15,
                    "trend": "Trend Name",
                    "relation": "How it relates to the company..."
                }
            ],
            "summary": "Overall summary of trends in the video.",
            "collection_trends": [
                {
                    "title": "Trend Title",
                    "description": "Trend description..."
                }
            ],
            "look_by_look": [
                {
                    "look": "Example 1: Title",
                    "description": "Description of the example..."
                }
            ],
            "strategy": {
                "do": ["Action to take 1", "Action to take 2"],
                "dont": ["Action to avoid 1", "Action to avoid 2"]
            },
            "products": [
                { "name": "Product Name", "description": "Detailed description of what is visible or said...", "timestamp": "0:15" }
            ],
            "themes": [
                { "name": "Theme Title", "description": "Explanation of this thematic concept in the video..." }
            ],
            "characters": [
                { "name": "Character Name", "role_description": "Description of role/character in the spot...", "appearance_timestamp": "0:05" }
            ],
            "music": [
                { "description": "Acoustic guitar backing track...", "vibe": "Warm, inviting, comforting", "duration": "0:00 - 0:30" }
            ],
            "talking_points": [
                { "point": "Hook statement at the beginning of the video...", "speaker": "Narrator", "timestamp": "0:05" },
                { "point": "Final call to action and concluding remarks...", "speaker": "Narrator", "timestamp": "4:55" }
            ],
            "word_cloud": [
                "Keyword1", "Keyword2"
            ]
        }
        
        Do not use markdown blocks. Output ONLY raw JSON.
        `;

        const videoPart = {
            fileData: {
                mimeType: 'video/mp4',
                fileUri: fullUrl
            }
        };

        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{
                role: "user",
                parts: [videoPart, { text: prompt }]
            }],
            config: {
                responseMimeType: "application/json",
                seed: 0,
                maxOutputTokens: 65535,
                thinkingConfig: {
                    thinkingLevel: 'MINIMAL'
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
                ]
            }
        });

        const text = extractTextFromResponse(response) || "{}";
        const parsed = safeJsonParse(text, null);
        if (!parsed) {
            console.warn("Failed to parse JSON for general trends analysis. Raw text preview:", text.substring(0, 200));
        }
        return parsed;
    } catch (error) {
        console.error("General trends analysis error:", error);
        return null;
    }
};

export const analyzeWebsite = async (url: string, focus: string, companyName: string = "test-company"): Promise<any> => {
    const prompt = `
    You are a senior marketing expert and strategic consultant advising ${companyName}.
    Task: Analyze the following website and answer the specific focus question with deep strategic insights.
    
    Website URL: ${url}
    Focus Question: ${focus}
    Company Name: ${companyName}
    
    **INSTRUCTIONS:**
    1. Analyze the page content, looking specifically for keywords related to the Focus Question: "${focus}".
    2. Generate a detailed report of the website.
    3. Categorize your findings into positive, negative, and neutral points regarding the company or the focus question.
    4. **Deep Dive Comparison to Focus Question**: Provide a comprehensive, strategic analysis of how the website addresses the Focus Question ("${focus}").
    5. Compare the website's content and stance to ${companyName}.
    6. Extract a list of top 10-15 keywords from the content for a word cloud.
    
    Use Google Search to find information about the website, its content, and how it relates to the focus question if you cannot access it directly.
    
    Return ONLY a valid JSON object with the following structure:
    {
        "summary": "A summary of the website and its relevance to the focus question.",
        "findings": {
            "positive": ["Positive point 1", "Positive point 2"],
            "negative": ["Negative point 1", "Negative point 2"],
            "neutral": ["Neutral point 1", "Neutral point 2"]
        },
        "score": 7,
        "comparison_to_focus": "A comprehensive, strategic analysis for a marketing expert at ${companyName}.",
        "comparison_to_company": "Detailed comparison of the website content to ${companyName}.",
        "recommendations": [
            "Recommendation 1...",
            "Recommendation 2..."
        ],
        "word_cloud": ["word1", "word2", "word3"]
    }
    Do not use markdown code blocks.
    `;

    try {
        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                tools: [{ googleSearch: {} }]
            }
        });

        const text = extractTextFromResponse(response) || "{}";
        const parsed = safeJsonParse(text);
        if (!parsed || Object.keys(parsed).length === 0) {
            throw new Error(`Website analysis produced empty output from ${GEMINI_MODELS.LITE}`);
        }
        return parsed;
    } catch (error: any) {
        console.error("Website analysis error:", error);
        throw error;
    }
};

export const groundedSearch = async (query: string, companyName: string = "test-company"): Promise<any> => {
    const prompt = `
    You are a senior market research analyst advising ${companyName}.
    Task: Answer the following research question using Google Search.
    
    Question: ${query}
    
    **INSTRUCTIONS:**
    1. Use Google Search to find relevant information and websites.
    2. Analyze the findings to answer the specific points in the question.
    3. Categorize your findings into positive, negative, and neutral points regarding the company or the topic.
    4. Provide a detailed report with summary, key findings, and strategic recommendations for ${companyName}.
    5. Ensure the recommendations are highly actionable and specific.
    
    Return ONLY a valid JSON object with the following structure:
    {
        "summary": "A comprehensive summary answering the question.",
        "findings": {
            "positive": ["Positive point 1", "Positive point 2"],
            "negative": ["Negative point 1", "Negative point 2"],
            "neutral": ["Neutral point 1", "Neutral point 2"]
        },
        "detailed_report": "A detailed narrative report explaining the findings in depth.",
        "recommendations": [
            "Strategic recommendation 1...",
            "Strategic recommendation 2..."
        ]
    }
    Do not use markdown code blocks.
    `;

    try {
        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                tools: [{ googleSearch: {} }]
            }
        });

        const text = extractTextFromResponse(response) || "{}";
        const parsed = safeJsonParse(text);
        if (!parsed || Object.keys(parsed).length === 0) {
            throw new Error(`Grounded search produced empty output from ${GEMINI_MODELS.LITE}`);
        }
        return parsed;
    } catch (error: any) {
        console.error("Grounded search error:", error);
        throw error;
    }
};
