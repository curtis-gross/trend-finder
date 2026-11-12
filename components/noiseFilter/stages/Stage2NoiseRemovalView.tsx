import React from 'react';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip } from 'recharts';
import { ArrowRight, CheckCircle2, ChevronDown, ChevronUp, Clock, EyeOff, Filter, Search } from 'lucide-react';
import { Stage2FilteredResult, FilteredComment, formatCommentTimestamp, getCommentYear } from '../../../services/noiseFilterService';
import { getCountryFlag } from '../languageAndGraphHelpers';
import { STAGE2_PREVIEW_LIMIT } from '../useStageChartMemos';

export interface Stage2NoiseRemovalViewProps {
    isDark: boolean;
    rawCommentsCount: number;
    stage2Data: Stage2FilteredResult | null;
    stage2PieData: any[];
    stage2NoiseReasons: any[];
    hoveredPieIndex: number | null;
    setHoveredPieIndex: (idx: number | null) => void;
    availableStage2Releases: string[];
    stage2ReleaseFilter: string;
    setStage2ReleaseFilter: (rel: string) => void;
    stage2SourceFilter: string;
    setStage2SourceFilter: (src: string) => void;
    stage2SearchQuery: string;
    setStage2SearchQuery: (q: string) => void;
    stage1Analytics: any;
    filteredRetainedComments: FilteredComment[];
    displayedRetainedComments: FilteredComment[];
    stage2ShowAllSignal: boolean;
    setStage2ShowAllSignal: React.Dispatch<React.SetStateAction<boolean>>;
    filteredNoiseComments: FilteredComment[];
    displayedNoiseComments: FilteredComment[];
    stage2ShowAllNoise: boolean;
    setStage2ShowAllNoise: React.Dispatch<React.SetStateAction<boolean>>;
    onProceedToStage3: () => void;
}

