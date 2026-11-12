/**
 * Core Text Generator.
 */
import {
    GEMINI_MODELS,
    applyDefaultThinkingConfig,
    callGenAiProxy
} from "./proxyAndRetryClient";
import { extractTextFromResponse } from "./jsonRepairAndGrounding";

/**
 * Generates text using Gemini (defaults to Gemini 3.8 Flash with Low Thinking).
 */
export const generateText = async (prompt: string, model: string = GEMINI_MODELS.FLASH, config: any = {}): Promise<string> => {
    try {
        const effectiveConfig = applyDefaultThinkingConfig(model, { ...config });
        const response = await callGenAiProxy("generateContent", {
            model: model,
            contents: [{ role: "user", parts: [{ text: prompt }] }],
            config: effectiveConfig
        });
        return extractTextFromResponse(response) || "";
    } catch (error) {
        console.error("Error generating text:", error);
        throw error;
    }
};
