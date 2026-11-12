import React, { useState } from 'react';
import { AlertCircle, Check, CheckCircle2, ExternalLink, FileText, Gamepad2, Loader2, Plus, Search } from 'lucide-react';
import { FindInsightsSource, ListenQueueApi } from '../findInsightsStore';

/* ---------- Shared Find Insights UI primitives (theme-aware dark cockpit tokens) ---------- */

export const BTN_PRIMARY = 'h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-semibold bg-[#0072BC] hover:bg-[#005A96] disabled:opacity-50 disabled:cursor-not-allowed text-white keep-white-text shadow-xs transition flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer';
export const BTN_SECONDARY = 'h-9 px-2.5 sm:px-3.5 rounded-lg text-xs font-semibold bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-[var(--app-card)] dark:hover:bg-[#0A2747] border border-[var(--app-border)] dark:border-sky-500/40 text-[var(--app-text)] dark:text-[#D8E1EB] disabled:opacity-50 disabled:cursor-not-allowed transition flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer';
export const CHIP = 'h-8 px-2.5 sm:px-3 rounded-lg text-xs font-medium bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-[var(--app-card)] dark:hover:bg-[#0A2747] border border-[var(--app-border)] dark:border-sky-500/40 text-[var(--app-text)] dark:text-[#D8E1EB] transition whitespace-nowrap shrink-0 cursor-pointer';
export const PANEL = 'bg-[var(--app-card)] dark:bg-[#041527] p-4 rounded-2xl border border-[var(--app-border)] dark:border-sky-500/20 space-y-3';
export const INPUT = 'w-full h-9 px-3 bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-sky-500/30 rounded-lg text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-[#0072BC]';
export const cardCls = (queued: boolean, inListen: boolean) => `rounded-xl border p-3 flex flex-col justify-between transition ${
    inListen
        ? 'bg-[var(--app-surface)]/40 dark:bg-[#041527] border-[var(--app-border)] dark:border-sky-500/10 opacity-80'
        : queued
            ? 'bg-sky-50/70 dark:bg-[#061C36] border-[#0072BC] dark:border-sky-500/60 ring-1 ring-[#0072BC]/30'
            : 'bg-[var(--app-card)] dark:bg-[#041527] border-[var(--app-border)] dark:border-sky-500/20 hover:border-[#0072BC]/50'
}`;

export const AddToListenButton: React.FC<{ inListen: boolean; onAdd: () => void; label?: string }> = ({ inListen, onAdd, label = 'Add' }) => (
    inListen ? (
        <span className="h-8 px-3 rounded-lg text-xs font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 flex flex-row items-center gap-1 whitespace-nowrap shrink-0">
            <Check size={12} className="shrink-0" /> In Listen
        </span>
    ) : (
        <button
            type="button"
            onClick={e => { e.stopPropagation(); onAdd(); }}
            className="h-8 px-3 rounded-lg text-xs font-semibold bg-[#0072BC] hover:bg-[#005A96] text-white keep-white-text transition flex flex-row items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
        >
            <Plus size={12} className="shrink-0" /> {label}
        </button>
    )
);

export const QueueCheckbox: React.FC<{ checked: boolean; disabled?: boolean; onToggle: () => void; label?: string }> = ({ checked, disabled, onToggle, label }) => (
    <input
        type="checkbox"
        aria-label={label || 'Select for Listen'}
        checked={checked}
        disabled={disabled}
        onClick={e => e.stopPropagation()}
        onChange={onToggle}
        className="h-4 w-4 rounded border-[var(--app-border)] text-[#0072BC] focus:ring-[#0072BC] cursor-pointer disabled:opacity-40 shrink-0"
    />
);

export const SourceErrorCard: React.FC<{ title: string; message: string; onRetry?: () => void }> = ({ title, message, onRetry }) => (
    <div role="alert" className="p-4 rounded-xl bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 flex items-start gap-3 text-xs">
        <AlertCircle size={18} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
        <div className="flex-1 min-w-0 space-y-0.5">
            <p className="font-bold text-rose-800 dark:text-rose-300">{title}</p>
            <p className="text-rose-700 dark:text-rose-200 break-words whitespace-pre-wrap">{message || 'Unexpected upstream API error occurred.'}</p>
        </div>
        {onRetry && <button type="button" onClick={onRetry} className={BTN_SECONDARY}>Retry</button>}
    </div>
);

