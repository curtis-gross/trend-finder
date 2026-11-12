import React, { useMemo, useState } from 'react';
import { Check, Link, Plus } from 'lucide-react';
import { ListenQueueApi } from '../findInsightsStore';
import { extractYouTubeId } from '../typesAndConstants';
import { BTN_PRIMARY, INPUT, PANEL } from './SteamAndDirectUrlTabs';

export type AddSourceType =
    | 'youtube_sentiment' | 'reddit' | 'abcd' | 'competitor_abcd' | 'steam_reviews'
    | 'metacritic_reviews' | 'trustpilot_sentiment' | 'tiktok' | 'website_analysis' | 'social_intelligence';

export const ADD_SOURCE_TYPES: Array<{ id: AddSourceType; label: string }> = [
    { id: 'youtube_sentiment', label: 'Video Sentiment' },
    { id: 'reddit', label: 'Reddit' },
    { id: 'abcd', label: 'ABCD Video' },
    { id: 'competitor_abcd', label: 'Competitor ABCD' },
    { id: 'steam_reviews', label: 'Steam' },
    { id: 'metacritic_reviews', label: 'Metacritic' },
    { id: 'trustpilot_sentiment', label: 'Trustpilot' },
    { id: 'tiktok', label: 'TikTok / Social' },
    { id: 'website_analysis', label: 'Website' }
];

const LABELS: Record<AddSourceType, string> = {
    ...Object.fromEntries(ADD_SOURCE_TYPES.map(t => [t.id, t.label])) as Record<AddSourceType, string>,
    social_intelligence: 'Social Topic'
};

