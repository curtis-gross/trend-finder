/**
 * Unified Barrel Export for Modularized Gemini Services (`services/gemini/*`).
 *
 * Domain Modules:
 * 1. `coreClientAndProxies` — Core GenAI SDK/proxy wrappers, retry logic, JSON sanitization, and text/video JSON generators.
 * 2. `mediaAndBrandAudit` — Multimodal video/comments analysis, competitive synthesis, reviews/Trustpilot, and web/trend grounding.
 * 3. `communityInsightsAndAudio` — Multi-channel social listening (YouTube/Reddit/TikTok), grounded alerts, and Gemini TTS audio briefings.
 */

export * from "./coreClientAndProxies";
export * from "./mediaAndBrandAudit";
export * from "./communityInsightsAndAudio";
