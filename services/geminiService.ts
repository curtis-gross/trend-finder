/**
 * Gemini Service Facade (`services/geminiService.ts`).
 *
 * Re-exports 100% of functions, constants, and types from the modularized
 * domain services under `services/gemini/` so all existing imports continue
 * working seamlessly while keeping individual domain modules concise and focused.
 */

export * from "./gemini/index";
