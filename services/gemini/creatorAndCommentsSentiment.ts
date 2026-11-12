/**
 * Creator Partner Compliance Audit and Comments Sentiment Graph.
 */
import {
    callGenAiProxy,
    extractTextFromResponse,
    safeJsonParse
} from "./coreClientAndProxies";

export const analyzeCreatorPartnerVideo = async (videoUrl: string, companyName: string = "test-company", customFocus?: string): Promise<any> => {
    console.log(`\n======================================================`);
    console.log(`🎥 [CREATOR PARTNER ANALYSIS] Analyzing Video: ${videoUrl}`);
    console.log(`🏢 Company: ${companyName}`);
    console.log(`======================================================\n`);

    try {
        const fullUrl = videoUrl.startsWith('http') ? videoUrl : `https://www.youtube.com/watch?v=${videoUrl}`;
        const videoPart = {
            fileData: {
                mimeType: 'video/mp4',
                fileUri: fullUrl
            }
        };

        const focusNote = customFocus ? `\n        ADDITIONAL AUDIT FOCUS: ${customFocus}\n` : '';

        const prompt = `
        You are the Chief Legal, Brand & Compliance Auditor for ${companyName}.
        Conduct a comprehensive Creator Partner Audit of the sponsored YouTube video: ${fullUrl}
${focusNote}
        Fill out the official **${companyName}: Creator Video Review Sign-Off Sheet**.

        EVALUATE EXACTLY THESE 10 CRITERIA:
        1. **FTC Disclosure**: Visual #ad on screen (high contrast) + explicit verbal partnership mention in the first 5 seconds.
        2. **Product & Collection Naming**: Exact product names, collection names, and formats stated correctly.
        3. **Claim Substantiation**: Zero unsubstantiated medical/health claims; factual or sensory-based benefits only.
        4. **Safe Usage & Handling**: Proper and safe product usage demonstrated according to guidelines.
        5. **Packaging Presentation**: Labels clean and visible; current active inventory/packaging shown.
        6. **Third-Party IP & Audio**: Commercial-cleared audio/music used; no visible competitor logos in the frame or background.
        7. **Competitor Neutrality**: No disparaging remarks about other brands; directs viewers to official ${companyName} channels.
        8. **Offer & CTA Precision**: Promo codes, sale dates, landing links, and discount details match campaign brief exactly.
        9. **Visual Environment & Tone**: Clean, bright setting; positive, inclusive tone aligned to brand aesthetic.
        10. **Platform & Safety Rules**: Complies with platform age guidelines; safe environments only.

        DETERMINE THE FINAL DECISION:
        - "APPROVED" (if 9+ criteria PASS and no critical safety/FTC failures)
        - "REVISIONS REQUIRED" (if minor fixes needed, like missing CTA link or missing discount graphic)
        - "REJECTED" (if severe non-compliance, medical claims, or missing FTC disclosure)

        REQUIRED OUTPUT SCHEMA (JSON):
        {
            "metadata": {
                "campaign_name": "Signature Brand Growth Campaign",
                "creator_handle": "@creator_partner",
                "reviewer_name": "AI Brand Auditor",
                "review_date": "${new Date().toLocaleDateString()}"
            },
            "final_decision": "APPROVED",
            "compliance_score": 90,
            "review_table": [
                {
                    "id": 1,
                    "criteria": "FTC Disclosure",
                    "focus_area": "Visual #ad on screen (high contrast) + explicit verbal partnership mention in the first 5 seconds.",
                    "status": "PASS",
                    "notes": "Verbal partnership stated at 0:03 and high-contrast #ad graphic displayed."
                },
                {
                    "id": 2,
                    "criteria": "Product Naming",
                    "focus_area": "Exact product names, collection names, and formats stated correctly.",
                    "status": "PASS",
                    "notes": "Stated product features and specifications accurately."
                },
                {
                    "id": 3,
                    "criteria": "Claim Substantiation",
                    "focus_area": "Zero unsubstantiated claims; factual benefits only.",
                    "status": "PASS",
                    "notes": "Compliant feature and experience claims only."
                },
                {
                    "id": 4,
                    "criteria": "Safe Usage & Handling",
                    "focus_area": "Proper product usage demonstrated.",
                    "status": "PASS",
                    "notes": "Product demonstrated safely according to brand guidelines."
                },
                {
                    "id": 5,
                    "criteria": "Packaging Presentation",
                    "focus_area": "Labels clean and visible; current active inventory/packaging shown.",
                    "status": "PASS",
                    "notes": "Current packaging displayed clearly to camera."
                },
                {
                    "id": 6,
                    "criteria": "Third-Party IP & Audio",
                    "focus_area": "Commercial-cleared audio/music used; no visible competitor logos in the frame or background.",
                    "status": "PASS",
                    "notes": "No competitor branding visible; background music cleared."
                },
                {
                    "id": 7,
                    "criteria": "Competitor Neutrality",
                    "focus_area": "No disparaging remarks about other brands; directs viewers to official ${companyName} channels.",
                    "status": "PASS",
                    "notes": "Positive brand messaging with direct link to official storefront."
                },
                {
                    "id": 8,
                    "criteria": "Offer & CTA Precision",
                    "focus_area": "Promo codes, sale dates, landing links, and discount details match campaign brief exactly.",
                    "status": "PASS",
                    "notes": "Promo code mentioned verbally and included in video description."
                },
                {
                    "id": 9,
                    "criteria": "Visual Environment & Tone",
                    "focus_area": "Clean, bright setting; positive, inclusive tone aligned to brand aesthetic.",
                    "status": "PASS",
                    "notes": "Sunlit modern setting aligned with brand visual standards."
                },
                {
                    "id": 10,
                    "criteria": "Platform & Safety Rules",
                    "focus_area": "Complies with platform age guidelines; safe environments only.",
                    "status": "PASS",
                    "notes": "Complies with all YouTube partner brand safety policies."
                }
            ],
            "product_mentions": [
                { "name": "Product Name", "description": "Visual/audio context...", "timestamp": "1:20", "sentiment": "Positive" }
            ],
            "audit_flags": [
                "Minor: Remind creator to place discount code in top 2 lines of description box."
            ],
            "recommendations": [
                "Approved for immediate campaign publishing across social channels."
            ],
            "summary": "Full 10-point Creator Video Review Sign-Off completed for ${companyName}.",
            "word_cloud": ["Creator", "Sponsorship", "FTC", "Compliance", "Product", "Brand", "SignOff"]
        }

        Do not use markdown blocks. Output ONLY raw JSON.
        `;

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
        return parsed;
    } catch (error) {
        console.error("Creator partner analysis error:", error);
        return null;
    }
};

