import React, { useState } from 'react';
import { GitCompare, Loader2, Search, Shield } from 'lucide-react';
import { FindInsightsSource, ListenQueueApi, getRowDedupFamily } from '../findInsightsStore';
import { extractYouTubeId } from '../typesAndConstants';
import { AddToListenButton, BTN_PRIMARY, BTN_SECONDARY, CHIP, INPUT, PANEL, QuickAddBar, SourceErrorCard } from './SteamAndDirectUrlTabs';
import { VideoCard, YouTubeListenKind, buildYouTubeListenItem, buildYouTubeUrlItem } from './YouTubeTrendsTab';

export type AbcdAddMode = 'abcd' | 'competitor_abcd' | 'both';
const SOURCE: FindInsightsSource = 'abcd';

const MODES: Array<{ id: AbcdAddMode; label: string }> = [
    { id: 'abcd', label: 'ABCD Framework' },
    { id: 'competitor_abcd', label: 'Competitor ABCD' },
    { id: 'both', label: 'Both Video Sentiment + ABCD' }
];

const kindsFor = (mode: AbcdAddMode): YouTubeListenKind[] => (mode === 'both' ? ['youtube_sentiment', 'abcd'] : [mode]);

export const buildAbcdItemsForVideo = (video: any, mode: AbcdAddMode, guidance?: string) =>
    kindsFor(mode).map(k => buildYouTubeListenItem(video, k, guidance));

export const buildAbcdItemsForUrl = (url: string, mode: AbcdAddMode, guidance?: string) => {
    const items = kindsFor(mode).map(k => buildYouTubeUrlItem(url, k, guidance));
    return items.every(Boolean) ? (items as any[]) : null;
};

export const buildComparativeItem = (urlA: string, urlB: string, guidance?: string) => {
    const a = extractYouTubeId(urlA);
    const b = extractYouTubeId(urlB);
    if (!a || !b || a === b) return null;
    const ua = `https://www.youtube.com/watch?v=${a}`;
    const ub = `https://www.youtube.com/watch?v=${b}`;
    return {
        type: 'comparative',
        id: `comparative-${a}-${b}`,
        url: ua,
        title: `Comparative Creative: ${a} vs ${b}`,
        subtitle: 'Two-Video ABCD Comparison',
        tags: ['ABCD', 'Comparative'],
        videos: [ua, ub],
        guidance: guidance?.trim() || undefined
    };
};

/** YouTube videos already in Listen as Video Sentiment that do not yet have an ABCD row. */
export const getListenVideosMissingAbcd = (rows: any[], queue: Pick<ListenQueueApi, 'isInListen'>) => {
    const seen = new Set<string>();
    const out: Array<{ id: string; title: string }> = [];
    (rows || []).forEach((r: any) => {
        if (!r || getRowDedupFamily(r.type) !== 'youtube_sentiment') return;
        const id = extractYouTubeId((Array.isArray(r.videos) && r.videos[0]) || r.url || '');
        if (!id || seen.has(id)) return;
        seen.add(id);
        if (queue.isInListen({ type: 'abcd', url: `https://www.youtube.com/watch?v=${id}` })) return;
        out.push({ id, title: r.title || `YouTube Video (${id})` });
    });
    return out;
};

interface AbcdVideoTabProps {
    companyName: string;
    rows: any[];
    queue: ListenQueueApi;
    guidance?: string;
    abcdQuery: string;
    setAbcdQuery: (v: string) => void;
    abcdLoading: boolean;
    abcdError: string | null;
    abcdVideos: any[];
    handleSearchAbcd: (q?: string) => void;
}

