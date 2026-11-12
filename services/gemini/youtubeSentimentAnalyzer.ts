/**
 * YouTube Unified Video & Comments Sentiment Analyzer.
 */
import {
    callGenAiProxy,
    extractTextFromResponse,
    safeJsonParse
} from "./coreClientAndProxies";
import {
    analyzeVideoSentiment,
    analyzeCommentsSentiment
} from "./mediaAndBrandAudit";

export function extractYouTubeId(url: string): string {
    if (!url) return '';
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=|shorts\/)([^#\&\?]*).*/;
    const match = url.match(regExp);
    return (match && match[2].length === 11) ? match[2] : url;
}

export const getVideoId = extractYouTubeId;

export const analyzeYouTubeSentiment = async (videoUrl: string, companyName: string = "test-company", isCompetitor: boolean = false): Promise<any> => {
    const videoId = extractYouTubeId(videoUrl);
    const fullUrl = videoUrl.startsWith('http') ? videoUrl : (videoId ? `https://www.youtube.com/watch?v=${videoId}` : videoUrl);

    console.log(`\n======================================================`);
    console.log(`🎥 [YOUTUBE UNIFIED SENTIMENT] Analyzing Video & Comments: ${fullUrl}`);
    console.log(`======================================================\n`);

    console.log(`🚀 [YOUTUBE CONCURRENT PIPELINE] Launching video sentiment and comments pipeline simultaneously for: ${fullUrl}`);

    const videoSentimentPromise = analyzeVideoSentiment(fullUrl, companyName, isCompetitor);

    const commentsPipelinePromise = (async () => {
        if (!videoId) return { rawComments: [], commentsResult: null };
        console.log(`📥 [YOUTUBE COMMENTS STREAM] Fetching comments from YouTube Data API for video [${videoId}]...`);
        const res = await fetch(`/api/youtube/comments?videoId=${videoId}&maxResults=100`);
        if (!res.ok) {
            const errText = await res.text();
            console.error('[analyzeYouTubeSentiment] Failed to fetch YouTube comments:', res.status, errText);
            throw new Error(`YouTube comments fetch failed (${res.status}): ${errText}`);
        }
        const data = await res.json();
        const rawComments = Array.isArray(data) ? data : (Array.isArray(data?.comments) ? data.comments : []);
        console.log(`✅ [YOUTUBE COMMENTS STREAM] Ingested ${rawComments.length} comments. Analyzing comment sentiment concurrently...`);

        let commentsResult: any = null;
        if (rawComments.length > 0) {
            commentsResult = await analyzeCommentsSentiment(rawComments, companyName, isCompetitor);
            console.log(`✅ [YOUTUBE COMMENTS STREAM] Comment sentiment analysis complete.`);
        }
        return { rawComments, commentsResult };
    })();

    const [commentsPipeline, videoResult] = await Promise.all([commentsPipelinePromise, videoSentimentPromise]);
    if (!videoResult || typeof videoResult !== 'object') {
        throw new Error(`Video multimodal sentiment analysis returned empty result for ${fullUrl}`);
    }

    const rawComments = commentsPipeline.rawComments || [];
    const commentsResult = commentsPipeline.commentsResult;

    const posVid = videoResult?.sentiment?.positive?.length || 0;
    const negVid = videoResult?.sentiment?.negative?.length || 0;
    const posCom = commentsResult?.counts?.positive || 0;
    const negCom = commentsResult?.counts?.negative || 0;
    const neuCom = commentsResult?.counts?.neutral || 0;
    const totalCom = posCom + negCom + neuCom;

    const videoScore: number | null = (posVid + negVid) > 0 ? Math.round((posVid / (posVid + negVid)) * 100) : null;
    const commentsScore: number | null = totalCom > 0 ? Math.round((posCom / totalCom) * 100) : null;
    const overallScore: number | null =
        videoScore !== null && commentsScore !== null
            ? Math.round((videoScore * 0.45) + (commentsScore * 0.55))
            : (commentsScore ?? videoScore ?? null);

    const synthesisPrompt = `
    You are a Master Social & Video Intelligence Director and Topic Graph Architect for ${companyName}.
    Synthesize the relationship between what is presented in this YouTube video and how the audience responded in the comments, explicitly identifying cross-topic connections between creator themes and audience comment clusters.

    VIDEO ANALYSIS:
    - Summary: ${videoResult?.summary || ''}
    - Themes: ${JSON.stringify(videoResult?.themes || [])}
    - Positive points: ${JSON.stringify(videoResult?.sentiment?.positive || [])}
    - Negative points: ${JSON.stringify(videoResult?.sentiment?.negative || [])}

    COMMENTS AUDIENCE ANALYSIS:
    - Audience Summary: ${commentsResult?.summary || ''}
    - Positive trends: ${JSON.stringify(commentsResult?.trends?.positive || [])}
    - Negative trends: ${JSON.stringify(commentsResult?.trends?.negative || [])}
    - Topic Clusters: ${JSON.stringify(commentsResult?.topic_clusters || [])}
    - Comment Topic Relationships: ${JSON.stringify(commentsResult?.topic_relationships || [])}

    Output valid JSON:
    {
        "summary": "Executive 2-3 sentence paragraph synthesizing video reception and audience sentiment.",
        "alignment": {
            "status": "Aligned",
            "explanation": "Comparison of creator tone vs audience sentiment.",
            "creator_stance": "Creator perspective summary.",
            "audience_consensus": "Audience consensus summary."
        },
        "topic_relationships": [
            {
                "source": "Topic or Theme A",
                "target": "Topic or Theme B",
                "strength": 0.88,
                "reason": "How audience comments and video coverage connect Topic A and Topic B"
            }
        ],
        "strategic_takeaways": [
            { "priority": "High", "area": "Community Engagement", "recommendation": "Actionable step", "impact": "Expected outcome" }
        ]
    }
    `;

    const synthResp = await callGenAiProxy("generateContent", {
        model: "gemini-3.5-flash-lite",
        contents: [{ role: "user", parts: [{ text: synthesisPrompt }] }],
        config: {
            responseMimeType: "application/json",
            temperature: 0.2
        }
    });
    const synthText = extractTextFromResponse(synthResp);
    if (!synthText || !synthText.trim()) {
        throw new Error(`YouTube unified sentiment synthesis returned empty response for ${fullUrl}`);
    }
    const synthData = safeJsonParse<any>(synthText, null);
    if (!synthData || typeof synthData !== 'object') {
        throw new Error(`Failed to parse YouTube unified sentiment synthesis JSON for ${fullUrl}`);
    }

    return {
        type: 'youtube_sentiment',
        videoUrl: fullUrl,
        videoId: videoId,
        overallScore: overallScore !== null ? Math.round(overallScore / 10) : null,
        overallScorePercent: overallScore,
        videoScore: videoScore,
        commentsScore: commentsScore,
        summary: synthData.summary || videoResult?.summary || commentsResult?.summary || '',
        alignment: synthData.alignment || null,
        topic_clusters: commentsResult?.topic_clusters || [],
        topic_relationships: (Array.isArray(synthData.topic_relationships) && synthData.topic_relationships.length > 0)
            ? synthData.topic_relationships
            : (commentsResult?.topic_relationships || []),
        strategic_takeaways: Array.isArray(synthData.strategic_takeaways) ? synthData.strategic_takeaways : [],
        videoSentiment: videoResult,
        commentsSentiment: commentsResult,
        videoResult,
        commentsResult,
        comments: rawComments,
        rawCommentsCount: rawComments.length,
        raw_comments_count: rawComments.length,
        timestamp: new Date().toISOString()
    };
};
