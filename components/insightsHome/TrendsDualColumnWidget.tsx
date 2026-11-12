import React from 'react';
import {
    ArrowUpRight,
    ArrowDownRight,
    ChevronRight,
    Search,
    Globe,
    Calendar,
    RefreshCw,
    Info,
    ExternalLink,
    PlayCircle,
    MessageSquare
} from 'lucide-react';
import { TopicItem, getCountryFlag } from './insightsHomeCache';
import { TimeRangeOption } from './useTopicDrilldownFilter';

const ColumnHeaderTooltip: React.FC<{
    title: string;
    description: string;
    children: React.ReactNode;
    align?: 'left' | 'center' | 'right';
}> = ({ title, description, children, align = 'left' }) => (
    <div className="relative group/tip inline-flex items-center gap-1 cursor-help">
        <span>{children}</span>
        <Info size={11} className="text-[var(--app-muted)] group-hover/tip:text-[#38bdf8] transition-colors" />
        <div className={`absolute bottom-full mb-2.5 hidden group-hover/tip:flex flex-col w-64 p-3 bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100 border border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl shadow-2xl z-50 pointer-events-none text-left normal-case font-sans ${
            align === 'right' ? 'right-0' : align === 'center' ? 'left-1/2 -translate-x-1/2' : 'left-0'
        }`}>
            <span className="text-[11px] font-black text-[#38bdf8] font-mono flex items-center gap-1.5 mb-1">
                <Info size={12} className="text-[#38bdf8]" /> {title}
            </span>
            <p className="text-[11px] text-[var(--app-muted)] dark:text-slate-300 font-normal leading-relaxed">
                {description}
            </p>
            <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 border-4 border-transparent border-t-zinc-950 dark:border-t-[#041E3A]" />
        </div>
    </div>
);

/** Clickable provenance badge: links a topic to the real video or social post behind it. */
export const TopicSourceBadge: React.FC<{ topic: TopicItem }> = ({ topic }) => {
    const primaryUrl = topic.videoUrl || topic.sourceUrl;
    if (!primaryUrl || !/^https?:\/\//i.test(primaryUrl)) return null;
    const isVideo = Boolean(topic.videoUrl);
    const label = topic.sourceUrls?.find(r => r.url === primaryUrl)?.title || topic.sourceTitle || (isVideo ? 'Source video' : 'Source post');
    const extra = (topic.sourceUrls?.length || 0) - 1;
    return (
        <>
            <a
                href={primaryUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={(e) => e.stopPropagation()}
                title={`Open source: ${label}`}
                data-testid="topic-source-link"
                className="inline-flex items-center gap-1 min-w-0 max-w-[190px] text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border border-[#349DD4]/40 bg-[#0077C8]/10 text-[#0077C8] dark:text-[#38bdf8] hover:bg-[#0077C8]/20 hover:underline"
            >
                {isVideo ? <PlayCircle size={10} className="shrink-0" /> : <MessageSquare size={10} className="shrink-0" />}
                <span className="truncate">{label}</span>
                <ExternalLink size={10} className="shrink-0" />
            </a>
            {extra > 0 && (
                <span className="text-[10px] font-mono text-[var(--app-muted)] shrink-0" title={`${extra + 1} distinct sources back this topic`}>
                    +{extra} sources
                </span>
            )}
        </>
    );
};

interface TrendsDualColumnWidgetProps {
    region: string;
    onRegionChange: (region: string) => void;
    timeRange: TimeRangeOption;
    onTimeRangeChange: (range: TimeRangeOption) => void;
    searchQuery: string;
    onSearchQueryChange: (query: string) => void;
    isLoading: boolean;
    onRefresh: () => void;
    filteredTopTopics: TopicItem[];
    filteredRisingTopics: TopicItem[];
    selectedTopic: string | null;
    onTopicClick: (topicTitle: string) => void;
    onNavigateToTab?: (tabName: 'listen' | 'filter' | 'topic_graph' | 'topic_trajectory' | 'ad_opportunities' | 'summarize') => void;
}

export const TrendsDualColumnWidget: React.FC<TrendsDualColumnWidgetProps> = ({
    region,
    onRegionChange,
    timeRange,
    onTimeRangeChange,
    searchQuery,
    onSearchQueryChange,
    isLoading,
    onRefresh,
    filteredTopTopics,
    filteredRisingTopics,
    selectedTopic,
    onTopicClick,
    onNavigateToTab
}) => {
    const renderLoadingSkeleton = () => (
        <div className="space-y-3 py-2 animate-pulse">
            <div className="flex items-center justify-center gap-2 py-2 text-xs font-mono text-[var(--app-muted)]">
                <RefreshCw size={13} className="animate-spin text-[#38bdf8]" />
                <span>Loading...</span>
            </div>
            {[...Array(5)].map((_, i) => (
                <div key={i} className="grid grid-cols-12 items-center p-3.5 rounded-2xl bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)] gap-3">
                    <div className="col-span-6 flex items-center gap-3">
                        <div className="w-5 h-4 bg-[var(--app-surface)] text-[var(--app-muted)] rounded"></div>
                        <div className="space-y-1.5 flex-1">
                            <div className="h-3.5 bg-[var(--app-surface)] text-[var(--app-muted)] rounded w-3/4"></div>
                            <div className="h-2.5 bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)] rounded w-1/2"></div>
                        </div>
                    </div>
                    <div className="col-span-4 space-y-1.5 px-2">
                        <div className="h-2.5 bg-[var(--app-surface)] text-[var(--app-muted)] rounded w-1/3"></div>
                        <div className="h-1.5 bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)] rounded-full w-full"></div>
                    </div>
                    <div className="col-span-2 flex justify-end">
                        <div className="h-4 bg-[var(--app-surface)] text-[var(--app-muted)] rounded w-12"></div>
                    </div>
                </div>
            ))}
        </div>
    );

    const renderTopicRow = (topic: TopicItem, isRising: boolean) => {
        const isPositive = topic.velocityChange >= 0;
        const isSelected = selectedTopic === topic.title;
        const countryMeta = topic.country ? getCountryFlag(topic.country, topic.title) : null;

        return (
            <div
                key={topic.id}
                onClick={() => onTopicClick(topic.title)}
                className={`grid grid-cols-12 items-center p-3 rounded-2xl border transition-all cursor-pointer group ${
                    isSelected
                        ? 'bg-blue-50 dark:bg-[#041E3A] border-blue-500/80 dark:border-[#38BDF8] shadow-[0_0_20px_rgba(52,157,212,0.3)] ring-1 ring-[#349DD4]'
                        : 'bg-[var(--app-surface)] dark:bg-[#061C36] border-[var(--app-border)] dark:border-[#041E3A] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] hover:border-[#349DD4]/40 dark:hover:border-[#0A2B52]'
                }`}
            >
                <div className="col-span-6 flex items-center gap-3 min-w-0 pr-2">
                    <span className={`w-5 text-center text-xs font-mono font-bold ${isSelected ? 'text-[#38bdf8]' : 'text-[var(--app-muted)] group-hover:text-[#38bdf8]'}`}>
                        {topic.rank}
                    </span>
                    <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                            <p className={`text-xs font-bold truncate group-hover:underline ${isSelected ? 'text-[var(--app-text)] font-black' : 'text-[var(--app-text)] group-hover:text-[var(--app-text)]'}`}>
                                {topic.title}
                            </p>
                            {countryMeta && (
                                <span className="text-[10px] text-[var(--app-muted)] font-mono shrink-0 bg-[var(--app-surface)] border border-[var(--app-border)] px-1 rounded" title={countryMeta.label}>
                                    {countryMeta.flag} {countryMeta.label}
                                </span>
                            )}
                        </div>
                        {(topic.category || topic.videoUrl || topic.sourceUrl) && (
                            <div className="flex items-center gap-1.5 min-w-0">
                                {topic.category && (
                                    <span className="text-[10px] text-[var(--app-muted)] font-mono block truncate">
                                        {topic.category}
                                    </span>
                                )}
                                <TopicSourceBadge topic={topic} />
                            </div>
                        )}
                    </div>
                </div>

                <div className="col-span-4 px-2 flex flex-col justify-center">
                    <div className="flex justify-between items-center text-[10px] font-mono text-[var(--app-muted)] font-bold mb-1">
                        <span className="text-[var(--app-text)]">
                            {topic.commentFrequency.toLocaleString()}{isRising ? ' Mentions' : ''}
                        </span>
                        <span className="text-[var(--app-muted)] font-bold">{topic.frequencyPercentage}%</span>
                    </div>
                    <div className="w-full bg-[var(--app-surface)] dark:bg-[#020F1D] rounded-full h-1.5 overflow-hidden flex items-center">
                        <div
                            className={`${isRising ? 'bg-[#FF7A00] group-hover:bg-[#ff9433]' : 'bg-[#0077C8] group-hover:bg-[#38bdf8]'} h-full rounded-full transition-all duration-500`}
                            style={{ width: `${topic.frequencyPercentage}%` }}
                        />
                    </div>
                </div>

                <div className="col-span-2 text-right flex items-center justify-end gap-1 font-mono text-xs font-bold">
                    {isPositive ? (
                        <span className="text-emerald-600 flex items-center">
                            <ArrowUpRight size={13} />
                            +{topic.velocityChange}%
                        </span>
                    ) : (
                        <span className="text-[var(--app-muted)] flex items-center">
                            <ArrowDownRight size={13} />
                            {topic.velocityChange}%
                        </span>
                    )}
                </div>
            </div>
        );
    };

    return (
        <>
            {/* GOOGLE TRENDS TOP CONTROL BAR */}
            <div className="bg-[var(--app-card)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl p-4 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar max-w-full">
                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] text-xs font-bold text-[var(--app-text)] dark:text-slate-100 shrink-0">
                        <Globe size={13} className="text-[#38bdf8] shrink-0" />
                        <select
                            value={region}
                            onChange={(e) => onRegionChange(e.target.value)}
                            className="bg-transparent text-[var(--app-text)] dark:text-slate-100 font-bold cursor-pointer focus:outline-none"
                        >
                            <option value="US" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">United States</option>
                            <option value="GLOBAL" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Global (Worldwide)</option>
                            <option value="UK" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">United Kingdom</option>
                            <option value="DE" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Germany</option>
                            <option value="JP" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Japan</option>
                        </select>
                    </div>

                    <div className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] text-xs font-bold text-[var(--app-text)] dark:text-slate-100 shrink-0">
                        <Calendar size={13} className="text-[#00F0FF] shrink-0" />
                        <select
                            value={timeRange}
                            onChange={(e) => onTimeRangeChange(e.target.value as TimeRangeOption)}
                            className="bg-transparent text-[var(--app-text)] dark:text-slate-100 font-bold cursor-pointer focus:outline-none"
                        >
                            <option value="all" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">All time</option>
                            <option value="24h" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Past 24 hours</option>
                            <option value="7d" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Past 7 days</option>
                            <option value="30d" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Past 30 days</option>
                            <option value="90d" className="bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100">Past 90 days</option>
                        </select>
                    </div>
                </div>

                <div className="flex flex-row items-center gap-2 flex-nowrap w-full sm:w-auto">
                    <div className="relative flex-1 min-w-0 sm:w-48">
                        <Search size={13} className="absolute left-3 top-2.5 text-[var(--app-muted)]" />
                        <input
                            type="text"
                            placeholder="Filter topics..."
                            value={searchQuery}
                            onChange={(e) => onSearchQueryChange(e.target.value)}
                            className="w-full pl-8 pr-3 py-1.5 bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl text-xs text-[var(--app-text)] dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:border-[#349DD4]"
                        />
                    </div>
                    <button
                        type="button"
                        onClick={onRefresh}
                        disabled={isLoading}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] text-[var(--app-text)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl text-xs font-bold transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        title="Refresh Trends"
                    >
                        <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#38bdf8]' : 'text-[var(--app-muted)]'} />
                        <span>Refresh</span>
                    </button>
                </div>
            </div>

            {/* GOOGLE TRENDS 2-COLUMN WIDGET */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* LEFT COLUMN: TOP TOPICS */}
                <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-4 hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition-all">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
                        <h3 className="text-base font-black text-[var(--app-text)] tracking-tight flex items-center gap-2 whitespace-nowrap">
                            Top topics
                        </h3>
                        <button
                            type="button"
                            onClick={() => onNavigateToTab && onNavigateToTab('filter')}
                            className="text-xs font-bold text-[#38bdf8] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                            Open Filter Pipeline Stage 3 <ChevronRight size={13} />
                        </button>
                    </div>

                    <div className="grid grid-cols-12 text-[11px] font-bold text-[var(--app-muted)] uppercase tracking-wider px-3 py-1.5 font-mono border-b border-[var(--app-border)] pb-2">
                        <div className="col-span-6 flex items-center">
                            <ColumnHeaderTooltip
                                title="Extracted Community Topic"
                                description="Granular features, issues, or themes discovered directly from customer feedback and tagged with the primary geographic region."
                                align="left"
                            >
                                Topic
                            </ColumnHeaderTooltip>
                        </div>
                        <div className="col-span-4 flex justify-center items-center">
                            <ColumnHeaderTooltip
                                title="Comment Signal Frequency"
                                description="Total count of constructive, non-noise customer comments for this topic across YouTube, Reddit, and store reviews. The percentage bar measures volume share relative to the #1 top-ranked topic (100% max corpus baseline)."
                                align="center"
                            >
                                Comment Frequency
                            </ColumnHeaderTooltip>
                        </div>
                        <div className="col-span-2 flex justify-end items-center">
                            <ColumnHeaderTooltip
                                title="Momentum Delta (% Change)"
                                description="Rate of change comparing live feedback (current/next period) against the historical baseline of previous cycles."
                                align="right"
                            >
                                Change
                            </ColumnHeaderTooltip>
                        </div>
                    </div>

                    <div className="space-y-1.5 min-h-[360px]">
                        {isLoading ? (
                            renderLoadingSkeleton()
                        ) : filteredTopTopics.length === 0 ? (
                            <div className="p-12 text-center text-[var(--app-muted)] text-xs font-mono">
                                {searchQuery.trim().length > 0
                                    ? 'No topics found matching search criteria.'
                                    : 'No GCS topic snapshots yet — connect GCS and add sources in Filter Pipeline.'}
                            </div>
                        ) : (
                            filteredTopTopics.map(topic => renderTopicRow(topic, false))
                        )}
                    </div>
                </div>

                {/* RIGHT COLUMN: RISING TOPICS */}
                <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-4 hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition-all">
                    <div className="flex items-center justify-between gap-2 pb-3 border-b border-[var(--app-border)]">
                        <h3 className="text-base font-black text-[var(--app-text)] tracking-tight flex items-center gap-2 whitespace-nowrap">
                            Rising topics
                        </h3>
                        <button
                            type="button"
                            onClick={() => onNavigateToTab && onNavigateToTab('filter')}
                            className="text-xs font-bold text-[#38bdf8] hover:underline flex items-center gap-1 whitespace-nowrap shrink-0 cursor-pointer"
                        >
                            Explore in Filter Pipeline <ChevronRight size={13} />
                        </button>
                    </div>

                    <div className="grid grid-cols-12 text-[11px] font-bold text-[var(--app-muted)] uppercase tracking-wider px-3 py-1.5 font-mono border-b border-[var(--app-border)] pb-2">
                        <div className="col-span-6 flex items-center">
                            <ColumnHeaderTooltip
                                title="Fastest Growing Community Topics"
                                description="Topics exhibiting rapid discussion spikes across live feedback channels over the recent 7-day period."
                                align="left"
                            >
                                Topic
                            </ColumnHeaderTooltip>
                        </div>
                        <div className="col-span-4 flex justify-center items-center">
                            <ColumnHeaderTooltip
                                title="Comment Signal Frequency"
                                description="Total count of constructive, non-noise customer comments for this topic across YouTube, reviews, and Reddit. The percentage bar measures volume share relative to the #1 top-ranked topic baseline."
                                align="center"
                            >
                                Comment Frequency
                            </ColumnHeaderTooltip>
                        </div>
                        <div className="col-span-2 flex justify-end items-center">
                            <ColumnHeaderTooltip
                                title="Surge Velocity (% Change)"
                                description="Momentum spike rate over the recent period compared to baseline community volume."
                                align="right"
                            >
                                Change
                            </ColumnHeaderTooltip>
                        </div>
                    </div>

                    <div className="space-y-1.5 min-h-[360px]">
                        {isLoading ? (
                            renderLoadingSkeleton()
                        ) : filteredRisingTopics.length === 0 ? (
                            <div className="p-12 text-center text-[var(--app-muted)] text-xs font-mono">
                                {searchQuery.trim().length > 0
                                    ? 'No rising topics found matching search criteria.'
                                    : 'No GCS topic snapshots yet — connect GCS and add sources in Filter Pipeline.'}
                            </div>
                        ) : (
                            filteredRisingTopics.map(topic => renderTopicRow(topic, true))
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
