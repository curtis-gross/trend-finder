import { describe, it, expect, vi } from 'vitest';
import { isRateLimitOrQuotaError, executeWithRetry } from '../services/geminiService';
import { stage3_convertToKeywords } from '../services/noiseFilterService';
import type { FilteredComment } from '../services/noiseFilterService';

describe('Extract Topics Quota Resilience & Concurrency Mitigations', () => {
    describe('isRateLimitOrQuotaError', () => {
        it('identifies status 429 as rate limit error', () => {
            expect(isRateLimitOrQuotaError({ status: 429 })).toBe(true);
            expect(isRateLimitOrQuotaError({ statusCode: 429 })).toBe(true);
            expect(isRateLimitOrQuotaError({ code: 429 })).toBe(true);
            expect(isRateLimitOrQuotaError({ status: '429' })).toBe(true);
        });

        it('identifies RESOURCE_EXHAUSTED in message or code', () => {
            expect(isRateLimitOrQuotaError(new Error('RESOURCE_EXHAUSTED: Quota exceeded for quota metric'))).toBe(true);
            expect(isRateLimitOrQuotaError({ message: 'Resource exhausted: 429 Too Many Requests' })).toBe(true);
            expect(isRateLimitOrQuotaError({ code: 'RESOURCE_EXHAUSTED' })).toBe(true);
        });

        it('identifies quota and rate limit phrases', () => {
            expect(isRateLimitOrQuotaError(new Error('Quota exceeded for quota metric'))).toBe(true);
            expect(isRateLimitOrQuotaError(new Error('Rate limit reached. Please wait.'))).toBe(true);
            expect(isRateLimitOrQuotaError(new Error('Too many requests'))).toBe(true);
        });

        it('returns false for non-quota errors', () => {
            expect(isRateLimitOrQuotaError(null)).toBe(false);
            expect(isRateLimitOrQuotaError(undefined)).toBe(false);
            expect(isRateLimitOrQuotaError(new Error('SyntaxError: Unexpected token'))).toBe(false);
            expect(isRateLimitOrQuotaError({ status: 404, statusText: 'Not Found' })).toBe(false);
            expect(isRateLimitOrQuotaError({ status: 500, message: 'Internal Server Error' })).toBe(false);
        });
    });

    describe('executeWithRetry', () => {
        it('executes successfully on the first attempt without retrying', async () => {
            const operation = vi.fn().mockResolvedValue('success');
            const onRetry = vi.fn();

            const result = await executeWithRetry(operation, {
                maxRetries: 3,
                baseDelayMs: 10,
                onRetry
            });

            expect(result).toBe('success');
            expect(operation).toHaveBeenCalledTimes(1);
            expect(onRetry).not.toHaveBeenCalled();
        });

        it('retries on 429 RESOURCE_EXHAUSTED and succeeds on subsequent attempt', async () => {
            let calls = 0;
            const operation = vi.fn().mockImplementation(async () => {
                calls++;
                if (calls === 1) {
                    const err: any = new Error('RESOURCE_EXHAUSTED: quota exceeded');
                    err.status = 429;
                    throw err;
                }
                return 'recovered_data';
            });
            const onRetry = vi.fn();

            const result = await executeWithRetry(operation, {
                maxRetries: 3,
                baseDelayMs: 10,
                maxDelayMs: 50,
                onRetry
            });

            expect(result).toBe('recovered_data');
            expect(operation).toHaveBeenCalledTimes(2);
            expect(onRetry).toHaveBeenCalledTimes(1);
            expect(onRetry).toHaveBeenCalledWith(1, expect.any(Number), expect.any(Error));
        });

        it('throws error after exhausting max retries', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('RESOURCE_EXHAUSTED'));
            const onRetry = vi.fn();

            await expect(
                executeWithRetry(operation, {
                    maxRetries: 2,
                    baseDelayMs: 5,
                    maxDelayMs: 20,
                    onRetry
                })
            ).rejects.toThrow('RESOURCE_EXHAUSTED');

            expect(operation).toHaveBeenCalledTimes(3); // Initial + 2 retries
            expect(onRetry).toHaveBeenCalledTimes(2);
        });

        it('does NOT retry non-quota errors and throws immediately', async () => {
            const operation = vi.fn().mockRejectedValue(new Error('Database syntax error'));
            const onRetry = vi.fn();

            await expect(
                executeWithRetry(operation, {
                    maxRetries: 3,
                    baseDelayMs: 10,
                    onRetry
                })
            ).rejects.toThrow('Database syntax error');

            expect(operation).toHaveBeenCalledTimes(1);
            expect(onRetry).not.toHaveBeenCalled();
        });
    });

    describe('Stage 3 Topic Extraction Concurrency & Pacing', () => {
        it('processes comments and produces valid Stage3 structure without crashing', async () => {
            const originalFetch = globalThis.fetch;
            let genAiCalls = 0;

            const mockFetch = vi.fn().mockImplementation(async (input: any) => {
                const url = String(input);
                if (url.includes('/api/genai/generateContent')) {
                    genAiCalls++;
                    const responseText = genAiCalls === 1
                        ? JSON.stringify([
                            { name: 'Product Quality & Craftsmanship', description: 'Durability and build feedback' },
                            { name: 'Fulfillment & Delivery Experience', description: 'Shipping speed and packaging' },
                            { name: 'Customer Support & Service', description: 'Responsiveness and issue resolution' },
                            { name: 'Pricing & Perceived Value', description: 'Value for money' }
                        ])
                        : JSON.stringify({
                            enrichedComments: [
                                {
                                    id: 'c-1',
                                    featureCategory: 'Product Quality & Craftsmanship',
                                    structuredKeywords: ['Product Quality & Craftsmanship'],
                                    discoveredTopics: ['cushion support durability', 'material craftsmanship'],
                                    keywords: ['Product Quality & Craftsmanship', 'cushion support durability', 'material craftsmanship'],
                                    sentiment: 'positive',
                                    language: 'English',
                                    constructiveSummary: 'Praised cushion support and durability.',
                                    actionableSuggestion: 'Maintain high material durability standards.'
                                },
                                {
                                    id: 'c-2',
                                    featureCategory: 'Fulfillment & Delivery Experience',
                                    structuredKeywords: ['Fulfillment & Delivery Experience'],
                                    discoveredTopics: ['shipping transit delay', 'corner packaging protection'],
                                    keywords: ['Fulfillment & Delivery Experience', 'shipping transit delay', 'corner packaging protection'],
                                    sentiment: 'negative',
                                    language: 'English',
                                    constructiveSummary: 'Reported slow shipping and corner packaging damage.',
                                    actionableSuggestion: 'Reinforce corner packaging and expedite transit.'
                                }
                            ],
                            topKeywords: [
                                { keyword: 'cushion support durability', category: 'Product Quality & Craftsmanship', mentions: 1, sentiment: 'positive' },
                                { keyword: 'shipping transit delay', category: 'Fulfillment & Delivery Experience', mentions: 1, sentiment: 'negative' }
                            ]
                        });

                    return {
                        ok: true,
                        status: 200,
                        headers: { get: () => 'application/json' },
                        text: async () => JSON.stringify({ text: responseText }),
                        json: async () => ({ text: responseText })
                    };
                }

                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    text: async () => JSON.stringify({ success: true }),
                    json: async () => ({ success: true })
                };
            });

            globalThis.fetch = mockFetch as any;

            try {
                const mockSignalComments: FilteredComment[] = [
                    {
                        id: 'c-1',
                        rawText: 'The sofa cushions are wonderfully supportive and durable.',
                        author: 'JohnD',
                        source: 'Customer Reviews',
                        isNoise: false
                    },
                    {
                        id: 'c-2',
                        rawText: 'Shipping took three weeks and packaging was damaged at corners.',
                        author: 'SarahM',
                        source: 'YouTube Comments',
                        isNoise: false
                    }
                ];

                const progressLogs: string[] = [];
                const result = await stage3_convertToKeywords(
                    mockSignalComments,
                    'test-company',
                    (msg) => progressLogs.push(msg)
                );

                expect(result).toBeDefined();
                expect(result.totalEnriched).toBe(2);
                expect(Array.isArray(result.enrichedComments)).toBe(true);
                expect(result.enrichedComments.length).toBe(2);
                expect(Array.isArray(result.featureClusters)).toBe(true);
                expect(result.featureClusters.length).toBeGreaterThan(0);
            } finally {
                globalThis.fetch = originalFetch;
            }
        });
    });
});
