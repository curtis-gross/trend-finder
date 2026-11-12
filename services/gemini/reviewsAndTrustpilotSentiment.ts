/**
 * Steam Reviews and Trustpilot Customer Sentiment Analysis.
 */
import {
    GEMINI_MODELS,
    callGenAiProxy,
    extractTextFromResponse,
    safeJsonParse
} from "./coreClientAndProxies";

export const analyzeSteamReviews = async (reviews: any[], companyName: string = "test-company"): Promise<any> => {
    if (!Array.isArray(reviews) || reviews.length === 0) {
        throw new Error(`No Steam reviews available to analyze for ${companyName}.`);
    }
    try {
        const prompt = `
        You are an expert data analyst and sentiment specialist for ${companyName}.
        Your goal is to analyze the sentiment of the following ${reviews.length} Steam user reviews.

        **REVIEWS:**
        ${JSON.stringify(reviews, null, 2)}

        **TASK:**
        1. Analyze the overall sentiment across all reviews and provide a summary.
        2. Identify and extract 5 distinct positive reviews, 5 distinct negative reviews, and 5 distinct neutral reviews from the provided list.
        3. Count the total number of positive, negative, and neutral reviews among those provided to be used in a chart.

        **REQUIRED OUTPUT (JSON Schema):**
        {
            "summary": "Overall summary of user feedback...",
            "reviews": {
                "positive": ["Review text 1", "Review text 2", "Review text 3", "Review text 4", "Review text 5"],
                "negative": ["Review text 1", "Review text 2", "Review text 3", "Review text 4", "Review text 5"],
                "neutral": ["Review text 1", "Review text 2", "Review text 3", "Review text 4", "Review text 5"]
            },
            "counts": { "positive": 60, "negative": 30, "neutral": 10 }
        }
        
        Do not use markdown blocks. Output ONLY raw JSON.
        `;

        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json"
            }
        });

        const text = extractTextFromResponse(response);
        if (!text || !text.trim()) {
            throw new Error(`Steam reviews sentiment analysis returned an empty response.`);
        }
        const parsed = safeJsonParse<any>(text, null);
        if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
            throw new Error(`Failed to parse Steam reviews sentiment JSON output.`);
        }
        return parsed;
    } catch (error) {
        console.error("Steam reviews analysis error:", error);
        throw error instanceof Error ? error : new Error(String(error));
    }
};

