import React from 'react';
import {
    Sparkles,
    ChevronRight,
    Search,
    X,
    Quote,
    ExternalLink,
    PlayCircle,
    MessageSquare
} from 'lucide-react';
import { TopicItem, getCountryFlag } from './insightsHomeCache';
import { collectTopicSourceRefs } from '../../services/noiseFilter/stage3ClusterAggregator';

const isHttpUrl = (u: unknown): u is string => typeof u === 'string' && /^https?:\/\//i.test(u.trim());
const isVideoUrl = (u: string): boolean => /youtube\.com|youtu\.be|tiktok\.com/i.test(u);
import {
    SentimentFilterOption,
    ReleaseFilterOption,
    SourceFilterOption
} from './useTopicDrilldownFilter';

interface InsightsTopicEvidenceModalProps {
    selectedTopic: string;
    activeTopicItem: TopicItem;
    topicComments: any[];
    selectedSentimentFilter: SentimentFilterOption;
    onSelectSentimentFilter: (filter: SentimentFilterOption) => void;
    selectedReleaseFilter: ReleaseFilterOption;
    onSelectReleaseFilter: (filter: ReleaseFilterOption) => void;
    selectedSourceFilter: SourceFilterOption;
    onSelectSourceFilter: (filter: SourceFilterOption) => void;
    drilldownSearch: string;
    onDrilldownSearchChange: (search: string) => void;
    onClose: () => void;
    onNavigateToTopic?: (topicName: string) => void;
    onNavigateToTab?: (tabName: 'listen' | 'filter' | 'topic_graph' | 'topic_trajectory' | 'ad_opportunities' | 'summarize') => void;
}

