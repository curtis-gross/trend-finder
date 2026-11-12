import { executeWithRetry, generateText, safeJsonParse } from '../geminiService';
import {
    type EnrichedComment,
    type FilteredComment,
    type InducedCategory,
    type Stage3KeywordResult,
} from './noiseTypes';
import { chunkArray, detectCommentLanguage } from './languageAndTimeUtils';
import { isPlatformOrSourceNode, stripSourceMetadataPrefix } from './nodeStemmingUtils';
import { induceDynamicCategories } from './dynamicCategoryInducer';
import { aggregateStage3TopicsAndClusters } from './stage3ClusterAggregator';
import { saveStageDataToGCS, sendTerminalLog } from './stageGcsCacheClient';

const resolveGroundedCommentSentiment = (
    c: FilteredComment,
    llmSentiment?: string
): 'positive' | 'negative' | 'neutral' => {
    if (llmSentiment === 'positive' || llmSentiment === 'negative') {
        return llmSentiment;
    }
    if (c.source === 'Metacritic' && typeof c.score === 'number') {
        if (c.reviewType === 'critic' || (c.maxScore && c.maxScore === 100) || c.score > 10) {
            return c.score >= 75 ? 'positive' : c.score < 50 ? 'negative' : 'neutral';
        }
        return c.score >= 7 ? 'positive' : c.score < 4 ? 'negative' : 'neutral';
    }
    if (llmSentiment === 'neutral') return 'neutral';
    return 'neutral';
};

/**
 * PHASE 3B: Comment Enrichment & Granular Topic Extraction
 */
