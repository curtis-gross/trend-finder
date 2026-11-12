import React, { useState } from 'react';
import { AlertTriangle, Eye, Flame, KeyRound, Loader2, Music, Play, Search, Star } from 'lucide-react';
import { useSystemReadiness } from '../../../context/SystemReadinessContext';
import { normalizeYouTubeVideo } from '../../../services/youtubeService';
import { FindInsightsSource, ListenQueueApi } from '../findInsightsStore';
import { extractYouTubeId } from '../typesAndConstants';
import { AddToListenButton, BTN_PRIMARY, BTN_SECONDARY, CHIP, INPUT, PANEL, QueueCheckbox, QuickAddBar, SourceErrorCard, cardCls } from './SteamAndDirectUrlTabs';

export type YouTubeListenKind = 'youtube_sentiment' | 'abcd' | 'competitor_abcd';

const KIND_TAGS: Record<YouTubeListenKind, string> = {
    youtube_sentiment: 'Video Sentiment',
    abcd: 'ABCD Framework',
    competitor_abcd: 'Competitor ABCD'
};

/** Builds an `add-selected-insights` item for a YouTube video in the requested Listen family. */
export const buildYouTubeListenItem = (rawV: any, kind: YouTubeListenKind = 'youtube_sentiment', guidance?: string) => {
    const v = normalizeYouTubeVideo(rawV);
    const base = {
        id: v.videoId,
        url: v.videoUrl,
        title: v.title || `YouTube Video (${v.videoId})`,
        subtitle: v.channelTitle || 'YouTube Creator',
        image: v.thumbnail,
        rating: v.formattedViews || (v.viewCount ? `${v.viewCount} views` : undefined),
        reason: `${v.formattedViews || ''} • Duration: ${v.duration || 'Video'}${v.publishedAt ? ` • Published ${new Date(v.publishedAt).toLocaleDateString()}` : ''}`,
        tags: ['YouTube', v.isShort ? 'Shorts' : KIND_TAGS[kind]],
        videos: [v.videoUrl],
        guidance: guidance?.trim() || undefined
    };
    return kind === 'youtube_sentiment'
        ? { ...base, type: 'youtube', subType: 'youtube_sentiment' }
        : { ...base, type: kind };
};

/** Builds a Listen item from a pasted YouTube URL or 11-char ID. Returns null when no video ID is found. */
export const buildYouTubeUrlItem = (input: string, kind: YouTubeListenKind = 'youtube_sentiment', guidance?: string) => {
    const id = extractYouTubeId(input);
    if (!id) return null;
    const url = `https://www.youtube.com/watch?v=${id}`;
    return buildYouTubeListenItem({ videoId: id, videoUrl: url, title: `YouTube Video (${id})`, thumbnail: `https://i.ytimg.com/vi/${id}/hqdefault.jpg` }, kind, guidance);
};

export const flattenTrends = (t: { trending?: any[]; topYear?: any[]; shorts?: any[] } | null | undefined): any[] => {
    const seen = new Set<string>();
    return [...(t?.trending || []), ...(t?.topYear || []), ...(t?.shorts || [])].filter((v: any) => {
        const id = v?.videoId || v?.id;
        if (!id || seen.has(id)) return false;
        seen.add(id);
        return true;
    });
};

