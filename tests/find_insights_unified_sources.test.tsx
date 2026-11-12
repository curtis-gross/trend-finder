/** @vitest-environment jsdom */
import React from 'react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';

const VIDEO_ID = 'dQw4w9WgXcQ';

vi.mock('../services/youtubeService', async (importOriginal) => {
    const actual: any = await importOriginal();
    return {
        ...actual,
        fetchYouTubeTrends: vi.fn(async (query: string) => ({
            query,
            trending: [{
                videoId: VIDEO_ID,
                videoUrl: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
                title: 'Test Creative Video',
                channelTitle: 'Test Channel',
                thumbnail: 'https://i.ytimg.com/vi/x/hq.jpg',
                formattedViews: '1.2M'
            }],
            topYear: [],
            shorts: []
        }))
    };
});

vi.mock('../components/trendIntelligence/findInsightsStore', async (importOriginal) => {
    const actual: any = await importOriginal();
    return { ...actual, handleRunRedditInsights: vi.fn(), handleRunFindInsights: vi.fn() };
});

import {
    buildExistingFamilyKeys, findInsightsModalState, getListenFamilyKey
} from '../components/trendIntelligence/findInsightsStore';
import { FindInsightsModal } from '../components/trendIntelligence/findInsights/FindInsightsModal';
import { buildAddSourceItems, detectListenSource } from '../components/trendIntelligence/findInsights/AddSourceTab';
import { buildRedditListenItem } from '../components/trendIntelligence/findInsights/RedditInsightsTab';
import { buildYouTubeUrlItem } from '../components/trendIntelligence/findInsights/YouTubeTrendsTab';

const existingRows = [{
    id: 'row-yt-1',
    type: 'youtube_sentiment',
    url: `https://www.youtube.com/watch?v=${VIDEO_ID}`,
    videos: [VIDEO_ID],
    title: 'Existing Sentiment Video'
}];

let dispatched: any[][] = [];
const onAdd = (e: Event) => dispatched.push((e as CustomEvent).detail);

const renderModal = (overrides: Record<string, any> = {}) => {
    const setIsOpen = vi.fn();
    render(
        <FindInsightsModal
            isOpen
            prompt=""
            setPrompt={vi.fn()}
            enableGroundedSearch
            setEnableGroundedSearch={vi.fn()}
            selectedContentTypes={['reddit']}
            setSelectedContentTypes={vi.fn()}
            setIsOpen={setIsOpen}
            foundInsights={[]}
            isFindingInsights={false}
            onRunSearch={vi.fn()}
            companyName="Test Company"
            existingRows={existingRows}
            {...overrides}
        />
    );
    return { setIsOpen };
};

const openTab = (name: RegExp) => fireEvent.click(screen.getByRole('tab', { name }));

beforeEach(() => {
    dispatched = [];
    window.addEventListener('add-selected-insights', onAdd);
    findInsightsModalState.redditInsights = [];
    findInsightsModalState.redditError = null;
    findInsightsModalState.isFindingReddit = false;
    findInsightsModalState.groundedError = null;
});

afterEach(() => {
    window.removeEventListener('add-selected-insights', onAdd);
    cleanup();
});

describe('Find Insights — unified tab switching', () => {
    it('switches across Discover, Video, Reddit, ABCD, and Add Source', async () => {
        renderModal();
        expect(screen.getByRole('tab', { name: /Discover/ }).getAttribute('aria-selected')).toBe('true');
        const run = screen.getByRole('button', { name: /Run Insight Discovery/ }) as HTMLButtonElement;
        expect(run.disabled).toBe(false);
        expect(screen.getByRole('button', { name: 'Customer Pain Points' })).toBeTruthy();

        openTab(/Video/);
        expect(screen.getByLabelText('Quick Add YouTube Video URL')).toBeTruthy();
        await screen.findByText('Test Creative Video');

        openTab(/Reddit/);
        expect(screen.getByLabelText('Add r/subreddit or Reddit Thread URL')).toBeTruthy();

        openTab(/ABCD/);
        expect(screen.getByLabelText('Search YouTube creatives')).toBeTruthy();
        expect(screen.getByRole('button', { name: 'Both Video Sentiment + ABCD' })).toBeTruthy();
        await screen.findByTitle('Test Creative Video');

        openTab(/Add Source/);
        expect(screen.getByLabelText('Source URLs')).toBeTruthy();
        expect(screen.getByRole('tab', { name: /Add Source/ }).getAttribute('aria-selected')).toBe('true');
    });
});

