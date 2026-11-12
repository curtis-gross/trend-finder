import { describe, it, expect, vi } from 'vitest';
import fs from 'fs';
import path from 'path';
import { fetchYouTubeCommentsWithMeta } from '../services/youtubeService';
import { analyzeYouTubeSentiment } from '../services/geminiService';

describe('Backend Diagnostics & Fallbacks Verification', () => {
    it('verifies index.html has cdn.tailwindcss.com script loaded', () => {
        const indexPath = path.resolve(__dirname, '../index.html');
        const indexHtml = fs.readFileSync(indexPath, 'utf8');
        expect(indexHtml).toContain('cdn.tailwindcss.com');
    });

    it('verifies app_config.json exists on disk and configures test-company', () => {
        const appConfigPath = path.resolve(__dirname, '../public/data/configuration/app_config.json');
        expect(fs.existsSync(appConfigPath)).toBe(true);
        const content = JSON.parse(fs.readFileSync(appConfigPath, 'utf8'));
        expect(content).toBeDefined();
        expect(content.branding?.companyName).toBe('test-company');
        expect(content.defaultMode).toBe('INSIGHTS');
    });

    it('verifies analyzeYouTubeSentiment generates a valid schema with mocked proxy and comments', async () => {
        const mockComments = [
            { text: 'The new workflow features look so smooth and reliable!', author: 'User1' },
            { text: 'Performance feels much more consistent this quarter.', author: 'User2' },
            { text: 'Interface feels responsive, no latency so far.', author: 'User3' }
        ];

        const originalFetch = global.fetch;
        global.fetch = vi.fn(async (input: RequestInfo | URL) => {
            const url = typeof input === 'string' ? input : input.toString();
            if (url.includes('/api/youtube/comments')) {
                return {
                    ok: true,
                    status: 200,
                    headers: { get: () => 'application/json' },
                    json: async () => mockComments,
                    text: async () => JSON.stringify(mockComments)
                } as unknown as Response;
            }
            return {
                ok: true,
                status: 200,
                headers: { get: () => 'application/json' },
                json: async () => ({
                    candidates: [{
                        content: {
                            parts: [{
                                text: JSON.stringify({
                                    summary: 'Strong positive reception across workflow and latency.',
                                    sentiment: { positive: ['Workflow speed'], negative: [], neutral: ['UI overview'] },
                                    trends: { positive: ['Workflow speed'], negative: [], neutral: [] },
                                    counts: { positive: 3, negative: 0, neutral: 0 },
                                    alignment: {
                                        status: 'Aligned',
                                        explanation: 'Creator and commenters agree on reliability.',
                                        creator_stance: 'Positive',
                                        audience_consensus: 'Positive'
                                    },
                                    strategic_takeaways: [
                                        { priority: 'High', area: 'Product', recommendation: 'Highlight workflow speed', impact: 'Retention' }
                                    ]
                                })
                            }]
                        }
                    }]
                }),
                text: async () => '{}'
            } as Response;
        }) as unknown as typeof fetch;

        try {
            const result = await analyzeYouTubeSentiment('https://www.youtube.com/watch?v=lT2t7w70c5U', 'test-company');

            expect(result).toHaveProperty('type', 'youtube_sentiment');
            expect(result).toHaveProperty('videoId', 'lT2t7w70c5U');
            expect(result).toHaveProperty('overallScore');
            expect(typeof result.overallScore).toBe('number');
            expect(result).toHaveProperty('summary');
            expect(result).toHaveProperty('alignment');
            expect(result).toHaveProperty('strategic_takeaways');
            expect(Array.isArray(result.strategic_takeaways)).toBe(true);
            expect(result).toHaveProperty('commentsResult');
            expect(result).toHaveProperty('videoResult');
            expect(result.rawCommentsCount).toBe(3);
        } finally {
            global.fetch = originalFetch;
        }
    });

    it('verifies fetchYouTubeCommentsWithMeta handles network fetch cleanly', async () => {
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            headers: { get: () => null },
            json: async () => [{ text: 'Great video!', author: 'UserA' }]
        });
        global.fetch = mockFetch;

        const result = await fetchYouTubeCommentsWithMeta('lT2t7w70c5U');
        expect(Array.isArray(result.comments)).toBe(true);
        expect(result.comments.length).toBe(1);
        expect(result.comments[0].text).toBe('Great video!');
    });
});
