/**
 * Core GenAI SDK & Proxy Client with Retry and Rate-Limit Handling.
 */
import {
    PLATFORM_MODELS,
    DEFAULT_FLASH_THINKING_LEVEL,
    applyDefaultThinkingConfig
} from "../../config/platformConfig";

export { PLATFORM_MODELS, DEFAULT_FLASH_THINKING_LEVEL, applyDefaultThinkingConfig };

// --- Proxy Call Helper ---
export const callGenAiProxy = async (endpoint: string, payload: any): Promise<any> => {
    if (payload && payload.model) {
        payload.config = applyDefaultThinkingConfig(payload.model, payload.config || {});
    }

    const maxAttempts = 3;
    let lastError: any;

    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
        try {
            const response = await fetch(`/api/genai/${endpoint}`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(payload)
            });

            if (
                (response.status === 502 || response.status === 503 || response.status === 504) &&
                attempt < maxAttempts
            ) {
                const backoffMs = attempt * 1000;
                console.warn(
                    `[callGenAiProxy] Transient ${response.status} on /api/genai/${endpoint}. Retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})...`
                );
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                continue;
            }

            const contentType = response.headers.get("content-type");

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(
                    `Failed to call GenAI proxy ${endpoint}: ${response.status} ${response.statusText}. Response: ${errorText.substring(0, 200)}`
                );
            }

            if (contentType && contentType.includes("application/json")) {
                return await response.json();
            } else {
                const text = await response.text();
                throw new Error(
                    `Expected JSON response from proxy but received ${contentType}. Content preview: ${text.substring(0, 100)}`
                );
            }
        } catch (err: any) {
            lastError = err;
            const msg = String(err?.message || err || '').toLowerCase();
            const isTransientNetworkError =
                msg.includes('failed to fetch') ||
                msg.includes('networkerror') ||
                msg.includes('load failed') ||
                msg.includes('fetch failed') ||
                msg.includes('err_connection_refused') ||
                msg.includes('econnrefused') ||
                msg.includes('econnreset') ||
                msg.includes('socket hang up') ||
                msg.includes(': 502 ') ||
                msg.includes(': 503 ') ||
                msg.includes(': 504 ');

            if (isTransientNetworkError && attempt < maxAttempts) {
                const backoffMs = attempt * 1000;
                console.warn(
                    `[callGenAiProxy] Transient network error on /api/genai/${endpoint} (${err?.message || err}). Retrying in ${backoffMs}ms (attempt ${attempt}/${maxAttempts})...`
                );
                await new Promise((resolve) => setTimeout(resolve, backoffMs));
                continue;
            }
            throw err;
        }
    }

    throw lastError;
};

/**
 * Detects whether an error is caused by rate limiting, quota exhaustion, 429 RESOURCE_EXHAUSTED,
 * or transient network / gateway / server restart errors.
 */
export const isRateLimitOrQuotaError = (error: any): boolean => {
    if (!error) return false;
    const msg = (error?.message || error?.statusText || String(error)).toLowerCase();
    const status = error?.status || error?.code || error?.statusCode;
    return (
        status === 429 ||
        status === '429' ||
        status === 'RESOURCE_EXHAUSTED' ||
        status === 502 ||
        status === 503 ||
        status === 504 ||
        status === '502' ||
        status === '503' ||
        status === '504' ||
        msg.includes('429') ||
        msg.includes('resource_exhausted') ||
        msg.includes('resource exhausted') ||
        msg.includes('quota exceeded') ||
        msg.includes('rate limit') ||
        msg.includes('too many requests') ||
        msg.includes('failed to fetch') ||
        msg.includes('networkerror') ||
        msg.includes('load failed') ||
        msg.includes('fetch failed') ||
        msg.includes('err_connection_refused') ||
        msg.includes('econnrefused') ||
        msg.includes('econnreset') ||
        msg.includes('socket hang up')
    );
};

export interface RetryOptions {
    maxRetries?: number;
    baseDelayMs?: number;
    maxDelayMs?: number;
    operationName?: string;
    onRetry?: (attempt: number, delayMs: number, error: any) => void | Promise<void>;
}

/**
 * Executes an async operation with exponential backoff and randomized jitter on 429 RESOURCE_EXHAUSTED.
 */
export const executeWithRetry = async <T>(
    operation: () => Promise<T>,
    options: RetryOptions = {}
): Promise<T> => {
    const {
        maxRetries = 3,
        baseDelayMs = 1500,
        maxDelayMs = 8000,
        operationName = 'Operation',
        onRetry
    } = options;

    let attempt = 0;
    while (true) {
        try {
            return await operation();
        } catch (err: any) {
            attempt++;
            const isQuota = isRateLimitOrQuotaError(err);
            if (!isQuota || attempt > maxRetries) {
                throw err;
            }

            // Exponential backoff: baseDelayMs * 2^(attempt - 1) + jitter (100ms - 400ms)
            const expDelay = baseDelayMs * Math.pow(2, attempt - 1);
            const jitter = Math.floor(Math.random() * 300) + 100;
            const delayMs = Math.min(expDelay + jitter, maxDelayMs);

            if (onRetry) {
                try {
                    await onRetry(attempt, delayMs, err);
                } catch (e) {
                    console.warn(`[${operationName}] onRetry handler threw:`, e);
                }
            } else {
                console.warn(`[${operationName}] Quota exhausted (429/RESOURCE_EXHAUSTED). Retrying in ${(delayMs / 1000).toFixed(1)}s (attempt ${attempt}/${maxRetries})...`);
            }

            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }
};

export const GEMINI_MODELS = {
    FLASH: PLATFORM_MODELS.FLASH,
    LITE: PLATFORM_MODELS.FLASH_LITE,
    FLASH_LITE: PLATFORM_MODELS.FLASH_LITE
};