describe('Find Insights — type-aware dedup', () => {
    it('keys youtube_sentiment and abcd as distinct families', () => {
        const keys = buildExistingFamilyKeys(existingRows);
        const sentiment = buildYouTubeUrlItem(VIDEO_ID, 'youtube_sentiment');
        const abcd = buildYouTubeUrlItem(VIDEO_ID, 'abcd');
        expect(keys.has(getListenFamilyKey(sentiment))).toBe(true);
        expect(keys.has(getListenFamilyKey(abcd))).toBe(false);
        expect(getListenFamilyKey(abcd)).toBe(`abcd::youtube:${VIDEO_ID}`);
    });

    it('marks the video In Listen on Video tab but still allows adding it on ABCD', async () => {
        renderModal();
        openTab(/Video/);
        const videoTitle = await screen.findByTitle('Test Creative Video');
        const videoCard = videoTitle.closest('[class*="rounded-xl"]') as HTMLElement;
        expect(within(videoCard).getByText('In Listen')).toBeTruthy();

        openTab(/ABCD/);
        const abcdTitle = await screen.findByTitle('Test Creative Video');
        const abcdCard = abcdTitle.closest('[class*="rounded-xl"]') as HTMLElement;
        expect(within(abcdCard).queryByText('In Listen')).toBeNull();
        fireEvent.click(within(abcdCard).getByRole('button', { name: /Add/ }));

        expect(dispatched).toHaveLength(1);
        expect(dispatched[0][0].type).toBe('abcd');
        expect(within(abcdCard).getByText('In Listen')).toBeTruthy();
        expect(screen.getByTestId('session-added-badge').textContent).toContain('Added 1 to Listen');
    });

    it('lists Listen videos without an ABCD row in the quick-pick strip', async () => {
        renderModal();
        openTab(/ABCD/);
        expect(screen.getByText('From Your Listen Videos')).toBeTruthy();
        expect(screen.getByText('Existing Sentiment Video')).toBeTruthy();
        await screen.findByTitle('Test Creative Video');
    });
});

describe('Find Insights — Add Source auto-detection + batch add', () => {
    it('detects source types from URLs', () => {
        expect(detectListenSource('https://youtu.be/dQw4w9WgXcQ')).toBe('youtube_sentiment');
        expect(detectListenSource('https://www.reddit.com/r/test/comments/abc123/title')).toBe('reddit');
        expect(detectListenSource('r/testcompany')).toBe('reddit');
        expect(detectListenSource('https://store.steampowered.com/app/990001/Test/')).toBe('steam_reviews');
        expect(detectListenSource('https://www.metacritic.com/game/test/')).toBe('metacritic_reviews');
        expect(detectListenSource('https://www.trustpilot.com/review/example.com')).toBe('trustpilot_sentiment');
        expect(detectListenSource('https://www.tiktok.com/@creator/video/1')).toBe('tiktok');
        expect(detectListenSource('https://example.com/article')).toBe('website_analysis');
    });

    it('adds an ABCD row alongside YouTube lines when toggled', () => {
        const out = buildAddSourceItems(`https://youtu.be/${VIDEO_ID}\nhttps://store.steampowered.com/app/990001/`, { alsoAbcd: true });
        expect(out.map(o => o.type)).toEqual(['youtube_sentiment', 'abcd', 'steam_reviews']);
        expect(out[2].item.url).toBe('990001');
    });

    it('batch adds detected sources from the UI without closing the modal', () => {
        const { setIsOpen } = renderModal();
        openTab(/Add Source/);
        fireEvent.change(screen.getByLabelText('Source URLs'), {
            target: { value: 'r/testcompany\nhttps://www.trustpilot.com/review/example.com\nhttps://example.com/news' }
        });
        fireEvent.click(screen.getByRole('button', { name: /Add 3 to Listen/ }));
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0].map((i: any) => i.type)).toEqual(['reddit', 'trustpilot_sentiment', 'website_analysis']);
        expect(setIsOpen).not.toHaveBeenCalledWith(false);
        expect(screen.getByLabelText('Source URLs')).toBeTruthy();
    });
});

describe('Find Insights — cross-tab queue + Add Selected', () => {
    it('Add Selected dispatches add-selected-insights and keeps the modal open; Done closes', () => {
        findInsightsModalState.redditInsights = [
            buildRedditListenItem('https://www.reddit.com/r/testcompany/comments/aa111/first_thread'),
            buildRedditListenItem('https://www.reddit.com/r/testcompany/comments/bb222/second_thread')
        ];
        const { setIsOpen } = renderModal();
        openTab(/Reddit/);
        screen.getAllByRole('checkbox').forEach(cb => fireEvent.click(cb));
        expect(screen.getByTestId('queue-summary').textContent).toContain('2 selected');

        act(() => { fireEvent.click(screen.getByRole('button', { name: /Add Selected \(2\)/ })); });
        expect(dispatched).toHaveLength(1);
        expect(dispatched[0]).toHaveLength(2);
        expect(dispatched[0].every((i: any) => i.type === 'reddit')).toBe(true);
        expect(setIsOpen).not.toHaveBeenCalledWith(false);
        expect(screen.getByTestId('session-added-badge').textContent).toContain('Added 2 to Listen');
        expect(screen.getAllByText('In Listen')).toHaveLength(2);

        fireEvent.click(screen.getByRole('button', { name: 'Done' }));
        expect(setIsOpen).toHaveBeenCalledWith(false);
    });

    it('rejects invalid Reddit input and accepts subreddits', () => {
        expect(buildRedditListenItem('not a subreddit!!')).toBeNull();
        expect(buildRedditListenItem('/r/gaming')?.url).toBe('r/gaming');
    });
});
