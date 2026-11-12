import React from 'react';
import {
    ResponsiveContainer,
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip
} from 'recharts';
import {
    Activity,
    CheckCircle,
    RefreshCw,
    ShieldAlert,
    Sparkles,
    TrendingUp
} from 'lucide-react';
import { CrossReleaseEvolution } from '../../../services/noiseFilterService';

export interface Stage5SentimentTrajectoryViewProps {
    isDark: boolean;
    isLoading: boolean;
    hasEvolutionData: boolean;
    trajectoryFilter: 'ALL' | 'improving' | 'critical' | 'emerging' | 'stable';
    setTrajectoryFilter: (f: 'ALL' | 'improving' | 'critical' | 'emerging' | 'stable') => void;
    selectedPillar: string | null;
    setSelectedPillar: (p: string | null) => void;
    stage5TimelineData: {
        timelinePoints: Record<string, any>[];
        pillars: CrossReleaseEvolution[];
    };
    onRebuildTrajectory: () => void;
}

export const Stage5SentimentTrajectoryView: React.FC<Stage5SentimentTrajectoryViewProps> = ({
    isDark,
    isLoading,
    hasEvolutionData,
    trajectoryFilter,
    setTrajectoryFilter,
    selectedPillar,
    setSelectedPillar,
    stage5TimelineData,
    onRebuildTrajectory
}) => {
    const filteredPillars = stage5TimelineData.pillars.filter(
        evo =>
            trajectoryFilter === 'ALL' ||
            evo.trajectory === trajectoryFilter ||
            (trajectoryFilter === 'critical' && evo.trajectory === 'declining')
    );

    return (
        <div className="space-y-6 animate-fadeIn">
            {hasEvolutionData ? (
                <div className="space-y-6">
                    <div className="bg-[var(--app-surface)] rounded-3xl p-3 sm:p-4 text-[var(--app-text)] shadow-xs border border-[var(--app-border)] flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar">
                        <div className="flex flex-row items-center gap-1 bg-[var(--app-card)] text-[var(--app-text)] p-1 rounded-2xl border border-[var(--app-border)] overflow-x-auto no-scrollbar shrink-0">
                            {[
                                { id: 'ALL', label: 'All Pillars', dot: null },
                                { id: 'improving', label: 'Improving', dot: 'bg-emerald-500' },
                                { id: 'critical', label: 'Critical', dot: 'bg-yellow-400' },
                                { id: 'emerging', label: 'Emerging Hits', dot: 'bg-sky-500' },
                                { id: 'stable', label: 'Stable', dot: 'bg-sky-400' }
                            ].map((f) => {
                                const isActive = trajectoryFilter === f.id;
                                return (
                                    <button
                                        key={f.id}
                                        type="button"
                                        onClick={() => setTrajectoryFilter(f.id as any)}
                                        className={`inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                                            isActive
                                                ? 'bg-[var(--app-surface)] text-[var(--app-text)] shadow-xs border border-[var(--app-border)]'
                                                : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                                        }`}
                                    >
                                        {f.dot && <span className={`w-2 h-2 rounded-full shrink-0 ${f.dot}`} />}
                                        <span>{f.label}</span>
                                    </button>
                                );
                            })}
                        </div>

                        <button
                            type="button"
                            onClick={onRebuildTrajectory}
                            disabled={isLoading}
                            className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold text-white keep-white-text shadow-xs disabled:opacity-50 cursor-pointer"
                            title="Re-synthesize trajectory with Gemini Flash from saved topics"
                        >
                            <RefreshCw size={13} className={isLoading ? 'animate-spin shrink-0' : 'shrink-0'} />
                            <span>Re-analyze Trajectory</span>
                        </button>
                    </div>

                    <div className="bg-[var(--app-surface)] rounded-3xl p-6 border border-[var(--app-border)] shadow-xs space-y-4">
                        <div className="flex flex-row flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                            <span className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] font-mono">
                                Multi-Horizon Topic Trajectory (2022–2027)
                            </span>

                            <div className="flex items-center gap-3 text-xs font-mono flex-wrap">
                                <span className="flex items-center gap-1.5 text-emerald-700 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" /> Improving
                                </span>
                                <span className="flex items-center gap-1.5 text-yellow-700 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-yellow-400" /> Critical
                                </span>
                                <span className="flex items-center gap-1.5 text-sky-700 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-400" /> Stable
                                </span>
                                <span className="flex items-center gap-1.5 text-sky-700 font-bold">
                                    <span className="w-2.5 h-2.5 rounded-full bg-sky-500" /> Emerging Hits
                                </span>
                            </div>
                        </div>

                        <div className="h-80 w-full min-w-0 pt-2">
                            <ResponsiveContainer width="100%" height={300} minWidth={100} minHeight={250} initialDimension={{ width: 520, height: 300 }}>
                                <LineChart data={stage5TimelineData.timelinePoints} margin={{ top: 15, right: 30, left: 0, bottom: 10 }}>
                                    <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                    <XAxis dataKey="release" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={11} tickLine={false} fontFamily="monospace" />
                                    <YAxis stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={10} domain={[20, 100]} tickLine={false} axisLine={false} unit="%" />
                                    <Tooltip
                                        wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                        content={({ active, payload, label }: any) => {
                                            if (active && payload && payload.length) {
                                                const fullLabel = payload[0]?.payload?.label || label;
                                                return (
                                                    <div className="bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl px-4 py-3 shadow-2xl text-[var(--app-text)] font-mono text-xs z-50 pointer-events-none max-w-sm space-y-2">
                                                        <div className="flex items-center justify-between pb-1.5 border-b border-[var(--app-border)]">
                                                            <span className="font-bold text-emerald-600 text-xs font-mono">{fullLabel}</span>
                                                            <span className="text-[10px] text-[var(--app-muted)] uppercase font-mono">Sentiment</span>
                                                        </div>
                                                        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                                            {(payload || []).map((item: any, i: number) => (
                                                                <div key={i} className="flex items-center justify-between gap-3 text-[11px]">
                                                                    <span className="text-[var(--app-muted)] font-sans truncate" style={{ color: item.color }}>
                                                                        {item.name}
                                                                    </span>
                                                                    <span className="font-bold text-[var(--app-text)] font-mono shrink-0">
                                                                        {item.value}% Working Well
                                                                    </span>
                                                                </div>
                                                            ))}
                                                        </div>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        }}
                                    />
                                    {filteredPillars.map((evo, pIdx) => {
                                        const isSelected = selectedPillar === evo.feature;
                                        const strokeColor =
                                            evo.trajectory === 'improving'
                                                ? '#10B981'
                                                : evo.trajectory === 'critical' || evo.trajectory === 'declining'
                                                ? '#FACC15'
                                                : evo.trajectory === 'emerging'
                                                ? '#0EA5E9'
                                                : '#38BDF8';

                                        return (
                                            <Line
                                                key={pIdx}
                                                type="monotone"
                                                dataKey={evo.feature}
                                                name={evo.feature}
                                                stroke={strokeColor}
                                                strokeWidth={isSelected ? 4 : 2}
                                                strokeOpacity={selectedPillar ? (isSelected ? 1 : 0.25) : 0.85}
                                                dot={{ r: isSelected ? 6 : 4, fill: strokeColor, stroke: isDark ? '#041527' : '#FFFFFF', strokeWidth: 2 }}
                                                activeDot={{ r: 8, stroke: '#0077C8', strokeWidth: 2 }}
                                            />
                                        );
                                    })}
                                </LineChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                        {filteredPillars.map((evo, idx) => {
                            const isImproving = evo.trajectory === 'improving';
                            const isCritical = evo.trajectory === 'critical' || evo.trajectory === 'declining';
                            const isEmerging = evo.trajectory === 'emerging';
                            const baseScore = evo.year2024Sentiment ?? evo.baselineSentiment ?? 50;
                            const y2022Score = evo.year2022Sentiment ?? (isCritical ? Math.min(85, baseScore + 10) : Math.max(40, baseScore - 8));
                            const y2023Score = evo.year2023Sentiment ?? (isCritical ? Math.min(82, baseScore + 5) : Math.max(45, baseScore - 4));
                            const baselineScore = baseScore;
                            const priorScore = evo.year2025Sentiment ?? evo.priorSentiment ?? 55;
                            const currentScore = evo.year2026Sentiment ?? evo.currentSentiment ?? 60;
                            const targetScore = evo.year2027Sentiment ?? evo.targetSentiment ?? 75;
                            const delta = currentScore - priorScore;
                            const isSelected = selectedPillar === evo.feature;

                            return (
                                <div
                                    key={idx}
                                    onClick={() => setSelectedPillar(isSelected ? null : evo.feature)}
                                    className={`p-6 rounded-3xl border cursor-pointer transition-all duration-200 space-y-4 ${
                                        isSelected
                                            ? 'bg-[var(--app-card)] border-2 border-emerald-500 shadow-md ring-1 ring-emerald-400/50'
                                            : isCritical
                                            ? 'bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-yellow-400/40 hover:shadow-md'
                                            : isEmerging
                                            ? 'bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-sky-200 hover:shadow-md'
                                            : isImproving
                                            ? 'bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-emerald-200 hover:shadow-md'
                                            : 'bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-sky-400/40 hover:shadow-md'
                                    }`}
                                >
                                    <div className="flex items-start justify-between gap-3 pb-2 border-b border-[var(--app-border)]">
                                        <div>
                                            <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] font-mono">
                                                {evo.category || 'Customer Experience'}
                                            </span>
                                            <h4 className="text-base font-bold text-[var(--app-text)] mt-0.5">
                                                {evo.feature}
                                            </h4>
                                        </div>

                                        <span className={`flex items-center gap-1.5 text-xs font-bold px-2.5 py-1 rounded-xl shrink-0 font-mono ${
                                            isCritical
                                                ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30 shadow-xs'
                                                : isEmerging
                                                ? 'bg-sky-50 text-sky-700 border border-sky-200 shadow-xs'
                                                : isImproving
                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 shadow-xs'
                                                : 'bg-sky-500/15 text-sky-700 border border-sky-400/30 shadow-xs'
                                        }`}>
                                            {isCritical ? (
                                                <ShieldAlert size={13} className="text-yellow-400" />
                                            ) : isImproving ? (
                                                <TrendingUp size={13} className="text-emerald-500" />
                                            ) : isEmerging ? (
                                                <Sparkles size={13} className="text-sky-500" />
                                            ) : (
                                                <Activity size={13} className="text-sky-600" />
                                            )}
                                            <span className="capitalize">{evo.trajectory || 'Stable'}</span>
                                        </span>
                                    </div>

                                    <div className="grid grid-cols-3 sm:grid-cols-6 gap-1.5 text-center">
                                        <div className="p-2 bg-[var(--app-card)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-2xs">
                                            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">2022 Base</span>
                                            <span className="text-sm font-black text-[var(--app-muted)] font-mono">{y2022Score}%</span>
                                        </div>
                                        <div className="p-2 bg-[var(--app-card)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-2xs">
                                            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">2023 Hist</span>
                                            <span className="text-sm font-black text-[var(--app-muted)] font-mono">{y2023Score}%</span>
                                        </div>
                                        <div className="p-2 bg-[var(--app-card)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-2xs">
                                            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">2024 Bench</span>
                                            <span className="text-sm font-black text-[var(--app-muted)] font-mono">{baselineScore}%</span>
                                        </div>
                                        <div className="p-2 bg-[var(--app-card)] text-[var(--app-text)] rounded-2xl border border-[var(--app-border)] shadow-2xs">
                                            <span className="text-[9px] font-bold text-[var(--app-muted)] uppercase block truncate">2025 Prior</span>
                                            <span className="text-sm font-black text-[var(--app-muted)] font-mono">{priorScore}%</span>
                                        </div>
                                        <div className={`p-2 bg-[var(--app-surface)] text-[var(--app-text)] rounded-2xl border-2 shadow-xs ${
                                            delta >= 2 ? 'border-emerald-500/80' : delta <= -2 ? 'border-yellow-400/80' : 'border-sky-400/50'
                                        }`}>
                                            <span className={`text-[9px] font-bold font-mono uppercase block truncate ${
                                                delta >= 2 ? 'text-emerald-600' : delta <= -2 ? 'text-yellow-400' : 'text-sky-600'
                                            }`}>2026 Live</span>
                                            <span className="text-sm font-black text-[var(--app-text)] flex items-center justify-center gap-0.5 font-mono">
                                                {currentScore}%
                                                <span className={`text-[9px] font-bold ${
                                                    delta >= 2 ? 'text-emerald-600' : delta <= -2 ? 'text-yellow-400' : 'text-sky-600'
                                                }`}>
                                                    ({delta > 0 ? `+${delta}` : delta}%)
                                                </span>
                                            </span>
                                        </div>
                                        <div className="p-2 bg-[#0077C8]/15 rounded-2xl border border-[#349DD4]/40 shadow-2xs">
                                            <span className="text-[9px] font-bold font-mono text-[#0077C8] uppercase block truncate">2027 Pred</span>
                                            <span className="text-sm font-black text-[#0077C8] font-mono">{targetScore}%</span>
                                        </div>
                                    </div>

                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed font-medium">
                                        {evo.summary}
                                    </p>

                                    {evo.keyDrivers && evo.keyDrivers.length > 0 && (
                                        <div className="space-y-1.5 pt-1">
                                            <span className="text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-wider block">
                                                Key Drivers:
                                            </span>
                                            <div className="flex flex-wrap gap-1.5">
                                                {(Array.isArray(evo.keyDrivers) ? evo.keyDrivers : []).map((driver, dIdx) => (
                                                    <span key={dIdx} className="text-[10px] font-medium bg-[var(--app-card)] text-[var(--app-muted)] px-2.5 py-1 rounded-lg border border-[var(--app-border)] font-mono">
                                                        {driver.replace(/^[•\-*]\s*/, '')}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {evo.actionableMandate && (
                                        <div className="p-3 rounded-xl bg-emerald-50 text-[var(--app-text)] border border-emerald-200 text-xs space-y-1">
                                            <div className="flex items-center gap-1.5 font-bold text-emerald-700">
                                                <CheckCircle size={13} className="text-emerald-700" />
                                                <span>Strategic Mandate:</span>
                                            </div>
                                            <p className="text-[var(--app-muted)] font-medium text-[11px] leading-relaxed">
                                                {evo.actionableMandate}
                                            </p>
                                        </div>
                                    )}

                                    {evo.riskIfIgnored && (
                                        <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-700 flex items-start gap-1.5">
                                            <ShieldAlert size={13} className="text-rose-600 shrink-0 mt-0.5" />
                                            <span><strong className="text-rose-700">Risk:</strong> {evo.riskIfIgnored}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] space-y-4">
                    <TrendingUp size={36} className="mx-auto text-[var(--app-muted)]" />
                    <h4 className="text-base font-bold text-[var(--app-text)]">Stage 5 Trajectory Not Available Yet</h4>
                    <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                        Synthesize longitudinal sentiment evolution and strategic mandates directly from the saved comment analysis.
                    </p>
                    <div className="pt-2">
                        <button
                            type="button"
                            onClick={onRebuildTrajectory}
                            disabled={isLoading}
                            className="btn-primary inline-flex items-center gap-2 whitespace-nowrap px-3.5 sm:px-5 py-2 rounded-xl text-xs font-black text-white keep-white-text shadow-lg disabled:opacity-50 cursor-pointer"
                        >
                            <RefreshCw size={14} className={isLoading ? 'animate-spin shrink-0' : 'shrink-0'} /> <span>Build Trajectory from Saved Topics</span>
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
