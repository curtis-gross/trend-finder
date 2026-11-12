import { GEMINI_MODELS, executeWithRetry, generateText, safeJsonParse } from '../geminiService';
import { type FilteredComment, type InducedCategory } from './noiseTypes';
import { getStratifiedSample } from './languageAndTimeUtils';
import { isPlatformOrSourceNode, stripSourceMetadataPrefix } from './nodeStemmingUtils';
import { sendTerminalLog } from './stageGcsCacheClient';

export const induceDynamicCategories = async (
    comments: FilteredComment[],
    companyName: string = 'test-company'
): Promise<InducedCategory[]> => {
    const stratified = getStratifiedSample(comments, 75);
    const sample = stratified.map(c => {
        const cleanBody = stripSourceMetadataPrefix(c.rawText);
        return {
            source: c.source,
            reviewType: c.reviewType,
            score: c.score,
            text: cleanBody.length > 180 ? cleanBody.slice(0, 180) + '...' : cleanBody
        };
    });

    const prompt = `You are a Principal Consumer Experience & NLP Intelligence Scientist for ${companyName}.
Examine these authentic customer comments and community discussions mined across Reddit, YouTube, social media, and review channels.

CUSTOMER FEEDBACK SAMPLE:
${JSON.stringify(sample)}

TASK:
Induce 4 to 7 natural, high-level customer experience & brand pillars tailored specifically to ${companyName} and the topics discussed in this feedback (e.g. "Product Quality & Craftsmanship", "Design & Functional Fit", "Customer Support & Service", "Pricing & Perceived Value", "Fulfillment & Delivery Experience").
Ground the pillars directly in what customers and community members are discussing for ${companyName}.
CRITICAL RULE: NEVER use platform, channel, or review source names (such as "Metacritic", "YouTube", "Reddit", "Steam", "TikTok", "Twitter", "Twitch", "Trustpilot", "Critic Reviews", "User Reviews", or "Metascore") as a category pillar name. Pillars must be product, service, usability, or brand experience domains only.

Return a valid JSON array of 4 to 7 objects:
[
  { "name": "Category Pillar Name", "description": "1-sentence scope of issues or praise covered here" }
]
Return JSON array only.`;

    try {
        const text = await executeWithRetry(
            () => generateText(prompt, GEMINI_MODELS.FLASH, {
                responseMimeType: 'application/json',
                temperature: 0.2,
                thinkingConfig: { thinkingLevel: 'LOW' }
            }),
            {
                maxRetries: 3,
                baseDelayMs: 1500,
                operationName: 'Dynamic Category Induction',
                onRetry: async (attempt, delayMs) => {
                    const delaySec = (delayMs / 1000).toFixed(1);
                    console.warn(`[Category Induction] 429 RESOURCE_EXHAUSTED/Retry (attempt ${attempt}/3). Backing off ${delaySec}s...`);
                    await sendTerminalLog(`⚠️ [Phase 3A: Category Induction] Vertex AI Retry (attempt ${attempt}/3). Backing off ${delaySec}s...`, 'worker');
                }
            }
        );
        const parsed = safeJsonParse(text);
        if (Array.isArray(parsed) && parsed.length >= 3) {
            const validCategories = parsed
                .map((item: any) => ({
                    name: String(item.name || item.category || 'General Feedback').trim(),
                    description: String(item.description || '').trim()
                }))
                .filter(cat => !isPlatformOrSourceNode(cat.name));
            if (validCategories.length >= 3) {
                return validCategories;
            }
        }
        throw new Error(`Gemini category induction returned fewer than 3 valid pillars for ${companyName}.`);
    } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        console.error('[Zero Silent Fallbacks] Dynamic category induction failed:', e);
        await sendTerminalLog(`❌ [Category Induction Error] ${msg}`, 'error');
        throw e instanceof Error ? e : new Error(msg);
    }
};
