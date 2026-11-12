import React, { useState } from 'react';
import { Loader2, MessageSquare, Search } from 'lucide-react';
import { FindInsightsSource, ListenQueueApi, findInsightsModalState, handleRunRedditInsights } from '../findInsightsStore';
import { InsightCard } from './GroundedSearchTab';
import { BTN_PRIMARY, BTN_SECONDARY, CHIP, INPUT, PANEL, QuickAddBar, SourceErrorCard } from './SteamAndDirectUrlTabs';

const SOURCE: FindInsightsSource = 'reddit';

export const getRedditPresets = (brand: string) => {
    const slug = brand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'testcompany';
    return [
        { label: `r/${slug}`, query: `r/${slug} subreddit top discussions about ${brand}` },
        { label: 'Complaints', query: `${brand} complaints and problems on Reddit` },
        { label: 'Reviews & Recs', query: `${brand} honest reviews and recommendations on Reddit` },
        { label: 'vs Competitors', query: `${brand} vs competitors Reddit comparison threads` },
        { label: 'Product Launches', query: `${brand} new product launch reactions on Reddit` }
    ];
};

/**
 * Parses "r/sub", "/r/sub", "sub", or a reddit.com URL into a Listen `reddit` item.
 * Returns null when the input cannot be a subreddit or Reddit thread.
 */
export const buildRedditListenItem = (input: string, guidance?: string) => {
    const raw = (input || '').trim();
    if (!raw) return null;
    let target = raw;
    let title = raw;
    let subtitle = 'Reddit';
    const urlMatch = raw.match(/reddit\.com\/(r\/[A-Za-z0-9_]+)(\/comments\/[A-Za-z0-9]+(?:\/([^/?#]+))?)?/i);
    if (/reddit\.com|redd\.it/i.test(raw)) {
        if (!urlMatch && !/redd\.it\//i.test(raw)) return null;
        target = raw.startsWith('http') ? raw : `https://${raw.replace(/^\/+/, '')}`;
        if (urlMatch) {
            subtitle = urlMatch[1];
            title = urlMatch[2] ? `${urlMatch[1]} — ${(urlMatch[3] || 'Thread').replace(/_/g, ' ')}` : `${urlMatch[1]} Community`;
        }
    } else {
        const sub = raw.replace(/^\/?r\//i, '').trim();
        if (!/^[A-Za-z0-9_]{2,40}$/.test(sub)) return null;
        target = `r/${sub}`;
        title = `r/${sub} Community`;
        subtitle = `r/${sub}`;
    }
    return {
        type: 'reddit',
        subType: 'reddit',
        id: target,
        url: target,
        tag: target,
        query: target,
        title,
        subtitle,
        tags: ['Reddit'],
        videos: [target],
        guidance: guidance?.trim() || undefined
    };
};

interface RedditInsightsTabProps {
    companyName: string;
    queue: ListenQueueApi;
    guidance?: string;
}

export const RedditInsightsTab: React.FC<RedditInsightsTabProps> = ({ companyName, queue, guidance }) => {
    const activeBrand = companyName || 'test-company';
    const [query, setQuery] = useState<string>(findInsightsModalState.redditQuery || '');
    const [inputError, setInputError] = useState<string | null>(null);
    const loading = findInsightsModalState.isFindingReddit;
    const error = findInsightsModalState.redditError;
    const threads = findInsightsModalState.redditInsights || [];
    const available = threads.filter(t => !queue.isInListen(t));

    const run = (q?: string) => {
        if (q !== undefined) setQuery(q);
        handleRunRedditInsights(q ?? query, activeBrand);
    };

    return (
        <div className="space-y-5 animate-fadeIn">
            <div className={PANEL}>
                <QuickAddBar
                    label="Add r/subreddit or Reddit Thread URL"
                    placeholder="Add r/subreddit or Reddit Thread URL"
                    buttonLabel="Add Reddit"
                    onSubmit={value => {
                        const item = buildRedditListenItem(value, guidance);
                        if (!item) { setInputError(`"${value}" is not a valid subreddit or Reddit thread URL.`); return false; }
                        setInputError(null);
                        queue.addNow(item);
                    }}
                />
                {inputError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{inputError}</p>}
                <div className="flex flex-col sm:flex-row gap-2 pt-2 border-t border-[var(--app-border)] dark:border-sky-500/20">
                    <div className="relative flex-1">
                        <MessageSquare size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-orange-600 pointer-events-none" />
                        <input
                            type="text"
                            aria-label="Search Reddit discussions"
                            value={query}
                            onChange={e => setQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && run()}
                            placeholder={`Search Reddit threads about ${activeBrand} (empty = top community discussions)`}
                            className={`${INPUT} pl-9`}
                        />
                    </div>
                    <button type="button" onClick={() => run()} disabled={loading} className={BTN_PRIMARY}>
                        {loading ? <><Loader2 size={13} className="animate-spin" /> Searching...</> : <><Search size={13} /> Find Threads</>}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {getRedditPresets(activeBrand).map(p => (
                        <button key={p.label} type="button" disabled={loading} onClick={() => run(p.query)} className={CHIP}>{p.label}</button>
                    ))}
                </div>
            </div>

            {error && <SourceErrorCard title="Reddit Discovery Failed" message={error} onRetry={() => run()} />}

            {loading && (
                <div className="text-center py-10 text-xs font-semibold text-[var(--app-muted)]">
                    <Loader2 className="animate-spin h-6 w-6 text-orange-600 mx-auto mb-2" /> Searching live Reddit discussions with Gemini grounded search...
                </div>
            )}

            {!loading && !error && threads.length === 0 && (
                <div className="text-center py-10 text-xs text-[var(--app-muted)]">Pick a preset or search to discover Reddit threads, or paste a subreddit above.</div>
            )}

            {!loading && threads.length > 0 && (
                <div className="space-y-3">
                    <div className="flex items-center justify-between gap-2">
                        <h4 className="font-bold text-sm text-[var(--app-text)]">Reddit Threads ({threads.length})</h4>
                        <div className="flex items-center gap-2">
                            <button type="button" onClick={() => queue.queueMany(available, SOURCE)} disabled={available.length === 0} className={BTN_SECONDARY}>Select All ({available.length})</button>
                            <button type="button" onClick={() => queue.unqueueMany(threads)} className={BTN_SECONDARY}>Clear</button>
                        </div>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {threads.map((item, idx) => (
                            <InsightCard key={`${item.url || item.id}-${idx}`} item={item} source={SOURCE} queue={queue} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
