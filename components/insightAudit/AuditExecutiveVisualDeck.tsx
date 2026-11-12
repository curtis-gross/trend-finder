import React from 'react';
import {
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    CartesianGrid
} from 'recharts';
import {
    ShieldCheck,
    Activity,
    AlertTriangle,
    CheckCircle2,
    Calendar,
    Target
} from 'lucide-react';
import { InsightAuditReport } from '../../services/insightAuditService';
import { AuditVisualTelemetry } from './useInsightAuditState';

interface AuditExecutiveVisualDeckProps {
    auditReport: InsightAuditReport;
    visualTelemetry: AuditVisualTelemetry;
    isDark: boolean;
}

export const AuditExecutiveVisualDeck: React.FC<AuditExecutiveVisualDeckProps> = ({
    auditReport,
    visualTelemetry,
    isDark
}) => {
    const matrixCount = auditReport.nextCycleGoNoGoMatrix?.length || 6;

    return (
        <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl text-[var(--app-text)] dark:text-slate-100 border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-6">
            {/* Visual Deck Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 uppercase tracking-wider flex items-center gap-1 font-mono">
                            <Activity size={13} /> Executive Synthesis Visual
                        </span>
                        <span className="text-xs font-mono text-[var(--app-muted)] dark:text-slate-400">
                            Unified Horizon Roadmap • Near-Term Action Priorities • Next-Cycle Go/No-Go Matrix
                        </span>
                    </div>
                    <h3 className="text-xl font-black text-[var(--app-text)] dark:text-slate-100 tracking-tight">
                        Strategic Intelligence & Horizon Command Deck
                    </h3>
                </div>

                <div className="flex items-center gap-3 font-mono">
                    <div className="bg-[var(--app-card)] dark:bg-[#061C36] px-3.5 py-1.5 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-right">
                        <span className="text-[10px] text-[var(--app-muted)] dark:text-slate-400 uppercase block">Brand Status</span>
                        <span className="text-xs font-black text-emerald-700 dark:text-emerald-400 block">
                            {auditReport.executiveSummary?.healthVerdict || 'Strong Momentum'}
                        </span>
                    </div>
                </div>
            </div>

            {/* 3 Main Visual Charts Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                {/* 1. Left: Health Score & Sentiment Gauge */}
                <div className="lg:col-span-4 bg-[var(--app-card)] dark:bg-[#061C36]/70 rounded-2xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] flex flex-col justify-between space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] dark:text-slate-100 flex items-center gap-1.5">
                            <ShieldCheck size={14} className="text-emerald-700 dark:text-emerald-400" /> Brand Health Index
                        </span>
                        <span className="text-[10px] font-mono text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60">
                            Live Ingest
                        </span>
                    </div>

                    <div className="h-44 w-full min-w-0 min-h-[160px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={160} minWidth={100} minHeight={160} initialDimension={{ width: 520, height: 160 }}>
                            <PieChart>
                                <Pie
                                    data={visualTelemetry.healthPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={50}
                                    outerRadius={70}
                                    startAngle={180}
                                    endAngle={0}
                                    paddingAngle={3}
                                    dataKey="value"
                                    cursor="pointer"
                                >
                                    <Cell fill="#10B981" stroke={isDark ? '#041E3A' : '#FFFFFF'} strokeWidth={2} />
                                    <Cell fill={isDark ? '#041527' : '#E2E8F0'} stroke={isDark ? '#041E3A' : '#FFFFFF'} strokeWidth={2} />
                                </Pie>
                                <Tooltip
                                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl px-3 py-2 shadow-lg text-[var(--app-text)] dark:text-slate-100 font-mono text-xs z-50 pointer-events-none">
                                                    <span className="text-[var(--app-muted)] dark:text-slate-400 font-bold">{data.name}: </span>
                                                    <span className="text-emerald-700 dark:text-emerald-400 font-black">{data.value}%</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pt-8 pointer-events-none">
                            <span className="text-3xl font-black text-[var(--app-text)] dark:text-slate-100 font-mono">
                                {visualTelemetry.healthScore}
                                <span className="text-sm text-[var(--app-muted)] dark:text-slate-400 font-normal">/100</span>
                            </span>
                            <span className="text-[10px] text-emerald-700 dark:text-emerald-400 uppercase font-mono tracking-wider font-bold">Health Score</span>
                        </div>
                    </div>

                    <div className="space-y-1.5 pt-2 border-t border-[var(--app-border)] dark:border-[#041E3A] text-xs">
                        <p className="text-[var(--app-muted)] dark:text-slate-300 text-[11px] leading-relaxed">
                            {auditReport.executiveSummary?.summaryNarrative || 'Overall brand sentiment signal is positive with strong product and experience validation.'}
                        </p>
                    </div>
                </div>

                {/* 2. Middle: Multi-Horizon Action Plan (1W • 1M • 1Y) */}
                <div className="lg:col-span-4 bg-[var(--app-card)] dark:bg-[#061C36]/70 rounded-2xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] flex flex-col justify-between space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] dark:text-slate-100 flex items-center gap-1.5">
                            <Calendar size={14} className="text-[#38bdf8]" /> Horizon Deliverables
                        </span>
                        <span className="text-[10px] font-mono text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] px-2 py-0.5 rounded-full border border-[var(--app-border)] dark:border-[#041E3A]">
                            3 Horizons
                        </span>
                    </div>

                    <div className="h-44 w-full min-w-0 min-h-[160px]">
                        <ResponsiveContainer width="100%" height={160} minWidth={100} minHeight={160} initialDimension={{ width: 520, height: 160 }}>
                            <BarChart
                                data={visualTelemetry.horizonData}
                                margin={{ top: 10, right: 10, left: -25, bottom: 5 }}
                            >
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} vertical={false} />
                                <XAxis dataKey="horizon" stroke={isDark ? '#94A3B8' : '#64748B'} tick={{ fill: isDark ? '#94A3B8' : '#64748B' }} fontSize={11} tickLine={false} />
                                <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} tick={{ fill: isDark ? '#94A3B8' : '#64748B' }} fontSize={10} tickLine={false} axisLine={false} allowDecimals={false} />
                                <Tooltip
                                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                    cursor={{ fill: isDark ? 'rgba(26, 34, 46, 0.5)' : 'rgba(226, 232, 240, 0.4)' }}
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl px-3.5 py-2.5 shadow-lg text-[var(--app-text)] dark:text-slate-100 font-mono text-xs z-50 pointer-events-none space-y-1">
                                                    <div className="flex items-center gap-1.5 font-bold" style={{ color: data.color }}>
                                                        <span>{data.horizon} ({data.label})</span>
                                                    </div>
                                                    <div className="text-sm font-black text-[var(--app-text)] dark:text-slate-100">
                                                        {data.items} Action Items
                                                    </div>
                                                    <p className="text-[10px] text-[var(--app-muted)] dark:text-slate-400 font-sans">
                                                        {data.theme}
                                                    </p>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                                <Bar dataKey="items" radius={[6, 6, 0, 0]}>
                                    {visualTelemetry.horizonData.map((entry, index) => (
                                        <Cell key={`cell-${index}`} fill={entry.color} />
                                    ))}
                                </Bar>
                            </BarChart>
                        </ResponsiveContainer>
                    </div>

                    <div className="grid grid-cols-3 gap-1.5 text-center pt-2 border-t border-[var(--app-border)] dark:border-[#041E3A] font-mono text-[10px]">
                        <div className="p-1.5 bg-rose-50 dark:bg-rose-950/40 rounded-lg border border-rose-200 dark:border-rose-800/60 text-rose-700 dark:text-rose-300">
                            <span className="block font-bold">1 Week</span>
                            <span>{auditReport.roadmap?.oneWeek?.items?.length || 3} Hotfixes</span>
                        </div>
                        <div className="p-1.5 bg-blue-50 dark:bg-[#041527] rounded-lg border border-blue-200 dark:border-[#041E3A] text-blue-700 dark:text-sky-300">
                            <span className="block font-bold">1 Month</span>
                            <span>{auditReport.roadmap?.oneMonth?.items?.length || 3} Updates</span>
                        </div>
                        <div className="p-1.5 bg-purple-50 dark:bg-purple-950/40 rounded-lg border border-purple-200 dark:border-purple-800/60 text-purple-700 dark:text-purple-300">
                            <span className="block font-bold">1 Year</span>
                            <span>{auditReport.roadmap?.oneYear?.items?.length || 3} Pillars</span>
                        </div>
                    </div>
                </div>

                {/* 3. Right: Next-Cycle Go/No-Go Matrix */}
                <div className="lg:col-span-4 bg-[var(--app-card)] dark:bg-[#061C36]/70 rounded-2xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] flex flex-col justify-between space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] dark:text-slate-100 flex items-center gap-1.5">
                            <Target size={14} className="text-amber-700 dark:text-amber-400" /> Next-Cycle Go/No-Go Matrix
                        </span>
                        <span className="text-[10px] font-mono text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] px-2 py-0.5 rounded-full border border-[var(--app-border)] dark:border-[#041E3A]">
                            {matrixCount} Features
                        </span>
                    </div>

                    <div className="h-44 w-full min-w-0 min-h-[160px] relative flex items-center justify-center">
                        <ResponsiveContainer width="100%" height={160} minWidth={100} minHeight={160} initialDimension={{ width: 520, height: 160 }}>
                            <PieChart>
                                <Pie
                                    data={visualTelemetry.decisionPieData}
                                    cx="50%"
                                    cy="50%"
                                    innerRadius={40}
                                    outerRadius={65}
                                    paddingAngle={4}
                                    dataKey="value"
                                    cursor="pointer"
                                >
                                    {visualTelemetry.decisionPieData.map((entry, index) => (
                                        <Cell key={`dec-cell-${index}`} fill={entry.color} stroke={isDark ? '#041E3A' : '#FFFFFF'} strokeWidth={2} />
                                    ))}
                                </Pie>
                                <Tooltip
                                    wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                    content={({ active, payload }: any) => {
                                        if (active && payload && payload.length) {
                                            const data = payload[0].payload;
                                            return (
                                                <div className="bg-white dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl px-3 py-2 shadow-lg text-[var(--app-text)] dark:text-slate-100 font-mono text-xs z-50 pointer-events-none">
                                                    <span className="font-bold" style={{ color: data.color }}>{data.name}: </span>
                                                    <span className="text-[var(--app-text)] dark:text-slate-100 font-black">{data.value} features</span>
                                                </div>
                                            );
                                        }
                                        return null;
                                    }}
                                />
                            </PieChart>
                        </ResponsiveContainer>
                        <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                            <span className="text-lg font-black text-[var(--app-text)] dark:text-slate-100 font-mono">
                                {visualTelemetry.goCount} <span className="text-xs text-emerald-700 dark:text-emerald-400">GO</span>
                            </span>
                            <span className="text-[9px] text-[var(--app-muted)] dark:text-slate-400 uppercase font-mono">Verdict</span>
                        </div>
                    </div>

                    <div className="flex items-center justify-between gap-2 pt-2 border-t border-[var(--app-border)] dark:border-[#041E3A] font-mono text-xs">
                        <span className="flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-emerald-500" /> {visualTelemetry.goCount} GO
                        </span>
                        <span className="flex items-center gap-1 text-amber-700 dark:text-amber-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-amber-500" /> {visualTelemetry.reArchCount} RE-ARCH
                        </span>
                        <span className="flex items-center gap-1 text-rose-700 dark:text-rose-400 font-bold">
                            <span className="w-2 h-2 rounded-full bg-rose-500" /> {visualTelemetry.noGoCount} NO-GO
                        </span>
                    </div>
                </div>
            </div>

            {/* Bottom Executive Highlight Banner */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                <div className="p-4 rounded-2xl bg-emerald-50 dark:bg-emerald-950/35 border border-emerald-200 dark:border-emerald-800/60 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 dark:text-emerald-300 uppercase tracking-wider font-mono">
                        <CheckCircle2 size={14} /> Top Positive Breakthrough
                    </div>
                    <p className="text-xs text-[var(--app-text)] dark:text-slate-200 font-semibold leading-relaxed">
                        {auditReport.executiveSummary?.topPositiveBreakthrough || 'Core product quality and customer experience satisfaction validated across channels.'}
                    </p>
                </div>

                <div className="p-4 rounded-2xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-800/60 space-y-1">
                    <div className="flex items-center gap-1.5 text-xs font-bold text-rose-700 dark:text-rose-300 uppercase tracking-wider font-mono">
                        <AlertTriangle size={14} /> Primary Friction Vector
                    </div>
                    <p className="text-xs text-[var(--app-text)] dark:text-slate-200 font-semibold leading-relaxed">
                        {auditReport.executiveSummary?.primaryFrictionVector || 'Service responsiveness and fulfillment consistency under peak demand.'}
                    </p>
                </div>
            </div>
        </div>
    );
};