export const Stage2NoiseRemovalView: React.FC<Stage2NoiseRemovalViewProps> = ({
    isDark, rawCommentsCount, stage2Data, stage2PieData, stage2NoiseReasons,
    hoveredPieIndex, setHoveredPieIndex, availableStage2Releases,
    stage2ReleaseFilter, setStage2ReleaseFilter, stage2SourceFilter, setStage2SourceFilter,
    stage2SearchQuery, setStage2SearchQuery, stage1Analytics,
    filteredRetainedComments, displayedRetainedComments, stage2ShowAllSignal, setStage2ShowAllSignal,
    filteredNoiseComments, displayedNoiseComments, stage2ShowAllNoise, setStage2ShowAllNoise,
    onProceedToStage3
}) => {
    return (
        <div className="space-y-6 animate-fadeIn">
            {stage2Data && (
                <div className="bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] p-6 shadow-xs space-y-6">
                    <div className="text-center max-w-xl mx-auto pb-2">
                        <h3 className="text-xl font-black text-[var(--app-text)] tracking-tight">
                            Noise vs. Signal Breakdown
                        </h3>
                    </div>

                    <div className="flex flex-col items-center justify-center pt-1">
                        <div className="h-56 w-full max-w-sm min-w-0 min-h-[200px] relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={200} initialDimension={{ width: 520, height: 220 }}>
                                <PieChart>
                                    <Pie
                                        data={stage2PieData || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={60}
                                        outerRadius={88}
                                        paddingAngle={5}
                                        dataKey="value"
                                        nameKey="name"
                                        onMouseEnter={(_, index) => setHoveredPieIndex(index)}
                                        onMouseLeave={() => setHoveredPieIndex(null)}
                                        cursor="pointer"
                                    >
                                        {(stage2PieData || []).map((entry, index) => (
                                            <Cell
                                                key={`cell-${index}`}
                                                fill={entry.color}
                                                fillOpacity={hoveredPieIndex === null || hoveredPieIndex === index ? 1 : 0.6}
                                                stroke={hoveredPieIndex === index ? '#0077C8' : (isDark ? '#041E3A' : '#E2E8F0')}
                                                strokeWidth={hoveredPieIndex === index ? 3 : 1}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                        content={({ active, payload }: any) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                return (
                                                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-3.5 py-2.5 shadow-2xl text-[var(--app-text)] font-mono text-xs z-50 pointer-events-none">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                                                            <span className="font-bold text-[var(--app-text)] text-[11px]">{data.name}</span>
                                                        </div>
                                                        <div className="text-sm font-black text-[var(--app-text)]">
                                                            {Number(data.value).toLocaleString()} comments <span className="text-xs text-[var(--app-muted)] font-medium">({data.percentage}%)</span>
                                                        </div>
                                                        {data.description && (
                                                            <p className="text-[10px] text-[var(--app-muted)] font-sans mt-1 max-w-[210px] leading-tight font-medium">
                                                                {data.description}
                                                            </p>
                                                        )}
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-2xl font-black text-rose-600 font-mono">
                                    {stage2Data.noisePercentage}%
                                </span>
                                <span className="text-[10px] text-[var(--app-muted)] uppercase font-mono tracking-wider font-bold">Noise Stripped</span>
                            </div>
                        </div>

                        <div className="flex flex-wrap items-center justify-center gap-4 mt-3">
                            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-emerald-50 border border-emerald-200 shadow-xs">
                                <div className="w-3.5 h-3.5 rounded-full bg-emerald-500 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase font-mono text-emerald-700 block">Actionable Signal Retained</span>
                                    <span className="text-base font-black text-[var(--app-text)] font-mono">
                                        {stage2Data.signalCount.toLocaleString()} <span className="text-xs text-[var(--app-muted)] font-semibold">({stage2Data.signalPercentage}%)</span>
                                    </span>
                                </div>
                            </div>

                            <div className="flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-rose-50 border border-rose-200 shadow-xs">
                                <div className="w-3.5 h-3.5 rounded-full bg-rose-500 shrink-0" />
                                <div>
                                    <span className="text-[10px] font-bold uppercase font-mono text-rose-700 block">Filtered Noise &amp; Spam</span>
                                    <span className="text-base font-black text-[var(--app-text)] font-mono">
                                        {stage2Data.noiseCount.toLocaleString()} <span className="text-xs text-[var(--app-muted)] font-semibold">({stage2Data.noisePercentage}%)</span>
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] space-y-4 max-w-4xl mx-auto w-full shadow-xs">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                            <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] flex items-center gap-1.5">
                                <EyeOff size={14} className="text-rose-600" /> Filtered Noise Classification Categories
                            </span>
                            <span className="text-[11px] font-mono text-[var(--app-muted)] font-semibold">
                                {stage2Data.noiseCount.toLocaleString()} Stripped Comments
                            </span>
                        </div>

                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {(stage2NoiseReasons || []).map((item, idx) => (
                                <div key={idx} className="p-3 bg-[var(--app-surface)] text-[var(--app-text)] rounded-xl border border-[var(--app-border)] space-y-1.5 shadow-xs">
                                    <div className="flex items-center justify-between text-xs">
                                        <span className="font-bold text-[var(--app-text)] text-[11px] truncate pr-2">{item.reason}</span>
                                        <span className="font-mono text-xs text-rose-700 font-bold shrink-0">
                                            {item.count.toLocaleString()} ({item.percentage}%)
                                        </span>
                                    </div>
                                    <div className="w-full h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-rose-500 rounded-full"
                                            style={{ width: `${item.percentage}%` }}
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {stage2Data ? (
                <div className="space-y-4">
                    <div className="bg-[var(--app-surface)] rounded-2xl text-[var(--app-text)] border border-[var(--app-border)] p-4 shadow-xs flex flex-row flex-wrap items-center justify-between gap-3 text-xs">
                        <div className="flex flex-row flex-wrap sm:flex-nowrap items-center gap-2 min-w-0 max-w-full">
                            <div className="flex flex-row items-center gap-1 bg-[var(--app-card)] p-1 rounded-xl border border-[var(--app-border)] overflow-x-auto no-scrollbar max-w-full">
                                {(availableStage2Releases || []).map((rel) => (
                                    <button
                                        key={rel}
                                        type="button"
                                        onClick={() => setStage2ReleaseFilter(rel)}
                                        className={`px-2.5 py-1 rounded-lg font-bold whitespace-nowrap shrink-0 transition-all cursor-pointer ${
                                            stage2ReleaseFilter === rel
                                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white keep-white-text font-black shadow-xs'
                                                : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-slate-200 dark:hover:bg-[#1A222E]'
                                        }`}
                                    >
                                        {rel === 'ALL' ? 'All Horizons' : rel}
                                    </button>
                                ))}
                            </div>

                            <select
                                value={stage2SourceFilter}
                                onChange={(e) => setStage2SourceFilter(e.target.value)}
                                className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-3 py-1.5 text-xs font-bold text-[var(--app-text)] focus:ring-2 focus:ring-[#0077C8]"
                            >
                                <option value="ALL">All Channels</option>
                                <option value="YouTube Comments">YouTube Comments</option>
                                <option value="Steam Reviews">Steam Reviews</option>
                                <option value="Metacritic">Metacritic Reviews (All {stage1Analytics?.metacriticTotal ?? 0})</option>
                                <option value="Metacritic Critic">Metacritic Critic (/critic-reviews/ • {stage1Analytics?.metacriticCriticCount ?? 0})</option>
                                <option value="Metacritic User">Metacritic User (/user-reviews/ • {stage1Analytics?.metacriticUserCount ?? 0})</option>
                                <option value="Reddit Discussion">Reddit Discussion</option>
                            </select>
                        </div>

                        <div className="relative">
                            <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" />
                            <input
                                type="text"
                                placeholder="Search filtered feedback..."
                                value={stage2SearchQuery}
                                onChange={(e) => setStage2SearchQuery(e.target.value)}
                                className="pl-8 pr-3 py-1.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-hidden focus:border-[#0077C8]"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[var(--app-surface)] rounded-3xl border border-emerald-200 p-6 text-[var(--app-text)] space-y-4 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-emerald-200">
                                <span className="text-xs font-black text-emerald-700 flex items-center gap-2 font-mono uppercase tracking-wider">
                                    <CheckCircle2 size={16} className="text-emerald-600" />
                                    Retained High-Signal Comments
                                </span>
                                <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full font-mono">
                                    {stage2ShowAllSignal
                                        ? `All ${filteredRetainedComments.length} Comments (${stage2Data.signalCount} Total)`
                                        : `Showing Top ${Math.min(STAGE2_PREVIEW_LIMIT, filteredRetainedComments.length)} of ${filteredRetainedComments.length} (${stage2Data.signalCount} Total)`}
                                </span>
                            </div>
                            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                {displayedRetainedComments.map((c, i) => {
                                    const rType = String((c as any).reviewType || '').toLowerCase();
                                    const isMcCritic = rType === 'critic' || String(c.source || '').toLowerCase().includes('metacritic critic');
                                    const isMcUser = rType === 'user' || String(c.source || '').toLowerCase().includes('metacritic user');
                                    const mcScore = (c as any).score;
                                    return (
                                        <div key={i} className="p-4 rounded-2xl bg-[var(--app-card)] border border-emerald-200 text-[var(--app-text)] text-xs space-y-2 hover:border-emerald-400 hover:shadow-xs transition-all">
                                            <div className="flex items-center justify-between">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <span className="font-black text-[var(--app-text)]">{c.author}</span>
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
                                                    {c.country && (
                                                        <span className="text-[10px] font-mono text-[var(--app-muted)] bg-[var(--app-surface)] border border-[var(--app-border)] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                                                            {getCountryFlag(c.country, c.rawText || (c as any).text || '').flag} {getCountryFlag(c.country, c.rawText || (c as any).text || '').label}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-[10px] text-[var(--app-muted)] font-mono flex items-center gap-1">
                                                        <Clock size={11} className="text-[var(--app-muted)]" />
                                                        {c.timestamp || formatCommentTimestamp(null, getCommentYear(c))}
                                                    </span>
                                                    <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono">
                                                        {getCommentYear(c)} • {c.source}
                                                    </span>
                                                </div>
                                            </div>
                                            <p className="text-[var(--app-text)] italic leading-relaxed font-sans">"{c.rawText}"</p>
                                        </div>
                                    );
                                })}
                                {filteredRetainedComments.length === 0 && (
                                    <div className="text-center py-8 text-[var(--app-muted)] text-xs font-mono">
                                        No retained high-signal comments match current filter.
                                    </div>
                                )}
                            </div>
                            {filteredRetainedComments.length > STAGE2_PREVIEW_LIMIT && (
                                <button
                                    type="button"
                                    onClick={() => setStage2ShowAllSignal(prev => !prev)}
                                    className="w-full py-2.5 px-3 rounded-xl border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 dark:bg-emerald-500/15 dark:hover:bg-emerald-500/25 text-emerald-700 dark:text-emerald-300 text-xs font-bold font-mono inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer"
                                >
                                    {stage2ShowAllSignal ? (
                                        <>Show Top {STAGE2_PREVIEW_LIMIT} Samples <ChevronUp size={13} /></>
                                    ) : (
                                        <>Show All {filteredRetainedComments.length} Retained Comments <ChevronDown size={13} /></>
                                    )}
                                </button>
                            )}
                        </div>

                        <div className="bg-[var(--app-surface)] rounded-3xl border border-rose-200 p-6 text-[var(--app-text)] space-y-4 shadow-xs">
                            <div className="flex items-center justify-between pb-3 border-b border-rose-200">
                                <span className="text-xs font-black text-rose-700 flex items-center gap-2 font-mono uppercase tracking-wider">
                                    <EyeOff size={16} className="text-rose-600" />
                                    Stripped Noise &amp; Spam
                                </span>
                                <span className="text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2.5 py-0.5 rounded-full font-mono">
                                    {stage2ShowAllNoise
                                        ? `All ${filteredNoiseComments.length} Filtered (${stage2Data.noiseCount} Total)`
                                        : `Showing Top ${Math.min(STAGE2_PREVIEW_LIMIT, filteredNoiseComments.length)} of ${filteredNoiseComments.length} (${stage2Data.noiseCount} Total)`}
                                </span>
                            </div>
                            <div className="space-y-3 max-h-[520px] overflow-y-auto pr-1">
                                {displayedNoiseComments.map((c, i) => (
                                    <div key={i} className="p-4 rounded-2xl bg-[var(--app-card)] border border-rose-200 text-[var(--app-text)] text-xs space-y-2 hover:border-rose-400 hover:shadow-xs transition-all">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <span className="font-black text-[var(--app-text)]">{c.author}</span>
                                                {c.country && (
                                                    <span className="text-[10px] font-mono text-[var(--app-muted)] bg-[var(--app-surface)] border border-[var(--app-border)] px-1.5 py-0.5 rounded flex items-center gap-1 font-semibold">
                                                        {getCountryFlag(c.country, c.rawText || (c as any).text || '').flag} {getCountryFlag(c.country, c.rawText || (c as any).text || '').label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[var(--app-muted)] font-mono flex items-center gap-1">
                                                    <Clock size={11} className="text-[var(--app-muted)]" />
                                                    {c.timestamp || formatCommentTimestamp(null, getCommentYear(c))}
                                                </span>
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                                    {getCommentYear(c)} • Filtered Noise
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[var(--app-muted)] line-through italic leading-relaxed font-sans">"{c.rawText}"</p>
                                        <div className="text-[11px] font-semibold bg-rose-50 p-2.5 rounded-xl border border-rose-200 text-rose-700 font-mono shadow-xs">
                                            <strong className="font-bold text-rose-700">Stripping Reason:</strong> {c.noiseReason || 'Low-effort emotional venting'}
                                        </div>
                                    </div>
                                ))}
                                {filteredNoiseComments.length === 0 && (
                                    <div className="text-center py-8 text-[var(--app-muted)] text-xs font-mono">
                                        No noise comments match current filter.
                                    </div>
                                )}
                            </div>
                            {filteredNoiseComments.length > STAGE2_PREVIEW_LIMIT && (
                                <button
                                    type="button"
                                    onClick={() => setStage2ShowAllNoise(prev => !prev)}
                                    className="w-full py-2.5 px-3 rounded-xl border border-rose-200 bg-rose-50 hover:bg-rose-100 dark:bg-rose-500/15 dark:hover:bg-rose-500/25 text-rose-700 dark:text-rose-300 text-xs font-bold font-mono inline-flex items-center justify-center gap-1.5 whitespace-nowrap transition cursor-pointer"
                                >
                                    {stage2ShowAllNoise ? (
                                        <>Show Top {STAGE2_PREVIEW_LIMIT} Samples <ChevronUp size={13} /></>
                                    ) : (
                                        <>Show All {filteredNoiseComments.length} Filtered Comments <ChevronDown size={13} /></>
                                    )}
                                </button>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] space-y-2 shadow-xs">
                    <Filter size={36} className="mx-auto text-[var(--app-muted)]" />
                    <h4 className="text-base font-bold text-[var(--app-text)]">Stage 2 Not Run Yet</h4>
                    <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                        Click 'Filter Comments' above to execute the parallel noise removal pipeline on the {rawCommentsCount} raw comments.
                    </p>
                </div>
            )}

            {stage2Data && (
                <div className="p-4 rounded-2xl bg-emerald-50 text-[var(--app-text)] border border-emerald-200 flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-xs">
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-emerald-700">
                            ✓ {stage2Data.signalCount} Signal Comments Isolated
                        </span>
                        <p className="text-[11px] text-[var(--app-muted)] font-medium">
                            Proceed to Stage 3 to extract granular topics and sentiment classification.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onProceedToStage3}
                        className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black text-white keep-white-text shrink-0 shadow-md cursor-pointer"
                    >
                        <span>Proceed to Stage 3: Extract Topics</span> <ArrowRight size={14} className="shrink-0" />
                    </button>
                </div>
            )}
        </div>
    );
};
