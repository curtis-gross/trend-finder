import React from 'react';
import {
    ShieldCheck,
    TrendingUp,
    AlertTriangle,
    CheckCircle2,
    Clock,
    Flame,
    Zap,
    Calendar,
    Target
} from 'lucide-react';
import { InsightAuditReport } from '../../services/insightAuditService';
import { AuditFilterSection, HorizonOption } from './useInsightAuditState';

interface AuditRoadmapAndMatrixCardsProps {
    auditReport: InsightAuditReport;
    filterSection: AuditFilterSection;
    selectedHorizon: HorizonOption;
    onSelectHorizon: (horizon: HorizonOption) => void;
}

const getVerdictBadge = (decision: string) => {
    const d = (decision || '').toUpperCase();
    if (d === 'GO') {
        return (
            <span className="flex items-center gap-1 px-3 py-1 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60 font-bold text-xs rounded-full font-mono">
                <CheckCircle2 size={13} /> GO
            </span>
        );
    }
    if (d === 'NO-GO' || d === 'NO GO') {
        return (
            <span className="flex items-center gap-1 px-3 py-1 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-bold text-xs rounded-full font-mono">
                <AlertTriangle size={13} /> NO-GO
            </span>
        );
    }
    return (
        <span className="flex items-center gap-1 px-3 py-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800/60 font-bold text-xs rounded-full font-mono">
            <Clock size={13} /> RE-ARCHITECT
        </span>
    );
};

