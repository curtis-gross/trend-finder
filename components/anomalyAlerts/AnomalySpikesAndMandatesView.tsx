import React, { useState } from 'react';
import {
    Check,
    ExternalLink,
    Flame,
    Gamepad2,
    Youtube,
    Zap
} from 'lucide-react';
import { NoiseSourceConfig } from '../../services/noiseFilterService';
import { formatVideoTitle } from './useAlertsPersistence';

interface AnomalySpikesAndMandatesViewProps {
    activeCompany: string;
    monitoredKeyword: string;
    immediateGroundedAlerts: any[];
    youtubeAlertData: any;
    steamAlertData: any;
    pipelineSources: NoiseSourceConfig[];
    alertData: any;
}

export const AnomalySpikesAndMandatesView: React.FC<AnomalySpikesAndMandatesViewProps> = ({
    activeCompany,
    monitoredKeyword,
    immediateGroundedAlerts,
    youtubeAlertData,
    steamAlertData,
    pipelineSources,
    alertData
}) => {
    const [deployedActions, setDeployedActions] = useState<Record<string, boolean>>({});

    const handleDeployAction = (actionId: string) => {
        setDeployedActions(prev => ({ ...prev, [actionId]: true }));
    };

    const hasTopStreamCards = immediateGroundedAlerts.length > 0 || youtubeAlertData || steamAlertData;

    return (
        <>
            {/* Top Progressive Alert Stream Cards */}
            {hasTopStreamCards && (
                <div className="space-y-4 animate-fadeIn">
                    <div className="flex items-center gap-2">
                        <Flame size={18} className="text-amber-500" />
                        <h3 className="font-black text-[var(--app-text)] text-base">
                            Live Alerts: {monitoredKeyword}
                        </h3>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* 1. Grounded Trend Alerts */}
                        {immediateGroundedAlerts.slice(0, 1).map((alert, idx) => (
                            <div key={idx} className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs flex flex-col justify-between hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition relative overflow-hidden text-[var(--app-text)]">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className={`px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono tracking-wide ${
                                            alert.severity === 'critical' ? 'bg-rose-50 text-rose-700 border border-rose-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                        }`}>
                                            Grounded Alert
                                        </span>
                                        <span className="text-[11px] font-bold text-[var(--app-muted)]">{alert.source || 'News & Forums'}</span>
                                    </div>
                                    <h4 className="font-bold text-sm text-[var(--app-text)] mb-1 leading-snug">
                                        {alert.title}
                                    </h4>
                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed line-clamp-3">
                                        {alert.summary}
                                    </p>
                                </div>
                                {alert.url && alert.url.startsWith('http') && (
                                    <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex justify-end">
                                        <a
                                            href={alert.url}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="text-xs font-bold text-blue-700 hover:text-blue-700 flex items-center gap-1"
                                        >
                                            View Source <ExternalLink size={12} />
                                        </a>
                                    </div>
                                )}
                            </div>
                        ))}

                        {/* 2. YouTube Multi-Video Sentiment Alert */}
                        {youtubeAlertData && (
                            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs flex flex-col justify-between hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition relative overflow-hidden text-[var(--app-text)]">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono tracking-wide bg-rose-50 text-rose-700 border border-rose-200 flex items-center gap-1">
                                            <Youtube size={12} /> YouTube Sentiment
                                        </span>
                                        <span className="text-[11px] font-bold text-rose-700 font-mono">
                                            {youtubeAlertData.sentimentScore}% Working Well
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-[var(--app-text)] mb-2 leading-snug">
                                        {(youtubeAlertData.videos || []).length} Creator Videos
                                    </h4>

                                    <div className="space-y-2 pt-1">
                                        {(Array.isArray(youtubeAlertData.videos) ? youtubeAlertData.videos : []).slice(0, 3).map((v: any, idx: number) => (
                                            <div key={idx} className="flex items-center justify-between gap-2 text-[11px] bg-[var(--app-card)] px-2.5 py-2 rounded-xl border border-[var(--app-border)] hover:border-[var(--app-border)] transition">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className={`w-2 h-2 rounded-full shrink-0 ${v.searchIntent === 'positive' ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                                                    <span className="truncate text-[var(--app-text)] font-semibold">{formatVideoTitle(v.title, activeCompany)}</span>
                                                </div>
                                                <a href={v.videoUrl} target="_blank" rel="noreferrer" className="text-blue-700 dark:text-sky-300 hover:text-blue-700 dark:hover:text-white shrink-0 flex items-center gap-1 font-mono font-bold text-[10px] bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-100 dark:hover:bg-[#1A222E] px-2 py-0.5 rounded-md border border-[var(--app-border)] dark:border-[#041E3A] transition shadow-2xs">
                                                    Watch <ExternalLink size={9} />
                                                </a>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                                <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex justify-end items-center text-[11px] text-[var(--app-muted)] font-mono">
                                    <span className="text-[var(--app-text)] font-bold">{(youtubeAlertData.comments || []).length} Comments</span>
                                </div>
                            </div>
                        )}

                        {/* 3. Steam Verified Reviews Alert */}
                        {steamAlertData && (steamAlertData.reviews || []).length > 0 && pipelineSources.some(s => s.type === 'steam') && (
                            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs flex flex-col justify-between hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition relative overflow-hidden text-[var(--app-text)]">
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <span className="px-2.5 py-0.5 rounded-md text-[10px] font-bold uppercase font-mono tracking-wide bg-blue-50 text-blue-700 border border-blue-200 flex items-center gap-1">
                                            <Gamepad2 size={12} /> Steam Reviews
                                        </span>
                                        <span className="text-[11px] font-bold text-[var(--app-muted)] font-mono">
                                            {steamAlertData.sentimentScore}% Working Well
                                        </span>
                                    </div>
                                    <h4 className="font-bold text-sm text-[var(--app-text)] mb-1 leading-snug">
                                        {steamAlertData.appName} Community Feedback
                                    </h4>
                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed line-clamp-3">
                                        {(steamAlertData.reviews || []).length} customer reviews analyzed.
                                    </p>
                                </div>
                                <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex justify-between items-center">
                                    <span className="text-[11px] text-[var(--app-muted)] font-medium">App ID: {steamAlertData.appId}</span>
                                    <a
                                        href={`https://store.steampowered.com/app/${steamAlertData.appId}/`}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="text-xs font-bold text-blue-700 hover:text-blue-700 flex items-center gap-1"
                                    >
                                        Steam Hub <ExternalLink size={12} />
                                    </a>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            )}

            {/* Synthesized Anomaly Report Workspace */}
            {alertData && (
                <div className="space-y-8 animate-fadeIn">
                    {/* Executive Severity & Root Cause Card */}
                    <div className="bg-[var(--app-card)] rounded-3xl p-8 border border-[var(--app-border)] shadow-xs space-y-6 text-[var(--app-text)]">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--app-border)] pb-6">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="px-3 py-0.5 rounded-full text-xs font-bold uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                        {alertData.alertMetadata?.status || 'WARNING'}
                                    </span>
                                </div>
                                <h3 className="text-xl sm:text-2xl font-black text-[var(--app-text)]">
                                    {alertData.alertMetadata?.title || `Sentiment Anomaly Report: ${monitoredKeyword}`}
                                </h3>
                            </div>

                            <div className="flex items-center gap-6 bg-[var(--app-surface)] dark:bg-[#061C36] px-6 py-3 rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shrink-0">
                                <div>
                                    <span className="text-[11px] font-bold text-[var(--app-muted)] uppercase font-mono block">Severity Index</span>
                                    <span className="text-2xl font-black text-rose-600 font-mono">
                                        {alertData.alertMetadata?.severityScore || 24}/100
                                    </span>
                                </div>
                                <div className="border-l border-[var(--app-border)] pl-6">
                                    <span className="text-[11px] font-bold text-[var(--app-muted)] uppercase font-mono block">Monitored Volume</span>
                                    <span className="text-sm font-bold text-[var(--app-muted)] font-mono">
                                        {alertData.alertMetadata?.totalMentions || 'Verified Items'}
                                    </span>
                                </div>
                            </div>
                        </div>

                        {/* Executive Root Cause Summary */}
                        <div className="space-y-2">
                            <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] font-mono">
                                Root-Cause Diagnostic
                            </h4>
                            <p className="text-[var(--app-text)] text-sm sm:text-base leading-relaxed bg-[var(--app-surface)] dark:bg-[#061C36] p-6 rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] font-sans">
                                {alertData.executiveSummary}
                            </p>
                        </div>

                        {/* Key Anomalies Grid */}
                        {alertData.keyAnomalies && alertData.keyAnomalies.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] font-mono">
                                    Detected Anomalies
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(Array.isArray(alertData.keyAnomalies) ? alertData.keyAnomalies : []).map((anom: any, i: number) => (
                                        <div key={i} className="p-5 rounded-2xl border border-rose-200 bg-rose-50 flex flex-col justify-between text-[var(--app-text)] hover:border-rose-200 transition-all shadow-2xs">
                                            <div>
                                                <div className="flex items-center justify-between mb-2">
                                                    <span className="text-xs font-bold text-rose-700 font-mono">{anom.anomalyTitle}</span>
                                                    <span className="px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-rose-50 text-rose-700 border border-rose-200 font-mono">
                                                        {anom.affectedCohort}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--app-muted)] leading-relaxed font-sans">{anom.rootCause}</p>
                                            </div>
                                            <div className="pt-3 mt-3 border-t border-rose-200 flex items-center justify-between text-[11px] text-[var(--app-muted)] font-mono">
                                                <span>Source: {anom.channelSource}</span>
                                                {anom.verificationLink && (
                                                    <a href={anom.verificationLink} target="_blank" rel="noreferrer" className="text-[#0077C8] font-bold hover:underline flex items-center gap-1">
                                                        Verify Evidence <ExternalLink size={10} />
                                                    </a>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}

                        {/* Immediate Mitigations & Hotfix Deployment */}
                        {alertData.immediateMitigations && alertData.immediateMitigations.length > 0 && (
                            <div className="space-y-3">
                                <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)] font-mono">
                                    Recommended Actions
                                </h4>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {(Array.isArray(alertData.immediateMitigations) ? alertData.immediateMitigations : []).map((mit: any, idx: number) => {
                                        const isDeployed = deployedActions[String(mit.id || idx)];
                                        return (
                                            <div key={idx} className="p-5 rounded-2xl border border-[var(--app-border)] bg-[var(--app-card)] shadow-xs flex flex-col justify-between text-[var(--app-text)] hover:border-[var(--app-border)] transition-all">
                                                <div>
                                                    <div className="flex items-center justify-between mb-2">
                                                        <span className="font-black text-sm text-[var(--app-text)]">{mit.actionTitle}</span>
                                                        <span className="text-xs font-black text-blue-700 font-mono px-2 py-0.5 rounded bg-blue-50 border border-blue-200">{mit.estimatedImpact}</span>
                                                    </div>
                                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed mb-2 font-sans">{mit.payloadSnippet}</p>
                                                    <span className="text-[11px] font-mono text-[var(--app-muted)]">Department: {mit.department}</span>
                                                </div>
                                                <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex justify-end">
                                                    <button
                                                        onClick={() => handleDeployAction(String(mit.id || idx))}
                                                        disabled={isDeployed}
                                                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                                                            isDeployed
                                                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 cursor-default font-mono font-bold'
                                                                : 'bg-[#0077C8] hover:bg-[#005fa3] text-white shadow-xs'
                                                        }`}
                                                    >
                                                        {isDeployed ? (
                                                            <>
                                                                <Check size={14} /> Action Dispatched
                                                            </>
                                                        ) : (
                                                            <>
                                                                <Zap size={14} className="text-yellow-700 fill-yellow-300" /> Deploy Mitigation Strategy
                                                            </>
                                                        )}
                                                    </button>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* DEDICATED YOUTUBE VIDEO SENTIMENT ANALYSIS SECTION */}
                    {youtubeAlertData && youtubeAlertData.videos && youtubeAlertData.videos.length > 0 && (
                        <div className="bg-[var(--app-card)] rounded-3xl p-8 border border-[var(--app-border)] shadow-xs space-y-6 text-[var(--app-text)]">
                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                                <div className="flex items-center gap-2">
                                    <Youtube size={18} className="text-rose-700" />
                                    <h3 className="text-xl font-bold text-[var(--app-text)]">
                                        Creator Video Sentiment
                                    </h3>
                                </div>
                                <div className="text-xs font-mono font-bold text-[var(--app-muted)]">
                                    {(youtubeAlertData.videos || []).length} Videos • {(youtubeAlertData.comments || []).length} Comments
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {(Array.isArray(youtubeAlertData.videos) ? youtubeAlertData.videos : []).map((vid: any, idx: number) => {
                                    const analysis = vid.analysis || {};
                                    const alignment = vid.alignment || analysis.alignment || {};
                                    const isPositiveIntent = vid.searchIntent === 'positive';

                                    return (
                                        <div key={idx} className="bg-[var(--app-surface)] dark:bg-[#061C36] rounded-3xl p-5 border border-[var(--app-border)] dark:border-[#041E3A] flex flex-col justify-between hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] transition text-[var(--app-text)] shadow-xs">
                                            <div className="space-y-3">
                                                <div className="flex items-center justify-between">
                                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase font-mono ${
                                                        isPositiveIntent ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'
                                                    }`}>
                                                        {isPositiveIntent ? 'Working Well Query' : 'Needs Attention Query'}
                                                    </span>
                                                    <span className="text-[11px] font-bold text-[var(--app-muted)] truncate max-w-[120px]">
                                                        {vid.channelTitle}
                                                    </span>
                                                </div>

                                                <h4 className="font-bold text-sm text-[var(--app-text)] line-clamp-2 leading-snug">
                                                    {vid.title}
                                                </h4>

                                                <div className="grid grid-cols-2 gap-2 bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] text-center shadow-2xs">
                                                    <div>
                                                        <span className="text-[10px] text-[var(--app-muted)] uppercase font-mono block">Video Score</span>
                                                        <span className="text-sm font-bold text-[var(--app-text)] font-mono">
                                                            {vid.videoScore || 70}%
                                                        </span>
                                                    </div>
                                                    <div className="border-l border-[var(--app-border)]">
                                                        <span className="text-[10px] text-[var(--app-muted)] uppercase font-mono block">Comments</span>
                                                        <span className="text-sm font-bold text-[var(--app-text)] font-mono">
                                                            {vid.commentsScore || 65}%
                                                        </span>
                                                    </div>
                                                </div>

                                                <div className="bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] space-y-1 shadow-2xs">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-[11px] font-bold text-[var(--app-muted)]">Audience Alignment:</span>
                                                        <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                                                            alignment.status === 'Aligned' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-amber-50 text-amber-700 border border-amber-200'
                                                        }`}>
                                                            {alignment.status || 'Active'}
                                                        </span>
                                                    </div>
                                                    {alignment.creator_stance && (
                                                        <p className="text-[11px] text-[var(--app-muted)] line-clamp-2">
                                                            <strong>Stance:</strong> {alignment.creator_stance}
                                                        </p>
                                                    )}
                                                </div>
                                            </div>

                                            <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex items-center justify-between">
                                                <span className="text-[11px] text-[var(--app-muted)] font-mono">{vid.commentCount || 50} comments</span>
                                                <a
                                                    href={vid.videoUrl || `https://www.youtube.com/watch?v=${vid.videoId}`}
                                                    target="_blank"
                                                    rel="noreferrer"
                                                    className="text-xs font-bold text-rose-600 hover:text-rose-700 flex items-center gap-1"
                                                >
                                                    Watch Video <ExternalLink size={12} />
                                                </a>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