/** Smart URL auto-detection for a single pasted line. */
export const detectListenSource = (input: string): AddSourceType => {
    const v = (input || '').trim();
    const lower = v.toLowerCase();
    if (/youtube\.com|youtu\.be/.test(lower) || (/^[a-zA-Z0-9_-]{11}$/.test(v) && /[A-Z_-]/.test(v) && /\d/.test(v))) return 'youtube_sentiment';
    if (/reddit\.com|redd\.it/.test(lower) || /^\/?r\/[a-z0-9_]+/i.test(v)) return 'reddit';
    if (/store\.steampowered\.com|steamcommunity\.com\/app/.test(lower)) return 'steam_reviews';
    if (/metacritic\.com/.test(lower)) return 'metacritic_reviews';
    if (/trustpilot\.com/.test(lower)) return 'trustpilot_sentiment';
    if (/tiktok\.com/.test(lower) || v.startsWith('#')) return 'tiktok';
    if (/^https?:\/\//.test(lower) || /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$)/.test(lower)) return 'website_analysis';
    return 'social_intelligence';
};

const normalizeTarget = (line: string, type: AddSourceType): string => {
    const v = line.trim();
    if (type === 'youtube_sentiment' || type === 'abcd' || type === 'competitor_abcd') {
        const id = extractYouTubeId(v);
        return id ? `https://www.youtube.com/watch?v=${id}` : v;
    }
    if (type === 'steam_reviews') {
        const m = v.match(/app\/(\d+)/);
        return m ? m[1] : v;
    }
    if (type === 'reddit' && /^\/r\//i.test(v)) return v.slice(1);
    return v;
};

const shortTarget = (t: string) => t.replace(/^https?:\/\/(www\.)?/, '').slice(0, 60);

export const buildAddSourceItem = (line: string, type: AddSourceType, focus?: string) => {
    const target = normalizeTarget(line, type);
    return {
        id: `${type}-${Math.random().toString(36).substring(2, 9)}`,
        type,
        url: target,
        tag: target,
        query: target,
        title: `${LABELS[type]}: ${shortTarget(target)}`,
        focus: focus?.trim() || undefined,
        guidance: focus?.trim() || undefined,
        timeframe: '7d',
        status: 'pending',
        videos: [target]
    };
};

/**
 * Parses single or multi-line input into Listen items.
 * `forcedType` overrides auto-detection; `alsoAbcd` adds an ABCD row for each YouTube line.
 */
export const buildAddSourceItems = (text: string, opts: { forcedType?: AddSourceType | 'auto'; alsoAbcd?: boolean; focus?: string } = {}) => {
    const lines = (text || '').split(/\r?\n+/).map(l => l.trim()).filter(Boolean);
    const out: Array<{ line: string; type: AddSourceType; item: any }> = [];
    lines.forEach(line => {
        const type = opts.forcedType && opts.forcedType !== 'auto' ? opts.forcedType : detectListenSource(line);
        out.push({ line, type, item: buildAddSourceItem(line, type, opts.focus) });
        if (opts.alsoAbcd && type === 'youtube_sentiment' && extractYouTubeId(line)) {
            out.push({ line, type: 'abcd', item: buildAddSourceItem(line, 'abcd', opts.focus) });
        }
    });
    return out;
};

export const AddSourceTab: React.FC<{ queue: ListenQueueApi; guidance?: string }> = ({ queue, guidance }) => {
    const [text, setText] = useState('');
    const [forcedType, setForcedType] = useState<AddSourceType | 'auto'>('auto');
    const [alsoAbcd, setAlsoAbcd] = useState(false);
    const [focus, setFocus] = useState('');
    const [lastMsg, setLastMsg] = useState<string | null>(null);

    const parsed = useMemo(
        () => buildAddSourceItems(text, { forcedType, alsoAbcd, focus: focus || guidance }),
        [text, forcedType, alsoAbcd, focus, guidance]
    );
    const fresh = parsed.filter(p => !queue.isInListen(p.item));
    const hasYouTube = parsed.some(p => p.type === 'youtube_sentiment');

    const handleAdd = () => {
        if (fresh.length === 0) return;
        const n = queue.addNow(fresh.map(p => p.item));
        setLastMsg(`Added ${n} source${n === 1 ? '' : 's'} to Listen`);
        setText('');
    };

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className={PANEL}>
                <div className="flex items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-[var(--app-text)] flex items-center gap-1.5"><Link size={13} className="text-[#0072BC] dark:text-sky-400" /> Add Source</h4>
                    <span className="text-[10px] text-[var(--app-muted)]">One URL per line. Type is detected automatically.</span>
                </div>
                <div className="flex flex-wrap gap-1.5" role="group" aria-label="Source type">
                    {[{ id: 'auto' as const, label: 'Auto-detect' }, ...ADD_SOURCE_TYPES].map(t => (
                        <button
                            key={t.id}
                            type="button"
                            aria-pressed={forcedType === t.id}
                            onClick={() => setForcedType(t.id)}
                            className={`h-8 px-3 rounded-lg text-xs font-semibold border transition cursor-pointer ${
                                forcedType === t.id ? 'bg-[#0072BC] text-white keep-white-text border-[#0072BC]' : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] border-[var(--app-border)] dark:border-sky-500/30'
                            }`}
                        >
                            {t.label}
                        </button>
                    ))}
                </div>
                <textarea
                    aria-label="Source URLs"
                    value={text}
                    onChange={e => { setText(e.target.value); setLastMsg(null); }}
                    placeholder={'https://www.youtube.com/watch?v=...\nr/subreddit or https://www.reddit.com/r/.../comments/...\nhttps://store.steampowered.com/app/...\nhttps://www.trustpilot.com/review/example.com'}
                    className="w-full h-28 border border-[var(--app-border)] dark:border-sky-500/30 bg-[var(--app-surface)] dark:bg-[#061C36] rounded-lg p-3 text-xs font-mono focus:ring-2 focus:ring-[#0072BC] outline-none resize-y text-[var(--app-text)] placeholder-slate-400"
                />
                <div className="flex flex-col sm:flex-row sm:items-center gap-2">
                    <input type="text" aria-label="Analyst focus" value={focus} onChange={e => setFocus(e.target.value)} placeholder="Analyst focus (optional)" className={`${INPUT} flex-1`} />
                    {(hasYouTube || forcedType === 'youtube_sentiment') && (
                        <label className="h-9 px-3 rounded-lg border border-[var(--app-border)] dark:border-sky-500/30 text-xs font-semibold text-[var(--app-text)] flex items-center gap-2 cursor-pointer shrink-0">
                            <input type="checkbox" checked={alsoAbcd} onChange={e => setAlsoAbcd(e.target.checked)} className="h-4 w-4 text-[#0072BC]" />
                            + Also add ABCD
                        </label>
                    )}
                    <button type="button" onClick={handleAdd} disabled={fresh.length === 0} className={BTN_PRIMARY}>
                        <Plus size={13} /> {fresh.length > 0 ? `Add ${fresh.length} to Listen` : 'Add to Listen'}
                    </button>
                </div>
                {lastMsg && <p className="text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1"><Check size={12} /> {lastMsg}</p>}
            </div>

            {parsed.length > 0 && (
                <ul className="space-y-1.5" aria-label="Detected sources">
                    {parsed.map((p, idx) => {
                        const inListen = queue.isInListen(p.item);
                        return (
                            <li key={`${p.line}-${p.type}-${idx}`} className="flex items-center gap-2 px-3 h-9 rounded-lg border border-[var(--app-border)] dark:border-sky-500/20 bg-[var(--app-card)] dark:bg-[#041527] text-xs">
                                <span className="px-2 py-0.5 rounded bg-sky-50 dark:bg-[#061C36] text-[#0072BC] dark:text-sky-300 border border-sky-200 dark:border-sky-500/40 text-[10px] font-bold shrink-0">{LABELS[p.type]}</span>
                                <span className="font-mono truncate flex-1 text-[var(--app-text)]">{p.line}</span>
                                {inListen && <span className="text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 flex items-center gap-1 shrink-0"><Check size={11} /> In Listen</span>}
                            </li>
                        );
                    })}
                </ul>
            )}
        </div>
    );
};
