import React from 'react';
import { Globe, Loader2, MessageSquare, Music, Search, Sparkles, Star } from 'lucide-react';
import { FindInsightsSource, ListenQueueApi, findInsightsModalState, handleRunFindInsights } from '../findInsightsStore';
import { AddToListenButton, BTN_PRIMARY, BTN_SECONDARY, CHIP, INPUT, PANEL, QueueCheckbox, SourceErrorCard, cardCls } from './SteamAndDirectUrlTabs';

type ResultFilter = 'all' | 'reddit' | 'tiktok' | 'trustpilot' | 'website';

interface GroundedSearchTabProps {
    companyName: string;
    prompt: string;
    setPrompt: (val: string) => void;
    guidance: string;
    setGuidance: (val: string) => void;
    selectedContentTypes: string[];
    setSelectedContentTypes: (val: string[]) => void;
    onRunSearch: () => void;
    isFindingInsights: boolean;
    foundInsights: any[];
    filteredInsights: any[];
    activeResultFilter: ResultFilter;
    setActiveResultFilter: (val: ResultFilter) => void;
    showGroundingTrace: boolean;
    setShowGroundingTrace: (val: boolean) => void;
    queue: ListenQueueApi;
}

const sourceCategories = [
    { id: 'reddit', label: 'Reddit', icon: MessageSquare },
    { id: 'tiktok', label: 'TikTok', icon: Music },
    { id: 'trustpilot_sentiment', label: 'Trustpilot', icon: Star },
    { id: 'website_analysis', label: 'Web & Press', icon: Globe }
];

export const getQuickQueryPresets = (brand: string) => [
    { label: 'Customer Pain Points', query: `${brand} customer pain points, complaints, and frustrations` },
    { label: 'Product Praise & Wins', query: `${brand} product praise, positive reviews, and customer wins` },
    { label: 'Competitor Comparisons', query: `${brand} vs competitors comparisons and switching discussions` },
    { label: 'Viral Discussions', query: `${brand} viral discussions, trending posts, and creator buzz` }
];

const badgeFor = (item: any) => {
    if (item.type === 'reddit') return { label: 'Reddit', icon: MessageSquare, cls: 'text-orange-700 dark:text-orange-300' };
    if (item.type === 'tiktok' || item.type === 'tiktok_hashtag') return { label: 'TikTok', icon: Music, cls: 'text-pink-700 dark:text-pink-300' };
    if (item.type === 'trustpilot' || item.type === 'trustpilot_sentiment') return { label: 'Trustpilot', icon: Star, cls: 'text-emerald-700 dark:text-emerald-300' };
    return { label: 'Web', icon: Globe, cls: 'text-sky-700 dark:text-sky-300' };
};