/** Shared video card used by Video and ABCD tabs. */
export const VideoCard: React.FC<{
    video: any;
    isShort?: boolean;
    queued: boolean;
    inListen: boolean;
    onToggle: () => void;
    onAdd: () => void;
    addLabel?: string;
}> = ({ video, isShort, queued, inListen, onToggle, onAdd, addLabel }) => (
    <div onClick={() => !inListen && onToggle()} className={`${cardCls(queued, inListen)} p-2 cursor-pointer`}>
        <div>
            <div className={`relative w-full ${isShort ? 'aspect-[9/13]' : 'aspect-video'} rounded-lg overflow-hidden bg-[var(--app-surface)] mb-2`}>
                <img src={video.thumbnail} alt={video.title} className="w-full h-full object-cover" loading="lazy" />
                {video.formattedViews && (
                    <div style={{ backgroundColor: 'rgba(4, 21, 39, 0.86)' }} className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-bold text-white keep-white-text flex items-center gap-1">
                        <Eye size={9} /> {video.formattedViews}
                    </div>
                )}
                <div className="absolute top-1 right-1">
                    <QueueCheckbox checked={queued} disabled={inListen} onToggle={onToggle} label={`Select ${video.title}`} />
                </div>
            </div>
            <h5 className="font-bold text-[11px] text-[var(--app-text)] leading-snug line-clamp-2 mb-0.5" title={video.title}>{video.title}</h5>
            <p className="text-[10px] text-[var(--app-muted)] truncate mb-1.5">{video.channelTitle}</p>
        </div>
        <div className="pt-1.5 border-t border-[var(--app-border)] dark:border-sky-500/20 flex items-center justify-between gap-1">
            <a href={video.videoUrl} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} className="text-[10px] font-semibold text-[var(--app-muted)] hover:text-[#0072BC]">Watch</a>
            <AddToListenButton inListen={inListen} onAdd={onAdd} label={addLabel} />
        </div>
    </div>
);

interface YouTubeTrendsTabProps {
    companyName: string;
    youtubeQuery: string;
    setYoutubeQuery: (val: string) => void;
    youtubeLoading: boolean;
    youtubeError: string | null;
    youtubeTrends: { query: string; trending: any[]; topYear: any[]; shorts: any[] } | null;
    handleSearchYouTubeTrends: (customQuery?: string) => void;
    queue: ListenQueueApi;
    guidance?: string;
}

const SOURCE: FindInsightsSource = 'youtube';

