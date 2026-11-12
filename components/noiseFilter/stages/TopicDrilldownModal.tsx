import React from 'react';
import { Quote, Search, Sparkles, X } from 'lucide-react';
import { EnrichedComment, getCommentYear } from '../../../services/noiseFilterService';
import { getCountryFlag } from '../languageAndGraphHelpers';

export interface TopicDrilldownModalProps {
    selectedTopic: string;
    activeTopicItem: {
        title: string;
        commentFrequency: number;
        frequencyPercentage: number;
        velocityChange: number;
        isBreakout: boolean;
        category: string;
        country: string;
        sentiment: string;
    };
    activeTopicComments: EnrichedComment[];
    availableDrilldownReleases: string[];
    drilldownSentimentFilter: 'ALL' | 'positive' | 'negative' | 'neutral';
    setDrilldownSentimentFilter: (s: 'ALL' | 'positive' | 'negative' | 'neutral') => void;
    drilldownReleaseFilter: string;
    setDrilldownReleaseFilter: (rel: string) => void;
    drilldownSourceFilter: string;
    setDrilldownSourceFilter: (src: string) => void;
    drilldownSearch: string;
    setDrilldownSearch: (q: string) => void;
    onClose: () => void;
}

export const TopicDrilldownModal: React.FC<TopicDrilldownModalProps> = ({
    selectedTopic,
    activeTopicItem,
    activeTopicComments,
    availableDrilldownReleases,
    drilldownSentimentFilter,
    setDrilldownSentimentFilter,
    drilldownReleaseFilter,
    setDrilldownReleaseFilter,
    drilldownSourceFilter,
    setDrilldownSourceFilter,
    drilldownSearch,
    setDrilldownSearch,
    onClose
}) => {
    return (
        <div
            className="fixed inset-0 z-[100] bg-zinc-300/35 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
            onClick={onClose}
        >
            <div
                id="noise-filter-topic-drilldown-panel"
                onClick={(e) => e.stopPropagation()}
                className="w-[96vw] max-w-[1600px] h-[90vh] bg-[var(--app-surface)] dark:bg-[#020F1D] border-2 border-zinc-400/50 dark:border-[#041E3A] ring-1 ring-white/20 dark:ring-[#041E3A] rounded-3xl shadow-[0_25px_90px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
            >
                <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4 border-b border-[var(--app-border)] dark:border-[#041E3A] bg-[var(--app-card)] dark:bg-[#041527] shrink-0">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-[#0077C8]/20 text-[#38bdf8] border border-[#349DD4]/40 font-mono uppercase tracking-wider">
                                Active Filter Focus
                            </span>
                            <span className="text-xs text-[var(--app-muted)] font-semibold font-mono">
                                {activeTopicItem.category || 'Customer Experience'}
                            </span>
                            {activeTopicItem.country && (
                                <span className="text-xs text-[var(--app-muted)] font-mono bg-[var(--app-surface)] border border-[var(--app-border)] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    {getCountryFlag(activeTopicItem.country).flag} {activeTopicItem.country}
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-[var(--app-text)] tracking-tight capitalize flex items-center gap-2">
                            <Quote size={20} className="text-[#0077C8]" />
                            {selectedTopic.includes(' ') ? selectedTopic : (selectedTopic.startsWith('#') ? selectedTopic : `#${selectedTopic}`)}
                        </h3>
                        <p className="text-xs text-[var(--app-muted)]">
                            Isolated customer critique quotes and constructive suggestions mined across community sources.
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-[var(--app-surface)] text-[var(--app-muted)] hover:text-[var(--app-text)] border border-[var(--app-border)] transition-all cursor-pointer"
                            title="Close Drilldown"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-[var(--app-surface)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Comment Volume</span>
                            <span className="text-base font-black text-[var(--app-text)] font-mono">
                                {activeTopicItem.commentFrequency.toLocaleString()} Mentions
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Velocity Change</span>
                            <span className={`text-base font-black font-mono ${activeTopicItem.velocityChange >= 0 ? 'text-emerald-600' : 'text-[var(--app-muted)]'}`}>
                                {activeTopicItem.velocityChange >= 0 ? `+${activeTopicItem.velocityChange}%` : `${activeTopicItem.velocityChange}%`}
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Horizon Scope</span>
                            <span className="text-xs font-bold text-[#38bdf8] font-mono">
                                Baseline → Prior → Current
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Corpus Evidence</span>
                            <span className="text-base font-black text-[#38bdf8] font-mono">
                                {activeTopicComments.length} Signal Quotes
                            </span>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                        <div className="flex flex-wrap items-center gap-2">
                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-text)] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs">
                                {['ALL', 'positive', 'negative', 'neutral'].map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => setDrilldownSentimentFilter(s as any)}
                                        className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                                            drilldownSentimentFilter === s
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1A222E] font-semibold'
                                        }`}
                                    >
                                        {s === 'ALL' ? 'All Sentiments' : s}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-text)] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs">
                                {(availableDrilldownReleases || []).map((rel) => (
                                    <button
                                        key={rel}
                                        onClick={() => setDrilldownReleaseFilter(rel)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            drilldownReleaseFilter === rel
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1A222E] font-semibold'
                                        }`}
                                    >
                                        {rel === 'ALL' ? 'All Horizons' : rel}
                                    </button>
                                ))}
                            </div>

                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-text)] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs flex-wrap">
                                {[
                                    { id: 'ALL', label: 'All Sources' },
                                    { id: 'youtube', label: '💬 YouTube' },
                                    { id: 'reviews', label: '⭐ Reviews' },
                                    { id: 'metacritic', label: '🏆 Metacritic (All)' },
                                    { id: 'metacritic_critic', label: '🏅 Critic (/critic-reviews/)' },
                                    { id: 'metacritic_user', label: '👤 User (/user-reviews/)' },
                                    { id: 'reddit', label: '🧵 Reddit' }
                                ].map((src) => (
                                    <button
                                        key={src.id}
                                        onClick={() => setDrilldownSourceFilter(src.id)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            drilldownSourceFilter === src.id
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1A222E] font-semibold'
                                        }`}
                                    >
                                        {src.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        <div className="relative">
                            <Search size={12} className="absolute left-3 top-2 text-[var(--app-muted)]" />
                            <input
                                type="text"
                                placeholder="Search comments..."
                                value={drilldownSearch}
                                onChange={(e) => setDrilldownSearch(e.target.value)}
                                className="pl-7 pr-3 py-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:border-[#0077C8] w-48"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {activeTopicComments.length > 0 ? (
                            (activeTopicComments || []).map((c, idx) => {
                                const isPos = c.sentiment === 'positive';
                                const isNeg = c.sentiment === 'negative';
                                const sLower = (c.source || '').toLowerCase();
                                const rType = String((c as any).reviewType || '').toLowerCase();
                                const isMcCritic = rType === 'critic' || sLower.includes('metacritic critic');
                                const isMcUser = rType === 'user' || sLower.includes('metacritic user');
                                const mcScore = (c as any).score;
                                const isYouTube = sLower.includes('youtube');
                                const isReddit = sLower.includes('reddit');
                                const isMetacritic = sLower.includes('metacritic');
                                const isReview = sLower.includes('review') || sLower.includes('customer') || sLower.includes('trustpilot') || sLower.includes('store') || sLower.includes('steam');

                                return (
                                    <div
                                        key={c.id || idx}
                                        className="p-4 rounded-2xl bg-[var(--app-surface)] text-[var(--app-text)] border border-[var(--app-border)] hover:border-[var(--app-border)] transition-all space-y-3 shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-xs font-bold text-[var(--app-text)]">
                                                    {c.author || 'Customer Feedback'}
                                                </span>
                                                {isMcCritic && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-700/60">
                                                        🏅 Critic{typeof mcScore === 'number' ? ` · ${mcScore}/100` : ''}
                                                    </span>
                                                )}
                                                {isMcUser && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-300 border border-cyan-700/60">
                                                        👤 User{typeof mcScore === 'number' ? ` · ${mcScore}/10` : ''}
                                                    </span>
                                                )}
                                                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                                                    isYouTube ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' :
                                                    isMetacritic ? 'bg-amber-50 text-amber-700 border-amber-200 font-bold' :
                                                    isReddit ? 'bg-orange-950/40 text-orange-300 border-orange-800/60 font-medium' :
                                                    isReview ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' :
                                                    'bg-[var(--app-surface)] text-[var(--app-muted)] border-[var(--app-border)]'
                                                }`}>
                                                    {c.source || 'Cross-Platform'}
                                                </span>
                                                <span className="text-[10px] font-mono text-[#0077C8] bg-[#0077C8]/10 border border-[#349DD4]/30 px-1.5 py-0.5 rounded font-bold">
                                                    {getCommentYear(c)}
                                                </span>
                                            </div>

                                            <span className={`text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full ${
                                                isPos ? 'bg-emerald-500/15 text-emerald-600 border border-emerald-500/30' :
                                                isNeg ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30' :
                                                'bg-sky-500/15 text-sky-700 border border-sky-400/30'
                                            }`}>
                                                {c.sentiment === 'positive' ? 'Working Well' : c.sentiment === 'negative' ? 'Needs Attention' : 'Neutral'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-[var(--app-muted)] leading-relaxed font-medium italic bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)]">
                                            "{c.rawText}"
                                        </p>

                                        {c.actionableSuggestion && (
                                            <div className="text-[11px] text-[#38bdf8] bg-[#0077C8]/10 border border-[#349DD4]/20 p-2.5 rounded-xl font-mono flex items-start gap-1.5">
                                                <Sparkles size={12} className="shrink-0 mt-0.5 text-[#38bdf8]" />
                                                <span><strong>Mandate:</strong> {c.actionableSuggestion}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] text-[var(--app-muted)] font-mono pt-1">
                                            <span>{c.timestamp || 'Recent feedback'}</span>
                                            {c.country && (
                                                <span>{getCountryFlag(c.country, c.rawText || (c as any).text || '').flag} {getCountryFlag(c.country, c.rawText || (c as any).text || '').label}</span>
                                            )}
                                        </div>
                                    </div>
                                );
                            })
                        ) : (
                            <div className="col-span-2 text-center py-8 text-[var(--app-muted)] text-xs font-mono">
                                No comments matching the active filters. Try clearing or expanding your criteria.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
