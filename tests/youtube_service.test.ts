import { describe, it, expect, vi } from 'vitest';
import { 
    normalizeYouTubeVideo, 
    normalizeTrendsResponse, 
    extractYouTubeVideoId, 
    fetchYouTubeTrends,
    searchYouTubeVideos,
    fetchYouTubeCommentsWithMeta
} from '../services/youtubeService';

describe('YouTube Service & Zero-Fallback Suite', () => {
    it('correctly extracts 11-char video IDs from various YouTube formats', () => {
        expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=s6CJADdyLX8')).toBe('s6CJADdyLX8');
        expect(extractYouTubeVideoId('https://youtu.be/s6CJADdyLX8')).toBe('s6CJADdyLX8');
        expect(extractYouTubeVideoId('https://www.youtube.com/shorts/s6CJADdyLX8')).toBe('s6CJADdyLX8');
        expect(extractYouTubeVideoId('https://example.com/watch?v=123')).toBeNull();
        expect(extractYouTubeVideoId('too_short')).toBeNull();
    });

    it('normalizes video items across both Node and Python schema variations', () => {
        const nodeItem = {
            videoId: 'vid123',
            title: 'test-company Product Launch Showcase',
            channelTitle: 'test-company Official',
            videoUrl: 'https://www.youtube.com/watch?v=vid123',
            thumbnail: 'https://img.youtube.com/vi/vid123/hqdefault.jpg',
            formattedViews: '150K views',
            viewCount: '150000',
            duration: '10:20',
            isShort: false
        };
        const normalizedNode = normalizeYouTubeVideo(nodeItem);
        expect(normalizedNode.videoId).toBe('vid123');
        expect(normalizedNode.videoUrl).toBe('https://www.youtube.com/watch?v=vid123');
        expect(normalizedNode.url).toBe('https://www.youtube.com/watch?v=vid123');
        expect(normalizedNode.formattedViews).toBe('150K views');

        const pyItem = {
            videoId: 'vid456',
            title: 'test-company Feature Deep Dive',
            channelTitle: 'TechReviewLab',
            url: 'https://www.youtube.com/watch?v=vid456',
            thumbnail: 'https://img.youtube.com/vi/vid456/hqdefault.jpg',
            views: '45K views',
            rawViewCount: 45000,
            isShort: false
        };
        const normalizedPy = normalizeYouTubeVideo(pyItem);
        expect(normalizedPy.videoId).toBe('vid456');
        expect(normalizedPy.videoUrl).toBe('https://www.youtube.com/watch?v=vid456');
        expect(normalizedPy.url).toBe('https://www.youtube.com/watch?v=vid456');
        expect(normalizedPy.formattedViews).toBe('45K views');
        expect(normalizedPy.views).toBe('45K views');
        expect(normalizedPy.rawViewCount).toBe(45000);
    });

    it('normalizes trends response with fallback to dual schemas', () => {
        const pyResponse = {
            videos: [{ videoId: 'v1', title: 'Video 1', url: 'https://youtube.com/watch?v=v1' }],
            monthlyBreakouts: [{ videoId: 'v2', title: 'Breakout 1', url: 'https://youtube.com/watch?v=v2' }],
            topShorts: [{ videoId: 'v3', title: 'Short 1', url: 'https://youtube.com/shorts/v3' }]
        };
        const res = normalizeTrendsResponse(pyResponse, 'test-company');
        expect(res.trending.length).toBe(1);
        expect(res.topYear.length).toBe(1);
        expect(res.shorts.length).toBe(1);
        expect(res.trending[0].videoId).toBe('v1');
        expect(res.topYear[0].videoId).toBe('v2');
        expect(res.shorts[0].videoId).toBe('v3');
        expect(res.shorts[0].isShort).toBe(true);
    });

    it('enforces Zero Silent Fallbacks on network or API failures', async () => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: async () => JSON.stringify({ error: '[YouTube API] Daily quota limit reached.' }),
            json: async () => ({ error: '[YouTube API] Daily quota limit reached.' })
        });

        await expect(fetchYouTubeTrends('test-company')).rejects.toThrow('[YouTube API] Daily quota limit reached.');

        global.fetch = originalFetch;
    });

    it('normalizes the FastAPI /api/youtube/search shape (server-side shorts split + stats)', () => {
        const serverResponse = {
            query: 'test-company Product Benefits',
            trending: [
                { videoId: 'long1', title: 'Platform explained', channelTitle: 'test-company Channel', viewCount: '12000', likeCount: '300', commentCount: '45', durationSeconds: 540, isShort: false, url: 'https://www.youtube.com/watch?v=long1' }
            ],
            topYear: [],
            shorts: [
                { videoId: 'shrt1', title: 'Platform in 30s #shorts', channelTitle: 'test-company Channel', viewCount: '900', durationSeconds: 30, isShort: true, url: 'https://www.youtube.com/shorts/shrt1' }
            ],
            totalResults: 2,
            quotaUnits: 101,
            apiCalls: 2
        };
        const res = normalizeTrendsResponse(serverResponse, 'test-company Product Benefits');
        expect(res.trending).toHaveLength(1);
        expect(res.shorts).toHaveLength(1);
        expect(res.topYear).toHaveLength(0);
        expect(res.trending[0].rawViewCount).toBe(12000);
        expect(res.trending[0].commentCount).toBe('45');
        expect(res.trending[0].durationSeconds).toBe(540);
        expect(res.trending[0].isShort).toBe(false);
        expect(res.shorts[0].isShort).toBe(true);
        expect(res.shorts[0].videoUrl).toContain('/shorts/');
        expect(res.quotaUnits).toBe(101);
        expect(res.apiCalls).toBe(2);
    });

    it('infers isShort from durationSeconds when the server omits the flag', () => {
        expect(normalizeYouTubeVideo({ videoId: 'a1', durationSeconds: 45 }).isShort).toBe(true);
        expect(normalizeYouTubeVideo({ videoId: 'a2', durationSeconds: 61 }).isShort).toBe(false);
    });

    it('issues exactly one /api/youtube/search request per fetchYouTubeTrends call', async () => {
        const originalFetch = global.fetch;
        const mockFetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            text: async () => '{}',
            json: async () => ({ query: 'x', trending: [], topYear: [], shorts: [], quotaUnits: 101, apiCalls: 2 })
        });
        global.fetch = mockFetch;

        await fetchYouTubeTrends('test-company Cloud Platform');

        expect(mockFetch).toHaveBeenCalledTimes(1);
        const calledUrl = String(mockFetch.mock.calls[0][0]);
        expect(calledUrl.startsWith('/api/youtube/search?')).toBe(true);
        expect(calledUrl).toContain('q=test-company+Cloud+Platform');
        expect(calledUrl).toContain('maxResults=20');
        expect(calledUrl).not.toContain('/api/youtube/trends');

        global.fetch = originalFetch;
    });

    it('surfaces the FastAPI detail envelope with the YouTube quotaExceeded reason', async () => {
        const originalFetch = global.fetch;
        const youtubeBody = {
            detail: {
                error: {
                    code: 403,
                    message: 'The request cannot be completed because you have exceeded your quota.',
                    errors: [{ reason: 'quotaExceeded', domain: 'youtube.quota' }]
                }
            }
        };
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 403,
            text: async () => JSON.stringify(youtubeBody),
            json: async () => youtubeBody
        });

        await expect(searchYouTubeVideos('test-company Mobile App')).rejects.toThrow(/HTTP 403.*\[quotaExceeded\].*exceeded your quota/);

        global.fetch = originalFetch;
    });

    it('fetchYouTubeCommentsWithMeta throws on a failed response instead of returning []', async () => {
        const originalFetch = global.fetch;
        global.fetch = vi.fn().mockResolvedValue({
            ok: false,
            status: 500,
            headers: { get: () => null },
            text: async () => JSON.stringify({ detail: { error: 'YOUTUBE_API_KEY not set. Add YOUTUBE_API_KEY=<key> to .env or the server environment.' } }),
            json: async () => ({})
        });

        await expect(fetchYouTubeCommentsWithMeta('lT2t7w70c5U')).rejects.toThrow('YOUTUBE_API_KEY not set');

        global.fetch = originalFetch;
    });

    it('fetchYouTubeCommentsWithMeta reads the FastAPI envelope and metadata headers', async () => {
        const originalFetch = global.fetch;
        const headers = new Map<string, string>([
            ['x-total-video-comments', '1234'],
            ['x-video-title', encodeURIComponent('test-company Platform Walkthrough')],
            ['x-recent-count', '40'],
            ['x-backfill-count', '60'],
            ['x-quota-units', '3']
        ]);
        global.fetch = vi.fn().mockResolvedValue({
            ok: true,
            status: 200,
            headers: { get: (k: string) => headers.get(k) ?? null },
            text: async () => '{}',
            json: async () => ({ comments: [{ id: 'c1', text: 'Helpful', publishedAt: '2026-09-30T00:00:00Z' }] })
        });

        const result = await fetchYouTubeCommentsWithMeta('https://www.youtube.com/watch?v=lT2t7w70c5U', { maxResults: 100, allowBackfill: true });
        expect(result.comments).toHaveLength(1);
        expect(result.videoTitle).toBe('test-company Platform Walkthrough');
        expect(result.totalVideoComments).toBe(1234);
        expect(result.recentCount).toBe(40);
        expect(result.backfillCount).toBe(60);
        expect(result.quotaUnits).toBe(3);
        const calledUrl = String((global.fetch as any).mock.calls[0][0]);
        expect(calledUrl).toContain('videoId=lT2t7w70c5U');
        expect(calledUrl).toContain('allowBackfill=true');

        global.fetch = originalFetch;
    });
});