/** Compact inline input + button. Clears itself after a successful submit. */
export const QuickAddBar: React.FC<{
    label: string;
    placeholder: string;
    buttonLabel?: string;
    onSubmit: (value: string) => boolean | void;
}> = ({ label, placeholder, buttonLabel = 'Add', onSubmit }) => {
    const [value, setValue] = useState('');
    const submit = () => {
        const v = value.trim();
        if (!v) return;
        if (onSubmit(v) !== false) setValue('');
    };
    return (
        <div className="flex flex-row items-center gap-2">
            <input
                type="text"
                aria-label={label}
                value={value}
                onChange={e => setValue(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); submit(); } }}
                placeholder={placeholder}
                className={`${INPUT} font-mono flex-1 min-w-0`}
            />
            <button type="button" onClick={submit} disabled={!value.trim()} className={BTN_PRIMARY}>
                <Plus size={13} className="shrink-0" /> {buttonLabel}
            </button>
        </div>
    );
};

/* ---------- Steam item builder + tab ---------- */

export const buildSteamListenItem = (game: any, guidance?: string) => {
    const appIdStr = String(game.id);
    const ratingText = game.review_score_desc
        ? `${game.review_score_desc} (${game.total_reviews ? Number(game.total_reviews).toLocaleString() + ' reviews' : ''})`
        : (game.price ? (game.price.final ? `$${(game.price.final / 100).toFixed(2)}` : 'Store Catalog') : 'Steam Game');
    return {
        type: 'steam_reviews',
        subType: 'steam_reviews',
        id: appIdStr,
        url: appIdStr,
        title: game.name,
        subtitle: game.review_score_desc ? `${game.review_score_desc} • Steam Store` : 'Steam Store',
        image: `https://shared.fastly.steamstatic.com/store_item_assets/steam/apps/${appIdStr}/header.jpg`,
        rating: ratingText,
        reason: `Steam catalog entry for ${game.name} (App ID #${appIdStr})`,
        tags: ['Steam', 'Reviews', game.review_score_desc || 'Catalog'].filter(Boolean),
        guidance: guidance?.trim() || undefined
    };
};

interface SteamReviewsTabProps {
    steamQuery: string;
    setSteamQuery: (val: string) => void;
    steamLoading: boolean;
    steamError: string | null;
    steamGames: any[];
    queue: ListenQueueApi;
    handleSearchSteam: (customTerm?: string) => void;
}

const STEAM_SOURCE: FindInsightsSource = 'steam';

