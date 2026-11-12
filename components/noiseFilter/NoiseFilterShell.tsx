import React from 'react';
import {
    AlertTriangle,
    CheckCircle2,
    DownloadCloud,
    Filter,
    Loader2,
    Network,
    Radio,
    RefreshCw,
    Share2,
    Sparkles,
    Tag,
    Trash2,
    TrendingUp,
    X,
    Zap
} from 'lucide-react';

export interface NoiseFilterShellProps {
    stageMode: 'all' | 'pipeline' | 'graph' | 'trajectory';
    activeStage: 'listen' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';
    setActiveStage: (stage: 'listen' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5') => void;
    isLoading: boolean;
    isHydratingCheckpoints: boolean;
    isRunningFullPipeline: boolean;
    fullPipelineStep: number;
    fullPipelineStepStatus: string;
    pipelineError: string | null;
    setPipelineError: (err: string | null) => void;
    statusMessage: string;
    setStatusMessage: (msg: string) => void;
    confirmingWipe: boolean;
    hasRawComments: boolean;
    hasStage2Data: boolean;
    hasStage3Data: boolean;
    hasStage4Data: boolean;
    onRunEntirePipeline: () => void;
    onInitCheckpoints: () => void;
    onWipePipeline: () => void;
    onReloadRawComments: () => void;
    onFilterComments: () => void;
    onConvertToKeywords: () => void;
    onBuildRelationshipGraph: () => void;
    onRebuildTrajectory: () => void;
}

export const NoiseFilterShell: React.FC<NoiseFilterShellProps> = ({
    stageMode,
    activeStage,
    setActiveStage,
    isLoading,
    isHydratingCheckpoints,
    isRunningFullPipeline,
    fullPipelineStep,
    fullPipelineStepStatus,
    pipelineError,
    setPipelineError,
    statusMessage,
    setStatusMessage,
    confirmingWipe,
    hasRawComments,
    hasStage2Data,
    hasStage3Data,
    hasStage4Data,
    onRunEntirePipeline,
    onInitCheckpoints,
    onWipePipeline,
    onReloadRawComments,
    onFilterComments,
    onConvertToKeywords,
    onBuildRelationshipGraph,
    onRebuildTrajectory
}) => {
    return (
        <>
            {/* Header Bar (Actionable Controls Only) */}
            <div className="flex flex-row items-center justify-between gap-2 overflow-x-auto no-scrollbar bg-[var(--app-surface)] dark:bg-[#041527] px-4 sm:px-6 py-3 rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs">
                <div className="flex flex-row items-center gap-2 shrink-0">
                    {(stageMode === 'all' || stageMode === 'pipeline') && (
                        <button
                            type="button"
                            onClick={onRunEntirePipeline}
                            disabled={isLoading || isRunningFullPipeline}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#0072BC] hover:bg-[#0284C7] text-white keep-white-text border border-[#0072BC]/60 rounded-xl text-xs font-black tracking-wide transition-all shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                            title="Scan all videos (update ABCD, sentiment & comments) and sequentially run Ingest, Filter, Topics, Graph, and Trajectory"
                        >
                            {isRunningFullPipeline ? (
                                <>
                                    <Loader2 size={14} className="animate-spin text-white shrink-0" />
                                    <span>Running Pipeline (Step {fullPipelineStep}/6)...</span>
                                </>
                            ) : (
                                <>
                                    <Zap size={14} className="text-white shrink-0" />
                                    <span>Run Entire Pipeline</span>
                                </>
                            )}
                        </button>
                    )}
                </div>

                <div className="flex flex-row items-center gap-2 shrink-0">
                    <button
                        type="button"
                        onClick={onInitCheckpoints}
                        disabled={isLoading || isHydratingCheckpoints}
                        className="px-2.5 sm:px-3.5 py-1.5 bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-100 dark:hover:bg-[#1A222E] text-[var(--app-text)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        title="Reload all checkpoints from GCS"
                    >
                        <RefreshCw size={13} className={isHydratingCheckpoints ? 'animate-spin text-[#0072BC] shrink-0' : 'shrink-0'} />
                        <span>Reload Checkpoints</span>
                    </button>

                    <button
                        type="button"
                        onClick={onWipePipeline}
                        disabled={isLoading}
                        className={`px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all shadow-2xs hover:shadow-xs inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50 border ${
                            confirmingWipe
                                ? 'bg-rose-600 hover:bg-rose-700 text-white keep-white-text border-rose-700 animate-pulse'
                                : 'bg-rose-50 dark:bg-[#061C36] hover:bg-rose-100 dark:hover:bg-[#1A222E] text-rose-700 dark:text-rose-300 border-rose-200 dark:border-[#041E3A]'
                        }`}
                        title="Wipe local and cloud checkpoints and reset pipeline for this company"
                    >
                        <Trash2 size={13} className="shrink-0" />
                        <span>{confirmingWipe ? 'Confirm Wipe?' : 'Wipe Pipeline'}</span>
                    </button>

                    {activeStage === 'stage1' && (
                        <button
                            type="button"
                            onClick={onReloadRawComments}
                            disabled={isLoading}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#041E3A] hover:bg-[#062B54] text-white keep-white-text border border-[#1E3A5F] rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                            <DownloadCloud size={14} className={isLoading ? 'animate-pulse shrink-0' : 'shrink-0'} />
                            <span>{isLoading ? 'Harvesting Sources...' : 'Reload Comments (Live Harvest)'}</span>
                        </button>
                    )}

                    {activeStage === 'stage2' && (
                        <button
                            type="button"
                            onClick={onFilterComments}
                            disabled={isLoading || !hasRawComments}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#041E3A] hover:bg-[#062B54] text-white keep-white-text border border-[#1E3A5F] rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                            <Filter size={14} className={isLoading ? 'animate-pulse shrink-0' : 'shrink-0'} />
                            <span>{isLoading ? 'Filtering Comments...' : 'Filter Comments'}</span>
                        </button>
                    )}

                    {activeStage === 'stage3' && (
                        <button
                            type="button"
                            onClick={onConvertToKeywords}
                            disabled={isLoading || !hasStage2Data}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#041E3A] hover:bg-[#062B54] text-white keep-white-text border border-[#1E3A5F] rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                            <Sparkles size={14} className={isLoading ? 'animate-pulse shrink-0' : 'shrink-0'} />
                            <span>{isLoading ? 'Extracting Topics...' : 'Extract Topics'}</span>
                        </button>
                    )}

                    {activeStage === 'stage4' && (
                        <button
                            type="button"
                            onClick={onBuildRelationshipGraph}
                            disabled={isLoading || !hasStage3Data}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#041E3A] hover:bg-[#062B54] text-white keep-white-text border border-[#1E3A5F] rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                        >
                            <Network size={14} className={isLoading ? 'animate-pulse shrink-0' : 'shrink-0'} />
                            <span>{isLoading ? 'Building Graph...' : 'Build Graph'}</span>
                        </button>
                    )}

                    {activeStage === 'stage5' && (
                        <button
                            type="button"
                            onClick={onRebuildTrajectory}
                            disabled={isLoading || (!hasStage3Data && !hasStage4Data)}
                            className="px-2.5 sm:px-3.5 py-1.5 bg-[#041E3A] hover:bg-[#062B54] text-white keep-white-text border border-[#1E3A5F] rounded-xl text-xs font-bold transition-all shadow-xs hover:shadow-sm inline-flex items-center gap-1.5 whitespace-nowrap cursor-pointer disabled:opacity-50"
                            title="Re-synthesize trajectory pillars directly from saved Stage 3 topics and save dedicated checkpoint"
                        >
                            <TrendingUp size={14} className={isLoading ? 'animate-pulse shrink-0' : 'shrink-0'} />
                            <span>{isLoading ? 'Synthesizing Trajectory...' : 'Rebuild Trajectory'}</span>
                        </button>
                    )}
                </div>
            </div>

            {/* Zero Silent Fallbacks Error Banner */}
            {pipelineError && (
                <div className="flex items-start justify-between gap-3 px-4 py-3 bg-rose-50 dark:bg-[#041527] border border-rose-300 dark:border-rose-700/70 rounded-2xl text-xs font-mono text-rose-800 dark:text-rose-200 shadow-md animate-fadeIn">
                    <div className="flex items-start gap-2.5">
                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div>
                            <span className="font-black uppercase tracking-wider text-rose-700 dark:text-rose-300 block">
                                Pipeline Execution Error (Zero Silent Fallbacks)
                            </span>
                            <span className="text-rose-800 dark:text-rose-100 mt-0.5 block break-all">{pipelineError}</span>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={() => setPipelineError(null)}
                        className="text-rose-700 dark:text-rose-300 hover:text-[var(--app-text)] dark:hover:text-white p-1 rounded-lg hover:bg-rose-100 dark:hover:bg-[#1A222E] transition cursor-pointer shrink-0"
                        title="Dismiss error"
                    >
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* 6-Step Full Pipeline Live Progress Tracker */}
            {isRunningFullPipeline && (
                <div className="bg-[var(--app-surface)] border border-indigo-200 rounded-2xl p-4 space-y-3 shadow-md animate-fadeIn">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className="flex items-center gap-2 text-xs font-black text-[var(--app-text)] font-mono">
                            <Loader2 size={14} className="animate-spin text-[#0077C8]" />
                            <span>EXECUTING FULL 6-STAGE DEEP MEDIA PIPELINE (STEP {fullPipelineStep}/6)</span>
                        </div>
                        <span className="text-[11px] font-mono text-indigo-700 truncate max-w-xl">
                            {fullPipelineStepStatus || statusMessage}
                        </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
                        {[
                            { step: 1, label: '1. Scan Videos', sub: 'ABCD, Sentiment & Comments' },
                            { step: 2, label: '2. Raw Ingest', sub: 'Multi-Channel Harvest' },
                            { step: 3, label: '3. Filter Noise', sub: 'Signal Isolation' },
                            { step: 4, label: '4. Topics', sub: 'Keyword & Domain Induction' },
                            { step: 5, label: '5. Topic Graph', sub: '60+ Node Network' },
                            { step: 6, label: '6. Trajectory', sub: '2022–2027 Evolution' }
                        ].map((item) => {
                            const isDone = fullPipelineStep > item.step;
                            const isCurrent = fullPipelineStep === item.step;
                            return (
                                <div
                                    key={item.step}
                                    className={`px-3 py-2 rounded-xl border text-[11px] font-mono transition-all ${
                                        isCurrent
                                            ? 'bg-indigo-50 border-indigo-500 text-[var(--app-text)] shadow-xs'
                                            : isDone
                                            ? 'bg-emerald-50 border-emerald-200 text-emerald-700'
                                            : 'bg-[var(--app-card)] border-[var(--app-border)] text-[var(--app-muted)]'
                                    }`}
                                >
                                    <div className="flex items-center justify-between gap-1 font-bold">
                                        <span>{item.label}</span>
                                        {isDone ? (
                                            <CheckCircle2 size={12} className="text-emerald-600 shrink-0" />
                                        ) : isCurrent ? (
                                            <Loader2 size={12} className="animate-spin text-indigo-600 shrink-0" />
                                        ) : null}
                                    </div>
                                    <div className="text-[9.5px] opacity-80 truncate mt-0.5">{item.sub}</div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Status Toast */}
            {statusMessage && !isRunningFullPipeline && (
                <div className="flex items-center justify-between gap-2 px-4 py-2.5 bg-[#0077C8]/15 border border-[#349DD4]/30 rounded-xl text-xs font-bold font-mono text-[#0077C8] animate-fadeIn">
                    <div className="flex items-center gap-2 min-w-0">
                        <Radio size={14} className="animate-pulse text-[#0077C8] shrink-0" />
                        <span className="truncate">{statusMessage}</span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setStatusMessage('')}
                        className="text-[var(--app-muted)] hover:text-[var(--app-text)] p-1 rounded-lg hover:bg-[var(--app-surface)] transition cursor-pointer shrink-0"
                        title="Dismiss status message"
                    >
                        <X size={13} />
                    </button>
                </div>
            )}

            {/* STAGES COMPACT SUB-TABS NAVIGATION */}
            {(stageMode === 'all' || stageMode === 'pipeline') && (
                <div className="bg-[var(--app-surface)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl px-3 sm:px-4 py-2.5 shadow-xs">
                    <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                        {[
                            { id: 'listen', icon: Radio, title: '1: Listen' },
                            { id: 'stage1', icon: DownloadCloud, title: '2: Raw Ingest' },
                            { id: 'stage2', icon: Filter, title: '3: Filter Noise' },
                            { id: 'stage3', icon: Tag, title: '4: Topics' },
                            ...(stageMode === 'all' ? [
                                { id: 'stage4', icon: Share2, title: '5: Graph' },
                                { id: 'stage5', icon: TrendingUp, title: '6: Trajectory' }
                            ] : [])
                        ].map((s) => {
                            const Icon = s.icon;
                            const isActive = activeStage === s.id;
                            return (
                                <button
                                    key={s.id}
                                    type="button"
                                    onClick={() => setActiveStage(s.id as any)}
                                    className={`inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer ${
                                        isActive
                                            ? 'bg-blue-50 dark:bg-[#041E3A] text-blue-700 dark:text-white border border-blue-200 dark:border-[#041E3A] shadow-xs font-bold'
                                            : 'bg-[var(--app-card)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                    }`}
                                >
                                    <Icon size={13} className={isActive ? 'text-[#0077C8] shrink-0' : 'text-[var(--app-muted)] shrink-0'} />
                                    <span>{s.title}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>
            )}
        </>
    );
};
