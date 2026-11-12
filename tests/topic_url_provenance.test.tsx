import { describe, it, expect, beforeEach, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import type { EnrichedComment } from '../services/noiseFilter/noiseTypes';
import {
    aggregateStage3TopicsAndClusters,
    buildTopicSourceRefsFromComments,
} from '../services/noiseFilter/stage3ClusterAggregator';
import {
    backfillCommentSourceUrls,
    getCachedInsights,
    getInsightsCacheKey,
    saveCachedInsights,
    type TopicItem,
} from '../components/insightsHome/insightsHomeCache';
import { TrendsDualColumnWidget } from '../components/insightsHome/TrendsDualColumnWidget';
import { InsightsTopicEvidenceModal } from '../components/insightsHome/InsightsTopicEvidenceModal';

const VIDEO_A = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
const VIDEO_B = 'https://www.youtube.com/watch?v=aBcDeFgHiJk';
const REDDIT_POST = 'https://www.reddit.com/r/gaming/comments/abc123/battery_thread/';

const makeComment = (id: string, extra: Partial<EnrichedComment> = {}): EnrichedComment => ({
    id,
    rawText: 'The battery drain issue makes the handheld unusable after an hour.',
    author: `user-${id}`,
    source: 'YouTube Comments',
    sourceLabel: 'YouTube: Handheld Review',
    isNoise: false,
    featureCategory: 'Hardware Performance',
    keywords: ['battery drain issue'],
    discoveredTopics: ['battery drain issue'],
    sentiment: 'negative',
    ...extra,
});

const providerComments: EnrichedComment[] = [
    makeComment('c1', { videoUrl: VIDEO_A, sourceUrl: VIDEO_A, videoId: 'dQw4w9WgXcQ', videoTitle: 'Handheld Review' }),
    makeComment('c2', { videoUrl: VIDEO_A, sourceUrl: VIDEO_A, videoId: 'dQw4w9WgXcQ', videoTitle: 'Handheld Review' }),
    makeComment('c3', { videoUrl: VIDEO_B, sourceUrl: VIDEO_B, videoId: 'aBcDeFgHiJk', videoTitle: 'Battery Test' }),
    makeComment('c4', { source: 'Reddit Discussion', sourceUrl: REDDIT_POST, videoTitle: 'Battery thread' }),
    makeComment('c5', { source: 'Reddit Discussion', sourceLabel: 'Reddit: no link' }),
];

const baseTopic = (overrides: Partial<TopicItem> = {}): TopicItem => ({
    id: 'top-gcs-0',
    rank: 1,
    title: 'battery drain issue',
    commentFrequency: 120,
    frequencyPercentage: 100,
    velocityChange: 42,
    category: 'Hardware Performance',
    ...overrides,
});

const widgetProps = (topics: TopicItem[]) => ({
    region: 'US',
    onRegionChange: () => {},
    timeRange: 'all' as any,
    onTimeRangeChange: () => {},
    searchQuery: '',
    onSearchQueryChange: () => {},
    isLoading: false,
    onRefresh: () => {},
    filteredTopTopics: topics,
    filteredRisingTopics: [],
    selectedTopic: null,
});

const modalProps = (topic: TopicItem, comments: any[]) => ({
    selectedTopic: topic.title,
    activeTopicItem: topic,
    topicComments: comments,
    selectedSentimentFilter: 'ALL' as any,
    onSelectSentimentFilter: () => {},
    selectedReleaseFilter: 'ALL' as any,
    onSelectReleaseFilter: () => {},
    selectedSourceFilter: 'ALL' as any,
    onSelectSourceFilter: () => {},
    drilldownSearch: '',
    onDrilldownSearchChange: () => {},
    onClose: () => {},
});

const memoryStore = new Map<string, string>();
const memoryStorage = {
    getItem: (k: string) => (memoryStore.has(k) ? memoryStore.get(k)! : null),
    setItem: (k: string, v: string) => { memoryStore.set(k, String(v)); },
    removeItem: (k: string) => { memoryStore.delete(k); },
    clear: () => memoryStore.clear(),
    key: (i: number) => Array.from(memoryStore.keys())[i] ?? null,
    get length() { return memoryStore.size; },
};
vi.stubGlobal('localStorage', memoryStorage);

describe('Topic URL provenance', () => {
    beforeEach(() => memoryStorage.clear());

    it('aggregates real comment URLs into topKeywords[].sourceUrls ranked by comment count', () => {
        const { topKeywords } = aggregateStage3TopicsAndClusters(providerComments, [], [{ name: 'Hardware Performance', description: '' }], 'acme');
        const topic = topKeywords.find(k => k.keyword === 'battery drain issue');
        expect(topic).toBeDefined();
        expect(topic!.sourceUrls?.map(r => r.url)).toEqual([VIDEO_A, VIDEO_B, REDDIT_POST]);
        expect(topic!.sourceUrls?.[0]).toMatchObject({ commentCount: 2, videoId: 'dQw4w9WgXcQ', title: 'Handheld Review' });
        expect(topic!.sourceUrl).toBe(VIDEO_A);
        expect(topic!.videoUrl).toBe(VIDEO_A);
        expect(topic!.sourceTitle).toBe('Handheld Review');
    });

    it('never invents URLs when comments lack provenance', () => {
        const bare = providerComments.map(({ videoUrl, sourceUrl, videoId, ...rest }) => rest as EnrichedComment);
        const { topKeywords } = aggregateStage3TopicsAndClusters(bare, [], [{ name: 'Hardware Performance', description: '' }], 'acme');
        topKeywords.forEach(k => {
            expect(k.sourceUrls).toBeUndefined();
            expect(k.sourceUrl).toBeUndefined();
            expect(k.videoUrl).toBeUndefined();
        });
        expect(buildTopicSourceRefsFromComments(bare, 'battery drain issue')).toEqual([]);
    });

    it('buildTopicSourceRefsFromComments backfills refs for legacy topics', () => {
        const refs = buildTopicSourceRefsFromComments(providerComments, 'battery drain issue');
        expect(refs[0]).toMatchObject({ url: VIDEO_A, commentCount: 2 });
        expect(refs).toHaveLength(3);
    });

    it('backfills legacy comment URLs only from matching configured sources', () => {
        const legacy = [
            { id: 'l1', sourceLabel: 'YouTube Video (dQw4w9WgXcQ)' },
            { id: 'l2', sourceLabel: 'Unknown channel' },
            { id: 'l3', subpageUrl: 'https://www.metacritic.com/game/x/user-reviews/' },
        ];
        const out = backfillCommentSourceUrls(legacy, [{ type: 'youtube', target: 'dQw4w9WgXcQ', videoId: 'dQw4w9WgXcQ', label: 'YouTube: Handheld Review' }]);
        expect(out[0]).toMatchObject({ sourceUrl: VIDEO_A, videoUrl: VIDEO_A, videoId: 'dQw4w9WgXcQ' });
        expect(out[1].sourceUrl).toBeUndefined();
        expect(out[1].videoUrl).toBeUndefined();
        expect(out[2].sourceUrl).toBe('https://www.metacritic.com/game/x/user-reviews/');
    });

    it('survives saveCachedInsights/getCachedInsights round-trip', () => {
        const refs = buildTopicSourceRefsFromComments(providerComments, 'battery drain issue');
        const topics: TopicItem[] = [
            baseTopic({ sourceUrls: refs, sourceUrl: VIDEO_A, videoUrl: VIDEO_A, sourceTitle: 'Handheld Review' }),
            baseTopic({ id: 'top-gcs-1', rank: 2, title: 'fan noise levels', commentFrequency: 90 }),
            baseTopic({ id: 'top-gcs-2', rank: 3, title: 'screen glare outdoors', commentFrequency: 60 }),
        ];
        saveCachedInsights('acme-prov', {
            topTopics: topics,
            risingTopics: topics,
            featureClusters: [{ category: 'Hardware Performance', keywordCount: 3, sentimentBreakdown: { positive: 1, negative: 3, neutral: 1 }, topKeywords: ['battery drain issue'] }],
            enrichedComments: providerComments,
            timestamp: Date.now(),
        });
        const cached = getCachedInsights('acme-prov');
        expect(cached?.topTopics[0]).toMatchObject({ sourceUrl: VIDEO_A, videoUrl: VIDEO_A, sourceTitle: 'Handheld Review' });
        expect(cached?.topTopics[0].sourceUrls?.[0].url).toBe(VIDEO_A);
        expect(cached?.enrichedComments?.[0]).toMatchObject({ videoUrl: VIDEO_A, sourceUrl: VIDEO_A, videoId: 'dQw4w9WgXcQ', videoTitle: 'Handheld Review' });
        const persisted = JSON.parse(localStorage.getItem(getInsightsCacheKey('acme-prov')) || '{}');
        expect(persisted.topTopics[0].videoUrl).toBe(VIDEO_A);
        expect(persisted.risingTopics[0].sourceUrls[0].url).toBe(VIDEO_A);
    });

    it('renders a clickable source badge on Overview topic rows without hijacking row clicks', () => {
        const refs = buildTopicSourceRefsFromComments(providerComments, 'battery drain issue');
        const onTopicClick = vi.fn();
        render(<TrendsDualColumnWidget {...widgetProps([baseTopic({ sourceUrls: refs, sourceUrl: VIDEO_A, videoUrl: VIDEO_A, sourceTitle: 'Handheld Review' })])} onTopicClick={onTopicClick} />);
        const link = screen.getByTestId('topic-source-link');
        expect(link.getAttribute('href')).toBe(VIDEO_A);
        expect(link.getAttribute('target')).toBe('_blank');
        expect(link.getAttribute('rel')).toBe('noopener noreferrer');
        expect(link.textContent).toContain('Handheld Review');
        expect(screen.getByText('+2 sources')).toBeTruthy();
        fireEvent.click(link);
        expect(onTopicClick).not.toHaveBeenCalled();
        fireEvent.click(screen.getByText('battery drain issue'));
        expect(onTopicClick).toHaveBeenCalledWith('battery drain issue');
    });

    it('renders zero links on topic rows without URLs', () => {
        const { container } = render(<TrendsDualColumnWidget {...widgetProps([baseTopic()])} onTopicClick={() => {}} />);
        expect(container.querySelectorAll('a').length).toBe(0);
    });

    it('renders source pills and per-comment links in the evidence modal', () => {
        render(<InsightsTopicEvidenceModal {...modalProps(baseTopic(), providerComments)} />);
        const pills = screen.getByTestId('topic-source-pills').querySelectorAll('a');
        expect(Array.from(pills).map(a => a.getAttribute('href'))).toEqual([VIDEO_A, VIDEO_B, REDDIT_POST]);
        const commentLinks = screen.getAllByTestId('comment-source-link');
        expect(commentLinks).toHaveLength(4);
        expect(commentLinks[0].getAttribute('href')).toBe(VIDEO_A);
        expect(commentLinks[0].textContent).toContain('Watch Video');
        expect(commentLinks[3].getAttribute('href')).toBe(REDDIT_POST);
        expect(commentLinks[3].textContent).toContain('View Source');
    });

    it('renders no fake links in the evidence modal when comments lack URLs', () => {
        const bare = providerComments.map(({ videoUrl, sourceUrl, videoId, ...rest }) => rest);
        const { container } = render(<InsightsTopicEvidenceModal {...modalProps(baseTopic(), bare)} />);
        expect(container.querySelectorAll('a').length).toBe(0);
    });
});