export const SteamReviewsTab: React.FC<SteamReviewsTabProps> = ({
    steamQuery, setSteamQuery, steamLoading, steamError, steamGames, queue, handleSearchSteam
}) => {
    const items = (steamGames || []).map(g => ({ game: g, item: buildSteamListenItem(g) }));
    const available = items.filter(x => !queue.isInListen(x.item)).map(x => x.item);
    return (
        <div className="space-y-5 animate-fadeIn">
            <div className={PANEL}>
                <div className="flex flex-row flex-wrap items-center justify-between gap-2">
                    <div className="flex items-center gap-2 min-w-0">
                        <Gamepad2 size={14} className="text-[#0072BC] dark:text-sky-400 shrink-0" />
                        <span className="text-xs font-bold text-[var(--app-text)] dark:text-white">
                            Steam Store &amp; Reviews API • Free Public Access (No API Key Required)
                        </span>
                    </div>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 inline-flex items-center gap-1 whitespace-nowrap shrink-0">
                        <CheckCircle2 size={11} className="shrink-0" /> Ready
                    </span>
                </div>
                <div className="flex flex-row items-center gap-2">
                    <div className="relative flex-1 min-w-0">
                        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)] pointer-events-none" />
                        <input
                            type="text"
                            aria-label="Search Steam catalog"
                            value={steamQuery}
                            onChange={e => setSteamQuery(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleSearchSteam()}
                            placeholder="Search Steam titles, tools, or catalog entries..."
                            className={`${INPUT} pl-9`}
                        />
                    </div>
                    <button type="button" onClick={() => handleSearchSteam()} disabled={steamLoading || !steamQuery.trim()} className={BTN_PRIMARY}>
                        {steamLoading ? <><Loader2 size={13} className="animate-spin shrink-0" /> Searching...</> : <><Search size={13} className="shrink-0" /> Search Steam</>}
                    </button>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                    {[
                        { label: 'Creative Tools', term: 'design' },
                        { label: 'Productivity', term: 'productivity' },
                        { label: 'Utilities', term: 'utilities' },
                        { label: 'Audio & Video', term: 'audio' },
                        { label: 'Developer Tools', term: 'developer' }
                    ].map(p => (
                        <button key={p.term} type="button" onClick={() => handleSearchSteam(p.term)} className={CHIP}>{p.label}</button>
                    ))}
                </div>
            </div>

            {steamError && <SourceErrorCard title="Steam API Error" message={steamError} onRetry={() => handleSearchSteam()} />}

            {steamLoading && (
                <div className="text-center py-10 text-xs font-semibold text-[var(--app-muted)]">
                    <Loader2 className="animate-spin h-6 w-6 text-[#0072BC] mx-auto mb-2" /> Connecting to Steam Store API...
                </div>
            )}

            {!steamLoading && items.length > 0 && (
                <div className="space-y-3">
                    <div className="flex flex-row items-center justify-between gap-2 flex-nowrap">
                        <h4 className="font-bold text-sm text-[var(--app-text)] flex items-center gap-2 min-w-0 truncate"><FileText size={14} className="shrink-0" /> Steam Catalog ({items.length})</h4>
                        <button type="button" onClick={() => queue.queueMany(available, STEAM_SOURCE)} disabled={available.length === 0} className={BTN_SECONDARY}>
                            Select All ({available.length})
                        </button>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                        {items.map(({ game, item }) => {
                            const inListen = queue.isInListen(item);
                            const queued = queue.isQueued(item);
                            return (
                                <div key={item.id} className={cardCls(queued, inListen)}>
                                    <div>
                                        <div className="relative w-full aspect-[460/215] rounded-lg overflow-hidden bg-[var(--app-surface)] mb-2">
                                            <img
                                                src={item.image}
                                                alt={game.name}
                                                onError={(e: any) => { if (game.tiny_image && e.target.src !== game.tiny_image) e.target.src = game.tiny_image; }}
                                                className="w-full h-full object-cover"
                                                loading="lazy"
                                            />
                                            <div className="absolute top-2 left-2">
                                                <QueueCheckbox checked={queued} disabled={inListen} onToggle={() => queue.toggleQueue(item, STEAM_SOURCE)} label={`Select ${game.name}`} />
                                            </div>
                                        </div>
                                        <h4 className="font-bold text-xs text-[var(--app-text)] line-clamp-2 mb-1" title={game.name}>{game.name}</h4>
                                        <p className="text-[11px] text-[var(--app-muted)] mb-2">{item.rating}</p>
                                    </div>
                                    <div className="pt-2 border-t border-[var(--app-border)] dark:border-sky-500/20 flex flex-row items-center justify-between gap-2">
                                        <a href={`https://store.steampowered.com/app/${item.id}`} target="_blank" rel="noopener noreferrer" className="text-[11px] font-semibold text-[var(--app-muted)] hover:text-[#0072BC] flex flex-row items-center gap-1 whitespace-nowrap">
                                            <ExternalLink size={11} className="shrink-0" /> Store
                                        </a>
                                        <AddToListenButton inListen={inListen} onAdd={() => queue.addNow(item)} />
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {!steamLoading && items.length === 0 && !steamError && (
                <div className="text-center py-10 text-[var(--app-muted)] text-xs">Search for a title to view Steam catalog entries and review feeds.</div>
            )}
        </div>
    );
};

export const SteamSearchTab = SteamReviewsTab;