export const AuditRoadmapAndMatrixCards: React.FC<AuditRoadmapAndMatrixCardsProps> = ({
    auditReport,
    filterSection,
    selectedHorizon,
    onSelectHorizon
}) => {
    const nearTermPriorities = auditReport.nearTermDoubleDownFeatures || [];
    const nextCycleMatrix = auditReport.nextCycleGoNoGoMatrix || [];

    return (
        <>
            {/* SECTION 1: HORIZON ROADMAP (1 WEEK • 1 MONTH • 1 YEAR) */}
            {(filterSection === 'all' || filterSection === 'roadmap') && (
                <div className="space-y-6">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <div>
                            <h3 className="text-lg font-black text-[var(--app-text)] dark:text-slate-100 flex items-center gap-2">
                                <Calendar size={18} className="text-[#38bdf8]" />
                                Horizon Action Plan
                            </h3>
                            <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 mt-0.5">
                                Immediate hotfixes, next-cycle deliverables, and multi-year strategic architecture.
                            </p>
                        </div>

                        <div className="flex items-center gap-1.5 bg-[var(--app-card)] dark:bg-[#041527] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A]">
                            {[
                                { id: 'all', label: 'All Horizons' },
                                { id: 'oneWeek', label: '1 Week' },
                                { id: 'oneMonth', label: '1 Month' },
                                { id: 'oneYear', label: '1 Year' }
                            ].map(h => (
                                <button
                                    key={h.id}
                                    onClick={() => onSelectHorizon(h.id as HorizonOption)}
                                    className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
                                        selectedHorizon === h.id
                                            ? 'bg-[#0077C8] text-white shadow-xs'
                                            : 'text-[var(--app-muted)] dark:text-slate-300 hover:text-[var(--app-text)] dark:hover:text-white dark:hover:bg-[#1A222E]'
                                    }`}
                                >
                                    {h.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* 1 WEEK PLAN */}
                        {(selectedHorizon === 'all' || selectedHorizon === 'oneWeek') && (
                            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-rose-200 dark:border-[#041E3A] p-6 shadow-xs space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-rose-200 dark:border-[#041E3A]">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 rounded-xl border border-rose-200 dark:border-rose-800/60">
                                            <Flame size={16} />
                                        </span>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-rose-700 dark:text-rose-400 tracking-wider font-mono">Urgent Action</span>
                                            <h4 className="text-base font-black text-[var(--app-text)] dark:text-slate-100">Next 1 Week</h4>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border border-rose-200 dark:border-rose-800/60 font-mono">
                                        {auditReport.roadmap?.oneWeek?.items?.length || 0} Hotfixes
                                    </span>
                                </div>

                                <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 italic">"{auditReport.roadmap?.oneWeek?.theme}"</p>

                                <div className="space-y-3">
                                    {(auditReport.roadmap?.oneWeek?.items || []).map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-[var(--app-card)] dark:bg-[#061C36] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] space-y-1.5 shadow-xs">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[var(--app-text)] dark:text-slate-100">{item.title}</span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-muted)] dark:text-slate-300 border border-[var(--app-border)] dark:border-[#041E3A] font-mono">
                                                    {item.owner}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">{item.description}</p>
                                            <div className="pt-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                                <span>Impact:</span> <span>{item.expectedImpact}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 1 MONTH PLAN */}
                        {(selectedHorizon === 'all' || selectedHorizon === 'oneMonth') && (
                            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-blue-200 dark:border-[#041E3A] p-6 shadow-xs space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-blue-200 dark:border-[#041E3A]">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 bg-blue-50 dark:bg-[#061C36] text-[#38bdf8] rounded-xl border border-blue-200 dark:border-[#041E3A]">
                                            <Zap size={16} />
                                        </span>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-blue-700 dark:text-sky-400 tracking-wider font-mono">Release Update</span>
                                            <h4 className="text-base font-black text-[var(--app-text)] dark:text-slate-100">Next 1 Month</h4>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-blue-50 dark:bg-[#061C36] text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-[#041E3A] font-mono">
                                        {auditReport.roadmap?.oneMonth?.items?.length || 0} Deliverables
                                    </span>
                                </div>

                                <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 italic">"{auditReport.roadmap?.oneMonth?.theme}"</p>

                                <div className="space-y-3">
                                    {(auditReport.roadmap?.oneMonth?.items || []).map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-[var(--app-card)] dark:bg-[#061C36] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] space-y-1.5 shadow-xs">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[var(--app-text)] dark:text-slate-100">{item.title}</span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-muted)] dark:text-slate-300 border border-[var(--app-border)] dark:border-[#041E3A] font-mono">
                                                    {item.owner}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">{item.description}</p>
                                            <div className="pt-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                                <span>Impact:</span> <span>{item.expectedImpact}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* 1 YEAR PLAN */}
                        {(selectedHorizon === 'all' || selectedHorizon === 'oneYear') && (
                            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-purple-200 dark:border-[#041E3A] p-6 shadow-xs space-y-4">
                                <div className="flex items-center justify-between pb-3 border-b border-purple-200 dark:border-[#041E3A]">
                                    <div className="flex items-center gap-2">
                                        <span className="p-2 bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 rounded-xl border border-purple-200 dark:border-purple-800/60">
                                            <Target size={16} />
                                        </span>
                                        <div>
                                            <span className="text-[10px] font-black uppercase text-purple-700 dark:text-purple-400 tracking-wider font-mono">Architecture</span>
                                            <h4 className="text-base font-black text-[var(--app-text)] dark:text-slate-100">Next 1 Year</h4>
                                        </div>
                                    </div>
                                    <span className="px-2.5 py-1 rounded-full text-[10px] font-bold bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800/60 font-mono">
                                        {auditReport.roadmap?.oneYear?.items?.length || 0} Pillars
                                    </span>
                                </div>

                                <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 italic">"{auditReport.roadmap?.oneYear?.theme}"</p>

                                <div className="space-y-3">
                                    {(auditReport.roadmap?.oneYear?.items || []).map((item, idx) => (
                                        <div key={idx} className="p-3.5 bg-[var(--app-card)] dark:bg-[#061C36] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] space-y-1.5 shadow-xs">
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[var(--app-text)] dark:text-slate-100">{item.title}</span>
                                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-muted)] dark:text-slate-300 border border-[var(--app-border)] dark:border-[#041E3A] font-mono">
                                                    {item.owner}
                                                </span>
                                            </div>
                                            <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">{item.description}</p>
                                            <div className="pt-1 text-[11px] font-mono text-emerald-700 dark:text-emerald-400 flex items-center gap-1 font-bold">
                                                <span>Impact:</span> <span>{item.expectedImpact}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* SECTION 2: NEAR-TERM ACTION PRIORITIES */}
            {(filterSection === 'all' || filterSection === 'doubledown') && (
                <div className="space-y-6">
                    <div className="pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <h3 className="text-lg font-black text-[var(--app-text)] dark:text-slate-100 flex items-center gap-2">
                            <TrendingUp size={18} className="text-emerald-700 dark:text-emerald-400" />
                            Near-Term Action Priorities
                        </h3>
                        <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 mt-0.5">
                            Strategic allocation of near-term sprints across high-signal priorities (Double Down vs. Rework).
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {nearTermPriorities.map((feat, idx) => (
                            <div key={idx} className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-4 hover:border-emerald-200 dark:hover:border-[#0A2B52] transition-all">
                                <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                                    <span className="text-xs font-bold text-[var(--app-muted)] dark:text-slate-400 font-mono">{feat.category}</span>
                                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase font-mono bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800/60">
                                        {feat.positiveSignalRate}% WORKING WELL
                                    </span>
                                </div>

                                <h4 className="text-base font-black text-[var(--app-text)] dark:text-slate-100 tracking-tight">{feat.name}</h4>
                                <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">{feat.whyDoubleDown}</p>

                                <div className="p-3 bg-[var(--app-card)] dark:bg-[#061C36] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] space-y-1 text-xs">
                                    <span className="font-bold text-emerald-700 dark:text-emerald-400 block flex items-center gap-1 font-mono">
                                        <CheckCircle2 size={13} /> Recommended Actions:
                                    </span>
                                    <ul className="list-disc list-inside text-[var(--app-muted)] dark:text-slate-300 text-[11px] space-y-1">
                                        {(feat.recommendedPatchActions || []).map((act, aIdx) => (
                                            <li key={aIdx}>{act}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 3: NEXT-CYCLE GO/NO-GO MATRIX */}
            {(filterSection === 'all' || filterSection === 'gonogo') && (
                <div className="space-y-6">
                    <div className="pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <h3 className="text-lg font-black text-[var(--app-text)] dark:text-slate-100 flex items-center gap-2">
                            <Target size={18} className="text-emerald-700 dark:text-emerald-400" />
                            Next-Cycle Go/No-Go Matrix
                        </h3>
                        <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 mt-0.5">
                            Definitive strategic verdicts for next-cycle initiatives based on synthesized community sentiment.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {nextCycleMatrix.map((dec, idx) => (
                            <div key={idx} className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-4 hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition-all">
                                <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                                    <h4 className="text-base font-black text-[var(--app-text)] dark:text-slate-100">{dec.featureName}</h4>
                                    {getVerdictBadge(dec.decision)}
                                </div>

                                <div className="space-y-2 text-xs">
                                    <div>
                                        <span className="font-bold text-[var(--app-muted)] dark:text-slate-400 font-mono uppercase text-[10px]">Community Verdict:</span>
                                        <p className="text-[var(--app-text)] dark:text-slate-100 mt-0.5 leading-relaxed font-semibold">{dec.communityVerdict}</p>
                                    </div>
                                    <div>
                                        <span className="font-bold text-[var(--app-muted)] dark:text-slate-400 font-mono uppercase text-[10px]">Strategic Rationale:</span>
                                        <p className="text-[var(--app-muted)] dark:text-slate-300 mt-0.5 leading-relaxed">{dec.strategicRationale}</p>
                                    </div>
                                    <div>
                                        <span className="font-bold text-[var(--app-muted)] dark:text-slate-400 font-mono uppercase text-[10px]">Next-Cycle Recommendation:</span>
                                        <p className="text-[#38bdf8] font-bold mt-0.5 leading-relaxed font-mono">{dec.nextCycleRecommendation || dec.recommendation}</p>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {/* SECTION 4: INGESTED EVIDENCE LEDGER */}
            {(filterSection === 'all' || filterSection === 'evidence') && (
                <div className="space-y-6">
                    <div className="pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                        <h3 className="text-lg font-black text-[var(--app-text)] dark:text-slate-100 flex items-center gap-2">
                            <ShieldCheck size={18} className="text-[#38bdf8]" />
                            Ingested Upstream Evidence Ledger
                        </h3>
                        <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 mt-0.5">
                            Live telemetry inputs synthesized to produce this strategic audit report.
                        </p>
                    </div>

                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                        <div className="p-4 bg-[var(--app-card)] dark:bg-[#041527] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] dark:text-slate-400 uppercase font-mono">Individual Video Audits</span>
                            <div className="text-2xl font-black text-[var(--app-text)] dark:text-slate-100 font-mono">{auditReport.evidenceSummary?.individualCount || 0}</div>
                        </div>
                        <div className="p-4 bg-[var(--app-card)] dark:bg-[#041527] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] dark:text-slate-400 uppercase font-mono">Bulk Analysis</span>
                            <div className="text-2xl font-black text-[var(--app-text)] dark:text-slate-100 font-mono">{auditReport.evidenceSummary?.hasBulkAnalysis ? 'Synthesized' : 'Not Loaded'}</div>
                        </div>
                        <div className="p-4 bg-[var(--app-card)] dark:bg-[#041527] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] dark:text-slate-400 uppercase font-mono">Filtered Signals</span>
                            <div className="text-2xl font-black text-purple-700 dark:text-purple-400 font-mono">{auditReport.evidenceSummary?.noiseFilterSignalCount || 0}</div>
                        </div>
                        <div className="p-4 bg-[var(--app-card)] dark:bg-[#041527] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs space-y-1">
                            <span className="text-[10px] font-bold text-[var(--app-muted)] dark:text-slate-400 uppercase font-mono">Anomaly Signals</span>
                            <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono">{auditReport.evidenceSummary?.alertsCount || 0}</div>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