const processKeywordEnrichmentChunk50 = async (
    chunk: FilteredComment[],
    batchIndex: number,
    totalBatches: number,
    companyName: string,
    targetCategories: InducedCategory[]
): Promise<{ enriched: EnrichedComment[]; topKeywords: any[] }> => {
    const categoryNames = targetCategories.map(c => c.name);

    const prompt = `You are a Principal Customer Intelligence & NLP Scientist for ${companyName}.
Enrich this batch of ${chunk.length} constructive customer feedback items (Batch ${batchIndex + 1} of ${totalBatches}).

TARGET CATEGORIES (Pillars induced for ${companyName}):
${JSON.stringify(targetCategories)}

TASK:
1. Assign exactly one target category ("featureCategory") from the list above:
   ${JSON.stringify(categoryNames)}

2. Discover and extract 2 to 4 unique, granular topics specific to EACH individual critique:
   - Extract organic, descriptive 2-5 word topics directly from the reviewer's specific feedback (including Metacritic Critic Reviews on a 0-100 scale from /critic-reviews/ and Metacritic User Reviews on a 0-10 scale from /user-reviews/).
   - DO NOT repeat generic lists; discover authentic topic phrases unique to what the reviewer discusses in their text.
   - CRITICAL RULE: NEVER output platform, channel, or review source names (such as "Metacritic", "Metacritic Reviews", "Metascore", "Critic Reviews", "User Reviews", "YouTube", "Reddit", "Steam", "TikTok", "Twitter", "Twitch", "Trustpilot") as a topic or keyword. Every topic must describe an actual product feature, service dimension, operational mechanic, or customer experience.

3. Detect authentic natural language ("English" | "Spanish" | "German" | "Portuguese" | "French" | "Japanese" | "Italian" | "Korean" | "Chinese" | "Russian" | "Arabic" | "Other").
4. Assign sentiment ("positive" | "negative" | "neutral"), constructiveSummary (1-sentence summarizing the core feedback), and actionableSuggestion (concrete recommendation for ${companyName}).

CORPUS:
${JSON.stringify(chunk.map(c => ({ id: c.id, text: stripSourceMetadataPrefix(c.rawText), period: c.period || c.release, source: c.source, reviewType: c.reviewType, score: c.score, maxScore: c.maxScore, author: c.author, language: c.language, sourceUrl: c.videoUrl || c.sourceUrl || c.subpageUrl })))}

Return valid JSON object matching:
{
  "enrichedComments": [
    {
      "id": "comment-id",
      "sourceUrl": "copy the CORPUS item's sourceUrl unchanged (or null)",
      "featureCategory": "${categoryNames[0]}",
      "structuredKeywords": ["${categoryNames[0]}"],
      "discoveredTopics": ["granular topic 1", "granular topic 2"],
      "keywords": ["${categoryNames[0]}", "granular topic 1", "granular topic 2"],
      "sentiment": "negative",
      "language": "English",
      "constructiveSummary": "Clear 1-sentence summary of customer feedback.",
      "actionableSuggestion": "Actionable operational suggestion for ${companyName}."
    }
  ],
  "topKeywords": [
    { "keyword": "granular topic 1", "category": "${categoryNames[0]}", "mentions": 3, "sentiment": "negative" }
  ]
}
Return JSON only.`;

    try {
        const text = await executeWithRetry(
            () => generateText(prompt, 'gemini-3.8-flash', {
                responseMimeType: 'application/json',
                temperature: 0.25,
                thinkingConfig: { thinkingLevel: 'LOW' }
            }),
            {
                maxRetries: 3,
                baseDelayMs: 1500,
                maxDelayMs: 8000,
                operationName: `Topic Extraction Worker #${batchIndex + 1}`,
                onRetry: async (attempt, delayMs) => {
                    const delaySec = (delayMs / 1000).toFixed(1);
                    console.warn(`[Topic Extraction Worker #${batchIndex + 1}/${totalBatches}] 429 RESOURCE_EXHAUSTED hit (attempt ${attempt}/3). Backing off ${delaySec}s with jitter...`);
                    await sendTerminalLog(`⚠️ [Topic Worker #${batchIndex + 1}/${totalBatches}] 429 RESOURCE_EXHAUSTED (attempt ${attempt}/3). Backing off ${delaySec}s with jitter...`, 'worker');
                }
            }
        );

        const parsed = safeJsonParse(text);
        if (!parsed || !Array.isArray(parsed.enrichedComments)) {
            throw new Error('Invalid response structure from topic extraction model');
        }

        const resultMap = new Map(parsed.enrichedComments.map((item: any) => [item.id, item]));
        const enriched = chunk.map(c => {
            const match: any = resultMap.get(c.id);
            const rawAssignedCategory = match?.featureCategory || targetCategories[0]?.name || 'Customer Experience';
            const assignedCategory = isPlatformOrSourceNode(rawAssignedCategory)
                ? (targetCategories[0]?.name || 'Customer Experience')
                : rawAssignedCategory;
            const structured: string[] = Array.isArray(match?.structuredKeywords) && match.structuredKeywords.length > 0
                ? match.structuredKeywords.filter((k: string) => !isPlatformOrSourceNode(k))
                : [assignedCategory];
            const discovered: string[] = Array.isArray(match?.discoveredTopics)
                ? match.discoveredTopics.filter((k: string) => !isPlatformOrSourceNode(k))
                : [];

            let mergedKeywords: string[] = [];
            if (Array.isArray(match?.keywords) && match.keywords.length > 0) {
                mergedKeywords = match.keywords.filter((k: string) => !isPlatformOrSourceNode(k));
            } else {
                mergedKeywords = [...structured, ...discovered];
            }
            if (mergedKeywords.length === 0) {
                mergedKeywords = [assignedCategory, 'Customer Feedback'];
            }

            const detectedLang = detectCommentLanguage(match?.language || c.language || c.country, c.rawText);
            // Provenance is copied from the input comment by ID, never from model output (hallucination-proof).
            const provenance = {
                sourceUrl: c.sourceUrl || c.subpageUrl,
                videoUrl: c.videoUrl,
                videoId: c.videoId,
                videoTitle: c.videoTitle,
                channelTitle: c.channelTitle,
                sourceLabel: c.sourceLabel
            };

            return {
                ...c,
                ...provenance,
                language: detectedLang,
                country: detectedLang,
                featureCategory: assignedCategory,
                keywords: mergedKeywords,
                structuredKeywords: structured.length > 0 ? structured : [assignedCategory],
                discoveredTopics: discovered,
                sentiment: resolveGroundedCommentSentiment(c, match?.sentiment),
                constructiveSummary: match?.constructiveSummary || `Customer feedback regarding ${companyName}`,
                actionableSuggestion: match?.actionableSuggestion || `Review customer feedback and optimize ${assignedCategory.toLowerCase()}`
            };
        });
        const cleanedTopKeywords = (Array.isArray(parsed.topKeywords) ? parsed.topKeywords : [])
            .filter((tk: any) => !isPlatformOrSourceNode(tk?.keyword || tk?.title));
        return { enriched, topKeywords: cleanedTopKeywords };
    } catch (e) {
        console.error(`Keyword batch ${batchIndex + 1} error after retries:`, e);
        await sendTerminalLog(`[Topic Extraction Error] Batch ${batchIndex + 1}/${totalBatches} failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
        throw e;
    }
};

export const stage3_convertToKeywords = async (
    signalComments: FilteredComment[],
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void
): Promise<Stage3KeywordResult> => {
    const CHUNK_SIZE = 75;
    const CONCURRENCY_LIMIT = 8;
    const chunks = chunkArray(signalComments, CHUNK_SIZE);
    const totalBatches = chunks.length;
    const workerCount = Math.min(CONCURRENCY_LIMIT, totalBatches);

    await sendTerminalLog(`STAGE 3: TOPIC INTELLIGENCE PIPELINE STARTING for ${companyName}...`, 'header');
    if (onProgress) onProgress(`Stage 3: Discovering dynamic category pillars for ${companyName}...`);

    await sendTerminalLog(`[Phase 3A: Category Induction] Analyzing clean feedback sample to induce natural customer pillars for ${companyName}...`, 'phase');
    const inducedCategories = await induceDynamicCategories(signalComments, companyName);
    await sendTerminalLog(`✅ Discovered ${inducedCategories.length} Dynamic Pillars for ${companyName}: ${inducedCategories.map(c => c.name).join(' • ')}`, 'success');

    await sendTerminalLog(`[Phase 3B: Topic Extraction] Processing ${signalComments.length} signal comments in ${totalBatches} chunks (${CHUNK_SIZE} comments/worker) across ${workerCount} concurrent work-stealing agents using gemini-3.8-flash (Low Thinking)...`, 'phase');
    if (onProgress) {
        onProgress(`Extracting granular topics across ${totalBatches} chunks (${CHUNK_SIZE} comments/agent • ${workerCount} concurrent agents)...`);
    }

    const batchEnrichedResults: EnrichedComment[][] = new Array(totalBatches).fill([]);
    const batchKeywordResults: any[][] = new Array(totalBatches).fill([]);
    let cursor = 0;
    let completedBatches = 0;

    if (totalBatches > 0) {
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < totalBatches) {
                    const idx = cursor++;
                    const chunk = chunks[idx];
                    const res = await processKeywordEnrichmentChunk50(chunk, idx, totalBatches, companyName, inducedCategories);
                    batchEnrichedResults[idx] = res.enriched;
                    batchKeywordResults[idx] = res.topKeywords;
                    completedBatches++;
                    await sendTerminalLog(`✅ [Stage 3 Work-Stealing Pool] Chunk ${idx + 1}/${totalBatches} enriched (${completedBatches}/${totalBatches} chunks complete).`, 'worker');
                    if (onProgress) {
                        onProgress(`Stage 3 Topic Extraction: ${completedBatches}/${totalBatches} chunks enriched (${CHUNK_SIZE} comments/agent • ${workerCount} concurrent agents)...`);
                    }
                }
            })
        );
    }

    const allEnrichedComments: EnrichedComment[] = batchEnrichedResults.flat();
    const allKeywordsCombined: any[] = batchKeywordResults.flat();

    const { topKeywords, featureClusters } = aggregateStage3TopicsAndClusters(
        allEnrichedComments,
        allKeywordsCombined,
        inducedCategories,
        companyName
    );

    const result: Stage3KeywordResult = {
        totalEnriched: allEnrichedComments.length,
        enrichedComments: allEnrichedComments,
        topKeywords,
        featureClusters,
        savedAt: new Date().toISOString()
    };

    await sendTerminalLog(`STAGE 3 COMPLETE: Extracted and ranked ${topKeywords.length} topics by comment frequency and velocity across ${allEnrichedComments.length} comments. Saving checkpoint to GCS...`, 'phase');
    await saveStageDataToGCS('noise_filter_keywords', result, companyName);

    return result;
};