export const analyzeTrustpilotSentiment = async (
    reviews: any[],
    companyName: string = "test-company",
    businessInfo?: any,
    trustpilotUrl?: string
): Promise<any> => {
    try {
        const defaultDomain = `${(companyName || 'test-company').toLowerCase().replace(/[^a-z0-9]+/g, '') || 'testcompany'}.com`;
        const rawDomain = businessInfo?.domain || (trustpilotUrl ? trustpilotUrl.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/trustpilot\.com\/review\//i, '').replace(/^www\./i, '').split('/')[0].split('?')[0] : defaultDomain);
        const domain = rawDomain.replace(/^www\./i, '').trim() || defaultDomain;
        const compactReviews = (reviews || []).map((r, i) => ({
            index: i + 1,
            author: r.author || 'Reviewer',
            rating: typeof r.rating === 'number' ? r.rating : (r.rating ?? null),
            title: r.title || '',
            review: (r.review || '').substring(0, 500),
            date: r.date || '',
            hasCompanyReply: Boolean(r.reply)
        }));

        const isGroundedNeeded = compactReviews.length < 5;

        const prompt = `
        You are an expert market intelligence specialist and customer experience data analyst evaluating customer sentiment for ${companyName} (${domain}).
        
        ${isGroundedNeeded ? `CRITICAL: Search Google for verified Trustpilot customer reviews, TrustScore rating, star breakdown, positive praise, negative complaints, customer service reviews, shipping experiences, return policies, and product quality for ${domain} at https://www.trustpilot.com/review/${domain}.` : ''}

        Analyze the following ${compactReviews.length > 0 ? `${compactReviews.length} provided reviews and live Trustpilot feedback` : `Trustpilot customer feedback`} for ${companyName} (${domain}).
        ${businessInfo?.trustScore ? `Current TrustScore: ${businessInfo.trustScore} / 5 (${businessInfo.rating || 'Standard'}) with ${businessInfo.reviewCount || 'multiple'} total reviews.` : ''}

        ${compactReviews.length > 0 ? `**PROVIDED REVIEWS DATA:**\n${JSON.stringify(compactReviews, null, 2)}` : ''}

        **TASK:**
        1. Synthesize the overall customer sentiment, brand perception, recurring themes, and operational trends across Trustpilot reviews for ${companyName}.
        2. Calculate/estimate the counts of positive (4-5 stars or positive sentiment), negative (1-2 stars or negative sentiment), and neutral (3 stars or mixed sentiment) reviews.
        3. Break down the review star distribution (1-star through 5-stars).
        4. Analyze key operational dimensions:
           - Customer Service & Staff
           - Order Fulfillment, Shipping & Delivery Timeliness
           - Product Quality, Selection & Authenticity
           - Pricing, Value & Price Matching
           - Returns, Exchanges & Refund Processing
           - Website, App & Checkout Experience
        5. Extract 6-8 distinct, authentic representative quotes for Positive reviews, Negative reviews (pain points), and Neutral/Mixed reviews.
        6. Provide 5-7 prioritized strategic recommendations for leadership to improve customer retention, CSAT, and TrustScore.
        7. Extract a 25-35 item keyword cloud of prominent customer themes.

        **REQUIRED OUTPUT (JSON Schema):**
        {
            "summary": "Comprehensive executive summary of customer sentiment, recurring praise, and major friction points...",
            "counts": {
                "positive": 60,
                "negative": 30,
                "neutral": 10
            },
            "star_distribution": {
                "star_5": 55,
                "star_4": 5,
                "star_3": 10,
                "star_2": 8,
                "star_1": 22
            },
            "sentiment_score": 68,
            "retail_dimensions": [
                {
                    "dimension": "Customer Service & Support",
                    "sentiment": "Positive",
                    "score": 85,
                    "summary": "Summary of feedback regarding customer support agents and service staff...",
                    "strengths": ["Knowledgeable associates", "Quick response when reached"],
                    "pain_points": ["Occasional hold times", "Inconsistent communication across departments"]
                },
                {
                    "dimension": "Order Fulfillment & Shipping",
                    "sentiment": "Mixed",
                    "score": 62,
                    "summary": "Analysis of delivery speeds, tracking accuracy, and stock availability...",
                    "strengths": ["Fast standard shipping on in-stock goods"],
                    "pain_points": ["Unexpected cancellation notices due to inventory lag"]
                },
                {
                    "dimension": "Product Quality & Selection",
                    "sentiment": "Positive",
                    "score": 90,
                    "summary": "Customer opinions on merchandise breadth and build quality...",
                    "strengths": ["Wide variety of products", "Authentic high-grade materials"],
                    "pain_points": ["Specialty sizes occasionally out of stock"]
                },
                {
                    "dimension": "Pricing & Value",
                    "sentiment": "Mixed",
                    "score": 65,
                    "summary": "Feedback on competitive pricing, discounts, and price guarantee policy...",
                    "strengths": ["Strong promotional seasonal sales"],
                    "pain_points": ["Friction when requesting price adjustments"]
                },
                {
                    "dimension": "Returns & Refund Experience",
                    "sentiment": "Mixed",
                    "score": 60,
                    "summary": "Evaluation of return window, credit, and refund processing times...",
                    "strengths": ["Easy drop-off"],
                    "pain_points": ["Refund posting delays"]
                }
            ],
            "reviews": {
                "positive": ["Quote 1", "Quote 2", "Quote 3", "Quote 4", "Quote 5"],
                "negative": ["Quote 1", "Quote 2", "Quote 3", "Quote 4", "Quote 5"],
                "neutral": ["Quote 1", "Quote 2", "Quote 3"]
            },
            "strategic_recommendations": [
                {
                    "priority": "High",
                    "area": "Inventory Synchronization",
                    "recommendation": "Implement real-time inventory locking at checkout to eliminate out-of-stock order cancellations.",
                    "expected_impact": "Reduces #1 source of 1-star reviews and improves trust among promotional shoppers."
                },
                {
                    "priority": "Medium",
                    "area": "Proactive Shipping Delay Alerts",
                    "recommendation": "Automatically send SMS/email notifications if pickup or transit is delayed beyond promised SLA.",
                    "expected_impact": "Sets transparent customer expectations and mitigates negative reviews."
                }
            ],
            "word_cloud": [
                "Customer Service", "Shipping", "Staff", "Value", "Quality", "Selection", "Refund",
                "Pickup", "Fast Delivery", "Helpful", "Inventory", "Return Policy"
            ],
            "business_info": {
                "name": "${businessInfo?.name || companyName}",
                "domain": "${domain}",
                "trustScore": "${businessInfo?.trustScore ?? ''}",
                "rating": "${businessInfo?.rating || 'TrustScore'}",
                "reviewCount": ${typeof businessInfo?.reviewCount === 'number' ? businessInfo.reviewCount : 0},
                "logo": "${businessInfo?.logo || ''}"
            }
        }

        Do not use markdown blocks. Output ONLY raw JSON.
        `;

        const config: any = isGroundedNeeded ? {
            tools: [{ googleSearch: {} }]
        } : {
            responseMimeType: "application/json"
        };

        const response = await callGenAiProxy("generateContent", {
            model: GEMINI_MODELS.LITE,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config
        });

        const text = extractTextFromResponse(response) || "{}";
        const parsed = safeJsonParse(text);
        if (!parsed || Object.keys(parsed).length === 0) {
            throw new Error(`Trustpilot sentiment parsing produced empty output from ${GEMINI_MODELS.LITE}`);
        }
        
        if (businessInfo && !parsed.business_info) {
            parsed.business_info = businessInfo;
        } else if (businessInfo && parsed.business_info) {
            parsed.business_info = { ...businessInfo, ...parsed.business_info };
        }

        return parsed;
    } catch (error: any) {
        console.error("Trustpilot reviews analysis error:", error);
        throw error;
    }
};
