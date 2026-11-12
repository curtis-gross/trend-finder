import React from 'react';
import {
    Activity, AlertTriangle, Filter, FolderArchive, History,
    Radio, RefreshCw, Sparkles, X, Youtube, Zap
} from 'lucide-react';
import { useAppConfig } from '../context/AppConfigContext';
import { useCompanyContext } from '../context/CompanyContext';
import { SentimentAnomalyAlertsProps, useAlertsPersistence } from './anomalyAlerts/useAlertsPersistence';
import { useParallelChannelScan } from './anomalyAlerts/useParallelChannelScan';
import { useExecutiveAudioPlayer } from './anomalyAlerts/useExecutiveAudioPlayer';
import { ExecutiveAudioBriefingCard } from './anomalyAlerts/ExecutiveAudioBriefingCard';
import { AnomalySpikesAndMandatesView } from './anomalyAlerts/AnomalySpikesAndMandatesView';
import { AnomalyEvidenceStreamView } from './anomalyAlerts/AnomalyEvidenceStreamView';

export type { SentimentAnomalyAlertsProps };

export const SentimentAnomalyAlerts: React.FC<SentimentAnomalyAlertsProps> = () => {
    const { config } = useAppConfig();
    const { name: companyName } = useCompanyContext();
    const activeCompany = companyName || config?.branding?.companyName || 'test-company';

    const persistence = useAlertsPersistence(activeCompany);
    const {
        pipelineSources, monitoredKeyword, isLoading, progressPercent,
        statusMessage, apiError, setApiError, threadStatus,
        immediateGroundedAlerts, youtubeAlertData, steamAlertData,
        alertData, setAlertData, setTalkTrackSynced, pastRuns,
        selectedVoice, setSelectedVoice, loadSavedRun,
        handleSelectPastRun, autoSaveDualRuns
    } = persistence;

    const { handleStartLiveMonitor } = useParallelChannelScan(activeCompany, persistence);

    const {
        isPlaying, audioProgress, currentTimeSec, playbackRate, isMuted,
        ttsError, setTtsError, isGeneratingTts, isGeneratingAudioBrief,
        currentSpokenIndex, togglePlayAudio, handleRestartAudio, handleSeek,
        handleSpeedChange, handleToggleMute, handleVoiceChange,
        handleRegenerateAudioBrief, formatTime
    } = useExecutiveAudioPlayer({
        activeCompany, monitoredKeyword, alertData, setAlertData,
        immediateGroundedAlerts, youtubeAlertData, steamAlertData,
        selectedVoice, setSelectedVoice, setTalkTrackSynced, autoSaveDualRuns
    });

    const stepChipClass = (status: string, runningCls: string) =>
        status === 'completed'
            ? 'bg-emerald-50 dark:bg-[#061C36] border-emerald-200 dark:border-emerald-700/50 text-emerald-700 dark:text-emerald-300 font-semibold'
            : status === 'running'
            ? `${runningCls} animate-pulse font-semibold`
            : 'bg-[var(--app-surface)] dark:bg-[#061C36] border-[var(--app-border)] dark:border-[#041E3A] text-[var(--app-muted)]';

    return (
        <div className="max-w-7xl mx-auto space-y-8 animate-fadeIn pb-16 bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)]">
            <div className="bg-[var(--app-card)] dark:bg-[#041527] rounded-3xl p-4 sm:p-6 text-[var(--app-text)] shadow-xs border border-[var(--app-border)] dark:border-[#041E3A] relative overflow-hidden space-y-4">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3">
                    {pastRuns.length > 0 ? (
                        <div className="flex flex-row items-center gap-2 flex-wrap min-w-0 flex-1">
                            <span className="text-xs font-bold text-[var(--app-muted)] flex items-center gap-1.5 font-mono whitespace-nowrap">
                                <History size={13} className="text-[#0077C8] shrink-0" /> Saved Results ({pastRuns.length}):
                            </span>
                            {pastRuns.map((record) => {
                                const isSelected = monitoredKeyword === record.keyword;
                                return (
                                    <button
                                        key={record.id}
                                        onClick={() => handleSelectPastRun(record)}
                                        disabled={isLoading}
                                        className={`px-2.5 sm:px-3 py-1 rounded-xl text-xs font-semibold border transition flex flex-row items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer ${
                                            isSelected
                                                ? 'bg-blue-50 dark:bg-[#041E3A] text-blue-700 dark:text-white border-blue-200 dark:border-[#041E3A] font-bold shadow-xs'
                                                : 'bg-[var(--app-card)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] border-[var(--app-border)] dark:border-[#041E3A] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] hover:text-[var(--app-text)] dark:hover:text-white'
                                        }`}
                                    >
                                        <span>#{record.keyword}</span>
                                        <span className={`text-[10px] px-1.5 py-0.2 rounded font-mono ${isSelected ? 'bg-blue-50 dark:bg-[#061C36] text-blue-700 dark:text-sky-300 font-bold' : 'bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-muted)]'}`}>
                                            {record.timestamp?.split(',')[1]?.trim() || record.timestamp || 'Saved'}
                                        </span>
                                    </button>
                                );
                            })}
                        </div>
                    ) : null}

                    <div className="flex flex-row items-center gap-2 flex-nowrap shrink-0 ml-auto">
                        <button
                            onClick={() => void loadSavedRun(false)}
                            disabled={isLoading}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[var(--app-card)] dark:bg-[#061C36] hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E] text-[var(--app-text)] dark:text-[#D8E1EB] dark:hover:text-white border border-[var(--app-border)] dark:border-[#041E3A] font-bold rounded-xl text-xs shadow-xs transition flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                            title="Load last saved anomaly run from GCS"
                        >
                            <FolderArchive size={14} className="text-[var(--app-muted)] shrink-0" /> Load Last
                        </button>
                        <button
                            onClick={() => void handleStartLiveMonitor()}
                            disabled={isLoading}
                            className="px-3 sm:px-4 py-1.5 sm:py-2 bg-[#0077C8] hover:bg-[#005fa3] text-white font-bold rounded-xl text-xs shadow-xs transition flex flex-row items-center justify-center gap-1.5 whitespace-nowrap shrink-0 disabled:opacity-50 cursor-pointer"
                            title="Scan live comments across Reddit, YouTube, Steam and Filter Pipeline"
                        >
                            {isLoading ? <><RefreshCw size={14} className="animate-spin shrink-0" /> Scanning...</> : <><Zap size={14} className="text-white shrink-0" /> Scan Live Feeds</>}
                        </button>
                    </div>
                </div>

                {apiError && (
                    <div role="alert" className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 rounded-2xl p-4 text-rose-700 dark:text-rose-200 flex items-center justify-between gap-3 shadow-xs animate-fadeIn">
                        <div className="flex items-center gap-3 min-w-0">
                            <AlertTriangle size={18} className="text-rose-700 dark:text-rose-400 shrink-0" />
                            <span className="text-xs font-semibold break-words">{apiError}</span>
                        </div>
                        <button onClick={() => setApiError(null)} aria-label="Dismiss error" className="text-rose-700 dark:text-rose-300 hover:opacity-80 transition shrink-0 cursor-pointer"><X size={16} /></button>
                    </div>
                )}

                {isLoading && (
                    <div className="bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] space-y-4 animate-fadeIn shadow-xs">
                        <div className="space-y-2">
                            <div className="flex items-center justify-between text-xs font-mono">
                                <span className="text-blue-700 font-bold flex items-center gap-2">
                                    <Activity size={14} className="animate-spin text-[#0077C8]" /> {statusMessage}
                                </span>
                                <span className="text-[#0077C8] font-black">{progressPercent}%</span>
                            </div>
                            <div className="w-full bg-[var(--app-surface)] rounded-full h-2.5 overflow-hidden border border-[var(--app-border)]">
                                <div className="bg-gradient-to-r from-[#0077C8] via-blue-500 to-[#0077C8] h-2.5 rounded-full transition-all duration-500 shadow-xs" style={{ width: `${progressPercent}%` }} />
                            </div>
                        </div>

                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs">
                            <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${stepChipClass(threadStatus.pipeline, 'bg-blue-50 dark:bg-[#041E3A] border-blue-200 dark:border-sky-500/50 text-blue-700 dark:text-sky-300')}`}>
                                <Filter size={14} className={threadStatus.pipeline === 'running' ? 'animate-spin' : ''} />
                                <span className="truncate font-semibold">1. Filter Pipeline</span>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${stepChipClass(threadStatus.grounded, 'bg-blue-50 dark:bg-[#041E3A] border-blue-200 dark:border-sky-500/50 text-blue-700 dark:text-sky-300')}`}>
                                <Radio size={14} className={threadStatus.grounded === 'running' ? 'animate-spin' : ''} />
                                <span className="truncate font-semibold">2. Grounded Trends</span>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${stepChipClass(threadStatus.youtube, 'bg-rose-50 dark:bg-[#041E3A] border-rose-200 dark:border-rose-500/50 text-rose-700 dark:text-rose-300')}`}>
                                <Youtube size={14} className={threadStatus.youtube === 'running' ? 'animate-spin' : ''} />
                                <span className="truncate font-semibold">3. YouTube Analysis</span>
                            </div>
                            <div className={`p-2.5 rounded-xl border flex items-center gap-2 transition ${stepChipClass(threadStatus.synthesis, 'bg-purple-50 dark:bg-[#041E3A] border-purple-200 dark:border-purple-500/50 text-purple-700 dark:text-purple-300')}`}>
                                <Sparkles size={14} className={threadStatus.synthesis === 'running' ? 'animate-spin' : ''} />
                                <span className="truncate font-semibold">4. Master Synthesis</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {alertData?.dailySummaryBrief && (
                <ExecutiveAudioBriefingCard
                    dailySummaryBrief={alertData.dailySummaryBrief}
                    monitoredKeyword={monitoredKeyword}
                    selectedVoice={selectedVoice}
                    isGeneratingTts={isGeneratingTts}
                    isGeneratingAudioBrief={isGeneratingAudioBrief}
                    isLoading={isLoading}
                    ttsError={ttsError}
                    onDismissTtsError={() => setTtsError(null)}
                    isPlaying={isPlaying}
                    onTogglePlay={togglePlayAudio}
                    onRestartAudio={handleRestartAudio}
                    currentTimeSec={currentTimeSec}
                    audioProgress={audioProgress}
                    onSeek={handleSeek}
                    playbackRate={playbackRate}
                    onSpeedChange={handleSpeedChange}
                    isMuted={isMuted}
                    onToggleMute={handleToggleMute}
                    onVoiceChange={(v) => void handleVoiceChange(v)}
                    onRegenerateAudioBrief={() => void handleRegenerateAudioBrief()}
                    currentSpokenIndex={currentSpokenIndex}
                    formatTime={formatTime}
                />
            )}

            {!isLoading && (
                <div className="space-y-8">
                    <AnomalySpikesAndMandatesView
                        activeCompany={activeCompany}
                        monitoredKeyword={monitoredKeyword}
                        immediateGroundedAlerts={immediateGroundedAlerts}
                        youtubeAlertData={youtubeAlertData}
                        steamAlertData={steamAlertData}
                        pipelineSources={pipelineSources}
                        alertData={alertData}
                    />
                    {alertData?.sampleFeed && <AnomalyEvidenceStreamView sampleFeed={alertData.sampleFeed} />}
                </div>
            )}
        </div>
    );
};
