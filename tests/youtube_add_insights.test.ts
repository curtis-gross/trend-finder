import { describe, it, expect } from 'vitest';
import { normalizeUrlKey } from '../components/RunwayAnalysis';

describe('YouTube Add Insights & Deduplication Diagnostics', () => {
    describe('normalizeUrlKey YouTube Normalization', () => {
        it('should extract and preserve unique video IDs for YouTube watch URLs', () => {
            const defaultVideoUrl = 'https://www.youtube.com/watch?v=lT2t7w70c5U';
            const newVideoUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';

            const keyDefault = normalizeUrlKey(defaultVideoUrl);
            const keyNew = normalizeUrlKey(newVideoUrl);

            expect(keyDefault).toBe('youtube:lT2t7w70c5U');
            expect(keyNew).toBe('youtube:dQw4w9WgXcQ');
            expect(keyDefault).not.toBe(keyNew);
        });

        it('should normalize youtu.be and shorts to the same canonical key as watch URL', () => {
            const watchUrl = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
            const shortUrl = 'https://youtu.be/dQw4w9WgXcQ';
            const shortsUrl = 'https://www.youtube.com/shorts/dQw4w9WgXcQ';
            const rawId = 'dQw4w9WgXcQ';

            expect(normalizeUrlKey(watchUrl)).toBe('youtube:dQw4w9WgXcQ');
            expect(normalizeUrlKey(shortUrl)).toBe('youtube:dQw4w9WgXcQ');
            expect(normalizeUrlKey(shortsUrl)).toBe('youtube:dQw4w9WgXcQ');
            expect(normalizeUrlKey(rawId)).toBe('youtube:dQw4w9WgXcQ');
        });

        it('should normalize Steam store URLs and numeric App IDs', () => {
            const steamUrl = 'https://store.steampowered.com/app/990001/Test_Product_Suite/';
            const steamId = '990001';

            expect(normalizeUrlKey(steamUrl)).toBe('steam:990001');
            expect(normalizeUrlKey(steamId)).toBe('steam:990001');
        });

        it('should correctly normalize non-YouTube web and Reddit URLs', () => {
            const redditTopic = 'r/testcompany - product feedback';
            const webUrl = 'https://www.example.com/articles/test-company-review?ref=home#comments';

            expect(normalizeUrlKey(redditTopic)).toBe('r/testcompany - product feedback');
            expect(normalizeUrlKey(webUrl)).toBe('example.com/articles/test-company-review');
        });
    });

    describe('Listen Table Deduplication & Row Ingestion Logic', () => {
        it('should allow adding new YouTube videos when table already has existing videos', () => {
            const existingRows = [
                {
                    id: 'tc-yt-1',
                    type: 'youtube_sentiment',
                    videos: ['https://www.youtube.com/watch?v=lT2t7w70c5U'],
                    url: 'https://www.youtube.com/watch?v=lT2t7w70c5U',
                    title: 'YouTube: Creator Product Review & Benchmarks'
                },
                {
                    id: 'tc-reddit-1',
                    type: 'reddit',
                    videos: ['r/testcompany feature feedback thread'],
                    url: 'r/testcompany feature feedback thread',
                    title: 'r/testcompany Feature Thread'
                }
            ];

            const existingTargets = new Set(
                existingRows.flatMap(r => [
                    r.url,
                    r.id,
                    ...(r.videos || [])
                ].filter(Boolean).map(u => normalizeUrlKey(u)))
            );

            const newVideosToAdd = [
                {
                    id: 'yt-row-1',
                    type: 'youtube_sentiment',
                    url: 'https://www.youtube.com/watch?v=TC_REVIEW_01',
                    videos: ['https://www.youtube.com/watch?v=TC_REVIEW_01'],
                    title: 'test-company Product Impressions'
                },
                {
                    id: 'yt-row-2',
                    type: 'youtube_sentiment',
                    url: 'https://www.youtube.com/shorts/TC_SHORTS_02',
                    videos: ['https://www.youtube.com/shorts/TC_SHORTS_02'],
                    title: 'Top test-company Tips'
                }
            ];

            const seenBatch = new Set<string>();
            const uniqueNewRows = newVideosToAdd.filter(r => {
                const key = normalizeUrlKey(r.url || (r.videos && r.videos[0]) || r.id);
                if (!key) return true;
                if (existingTargets.has(key) || seenBatch.has(key)) {
                    return false;
                }
                seenBatch.add(key);
                return true;
            });

            expect(uniqueNewRows).toHaveLength(2);
            expect(uniqueNewRows[0].title).toBe('test-company Product Impressions');
            expect(uniqueNewRows[1].title).toBe('Top test-company Tips');

            const updatedRows = [...uniqueNewRows, ...existingRows];
            expect(updatedRows).toHaveLength(4);

            const sentimentTypes = ['sentiment_video', 'sentiment_comments', 'steam_reviews', 'trustpilot_sentiment', 'youtube_sentiment', 'youtube'];
            const sentimentRows = updatedRows.filter(r => sentimentTypes.includes(r.type));
            expect(sentimentRows).toHaveLength(3);
        });

        it('should reject exact duplicate videos when already in the table', () => {
            const existingRows = [
                {
                    id: 'tc-yt-1',
                    type: 'youtube_sentiment',
                    videos: ['https://www.youtube.com/watch?v=lT2t7w70c5U'],
                    url: 'https://www.youtube.com/watch?v=lT2t7w70c5U'
                }
            ];

            const existingTargets = new Set(
                existingRows.flatMap(r => [
                    r.url,
                    r.id,
                    ...(r.videos || [])
                ].filter(Boolean).map(u => normalizeUrlKey(u)))
            );

            const duplicateAttempt = {
                id: 'new-row',
                type: 'youtube_sentiment',
                url: 'https://youtu.be/lT2t7w70c5U',
                videos: ['https://youtu.be/lT2t7w70c5U']
            };

            const key = normalizeUrlKey(duplicateAttempt.url);
            const isDuplicate = existingTargets.has(key);
            expect(isDuplicate).toBe(true);
        });
    });
});
