import React from 'react';
import {
    ShieldCheck,
    Sparkles,
    RefreshCw,
    Save,
    TrendingUp,
    Layers,
    Radio,
    Calendar,
    Target
} from 'lucide-react';
import { useCompanyContext } from '../context/CompanyContext';
import { useTheme } from '../contexts/ThemeContext';
import { useInsightAuditState } from './insightAudit/useInsightAuditState';
import { AuditExecutiveVisualDeck } from './insightAudit/AuditExecutiveVisualDeck';
import { AuditRoadmapAndMatrixCards } from './insightAudit/AuditRoadmapAndMatrixCards';

export const InsightAudit: React.FC = () => {
    const { name: companyName } = useCompanyContext();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const activeCompany = companyName || 'test-company';

    const {
        auditReport,
        isLoading,
        isSaving,
        statusMessage,
        selectedHorizon,
        setSelectedHorizon,
        filterSection,
        setFilterSection,
        visualTelemetry,
        loadSavedAudit,
        handleRunAudit,
        handleManualSave
    } = useInsightAuditState(activeCompany, isDark);

    const isErrorStatus = /failed|error/i.test(statusMessage || '');

    return (
        <div className="max-w-7xl mx-auto w-full px-4 sm:px-6 py-8 space-y-8 animate-fadeIn bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)] dark:text-slate-100">
            {/* Header */}
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-[var(--app-border)] dark:border-[#041E3A]">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-50 dark:bg-[#061C36] text-blue-700 dark:text-sky-300 border border-blue-200 dark:border-[#041E3A] uppercase tracking-wider flex items-center gap-1.5 font-mono whitespace-nowrap">
                            <ShieldCheck size={13} className="shrink-0" /> Strategic Synthesis
                        </span>
                        <span className="text-xs font-medium text-[var(--app-muted)] dark:text-slate-400">
                            Unified Cross-Insight Evidence & Decision Horizon
                        </span>
                    </div>
                    <h2 className="text-xl sm:text-2xl font-black text-[var(--app-text)] dark:text-slate-100 tracking-tight">
                        Insight Audit & Horizon Roadmap
                    </h2>
                </div>

                <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar max-w-full shrink-0">
                    <button
                        onClick={() => void loadSavedAudit(false)}
                        disabled={isLoading}
                        className="flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-[var(--app-text)] dark:text-slate-200 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                        title="Load last run from GCS"
                    >
                        <RefreshCw size={14} className={`shrink-0 ${isLoading ? 'animate-spin' : ''}`} />
                        <span>Load Last</span>
                    </button>
                    <button
                        onClick={() => void handleManualSave()}
                        disabled={isSaving || !auditReport}
                        className="flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold text-[var(--app-text)] dark:text-slate-200 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl shadow-xs transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
                    >
                        <Save size={14} className="shrink-0" />
                        <span>{isSaving ? 'Saving...' : 'Save to GCS'}</span>
                    </button>
                    <button
                        onClick={() => void handleRunAudit()}
                        disabled={isLoading}
                        className="flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 text-xs font-bold rounded-xl shadow-xs transition-all bg-[#0077C8] hover:bg-[#005fa3] text-white disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                        <Sparkles size={14} className="shrink-0" />
                        <span>{isLoading ? 'Synthesizing with Gemini 3.8 Flash...' : 'Run Insight Audit'}</span>
                    </button>
                </div>
            </div>

            {/* Status Toast */}
            {statusMessage && (
                <div
                    role={isErrorStatus ? 'alert' : 'status'}
                    className={`flex items-center gap-2 px-4 py-2.5 border rounded-xl text-xs font-medium animate-fadeIn font-mono ${
                        isErrorStatus
                            ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-200 dark:border-rose-500/40 text-rose-700 dark:text-rose-200'
                            : 'bg-blue-50 dark:bg-[#041527] border-blue-200 dark:border-[#041E3A] text-blue-700 dark:text-sky-300'
                    }`}
                >
                    <Radio size={14} className={`shrink-0 ${isErrorStatus ? 'text-rose-600 dark:text-rose-400' : 'animate-pulse text-blue-700 dark:text-sky-400'}`} />
                    <span className="break-words">{statusMessage}</span>
                </div>
            )}

            {/* QUICK VIEW FILTER BUTTONS */}
            <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar max-w-full border-b border-[var(--app-border)] dark:border-[#041E3A] pb-3">
                <button
                    onClick={() => setFilterSection('all')}
                    className={`flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        filterSection === 'all'
                            ? 'bg-[#0077C8] text-white shadow-xs'
                            : 'text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white shadow-xs'
                    }`}
                >
                    <Layers size={14} className="shrink-0" /> <span>All Insights</span>
                </button>
                <button
                    onClick={() => setFilterSection('roadmap')}
                    className={`flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        filterSection === 'roadmap'
                            ? 'bg-[#0077C8] text-white shadow-xs'
                            : 'text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white shadow-xs'
                    }`}
                >
                    <Calendar size={14} className="shrink-0" /> <span>Horizon Action Plan (1W • 1M • 1Y)</span>
                </button>
                <button
                    onClick={() => setFilterSection('doubledown')}
                    className={`flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        filterSection === 'doubledown'
                            ? 'bg-[#0077C8] text-white shadow-xs'
                            : 'text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white shadow-xs'
                    }`}
                >
                    <TrendingUp size={14} className="shrink-0" /> <span>Near-Term Action Priorities</span>
                </button>
                <button
                    onClick={() => setFilterSection('gonogo')}
                    className={`flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        filterSection === 'gonogo'
                            ? 'bg-[#0077C8] text-white shadow-xs'
                            : 'text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white shadow-xs'
                    }`}
                >
                    <Target size={14} className="shrink-0" /> <span>Next-Cycle Go/No-Go Matrix</span>
                </button>
                <button
                    onClick={() => setFilterSection('evidence')}
                    className={`flex flex-row items-center gap-1.5 px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                        filterSection === 'evidence'
                            ? 'bg-[#0077C8] text-white shadow-xs'
                            : 'text-[var(--app-muted)] dark:text-slate-300 bg-[var(--app-card)] dark:bg-[#041527] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white shadow-xs'
                    }`}
                >
                    <ShieldCheck size={14} className="shrink-0" /> <span>Ingested Evidence</span>
                </button>
            </div>

            {auditReport && (
                <div className="space-y-12">
                    {visualTelemetry && (
                        <AuditExecutiveVisualDeck
                            auditReport={auditReport}
                            visualTelemetry={visualTelemetry}
                            isDark={isDark}
                        />
                    )}
                    <AuditRoadmapAndMatrixCards
                        auditReport={auditReport}
                        filterSection={filterSection}
                        selectedHorizon={selectedHorizon}
                        onSelectHorizon={setSelectedHorizon}
                    />
                </div>
            )}

            {!auditReport && (
                <div className="text-center py-20 bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs space-y-4">
                    <ShieldCheck size={48} className="mx-auto text-[#38bdf8] bg-blue-50 dark:bg-[#061C36] p-3 rounded-2xl border border-blue-200 dark:border-[#041E3A]" />
                    <div className="space-y-1">
                        <h3 className="text-lg font-bold text-[var(--app-text)] dark:text-slate-100">Insight Audit Not Generated Yet</h3>
                        <p className="text-xs text-[var(--app-muted)] dark:text-slate-400 max-w-md mx-auto">
                            Synthesize insights across all channels, noise filtering, and sentiment alerts into a unified horizon roadmap.
                        </p>
                    </div>
                    <button
                        onClick={() => void handleRunAudit()}
                        disabled={isLoading}
                        className="inline-flex flex-row items-center gap-2 mx-auto px-5 py-2 text-xs font-bold shadow-xs bg-[#0077C8] hover:bg-[#005fa3] text-white rounded-xl transition-all whitespace-nowrap cursor-pointer disabled:opacity-50"
                    >
                        <Sparkles size={16} className="shrink-0" /> Run Insight Audit
                    </button>
                </div>
            )}
        </div>
    );
};