export const analyzeCommentsSentiment = async (comments: any[], companyName: string = "test-company", isCompetitor: boolean = false): Promise<any> => {
    try {
        const competitorInstruction = isCompetitor ? `
        **CRITICAL NOTE:** These comments are for a COMPETITOR of ${companyName}. 
        Skew your insights towards helping ${companyName} understand what this competitor is doing well, where they are weak, and what ${companyName} can learn from them.` : ``;

        const prompt = `
        You are an expert data analyst, community topic graph architect, and sentiment specialist for ${companyName}.
        Your goal is to analyze the sentiment, topic clusters, and cross-topic relationships across the following YouTube comments.
        ${competitorInstruction}

        **COMMENTS:**
        ${JSON.stringify(comments, null, 2)}

        **TASK:**
        1. Analyze for sentiment (positive, negative, neutral) across these comments.
        2. Provide aggregate counts for each sentiment.
        3. Highlight top 5 positive, negative, and neutral trends or recurring themes across all comments.
        4. Induce 5 to 8 distinct, canonical topic clusters ("topic_clusters") from the comments, noting how each topic connects to other topics based on comments that mention or bridge multiple themes together.
        5. Explicitly map cross-topic relationships ("topic_relationships") wherever comments co-mention, compare, or causally connect two topics. Generate at least 6 to 12 strong cross-topic relationship edges so the topic network graph is richly interconnected.
        6. Provide a breakdown of all provided comments with their sentiment, primary "category" (matching one of the induced topic clusters), and "relatedTopics" (1 to 3 secondary or connected topics referenced or implied by that comment).

        **REQUIRED OUTPUT (JSON Schema):**
        {
            "counts": {
                "positive": 45,
                "negative": 25,
                "neutral": 30
            },
            "trends": {
                "positive": ["Trend 1", "Trend 2"],
                "negative": ["Trend 1", "Trend 2"],
                "neutral": ["Trend 1", "Trend 2"]
            },
            "summary": "Overall comments sentiment and cross-topic relationship summary.",
            "topic_clusters": [
                {
                    "topic": "Canonical Topic Name",
                    "mentions": 18,
                    "sentiment": "positive|negative|mixed",
                    "relatedTopics": ["Connected Topic 1", "Connected Topic 2"]
                }
            ],
            "topic_relationships": [
                {
                    "source": "Canonical Topic Name A",
                    "target": "Canonical Topic Name B",
                    "strength": 0.85,
                    "sharedCommentCount": 8,
                    "reason": "Brief explanation of how user comments connect Topic A and Topic B"
                }
            ],
            "breakdown": [
                {
                    "text": "Comment text here",
                    "sentiment": "positive|negative|neutral",
                    "category": "Canonical Topic Name",
                    "relatedTopics": ["Connected Topic 1", "Connected Topic 2"]
                }
            ]
        }
        
        Do not use markdown blocks. Output ONLY raw JSON.
        `;

        const response = await callGenAiProxy("generateContent", {
            model: 'gemini-3.5-flash-lite',
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: { 
                responseMimeType: "application/json",
                maxOutputTokens: 65535,
                seed: 0,
                thinkingConfig: {
                    thinkingLevel: "MINIMAL"
                },
                safetySettings: [
                    { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'OFF' },
                    { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'OFF' }
                ]
            }
        });

        const text = extractTextFromResponse(response);
        if (!text) {
            throw new Error(`Model returned empty response for comments sentiment analysis`);
        }
        const parsed = safeJsonParse(text, null);
        if (!parsed) {
            throw new Error(`Failed to parse JSON response for comments sentiment analysis`);
        }
        return parsed;
    } catch (error) {
        console.error("Comments sentiment error:", error);
        throw error;
    }
};
