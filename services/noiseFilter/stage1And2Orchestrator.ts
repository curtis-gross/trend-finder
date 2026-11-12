import { executeWithRetry, generateText, safeJsonParse } from '../geminiService';
import {
    type FilteredComment,
    type HarvestSourceError,
    type NoiseSourceConfig,
    type RawComment,
    type Stage2FilteredResult,
} from './noiseTypes';
import { chunkArray, detectCommentLanguage } from './languageAndTimeUtils';
import { extractYouTubeId } from './listenTableBlocklist';
import { getSourcesFromListenTable, mergeListenTableSources } from './listenSourceSync';
import { harvestSingleSource } from './redditAndTrustpilotHarvester';
import { saveStageDataToGCS, sendTerminalLog } from './stageGcsCacheClient';

// ============================================================================
// STAGE 1: RAW INGESTION (YouTube, Steam, Reddit, Metacritic)
// ============================================================================
export const stage1_harvestRawComments = async (
    sources: NoiseSourceConfig[],
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void
): Promise<{ rawComments: RawComment[]; sourcesUsed: NoiseSourceConfig[]; sourceErrors: HarvestSourceError[] }> => {
    const tableSources = await getSourcesFromListenTable(companyName);
    const activeSources = mergeListenTableSources(sources || [], tableSources, companyName);
    if (activeSources.length === 0) {
        throw new Error('No listening sources configured. Add YouTube videos or channels in Step 1: Listen first.');
    }

    const harvestedYouTubeIds = new Set<string>();
    const dedupedSources: NoiseSourceConfig[] = [];
    for (const src of activeSources) {
        if (src.type === 'youtube' || src.type === 'youtube_abcd') {
            const ytId = extractYouTubeId(src.target);
            if (ytId && harvestedYouTubeIds.has(ytId)) {
                continue;
            }
            if (ytId) harvestedYouTubeIds.add(ytId);
        }
        dedupedSources.push(src);
    }

    const CONCURRENCY = 6;
    const workerCount = Math.min(CONCURRENCY, dedupedSources.length);
    await sendTerminalLog(`STAGE 1: MULTI-CHANNEL HARVEST STARTING: Harvesting ${dedupedSources.length} sources in parallel (${workerCount} concurrent workers)...`, 'header');
    if (onProgress) onProgress(`Harvesting comments across ${dedupedSources.length} sources (${workerCount} concurrent workers)...`);

    const allSourceResults: RawComment[][] = new Array(dedupedSources.length).fill([]);
    const sourceErrors: HarvestSourceError[] = [];
    const attemptedSources = dedupedSources.length;
    let cursor = 0;
    let completedCount = 0;

    await Promise.all(
        Array.from({ length: workerCount }, async () => {
            while (cursor < dedupedSources.length) {
                const idx = cursor++;
                const src = dedupedSources[idx];
                if (onProgress) onProgress(`[${idx + 1}/${dedupedSources.length}] Ingesting ${src.label}...`);
                const sourceComments = await harvestSingleSource(src, companyName, sourceErrors);
                allSourceResults[idx] = sourceComments;
                completedCount++;
                if (onProgress) onProgress(`[${completedCount}/${dedupedSources.length}] Completed ${src.label} (${sourceComments.length} items)...`);
            }
        })
    );

    const rawComments = allSourceResults.flat();

    if (sourceErrors.length > 0) {
        await sendTerminalLog(`STAGE 1 WARNING: ${sourceErrors.length}/${attemptedSources} sources failed. ${sourceErrors.map(e => `${e.sourceLabel}: ${e.message.slice(0, 120)}`).join(' | ')}`, 'phase');
        if (onProgress) onProgress(`${sourceErrors.length} source(s) failed: ${sourceErrors.map(e => e.sourceLabel).join(', ')}. See pipeline log for the API error.`);
    }
    if (attemptedSources > 0 && sourceErrors.length === attemptedSources) {
        throw new Error(`Stage 1 harvest failed for all ${attemptedSources} sources. First error: ${sourceErrors[0].sourceLabel}: ${sourceErrors[0].message}`);
    }

    await sendTerminalLog(`STAGE 1 COMPLETE: Ingested ${rawComments.length} raw comments across ${attemptedSources - sourceErrors.length}/${attemptedSources} sources. Saving raw checkpoint to GCS...`, 'phase');

    if (rawComments.length > 0) {
        await saveStageDataToGCS('noise_filter_raw_comments', {
            rawComments,
            count: rawComments.length,
            sourcesUsed: activeSources,
            sourceErrors,
            savedAt: new Date().toISOString()
        }, companyName);
    }

    return { rawComments, sourcesUsed: activeSources, sourceErrors };
};

