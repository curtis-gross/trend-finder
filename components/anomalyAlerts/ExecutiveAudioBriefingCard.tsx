import React from 'react';
import {
    AlertCircle,
    FileText,
    Headphones,
    Pause,
    Play,
    Radio,
    RotateCcw,
    Sparkles,
    Volume2,
    VolumeX,
    Zap
} from 'lucide-react';

interface ExecutiveAudioBriefingCardProps {
    dailySummaryBrief: any;
    monitoredKeyword: string;
    selectedVoice: string;
    isGeneratingTts: boolean;
    isGeneratingAudioBrief: boolean;
    isLoading: boolean;
    ttsError: string | null;
    onDismissTtsError: () => void;
    isPlaying: boolean;
    onTogglePlay: () => void;
    onRestartAudio: () => void;
    currentTimeSec: number;
    audioProgress: number;
    onSeek: (e: React.ChangeEvent<HTMLInputElement>) => void;
    playbackRate: number;
    onSpeedChange: (speed: number) => void;
    isMuted: boolean;
    onToggleMute: () => void;
    onVoiceChange: (voiceName: string) => void;
    onRegenerateAudioBrief: () => void;
    currentSpokenIndex: number;
    formatTime: (seconds: number) => string;
}

export const ExecutiveAudioBriefingCard: React.FC<ExecutiveAudioBriefingCardProps> = ({
    dailySummaryBrief,
    monitoredKeyword,
    selectedVoice,
    isGeneratingTts,
    isGeneratingAudioBrief,
    isLoading,
    ttsError,
    onDismissTtsError,
    isPlaying,
    onTogglePlay,
    onRestartAudio,
    currentTimeSec,
    audioProgress,
    onSeek,
    playbackRate,
    onSpeedChange,
    isMuted,
    onToggleMute,
    onVoiceChange,
    onRegenerateAudioBrief,
    currentSpokenIndex,
    formatTime
}) => {
    if (!dailySummaryBrief) return null;

    return (
        <div className="bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-text)] rounded-3xl p-4 sm:p-6 md:p-8 shadow-xs border border-[var(--app-border)] dark:border-[#041E3A] relative overflow-hidden space-y-6 animate-fadeIn">
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 lg:gap-6 relative z-10">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                    <div className="p-3 sm:p-3.5 bg-blue-50 dark:bg-[#061C36] text-blue-700 dark:text-sky-300 rounded-2xl border border-blue-200 dark:border-[#041E3A] shadow-xs shrink-0">
                        <Headphones size={24} className="text-blue-700 dark:text-sky-300 sm:w-7 sm:h-7" />
                    </div>
                    <div className="min-w-0">
                        <h3 className="text-lg sm:text-xl md:text-2xl font-black text-[var(--app-text)]">
                            {dailySummaryBrief.title || `Daily Brief: ${monitoredKeyword}`}
                        </h3>
                    </div>
                </div>

                {/* Voice Selector & Regenerate */}
                <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar max-w-full w-full lg:w-auto lg:justify-end">
                    <div className="flex flex-row items-center gap-1 bg-[var(--app-card)] dark:bg-[#061C36] px-2 py-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs flex-nowrap shrink-0">
                        <span className="text-[var(--app-muted)] font-mono text-[11px] px-1 whitespace-nowrap shrink-0">Voice:</span>
                        {['Aoede', 'Fenrir', 'Kore', 'Puck', 'Charon'].map((vName) => (
                            <button
                                key={vName}
                                onClick={() => onVoiceChange(vName)}
                                disabled={isGeneratingTts || isGeneratingAudioBrief}
                                className={`px-2 py-0.5 rounded-lg text-xs font-bold transition font-mono whitespace-nowrap shrink-0 cursor-pointer ${
                                    selectedVoice === vName
                                        ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white font-bold shadow-xs'
                                        : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                }`}
                                title={`Switch to voice '${vName}'`}
                            >
                                {vName}
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onRegenerateAudioBrief}
                        disabled={isGeneratingAudioBrief || isLoading}
                        className="flex flex-row items-center gap-1.5 px-3 sm:px-4 py-1.5 sm:py-2 text-xs font-bold text-white bg-[#0077C8] hover:bg-[#005fa3] rounded-xl shadow-xs transition-all disabled:opacity-50 whitespace-nowrap shrink-0 cursor-pointer"
                        title="Regenerate audio brief"
                    >
                        <Sparkles size={14} className={`shrink-0 ${isGeneratingAudioBrief ? 'animate-spin' : ''}`} />
                        <span>{isGeneratingAudioBrief ? 'Synthesizing...' : 'Regenerate Brief'}</span>
                    </button>
                </div>
            </div>

            {/* Zero Silent Fallback TTS Error / Notice Banner */}
            {ttsError && (
                <div role="alert" className="bg-rose-50 dark:bg-rose-500/10 border border-rose-200 dark:border-rose-500/40 rounded-xl p-3 flex items-center justify-between gap-3 text-xs text-rose-700 dark:text-rose-200">
                    <div className="flex items-center gap-2 min-w-0">
                        <AlertCircle size={15} className="text-rose-700 dark:text-rose-400 shrink-0" />
                        <span className="break-words">{ttsError}</span>
                    </div>
                    <button onClick={onDismissTtsError} className="text-rose-700 dark:text-rose-300 hover:opacity-80 font-bold ml-2 text-[11px] whitespace-nowrap shrink-0 cursor-pointer">
                        Dismiss
                    </button>
                </div>
            )}

            {/* Audio Player Controls Bar */}
            <div className="bg-[var(--app-card)] p-3.5 sm:p-4 md:p-5 rounded-2xl border border-[var(--app-border)] flex flex-row flex-wrap md:flex-nowrap items-center justify-between gap-3 md:gap-4 relative z-10">
                <div className="flex flex-row items-center gap-2 flex-nowrap shrink-0">
                    <button
                        onClick={onTogglePlay}
                        disabled={!dailySummaryBrief.audioScript}
                        className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl flex items-center justify-center transition-all shadow-xs bg-[#0077C8] hover:bg-[#005fa3] text-white shrink-0 cursor-pointer"
                        title={isPlaying ? 'Pause Podcast' : 'Play Podcast'}
                    >
                        {isPlaying ? <Pause size={20} className="fill-white" /> : <Play size={20} className="fill-white ml-0.5" />}
                    </button>

                    <button
                        onClick={onRestartAudio}
                        className="p-2 sm:p-2.5 bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-100 dark:hover:bg-[#1A222E] text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] transition shadow-xs shrink-0 cursor-pointer"
                        title="Restart from beginning"
                    >
                        <RotateCcw size={16} />
                    </button>
                </div>

                {/* Scrubbing Track & Time Display */}
                <div className="flex-1 basis-full md:basis-auto order-last md:order-none w-full min-w-[160px] flex items-center gap-3">
                    <span className="text-xs font-mono font-bold text-[var(--app-muted)] min-w-[36px]">
                        {formatTime(currentTimeSec)}
                    </span>

                    <div className="flex-1 relative flex items-center">
                        <input
                            type="range"
                            min="0"
                            max="100"
                            value={audioProgress}
                            onChange={onSeek}
                            className="w-full h-2 bg-[var(--app-surface)] rounded-lg appearance-none cursor-pointer accent-[#0077C8]"
                        />
                    </div>

                    <span className="text-xs font-mono font-bold text-[var(--app-muted)] min-w-[36px]">
                        {formatTime(dailySummaryBrief.durationSeconds || 90)}
                    </span>
                </div>

                {/* Speed Controls & Mute */}
                <div className="flex flex-row items-center gap-2 flex-nowrap shrink-0 ml-auto md:ml-0">
                    <div className="flex flex-row items-center gap-0.5 bg-[var(--app-surface)] dark:bg-[#061C36] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs shadow-xs flex-nowrap overflow-x-auto no-scrollbar">
                        {[1.0, 1.25, 1.5, 2.0].map((spd) => (
                            <button
                                key={spd}
                                onClick={() => onSpeedChange(spd)}
                                className={`px-2 py-0.5 rounded-lg font-mono text-[11px] font-bold transition whitespace-nowrap shrink-0 cursor-pointer ${
                                    playbackRate === spd
                                        ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white font-bold'
                                        : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white dark:hover:bg-[#1A222E]'
                                }`}
                            >
                                {spd}x
                            </button>
                        ))}
                    </div>

                    <button
                        onClick={onToggleMute}
                        className="p-2 bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-100 dark:hover:bg-[#1A222E] text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] transition shadow-xs shrink-0 cursor-pointer"
                        title={isMuted ? 'Unmute' : 'Mute'}
                    >
                        {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
                    </button>
                </div>
            </div>

            {/* Content Section: Full-Width Spoken Talk Track & Executive Insights */}
            <div className="space-y-6 relative z-10">
                <div className="bg-[var(--app-card)] rounded-2xl p-6 border border-[var(--app-border)] space-y-4 shadow-xs">
                    <div className="flex items-center justify-between pb-3 border-b border-[var(--app-border)]">
                        <span className="text-xs font-black uppercase tracking-wider font-mono text-[#0077C8] flex items-center gap-1.5">
                            <FileText size={15} /> Executive Talk Track
                        </span>
                    </div>

                    <div className="text-sm md:text-[14.5px] leading-relaxed font-sans text-[var(--app-text)]">
                        {(dailySummaryBrief.audioScript || '')
                            .split(/(?<=[.!?])\s+/)
                            .filter(Boolean)
                            .map((sentence: string, sIdx: number) => {
                                const isSpoken = isPlaying && currentSpokenIndex === sIdx;
                                return (
                                    <span
                                        key={sIdx}
                                        className={`transition-all duration-300 inline mr-2 ${
                                            isSpoken
                                                ? 'text-blue-700 bg-blue-50 border border-blue-200 px-2 py-0.5 rounded-lg font-bold shadow-xs'
                                                : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                                        }`}
                                    >
                                        {sentence}{' '}
                                    </span>
                                );
                            })}
                    </div>
                </div>

                {/* Executive Key Takeaways & Live Pulse */}
                <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
                    <div className="md:col-span-7 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] space-y-3 shadow-xs">
                        <span className="text-xs font-black uppercase tracking-wider font-mono text-[#0077C8] flex items-center gap-1.5 pb-1 border-b border-[var(--app-border)]">
                            <Zap size={14} /> Executive Key Takeaways
                        </span>
                        <div className="space-y-2.5 pt-1">
                            {(dailySummaryBrief.audioKeyTakeaways || [
                                `Discourse tracking active for #${monitoredKeyword}.`,
                                'Multi-channel coverage grounded in Filter Pipeline, YouTube, and web intelligence.',
                                'Customer experience actions ready for deployment.'
                            ]).map((takeaway: string, tIdx: number) => (
                                <div key={tIdx} className="flex items-start gap-2.5 text-xs text-[var(--app-muted)]">
                                    <span className="text-[#0077C8] font-bold mt-0.5">•</span>
                                    <span className="leading-relaxed">{takeaway}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="md:col-span-5 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] space-y-3 shadow-xs flex flex-col justify-between">
                        <span className="text-xs font-black uppercase tracking-wider font-mono text-amber-700 flex items-center gap-1.5 pb-1 border-b border-[var(--app-border)]">
                            <Radio size={14} /> Multi-Channel Health Matrix
                        </span>
                        {dailySummaryBrief.sentimentPulse?.channels ? (
                            <div className="grid grid-cols-2 gap-2.5 pt-1">
                                {(Array.isArray(dailySummaryBrief.sentimentPulse.channels) ? dailySummaryBrief.sentimentPulse.channels : []).map((ch: any, cIdx: number) => (
                                    <div key={cIdx} className="p-3 bg-[var(--app-surface)] dark:bg-[#061C36] rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] text-xs space-y-1">
                                        <span className="text-[10px] text-[var(--app-muted)] font-mono block truncate">{ch.channel}</span>
                                        <span className="text-xs font-bold font-mono text-blue-700 dark:text-sky-300 block">{ch.sentiment}</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-xs text-[var(--app-muted)] italic py-2">
                                Channel metrics available after scan.
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};