/** Shared text-result card for Discover and Reddit tabs. */
export const InsightCard: React.FC<{ item: any; source: FindInsightsSource; queue: ListenQueueApi }> = ({ item, source, queue }) => {
    const inListen = queue.isInListen(item);
    const queued = queue.isQueued(item);
    const badge = badgeFor(item);
    const BadgeIcon = badge.icon;
    return (
        <div className={cardCls(queued, inListen)}>
            <div>
                <div className="flex items-start justify-between gap-2 mb-1.5">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold font-mono border border-[var(--app-border)] dark:border-sky-500/30 bg-[var(--app-surface)] dark:bg-[#061C36] flex items-center gap-1 ${badge.cls}`}>
                        <BadgeIcon size={11} /> {badge.label}
                    </span>
                    <QueueCheckbox checked={queued} disabled={inListen} onToggle={() => queue.toggleQueue(item, source)} label={`Select ${item.title}`} />
                </div>
                <h4 className="font-bold text-xs text-[var(--app-text)] leading-snug line-clamp-2 mb-1">{item.title}</h4>
                {item.subtitle && <p className="text-[11px] text-[var(--app-muted)] truncate mb-1">{item.subtitle}</p>}
                {item.reason && <p className="text-[11px] text-[var(--app-muted)] line-clamp-2 mb-2 leading-relaxed">{item.reason}</p>}
                {typeof item.url === 'string' && item.url.startsWith('http') && (
                    <a href={item.url} target="_blank" rel="noopener noreferrer" className="text-[10px] text-[#0072BC] dark:text-sky-400 hover:underline font-mono truncate block mb-2" title={item.url}>
                        {item.url}
                    </a>
                )}
            </div>
            <div className="pt-2 border-t border-[var(--app-border)] dark:border-sky-500/20 flex items-center justify-end">
                <AddToListenButton inListen={inListen} onAdd={() => queue.addNow(item)} />
            </div>
        </div>
    );
};

export const GroundedSearchTab: React.FC<GroundedSearchTabProps> = ({
    companyName, prompt, setPrompt, guidance, setGuidance,
    selectedContentTypes, setSelectedContentTypes, onRunSearch, isFindingInsights,
    foundInsights, filteredInsights, activeResultFilter, setActiveResultFilter,
    showGroundingTrace, setShowGroundingTrace, queue
}) => {
    const activeBrand = companyName || 'test-company';
    const trace = findInsightsModalState.groundingTrace;
    const count = (fn: (i: any) => boolean) => foundInsights.filter(i => i.type !== 'youtube' && fn(i)).length;
    const filterTabs: Array<{ id: ResultFilter; label: string; n: number }> = [
        { id: 'all', label: 'All', n: count(() => true) },
        { id: 'reddit', label: 'Reddit', n: count(i => i.type === 'reddit') },
        { id: 'tiktok', label: 'TikTok', n: count(i => i.type === 'tiktok' || i.type === 'tiktok_hashtag') },
        { id: 'trustpilot', label: 'Trustpilot', n: count(i => i.type === 'trustpilot' || i.type === 'trustpilot_sentiment') },
        { id: 'website', label: 'Web & Press', n: count(i => ['website', 'grounded_search', 'website_analysis'].includes(i.type)) }
    ];
    const available = filteredInsights.filter(i => !queue.isInListen(i));

    return (
        <div className="space-y-5 animate-fadeIn">
            <div className={PANEL}>
                <div className="flex items-center justify-between">
                    <h4 className="text-xs font-bold text-[var(--app-text)] flex items-center gap-1.5"><Sparkles size={13} className="text-[#0072BC] dark:text-sky-400" /> Grounded Insights</h4>
                    <span className="text-[10px] text-[var(--app-muted)]">Leave the query empty to run a full {activeBrand} discovery.</span>
                </div>
                <textarea
                    aria-label="Grounded search query"
                    value={prompt}
                    onChange={e => setPrompt(e.target.value)}
                    placeholder={`Optional: search ${activeBrand} community topics, reviews, creator trends, or sentiment...`}
                    className="w-full h-16 border border-[var(--app-border)] dark:border-sky-500/30 bg-[var(--app-surface)] dark:bg-[#061C36] rounded-lg p-3 text-xs focus:ring-2 focus:ring-[#0072BC] outline-none resize-none text-[var(--app-text)] placeholder-slate-400"
                />
                <div className="flex flex-wrap items-center gap-1.5">
                    {getQuickQueryPresets(activeBrand).map(p => (
                        <button
                            key={p.label}
                            type="button"
                            disabled={isFindingInsights}
                            onClick={() => { setPrompt(p.query); onRunSearch(); }}
                            className={CHIP}
                        >
                            {p.label}
                        </button>
                    ))}
                </div>
                <input
                    type="text"
                    aria-label="Analyst guidance"
                    value={guidance}
                    onChange={e => setGuidance(e.target.value)}
                    placeholder="Analyst guidance (optional) — applied to every item you add"
                    className={INPUT}
                />
                <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="flex flex-wrap gap-1.5">
                        {sourceCategories.map(cat => {
                            const Icon = cat.icon;
                            const on = selectedContentTypes.includes(cat.id);
                            return (
                                <button
                                    key={cat.id}
                                    type="button"
                                    aria-pressed={on}
                                    onClick={() => setSelectedContentTypes(on ? selectedContentTypes.filter(t => t !== cat.id) : [...selectedContentTypes, cat.id])}
                                    className={`h-8 px-3 rounded-lg text-xs font-semibold border flex items-center gap-1.5 transition cursor-pointer ${
                                        on ? 'bg-[#0072BC] text-white keep-white-text border-[#0072BC]' : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] border-[var(--app-border)] dark:border-sky-500/30'
                                    }`}
                                >
                                    <Icon size={12} /> {cat.label}
                                </button>
                            );
                        })}
                    </div>
                    <button type="button" onClick={onRunSearch} disabled={isFindingInsights} className={BTN_PRIMARY}>
                        {isFindingInsights ? <><Loader2 size={13} className="animate-spin" /> Searching...</> : <><Search size={13} /> Run Insight Discovery</>}
                    </button>
                </div>
            </div>

            {isFindingInsights && (
                <div className="text-center py-8 text-xs font-semibold text-[var(--app-muted)]">
                    <Loader2 className="animate-spin h-6 w-6 text-[#0072BC] mx-auto mb-2" /> Searching grounded sources...
                </div>
            )}

            {findInsightsModalState.groundedError && (
                <SourceErrorCard title="Grounded Intelligence Search Failed" message={findInsightsModalState.groundedError} onRetry={() => handleRunFindInsights(activeBrand)} />
            )}

            {!isFindingInsights && !findInsightsModalState.groundedError && foundInsights.length === 0 && (
                <div className="text-center py-8 text-xs text-[var(--app-muted)]">No grounded insights yet. Pick a quick query or click Run Insight Discovery.</div>
            )}

            {!isFindingInsights && foundInsights.length > 0 && (
                <div className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 overflow-x-auto">
                            {filterTabs.map(ft => (
                                <button
                                    key={ft.id}
                                    type="button"
                                    onClick={() => setActiveResultFilter(ft.id)}
                                    className={`h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                                        activeResultFilter === ft.id ? 'bg-[#0072BC] text-white keep-white-text' : 'text-[var(--app-muted)] hover:bg-[var(--app-surface)] dark:hover:bg-[#061C36]'
                                    }`}
                                >
                                    {ft.label}{ft.n > 0 ? ` (${ft.n})` : ''}
                                </button>
                            ))}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {trace && (
                                <button type="button" onClick={() => setShowGroundingTrace(!showGroundingTrace)} className={BTN_SECONDARY}>
                                    {showGroundingTrace ? 'Hide Trace' : 'Grounding Trace'}
                                </button>
                            )}
                            <button type="button" onClick={() => queue.queueMany(available, 'grounded')} disabled={available.length === 0} className={BTN_SECONDARY}>Select All ({available.length})</button>
                            <button type="button" onClick={() => queue.unqueueMany(filteredInsights)} className={BTN_SECONDARY}>Clear</button>
                        </div>
                    </div>

                    {showGroundingTrace && trace && (
                        <div className="p-3 rounded-xl border border-[var(--app-border)] dark:border-sky-500/20 bg-[var(--app-surface)] dark:bg-[#041527] space-y-2 text-[11px] font-mono">
                            {Array.isArray(trace.searchQueries) && trace.searchQueries.length > 0 && (
                                <div className="flex flex-wrap gap-1.5">
                                    {trace.searchQueries.map((q: string, idx: number) => (
                                        <span key={idx} className="px-2 py-0.5 rounded border border-[var(--app-border)] dark:border-sky-500/30 text-[var(--app-muted)]">&ldquo;{q}&rdquo;</span>
                                    ))}
                                </div>
                            )}
                            {Array.isArray(trace.rawGroundedLinks) && trace.rawGroundedLinks.length > 0 && (
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {trace.rawGroundedLinks.map((chunk: any, idx: number) => (
                                        <a key={idx} href={chunk?.uri || '#'} target="_blank" rel="noreferrer" className="block text-[#0072BC] dark:text-sky-400 hover:underline truncate">
                                            {chunk?.title || chunk?.uri || 'Grounded source'}
                                        </a>
                                    ))}
                                </div>
                            )}
                            {trace.rawResponseText && (
                                <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap text-[10px] text-[var(--app-muted)]">{trace.rawResponseText}</pre>
                            )}
                        </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                        {filteredInsights.map((item, idx) => (
                            <InsightCard key={`${item.url || item.id || item.title}-${idx}`} item={item} source="grounded" queue={queue} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
};