export const InsightsTopicEvidenceModal: React.FC<InsightsTopicEvidenceModalProps> = ({
    selectedTopic,
    activeTopicItem,
    topicComments,
    selectedSentimentFilter,
    onSelectSentimentFilter,
    selectedReleaseFilter,
    onSelectReleaseFilter,
    selectedSourceFilter,
    onSelectSourceFilter,
    drilldownSearch,
    onDrilldownSearchChange,
    onClose,
    onNavigateToTopic,
    onNavigateToTab
}) => {
    const activeCountryMeta = activeTopicItem.country
        ? getCountryFlag(activeTopicItem.country, activeTopicItem.title)
        : null;
    const topicRefs = (activeTopicItem.sourceUrls?.length ? activeTopicItem.sourceUrls : collectTopicSourceRefs(topicComments))
        .filter(ref => isHttpUrl(ref?.url));

    return (
        <div
            className="fixed inset-0 z-[100] bg-zinc-300/35 dark:bg-black/80 backdrop-blur-md flex items-center justify-center p-3 sm:p-6 animate-fadeIn"
            onClick={onClose}
        >
            <div
                id="topic-drilldown-panel"
                onClick={(e) => e.stopPropagation()}
                className="w-[96vw] max-w-[1600px] h-[90vh] bg-[var(--app-surface)] dark:bg-[#020F1D] border-2 border-zinc-400/50 dark:border-[#041E3A] ring-1 ring-white/20 dark:ring-[#041E3A] rounded-3xl shadow-[0_25px_90px_rgba(0,0,0,0.85)] flex flex-col overflow-hidden"
            >
                {/* Sticky Modal Header with Title & Action Controls */}
                <div className="flex flex-wrap items-start justify-between gap-4 px-6 py-4 border-b border-[var(--app-border)] dark:border-[#041E3A] bg-[var(--app-card)] dark:bg-[#041527] shrink-0">
                    <div className="space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2.5 py-0.5 rounded-md text-[10px] font-black bg-blue-50 dark:bg-[#061C36] text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-[#041E3A] font-mono uppercase tracking-wider">
                                Active Filter Focus
                            </span>
                            <span className="text-xs text-[var(--app-muted)] font-semibold font-mono">
                                {activeTopicItem.category || 'General'}
                            </span>
                            {activeCountryMeta && (
                                <span className="text-xs text-[var(--app-muted)] font-mono bg-[var(--app-surface)] border border-[var(--app-border)] px-2 py-0.5 rounded-full flex items-center gap-1">
                                    {activeCountryMeta.flag} {activeCountryMeta.label}
                                </span>
                            )}
                        </div>
                        <h3 className="text-2xl font-black text-[var(--app-text)] tracking-tight capitalize flex items-center gap-2">
                            <Quote size={20} className="text-[#38bdf8]" />
                            {selectedTopic}
                        </h3>
                        <p className="text-xs text-[var(--app-muted)]">
                            Isolated customer critique quotes and constructive suggestions mined across YouTube, reviews, and Reddit.
                        </p>
                        {topicRefs.length > 0 && (
                            <div className="flex flex-wrap items-center gap-1.5 pt-1" data-testid="topic-source-pills">
                                {topicRefs.slice(0, 6).map(ref => (
                                    <a
                                        key={ref.url}
                                        href={ref.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={ref.url}
                                        className="inline-flex items-center gap-1 max-w-[260px] text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border border-[#349DD4]/40 bg-[#0077C8]/10 text-[#0077C8] dark:text-[#38bdf8] hover:bg-[#0077C8]/20 hover:underline"
                                    >
                                        {ref.videoId || isVideoUrl(ref.url) ? <PlayCircle size={11} className="shrink-0" /> : <MessageSquare size={11} className="shrink-0" />}
                                        <span className="shrink-0">{ref.source}</span>
                                        {ref.title && <span className="truncate font-medium">· {ref.title}</span>}
                                        <span className="shrink-0 text-[var(--app-muted)]">({ref.commentCount})</span>
                                        <ExternalLink size={10} className="shrink-0" />
                                    </a>
                                ))}
                                {topicRefs.length > 6 && (
                                    <span className="text-[10px] font-mono text-[var(--app-muted)]">+{topicRefs.length - 6} more</span>
                                )}
                            </div>
                        )}
                    </div>

                    <div className="flex items-center gap-2">
                        <button
                            onClick={() => {
                                if (onNavigateToTopic) {
                                    onNavigateToTopic(selectedTopic);
                                } else if (onNavigateToTab) {
                                    onNavigateToTab('filter');
                                }
                            }}
                            className="px-3.5 py-1.5 rounded-xl bg-[#0077C8] hover:bg-[#2689be] text-white text-xs font-bold transition-all flex items-center gap-1.5 shadow-md cursor-pointer"
                        >
                            Deep Dive in Filter Pipeline <ChevronRight size={14} />
                        </button>
                        <button
                            onClick={onClose}
                            className="p-2 rounded-xl bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] hover:text-[var(--app-text)] dark:hover:text-white transition-all cursor-pointer"
                            title="Close Drilldown"
                        >
                            <X size={18} />
                        </button>
                    </div>
                </div>

                {/* Scrollable Modal Body */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6 bg-[#F7F8FA] dark:bg-[#020F1D]">
                    {/* Telemetry Summary Bar */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-center">
                        <div className="p-3 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Comment Volume</span>
                            <span className="text-base font-black text-[var(--app-text)] font-mono">
                                {activeTopicItem.commentFrequency.toLocaleString()} Mentions
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Velocity Change</span>
                            <span className={`text-base font-black font-mono ${activeTopicItem.velocityChange >= 0 ? 'text-emerald-600' : 'text-[var(--app-muted)]'}`}>
                                {activeTopicItem.velocityChange >= 0 ? `+${activeTopicItem.velocityChange}%` : `${activeTopicItem.velocityChange}%`}
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Release Scope</span>
                            <span className="text-xs font-bold text-[#38bdf8] font-mono">
                                2024 → 2025 → 2026
                            </span>
                        </div>
                        <div className="p-3 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl shadow-xs">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase font-mono block">Corpus Evidence</span>
                            <span className="text-base font-black text-[#38bdf8] font-mono">
                                {topicComments.length} Signal Quotes
                            </span>
                        </div>
                    </div>

                    {/* Inner Filter Chips & Search Bar */}
                    <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                        <div className="flex flex-wrap items-center gap-2">
                            {/* Sentiment Filter */}
                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] p-1 rounded-xl text-xs">
                                {(['ALL', 'positive', 'negative', 'neutral'] as SentimentFilterOption[]).map((s) => (
                                    <button
                                        key={s}
                                        onClick={() => onSelectSentimentFilter(s)}
                                        className={`px-2.5 py-1 rounded-lg font-bold capitalize transition-all cursor-pointer ${
                                            selectedSentimentFilter === s
                                                ? s === 'neutral'
                                                    ? 'bg-sky-500/20 text-sky-700 dark:text-sky-300 border border-sky-400/40 shadow-xs'
                                                    : s === 'negative'
                                                    ? 'bg-yellow-500/20 text-yellow-700 dark:text-yellow-300 border border-yellow-400/40 shadow-xs'
                                                    : 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : s === 'neutral'
                                                ? 'text-sky-600 dark:text-sky-300 hover:text-sky-700 dark:hover:bg-[#1A222E]'
                                                : s === 'negative'
                                                ? 'text-yellow-600 dark:text-yellow-300 hover:text-yellow-700 dark:hover:bg-[#1A222E]'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                        }`}
                                    >
                                        {s === 'ALL' ? 'All Sentiments' : s}
                                    </button>
                                ))}
                            </div>

                            {/* Release Year Filter */}
                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] p-1 rounded-xl text-xs">
                                {(['ALL', '2024', '2025', '2026', '2027'] as ReleaseFilterOption[]).map((rel) => (
                                    <button
                                        key={rel}
                                        onClick={() => onSelectReleaseFilter(rel)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            selectedReleaseFilter === rel
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                        }`}
                                    >
                                        {rel === 'ALL' ? 'All Years' : rel}
                                    </button>
                                ))}
                            </div>

                            {/* Source Channel Filter */}
                            <div className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] p-1 rounded-xl text-xs">
                                {[
                                    { id: 'ALL' as SourceFilterOption, label: 'All Sources' },
                                    { id: 'youtube' as SourceFilterOption, label: '💬 YouTube' },
                                    { id: 'reviews' as SourceFilterOption, label: '⭐ Reviews' },
                                    { id: 'reddit' as SourceFilterOption, label: '🧵 Reddit' }
                                ].map((src) => (
                                    <button
                                        key={src.id}
                                        onClick={() => onSelectSourceFilter(src.id)}
                                        className={`px-2.5 py-1 rounded-lg font-bold transition-all cursor-pointer ${
                                            selectedSourceFilter === src.id
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                        }`}
                                    >
                                        {src.label}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Search Inside Evidence */}
                        <div className="relative">
                            <Search size={12} className="absolute left-3 top-2 text-[var(--app-muted)]" />
                            <input
                                type="text"
                                placeholder="Search comments..."
                                value={drilldownSearch}
                                onChange={(e) => onDrilldownSearchChange(e.target.value)}
                                className="pl-7 pr-3 py-1 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:border-[#349DD4] w-48"
                            />
                        </div>
                    </div>

                    {/* Isolated Customer Comments Evidence Feed Grid */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {topicComments.length > 0 ? (
                            topicComments.map((c, idx) => {
                                const isPos = c.sentiment === 'positive';
                                const isNeg = c.sentiment === 'negative';
                                const sLower = (c.source || '').toLowerCase();
                                const isYouTube = sLower.includes('youtube');
                                const isReddit = sLower.includes('reddit');
                                const isReview = sLower.includes('review') || sLower.includes('customer') || sLower.includes('trustpilot') || sLower.includes('store') || sLower.includes('steam');
                                const commentUrl = [c.videoUrl, c.sourceUrl, c.subpageUrl].find(isHttpUrl);
                                const isVideoLink = Boolean(commentUrl) && (isHttpUrl(c.videoUrl) || isVideoUrl(commentUrl!));
                                const langMeta = (c.country || c.language || c.rawText)
                                    ? getCountryFlag(c.country || c.language, c.rawText || c.text || c.comment || '')
                                    : null;

                                return (
                                    <div
                                        key={c.id || idx}
                                        className="p-4 rounded-2xl bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition-all space-y-3 shadow-md"
                                    >
                                        <div className="flex items-start justify-between gap-2">
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-[var(--app-text)]">
                                                    {c.author || 'Customer Feedback'}
                                                </span>
                                                <span className={`text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border ${
                                                    isYouTube ? 'bg-rose-50 text-rose-700 border-rose-200 font-bold' :
                                                    isReddit ? 'bg-orange-950/40 text-orange-300 border-orange-800/50 font-medium' :
                                                    isReview ? 'bg-emerald-50 text-emerald-700 border-emerald-200 font-bold' :
                                                    'bg-[var(--app-surface)] text-[var(--app-muted)] border-[var(--app-border)]'
                                                }`}>
                                                    {c.source || 'Cross-Platform'}
                                                </span>
                                                <span className="text-[10px] font-mono text-[#38bdf8] bg-[#0077C8]/15 border border-[#349DD4]/40 px-1.5 py-0.5 rounded font-bold">
                                                    {c.release || '2026'}
                                                </span>
                                            </div>

                                            <span className={`text-[10px] font-bold uppercase font-mono px-2 py-0.5 rounded-full ${
                                                isPos ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                isNeg ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30' :
                                                'bg-sky-500/15 text-sky-700 border border-sky-400/30'
                                            }`}>
                                                {c.sentiment === 'positive' ? 'Working Well' : c.sentiment === 'negative' ? 'Needs Attention' : 'Neutral'}
                                            </span>
                                        </div>

                                        <p className="text-xs text-[var(--app-text)] dark:text-slate-100 leading-relaxed font-medium italic bg-[var(--app-card)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] p-3 rounded-xl">
                                            "{c.rawText}"
                                        </p>

                                        {commentUrl && (
                                            <a
                                                href={commentUrl}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                data-testid="comment-source-link"
                                                className="inline-flex items-center gap-1 max-w-full text-[11px] font-mono font-bold text-[#0077C8] dark:text-[#38bdf8] hover:underline"
                                            >
                                                {isVideoLink ? <PlayCircle size={12} className="shrink-0" /> : <MessageSquare size={12} className="shrink-0" />}
                                                <span className="shrink-0">{isVideoLink ? 'Watch Video ↗' : 'View Source ↗'}</span>
                                                <span className="truncate font-medium text-[var(--app-muted)]">{c.videoTitle || c.sourceLabel || c.source}</span>
                                            </a>
                                        )}

                                        {c.actionableSuggestion && (
                                            <div className="text-[11px] text-[#38bdf8] bg-[#0077C8]/15 border border-[#349DD4]/30 p-2.5 rounded-xl font-mono flex items-start gap-1.5">
                                                <Sparkles size={12} className="shrink-0 mt-0.5 text-[#38bdf8]" />
                                                <span><strong>Mandate:</strong> {c.actionableSuggestion}</span>
                                            </div>
                                        )}

                                        <div className="flex items-center justify-between text-[10px] text-[var(--app-muted)] font-mono pt-1">
                                            <span>{c.timestamp || 'Recent feedback'}</span>
                                            {langMeta && (
                                                <span>
                                                    {langMeta.flag} {langMeta.label}
                                                </span>
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
