import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell, PieChart, Pie } from 'recharts';
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Clock, DownloadCloud, Layers, Search } from 'lucide-react';
import { RawComment, formatCommentTimestamp, getCommentYear } from '../../../services/noiseFilterService';
import { getCountryFlag } from '../languageAndGraphHelpers';
import { STAGE1_PAGE_SIZE } from '../useStageChartMemos';

export interface Stage1RawIngestionViewProps {
    isDark: boolean;
    rawComments: RawComment[];
    displayedRawComments: RawComment[];
    rawSearchQuery: string;
    setRawSearchQuery: (q: string) => void;
    stage1Analytics: any;
    hoveredStage1PieIndex: number | null;
    setHoveredStage1PieIndex: (idx: number | null) => void;
    totalRawCount: number;
    totalRawPages: number;
    currentRawPage: number;
    setStage1Page: React.Dispatch<React.SetStateAction<number>>;
    stage1ViewAll: boolean;
    setStage1ViewAll: React.Dispatch<React.SetStateAction<boolean>>;
    onProceedToStage2: () => void;
}

export const Stage1RawIngestionView: React.FC<Stage1RawIngestionViewProps> = ({
    isDark, rawComments, displayedRawComments, rawSearchQuery, setRawSearchQuery,
    stage1Analytics, hoveredStage1PieIndex, setHoveredStage1PieIndex,
    totalRawCount, totalRawPages, currentRawPage, setStage1Page,
    stage1ViewAll, setStage1ViewAll, onProceedToStage2
}) => {
    return (
        <div className="space-y-6 animate-fadeIn">
            {/* Visual Analytics: Distinct Sources & Scanned Comments Breakdown */}
            <div className="bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] p-6 shadow-xs space-y-6">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--app-border)]">
                    <h3 className="text-lg font-black text-[var(--app-text)] tracking-tight">
                        Comments Scanned by Channel
                    </h3>
                </div>

                {/* Visual Graphs Grid: Bar Chart & Platform Share Donut */}
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                    {/* Bar Chart: Comments Scanned per Distinct Channel Source */}
                    <div className="lg:col-span-8 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] flex flex-col justify-between space-y-4 shadow-lg">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                            <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-muted)] flex items-center gap-1.5">
                                <Activity size={14} className="text-emerald-600" /> Scanned Comments per Distinct Channel
                            </span>
                            <div className="flex items-center gap-3 text-[11px] font-mono">
                                <span className="flex items-center gap-1 text-rose-600">
                                    <span className="w-2 h-2 rounded-full bg-[#FF4757]" /> YouTube
                                </span>
                                <span className="flex items-center gap-1 text-blue-600">
                                    <span className="w-2 h-2 rounded-full bg-[#00F0FF]" /> Steam
                                </span>
                                <span className="flex items-center gap-1 text-amber-600">
                                    <span className="w-2 h-2 rounded-full bg-[#FACC15]" /> Metacritic
                                </span>
                                <span className="flex items-center gap-1 text-[#FF7A00]">
                                    <span className="w-2 h-2 rounded-full bg-[#FF7A00]" /> Reddit
                                </span>
                            </div>
                        </div>

                        <div className="h-64 w-full min-w-0">
                            <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={200} initialDimension={{ width: 520, height: 220 }}>
                                <BarChart data={stage1Analytics.channelBarData} margin={{ top: 10, right: 15, left: -20, bottom: 25 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} vertical={false} />
                                    <XAxis
                                        dataKey="name"
                                        stroke={isDark ? '#94A3B8' : '#64748B'}
                                        fontSize={10}
                                        tickLine={false}
                                        angle={-20}
                                        textAnchor="end"
                                        interval={0}
                                    />
                                    <YAxis
                                        stroke={isDark ? '#94A3B8' : '#64748B'}
                                        fontSize={10}
                                        tickLine={false}
                                        axisLine={false}
                                        domain={[0, 'auto']}
                                    />
                                    <Tooltip
                                        contentStyle={{
                                            backgroundColor: isDark ? '#041527' : '#FFFFFF',
                                            borderColor: isDark ? '#041E3A' : '#E2E8F0',
                                            borderRadius: '12px',
                                            color: isDark ? '#F8F6F0' : '#0F172A',
                                            fontSize: '11px',
                                            boxShadow: isDark ? '0 8px 24px rgba(0,0,0,0.45)' : '0 8px 24px rgba(15,23,42,0.08)'
                                        }}
                                        formatter={(value: any, _name: any, item: any) => {
                                            const payload = item?.payload || {};
                                            const count = Number(value);
                                            const target = payload.targetCount || 750;
                                            const statusNote = count >= target ? `(Capped at ${target})` : '(All comments on video)';
                                            return [`${count.toLocaleString()} Comments • ${statusNote}`, 'Harvested Volume'];
                                        }}
                                        labelFormatter={(label, payload) => {
                                            const item = payload?.[0]?.payload;
                                            return item?.fullName || label;
                                        }}
                                    />
                                    <Bar dataKey="commentsCount" radius={[6, 6, 0, 0]}>
                                        {(stage1Analytics?.channelBarData || []).map((entry: any, index: number) => (
                                            <Cell key={`cell-${index}`} fill={entry.color} />
                                        ))}
                                    </Bar>
                                </BarChart>
                            </ResponsiveContainer>
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] font-mono pt-2 border-t border-[var(--app-border)]">
                            <span>Harvest Limit: up to 750 comments/stream (YouTube/Steam), up to 250 (Metacritic), up to 200 (Reddit)</span>
                            <span className="text-emerald-600 font-bold">Live YouTube, Metacritic &amp; Reddit Mining (Zero Fallbacks)</span>
                        </div>
                    </div>

                    {/* Donut Chart & Platform Breakdown Share */}
                    <div className="lg:col-span-4 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] flex flex-col justify-between space-y-4 shadow-lg">
                        <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                            <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-muted)] flex items-center gap-1.5">
                                <Layers size={14} className="text-blue-600" /> Source Diversity Share
                            </span>
                            <span className="text-[10px] font-mono text-[var(--app-muted)] bg-[var(--app-card)] px-2 py-0.5 rounded-full border border-[var(--app-border)]">
                                4 Platforms
                            </span>
                        </div>

                        <div className="h-44 w-full min-w-0 min-h-[150px] relative flex items-center justify-center">
                            <ResponsiveContainer width="100%" height={176} minWidth={100} minHeight={150} initialDimension={{ width: 320, height: 176 }}>
                                <PieChart>
                                    <Pie
                                        data={stage1Analytics?.platformPieData || []}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={45}
                                        outerRadius={68}
                                        paddingAngle={4}
                                        dataKey="value"
                                        nameKey="name"
                                        onMouseEnter={(_, index) => setHoveredStage1PieIndex(index)}
                                        onMouseLeave={() => setHoveredStage1PieIndex(null)}
                                        cursor="pointer"
                                    >
                                        {(stage1Analytics?.platformPieData || []).map((entry: any, index: number) => (
                                            <Cell
                                                key={`pie-cell-${index}`}
                                                fill={entry.color}
                                                fillOpacity={hoveredStage1PieIndex === null || hoveredStage1PieIndex === index ? 1 : 0.6}
                                                stroke={hoveredStage1PieIndex === index ? (isDark ? '#38BDF8' : '#0F172A') : (isDark ? '#041E3A' : '#FFFFFF')}
                                                strokeWidth={hoveredStage1PieIndex === index ? 3 : 1.5}
                                            />
                                        ))}
                                    </Pie>
                                    <Tooltip
                                        wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                        content={({ active, payload }: any) => {
                                            if (active && payload && payload.length) {
                                                const data = payload[0].payload;
                                                const pct = stage1Analytics.totalComments > 0
                                                    ? Math.round((data.value / stage1Analytics.totalComments) * 100)
                                                    : 33;
                                                return (
                                                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-3.5 py-2.5 shadow-2xl text-[var(--app-text)] font-mono text-xs z-50 pointer-events-none">
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: data.color }} />
                                                            <span className="font-bold text-[var(--app-text)] text-[11px]">{data.name}</span>
                                                        </div>
                                                        <div className="text-sm font-black text-[var(--app-text)]">
                                                            {Number(data.value).toLocaleString()} comments <span className="text-xs text-[var(--app-muted)] font-normal">({pct}%)</span>
                                                        </div>
                                                        <p className="text-[10px] text-[var(--app-muted)] font-sans mt-1">
                                                            {data.sourcesCount} Active Data Feeds
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                                <span className="text-xs font-black text-[var(--app-text)] font-mono">
                                    {stage1Analytics.totalComments > 0 ? stage1Analytics.totalComments.toLocaleString() : '0'}
                                </span>
                                <span className="text-[9px] text-[var(--app-muted)] uppercase font-mono">Comments</span>
                            </div>
                        </div>

                        <div className="space-y-2 pt-1 border-t border-[var(--app-border)]">
                            {(stage1Analytics?.platformPieData || []).map((plat: any) => {
                                const pct = stage1Analytics.totalComments > 0
                                    ? Math.round((plat.value / stage1Analytics.totalComments) * 100)
                                    : 33;
                                return (
                                    <div key={plat.name} className="flex items-center justify-between p-2 rounded-xl bg-[var(--app-card)] text-[var(--app-text)] border border-[var(--app-border)] text-xs">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: plat.color }} />
                                            <span className="font-bold text-[var(--app-text)] text-[11px]">{plat.name}</span>
                                            <span className="text-[10px] text-[var(--app-muted)] font-mono">
                                                {plat.name === 'Metacritic' && stage1Analytics.metacriticTotal > 0
                                                    ? `(${stage1Analytics.metacriticCriticCount} Critic · ${stage1Analytics.metacriticUserCount} User)`
                                                    : `(${plat.sourcesCount} feeds)`}
                                            </span>
                                        </div>
                                        <div className="flex items-center gap-2 font-mono">
                                            <span className="text-[11px] text-[var(--app-muted)]">{plat.value.toLocaleString()}</span>
                                            <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[var(--app-card)] border border-[var(--app-border)]" style={{ color: plat.color }}>
                                                {pct}%
                                            </span>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                </div>
            </div>

            {/* Raw Ingested Preview Table */}
            <div className="bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] p-6 shadow-xs space-y-4">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                    <div className="min-w-0">
                        <h4 className="text-base font-bold text-[var(--app-text)]">
                            Raw Harvested Comments Corpus ({rawComments.length})
                        </h4>
                        <p className="text-xs text-[var(--app-muted)]">
                            Unfiltered feedback stored in GCS ready for parallel noise stripping.
                        </p>
                    </div>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" />
                        <input
                            type="text"
                            placeholder="Search raw text..."
                            value={rawSearchQuery}
                            onChange={(e) => setRawSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-hidden focus:border-[#0077C8]"
                        />
                    </div>
                </div>

                {rawComments.length > 0 ? (
                    <div className="space-y-3">
                        <div className="max-h-[460px] overflow-y-auto space-y-2.5 pr-1">
                            {displayedRawComments.map((c, i) => {
                                const rType = String((c as any).reviewType || '').toLowerCase();
                                const isMcCritic = rType === 'critic' || String(c.source || '').toLowerCase().includes('metacritic critic');
                                const isMcUser = rType === 'user' || String(c.source || '').toLowerCase().includes('metacritic user');
                                const mcScore = (c as any).score;
                                return (
                                    <div key={i} className="p-3.5 rounded-2xl bg-[var(--app-card)] border border-[var(--app-border)] text-xs space-y-1 hover:border-[var(--app-border)] transition">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-[var(--app-text)]">{c.author}</span>
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
                                                    <span className="text-[10px] font-mono text-[var(--app-muted)] bg-[var(--app-card)] border border-[var(--app-border)] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        {getCountryFlag(c.country, c.rawText || (c as any).text || '').flag} {getCountryFlag(c.country, c.rawText || (c as any).text || '').label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[var(--app-muted)] font-mono flex items-center gap-1">
                                                    <Clock size={11} className="text-[var(--app-muted)]" />
                                                    {c.timestamp || formatCommentTimestamp(null, getCommentYear(c))}
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--app-card)] text-[var(--app-muted)] border border-[var(--app-border)]">
                                                    {getCommentYear(c)} • {c.source}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[var(--app-muted)] italic leading-relaxed">
                                            "{c.rawText}"
                                        </p>
                                    </div>
                                );
                            })}
                            {displayedRawComments.length === 0 && (
                                <div className="text-center py-8 text-[var(--app-muted)] text-xs font-mono">
                                    No raw comments match "{rawSearchQuery}".
                                </div>
                            )}
                        </div>

                        {totalRawCount > STAGE1_PAGE_SIZE && (
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--app-border)] text-xs">
                                <div className="flex items-center gap-2 text-[var(--app-muted)] font-mono text-[11px]">
                                    <span>
                                        {stage1ViewAll
                                            ? `Showing all ${totalRawCount} comments`
                                            : `Showing ${(currentRawPage - 1) * STAGE1_PAGE_SIZE + 1}–${Math.min(currentRawPage * STAGE1_PAGE_SIZE, totalRawCount)} of ${totalRawCount} comments`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStage1ViewAll(prev => !prev)}
                                        className="text-[#0077C8] hover:underline font-bold ml-1 whitespace-nowrap cursor-pointer"
                                    >
                                        {stage1ViewAll ? 'Paginate (50/page)' : 'View All'}
                                    </button>
                                </div>
                                {!stage1ViewAll && (
                                    <div className="flex flex-row items-center gap-1.5 font-mono text-[11px] flex-nowrap shrink-0">
                                        <button
                                            type="button"
                                            onClick={() => setStage1Page(p => Math.max(1, p - 1))}
                                            disabled={currentRawPage <= 1}
                                            className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                                        >
                                            <ChevronLeft size={13} /> Prev
                                        </button>
                                        <span className="px-2 font-bold text-[var(--app-muted)] whitespace-nowrap">
                                            Page {currentRawPage} of {totalRawPages}
                                        </span>
                                        <button
                                            type="button"
                                            onClick={() => setStage1Page(p => Math.min(totalRawPages, p + 1))}
                                            disabled={currentRawPage >= totalRawPages}
                                            className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap transition cursor-pointer"
                                        >
                                            Next <ChevronRight size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="text-center py-12 text-[var(--app-muted)] space-y-2">
                        <DownloadCloud size={32} className="mx-auto text-[var(--app-muted)]" />
                        <p className="text-sm font-semibold">No raw comments loaded yet.</p>
                        <p className="text-xs text-[var(--app-muted)]">Click 'Reload Comments (Live Harvest)' above to fetch up to 750 reviews per video/stream and up to 200 per Reddit discussion.</p>
                    </div>
                )}

                {rawComments.length > 0 && (
                    <div className="mt-4 p-4 rounded-2xl bg-emerald-50 text-[var(--app-text)] border border-emerald-200 flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-3 shadow-xs">
                        <div className="min-w-0 flex-1">
                            <span className="text-xs font-bold text-emerald-700">
                                ✓ {rawComments.length} Raw Comments Ready for Processing
                            </span>
                            <p className="text-[11px] text-[var(--app-muted)] font-medium">
                                Proceed to Stage 2 to deploy parallel Gemini 3.8 Flash (Low Thinking) workers (100 comments/worker) to strip pile-on noise.
                            </p>
                        </div>
                        <button
                            type="button"
                            onClick={onProceedToStage2}
                            className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black text-white keep-white-text shrink-0 shadow-md cursor-pointer"
                        >
                            <span>Proceed to Stage 2: Filter Comments</span> <ArrowRight size={14} className="shrink-0" />
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