export const YouTubeTrendsTab: React.FC<YouTubeTrendsTabProps> = ({
    companyName, youtubeQuery, setYoutubeQuery, youtubeLoading, youtubeError, youtubeTrends, handleSearchYouTubeTrends, queue, guidance
}) => {
    const activeBrand = companyName || 'test-company';
    const [urlError, setUrlError] = useState<string | null>(null);
    const { checks } = useSystemReadiness();
    const isYouTubeKeyMissing =
        checks?.youtube?.configured === false ||
        Boolean(youtubeError && /YOUTUBE_API_KEY|api key not (set|configured|found)|missing.*youtube/i.test(youtubeError));
    const presets = [`${activeBrand} Official`, `${activeBrand} Review`, `${activeBrand} Campaign`, `${activeBrand} Shorts`];
    const toItem = (v: any) => buildYouTubeListenItem(v, 'youtube_sentiment', guidance);
    const all = flattenTrends(youtubeTrends);
    const available = all.map(toItem).filter(i => !queue.isInListen(i));

    const section = (title: string, Icon: any, videos: any[], isShort = false) => videos.length > 0 && (
        <div className="space-y-2.5">
            <h4 className="font-bold text-sm text-[var(--app-text)] flex items-center gap-2"><Icon size={14} className="text-[#0072BC] dark:text-sky-400" /> {title} ({videos.length})</h4>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3">
                {videos.map((video: any) => {
                    const item = toItem(video);
                    return (
                        <VideoCard
                            key={video.videoId}
                            video={video}
                            isShort={isShort}
                            queued={queue.isQueued(item)}
                            inListen={queue.isInListen(item)}
                            onToggle={() => queue.toggleQueue(item, SOURCE)}
                            onAdd={() => queue.addNow(item)}
                        />
                    );
                })}
            </div>
        </div>
    );

    return (
        <div className="space-y-5 animate-fadeIn">
            {isYouTubeKeyMissing && (
                <div
                    role="alert"
                    className="p-4 rounded-xl bg-amber-50 dark:bg-amber-500/10 border border-amber-300 dark:border-amber-500/40 flex items-start gap-3 text-xs"
                >
                    <AlertTriangle size={18} className="text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0 space-y-1">
                        <p className="font-bold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                            <KeyRound size={13} className="shrink-0" />
                            <span>YouTube API Key Missing (<code className="font-mono">YOUTUBE_API_KEY</code>)</span>
                        </p>
                        <p className="text-amber-800 dark:text-amber-200/90 break-words">
                            Add <code className="font-mono font-semibold px-1 py-0.5 rounded bg-amber-100 dark:bg-amber-950/60">YOUTUBE_API_KEY=&lt;your_key&gt;</code> to your <code className="font-mono font-semibold">.env</code> file (or server environment) and restart the backend to enable YouTube search and comment analysis.
                        </p>
                        {checks?.youtube?.message && (
                            <p className="text-[11px] font-mono text-amber-700 dark:text-amber-300/90 break-words">
                                {checks.youtube.message}
                            </p>
                        )}
                    </div>
                </div>
            )}

            <div className={PANEL}>
                <QuickAddBar
                    label="Quick Add YouTube Video URL"
                    placeholder="Quick Add YouTube Video URL — https://www.youtube.com/watch?v=..."
                    buttonLabel="Add Video"
                    onSubmit={value => {
                        const item = buildYouTubeUrlItem(value, 'youtube_sentiment', guidance);
                        if (!item) { setUrlError(`"${value}" is not a valid YouTube URL or video ID.`); return false; }
                        setUrlError(null);
                        queue.addNow(item);
                    }}
                />
                {urlError && <p className="text-[11px] text-rose-600 dark:text-rose-400">{urlError}</p>}
                <div className="flex flex-row items-center gap-2 pt-2 border-t border-[var(--app-border)] dark:border-sky-500/20">
                    <div className="relative flex-1 min-w-0">
                        <Play size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#0072BC] pointer-events-none" />
                        <input
                            type="text"
                            aria-label="Search YouTube"
                            value={youtubeQuery}
                            onChange={e => setYoutubeQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchYouTubeTrends()}
                            placeholder={`Search YouTube (e.g. ${activeBrand} Review)...`}
                            className={`${INPUT} pl-9`}
                        />
                    </div>
                    <button type="button" onClick={() => handleSearchYouTubeTrends()} disabled={youtubeLoading || !youtubeQuery.trim()} className={BTN_PRIMARY}>
                        {youtubeLoading ? <><Loader2 size={13} className="animate-spin shrink-0" /> Searching...</> : <><Search size={13} className="shrink-0" /> Search YouTube</>}
                    </button>
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                    {presets.map(p => (
                        <button key={p} type="button" onClick={() => { setYoutubeQuery(p); handleSearchYouTubeTrends(p); }} className={CHIP}>{p}</button>
                    ))}
                </div>
            </div>

            {youtubeError && <SourceErrorCard title="YouTube API Error" message={youtubeError} onRetry={() => handleSearchYouTubeTrends()} />}

            {youtubeLoading && (
                <div className="text-center py-10 text-xs font-semibold text-[var(--app-muted)]">
                    <Loader2 className="animate-spin h-6 w-6 text-[#0072BC] mx-auto mb-2" /> Searching YouTube for trending videos, top-year releases, and Shorts...
                </div>
            )}

            {!youtubeLoading && youtubeTrends && all.length === 0 && !youtubeError && (
                <div className="text-center py-10 text-xs text-[var(--app-muted)]">No YouTube videos found for &ldquo;{youtubeTrends.query}&rdquo;. Try a broader query or a preset.</div>
            )}

            {!youtubeLoading && all.length > 0 && (
                <div className="space-y-6">
                    <div className="flex flex-row items-center justify-end gap-2 flex-nowrap">
                        <button type="button" onClick={() => queue.queueMany(available, SOURCE)} disabled={available.length === 0} className={BTN_SECONDARY}>Select All ({available.length})</button>
                        <button type="button" onClick={() => queue.unqueueMany(all.map(toItem))} className={BTN_SECONDARY}>Clear</button>
                    </div>
                    {section('Trending Videos', Flame, youtubeTrends?.trending || [])}
                    {section('Top Videos (Past Year)', Star, youtubeTrends?.topYear || [])}
                    {section('YouTube Shorts', Music, youtubeTrends?.shorts || [], true)}
                </div>
            )}
        </div>
    );
};