// ============================================================================
// STAGE 2: NOISE REMOVAL & SIGNAL FILTERING
// ============================================================================
const processNoiseRemovalChunk50 = async (
    chunk: RawComment[],
    batchIndex: number,
    totalBatches: number,
    companyName: string
): Promise<FilteredComment[]> => {
    const prompt = `You are a Senior NLP Noise Filtration & Language Classification Engineer for ${companyName}.
Filter this batch of ${chunk.length} customer feedback and social community discussion items (Batch ${batchIndex + 1} of ${totalBatches}).

TASK:
1. Classify each comment as NOISE (isNoise: true) or ACTIONABLE SIGNAL (isNoise: false) for ${companyName}:
   - isNoise = true: Generic low-info reactions or one-liners (e.g., "cool", "nice", "ok", "fire", single emojis), bot spam, promotional self-links, giveaway requests, generic insults or ungrounded venting ("trash", "overpriced scam"), completely off-topic chatter, or gibberish.
   - isNoise = false: Actionable customer sentiment, product quality, material or feature composition, usability feedback, design and aesthetics, product comparisons, store or platform experience, customer service, shipping/fulfillment, pricing value perceptions, or substantive brand impressions.
   - For noise comments, provide a concise noiseReason (e.g. "Generic low-effort one-liner lacking actionable context", "Bot spam or promotional link", "Ungrounded emotional venting without product specifics").
2. Detect the authentic natural language of each comment:
   - "language": "English" | "Spanish" | "German" | "Portuguese" | "French" | "Japanese" | "Italian" | "Korean" | "Chinese" | "Russian" | "Arabic" | "Other"

COMMENTS CORPUS:
${JSON.stringify(chunk.map(c => ({ id: c.id, text: c.rawText, period: c.period || c.release, source: c.source, reviewType: c.reviewType, score: c.score, author: c.author })))}

Return a valid JSON array matching:
[
  {
    "id": "item-id",
    "isNoise": false,
    "language": "English",
    "noiseReason": null
  }
]
Return JSON array only.`;

    try {
        const text = await executeWithRetry(
            () => generateText(prompt, 'gemini-3.8-flash', {
                responseMimeType: 'application/json',
                temperature: 0.1,
                thinkingConfig: { thinkingLevel: 'LOW' }
            }),
            {
                maxRetries: 3,
                baseDelayMs: 1500,
                operationName: `Noise Filter Worker #${batchIndex + 1}`,
                onRetry: async (attempt, delayMs) => {
                    const delaySec = (delayMs / 1000).toFixed(1);
                    await sendTerminalLog(`⚠️ [Noise Worker #${batchIndex + 1}/${totalBatches}] 429 RESOURCE_EXHAUSTED (attempt ${attempt}/3). Backing off ${delaySec}s with jitter...`, 'worker');
                }
            }
        );

        const parsed = safeJsonParse(text);
        if (!Array.isArray(parsed)) {
            throw new Error('Invalid response structure from noise filter model');
        }

        const resultMap = new Map(parsed.map((item: any) => [item.id, item]));
        return chunk.map(c => {
            const match: any = resultMap.get(c.id);
            const isMetacriticProtected =
                c.source === 'Metacritic' &&
                (c.reviewType === 'critic' || c.reviewType === 'json-ld' || (c.rawText || '').length >= 25);
            const isNoise = isMetacriticProtected
                ? false
                : (match ? Boolean(match.isNoise) : false);
            const detectedLang = detectCommentLanguage(match?.language || c.language || c.country, c.rawText);
            return {
                ...c,
                isNoise,
                noiseReason: isNoise ? (match?.noiseReason || 'Low-effort venting lacking actionable details') : undefined,
                language: detectedLang,
                country: detectedLang
            };
        });
    } catch (e) {
        console.error(`Noise filter batch ${batchIndex + 1} error:`, e);
        await sendTerminalLog(`[Noise Filter Error] Batch ${batchIndex + 1}/${totalBatches} failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
        throw e;
    }
};

export const stage2_filterNoiseComments = async (
    rawComments: RawComment[],
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void
): Promise<Stage2FilteredResult> => {
    const CHUNK_SIZE = 200;
    const CONCURRENCY_LIMIT = 8;

    const deterministicSignalComments: FilteredComment[] = [];
    const commentsNeedingLLM: RawComment[] = [];

    for (const c of rawComments) {
        const isMetacritic = c.source === 'Metacritic' || String(c.source || '').toLowerCase().includes('metacritic');
        if (isMetacritic) {
            const detectedLang = detectCommentLanguage(c.language || c.country, c.rawText);
            deterministicSignalComments.push({
                ...c,
                isNoise: false,
                noiseReason: undefined,
                language: detectedLang,
                country: detectedLang
            });
        } else {
            commentsNeedingLLM.push(c);
        }
    }

    const chunks = chunkArray(commentsNeedingLLM, CHUNK_SIZE);
    const totalBatches = chunks.length;
    const workerCount = Math.min(CONCURRENCY_LIMIT, totalBatches);

    await sendTerminalLog(
        `STAGE 2 NOISE REMOVAL STARTING: Fast-pathed ${deterministicSignalComments.length} Verified Metacritic Review Signals; partitioning ${commentsNeedingLLM.length} comments into ${totalBatches} chunks (${CHUNK_SIZE} comments/worker) across ${workerCount} concurrent work-stealing agents (gemini-3.8-flash Low Thinking)...`,
        'header'
    );
    if (onProgress) {
        onProgress(`Filtering ${commentsNeedingLLM.length} comments in ${totalBatches} chunks (${CHUNK_SIZE}/agent) across ${workerCount} concurrent agents (+${deterministicSignalComments.length} verified Metacritic signals)...`);
    }

    const batchResults: FilteredComment[][] = new Array(totalBatches).fill([]);
    let cursor = 0;
    let completedBatches = 0;

    if (totalBatches > 0) {
        await Promise.all(
            Array.from({ length: workerCount }, async () => {
                while (cursor < totalBatches) {
                    const idx = cursor++;
                    const chunk = chunks[idx];
                    const res = await processNoiseRemovalChunk50(chunk, idx, totalBatches, companyName);
                    batchResults[idx] = res;
                    completedBatches++;
                    await sendTerminalLog(`✅ [Stage 2 Work-Stealing Pool] Chunk ${idx + 1}/${totalBatches} complete (${completedBatches}/${totalBatches} chunks filtered).`, 'worker');
                    if (onProgress) {
                        onProgress(`Stage 2 Noise Filter: ${completedBatches}/${totalBatches} chunks filtered (${CHUNK_SIZE} comments/agent • ${workerCount} concurrent agents)...`);
                    }
                }
            })
        );
    }

    const allFilteredComments: FilteredComment[] = [
        ...deterministicSignalComments,
        ...batchResults.flat()
    ];

    const totalCount = allFilteredComments.length;
    const noiseCount = allFilteredComments.filter(c => c.isNoise).length;
    const signalCount = totalCount - noiseCount;
    const noisePercentage = Math.round((noiseCount / (totalCount || 1)) * 100);
    const signalPercentage = 100 - noisePercentage;

    const result: Stage2FilteredResult = {
        totalCount,
        signalCount,
        noiseCount,
        signalPercentage,
        noisePercentage,
        filteredComments: allFilteredComments,
        savedAt: new Date().toISOString()
    };

    await sendTerminalLog(`STAGE 2 COMPLETE: Retained ${signalCount} Signal (${signalPercentage}%), Stripped ${noiseCount} Noise (${noisePercentage}%). Saving checkpoint to GCS...`, 'phase');
    await saveStageDataToGCS('noise_filter_filtered_comments', result, companyName);

    return result;
};