export const AbcdVideoTab: React.FC<AbcdVideoTabProps> = ({
    companyName, rows, queue, guidance, abcdQuery, setAbcdQuery, abcdLoading, abcdError, abcdVideos, handleSearchAbcd
}) => {
    const brand = companyName || 'test-company';
    const [mode, setMode] = useState<AbcdAddMode>('abcd');
    const [urlError, setUrlError] = useState<string | null>(null);
    const [compA, setCompA] = useState('');
    const [compB, setCompB] = useState('');
    const presets = [`${brand} commercial`, `${brand} ad`, `${brand} launch video`];
    const missing = getListenVideosMissingAbcd(rows, queue);
    const add = (items: any[]) => queue.addNow(items.filter(i => !queue.isInListen(i)));

    const addComparative = () => {
        const item = buildComparativeItem(compA, compB, guidance);
        if (!item) { setUrlError('Comparative Creative needs two different valid YouTube URLs.'); return; }
        setUrlError(null);
        queue.addNow(item);
        setCompA('');
        setCompB('');
    };

    return (
        <div className="space-y-5 animate-fadeIn">
            <div className={PANEL}>
                <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-semibold text-[var(--app-muted)]">Add videos as:</span>
                    {MODES.map(m => (
                        <button
                            key={m.id}
                            type="button"
                            aria-pressed={mode === m.id}
                            onClick={() => setMode(m.id)}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer flex items-center gap-1.5 ${
                                mode === m.id ? 'bg-[#0072BC] text-white keep-white-text border-[#0072BC]' : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] border-[var(--app-border)] dark:border-sky-500/30'
                            }`}
                        >
                            {m.id === 'competitor_abcd' && <Shield size={12} />} {m.label}
                        </button>
                    ))}
                </div>
                <QuickAddBar
                    label="ABCD YouTube URL"
                    placeholder="Paste an ABCD YouTube URL — https://www.youtube.com/watch?v=..."
                    buttonLabel="Add to ABCD"
                    onSubmit={value => {
                        const items = buildAbcdItemsForUrl(value, mode, guidance);
                        if (!items) { setUrlError(`"${value}" is not a valid YouTube URL or video ID.`); return false; }
                        setUrlError(null);
                        add(items);
                    }}
                />
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                    <GitCompare size={14} className="text-[#0072BC] dark:text-sky-400 shrink-0 hidden sm:block" />
                    <input aria-label="Comparative video A" value={compA} onChange={e => setCompA(e.target.value)} placeholder="Comparative Creative — Video A URL" className={`${INPUT} font-mono flex-1`} />
                    <input aria-label="Comparative video B" value={compB} onChange={e => setCompB(e.target.value)} placeholder="Video B URL" className={`${INPUT} font-mono flex-1`} />
                    <button type="button" onClick={addComparative} disabled={!compA.trim() || !compB.trim()} className={BTN_SECONDARY}>Add Comparative</button>
                </div>
                {urlError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{urlError}</p>}
            </div>

            {missing.length > 0 && (
                <div className={PANEL}>
                    <h4 className="text-xs font-bold text-[var(--app-text)]">From Your Listen Videos <span className="font-normal text-[var(--app-muted)]">— not yet scored with ABCD</span></h4>
                    <div className="flex gap-2 overflow-x-auto pb-1">
                        {missing.map(v => (
                            <div key={v.id} className="w-44 shrink-0 rounded-lg border border-[var(--app-border)] dark:border-sky-500/20 p-2 space-y-1.5 bg-[var(--app-surface)] dark:bg-[#061C36]">
                                <img src={`https://i.ytimg.com/vi/${v.id}/mqdefault.jpg`} alt={v.title} className="w-full aspect-video object-cover rounded" loading="lazy" />
                                <p className="text-[10px] font-semibold text-[var(--app-text)] line-clamp-2" title={v.title}>{v.title}</p>
                                <AddToListenButton
                                    inListen={false}
                                    label="Add to ABCD"
                                    onAdd={() => queue.addNow(buildYouTubeUrlItem(v.id, 'abcd', guidance))}
                                />
                            </div>
                        ))}
                    </div>
                </div>
            )}

            <div className={PANEL}>
                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        aria-label="Search YouTube creatives"
                        value={abcdQuery}
                        onChange={e => setAbcdQuery(e.target.value)}
                        onKeyDown={e => e.key === 'Enter' && handleSearchAbcd()}
                        placeholder={`Search YouTube creatives (e.g. ${brand} commercial)`}
                        className={`${INPUT} flex-1`}
                    />
                    <button type="button" onClick={() => handleSearchAbcd()} disabled={abcdLoading || !abcdQuery.trim()} className={BTN_PRIMARY}>
                        {abcdLoading ? <><Loader2 size={13} className="animate-spin" /> Searching...</> : <><Search size={13} /> Search Creatives</>}
                    </button>
                </div>
                <div className="flex flex-wrap gap-1.5">
                    {presets.map(p => <button key={p} type="button" onClick={() => { setAbcdQuery(p); handleSearchAbcd(p); }} className={CHIP}>{p}</button>)}
                </div>
            </div>

            {abcdError && <SourceErrorCard title="YouTube Creative Search Failed" message={abcdError} onRetry={() => handleSearchAbcd()} />}

            {abcdLoading && (
                <div className="text-center py-10 text-xs font-semibold text-[var(--app-muted)]">
                    <Loader2 className="animate-spin h-6 w-6 text-[#0072BC] mx-auto mb-2" /> Searching YouTube creatives...
                </div>
            )}

            {!abcdLoading && abcdVideos.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                    {abcdVideos.map((video: any) => {
                        const items = buildAbcdItemsForVideo(video, mode, guidance);
                        const inListen = items.every(i => queue.isInListen(i));
                        const queued = items.filter(i => !queue.isInListen(i)).every(i => queue.isQueued(i)) && !inListen;
                        return (
                            <VideoCard
                                key={video.videoId}
                                video={video}
                                queued={queued}
                                inListen={inListen}
                                addLabel="Add"
                                onToggle={() => (queued ? queue.unqueueMany(items) : queue.queueMany(items.filter(i => !queue.isInListen(i)), SOURCE))}
                                onAdd={() => add(items)}
                            />
                        );
                    })}
                </div>
            )}

            {!abcdLoading && !abcdError && abcdVideos.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--app-muted)]">Pick a creative preset or paste a YouTube URL to add ABCD evaluations.</div>
            )}
        </div>
    );
};
