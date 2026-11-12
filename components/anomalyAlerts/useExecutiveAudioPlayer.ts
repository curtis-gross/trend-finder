import React, { useState, useEffect, useRef } from 'react';
import {
    synthesizeAlertsReportAndTalkTrack,
    generatePodcastTTS
} from '../../services/geminiService';

interface UseExecutiveAudioPlayerParams {
    activeCompany: string;
    monitoredKeyword: string;
    alertData: any;
    setAlertData: React.Dispatch<React.SetStateAction<any>>;
    immediateGroundedAlerts: any[];
    youtubeAlertData: any;
    steamAlertData: any;
    selectedVoice: string;
    setSelectedVoice: React.Dispatch<React.SetStateAction<string>>;
    setTalkTrackSynced: React.Dispatch<React.SetStateAction<boolean>>;
    autoSaveDualRuns: (reportData: any, keyword: string) => Promise<void>;
}

export const useExecutiveAudioPlayer = ({
    activeCompany,
    monitoredKeyword,
    alertData,
    setAlertData,
    immediateGroundedAlerts,
    youtubeAlertData,
    steamAlertData,
    selectedVoice,
    setSelectedVoice,
    setTalkTrackSynced,
    autoSaveDualRuns
}: UseExecutiveAudioPlayerParams) => {
    const resolvedCompany = activeCompany || 'test-company';

    const [isPlaying, setIsPlaying] = useState<boolean>(false);
    const [audioProgress, setAudioProgress] = useState<number>(0);
    const [currentTimeSec, setCurrentTimeSec] = useState<number>(0);
    const [playbackRate, setPlaybackRate] = useState<number>(1.0);
    const [isMuted, setIsMuted] = useState<boolean>(false);
    const [ttsError, setTtsError] = useState<string | null>(null);
    const [isGeneratingTts, setIsGeneratingTts] = useState<boolean>(false);
    const [isGeneratingAudioBrief, setIsGeneratingAudioBrief] = useState<boolean>(false);
    const [currentSpokenIndex, setCurrentSpokenIndex] = useState<number>(0);
    const [showFullTranscript, setShowFullTranscript] = useState<boolean>(false);

    const audioElementRef = useRef<HTMLAudioElement | null>(null);
    const synthUtteranceRef = useRef<SpeechSynthesisUtterance | null>(null);
    const timerIntervalRef = useRef<any>(null);

    useEffect(() => {
        return () => {
            if (audioElementRef.current) {
                audioElementRef.current.pause();
                audioElementRef.current.src = '';
            }
            if (typeof window !== 'undefined' && window.speechSynthesis) {
                window.speechSynthesis.cancel();
            }
            if (timerIntervalRef.current) {
                clearInterval(timerIntervalRef.current);
            }
        };
    }, []);

    const pauseAudio = () => {
        if (audioElementRef.current) {
            audioElementRef.current.pause();
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.pause();
        }
        if (timerIntervalRef.current) {
            clearInterval(timerIntervalRef.current);
        }
        setIsPlaying(false);
    };

    const playAudio = () => {
        const brief = alertData?.dailySummaryBrief;
        if (!brief?.audioScript) return;

        if (brief.audioUrl) {
            if (!audioElementRef.current || audioElementRef.current.src !== brief.audioUrl) {
                audioElementRef.current = new Audio(brief.audioUrl);
            }
            audioElementRef.current.playbackRate = playbackRate;
            audioElementRef.current.muted = isMuted;

            audioElementRef.current.ontimeupdate = () => {
                if (audioElementRef.current) {
                    const current = audioElementRef.current.currentTime;
                    const duration = audioElementRef.current.duration || brief.durationSeconds || 90;
                    setCurrentTimeSec(Math.floor(current));
                    setAudioProgress((current / duration) * 100);

                    const sentences = (brief.audioScript || '').split(/(?<=[.!?])\s+/);
                    const idx = Math.min(
                        Math.floor((current / duration) * sentences.length),
                        sentences.length - 1
                    );
                    setCurrentSpokenIndex(idx);
                }
            };

            audioElementRef.current.onended = () => {
                setIsPlaying(false);
                setAudioProgress(100);
                setCurrentTimeSec(brief.durationSeconds || 90);
            };

            audioElementRef.current.play()
                .then(() => {
                    setIsPlaying(true);
                    setTtsError(null);
                })
                .catch(err => {
                    console.error('Audio element play error:', err);
                    setTtsError(`Audio playback error: ${err.message || err}`);
                });
            return;
        }

        setTtsError('Gemini 3.1 TTS audio not generated yet. Click an Executive Voice below (Aoede, Fenrir, Kore, Puck, Charon) to synthesize audio.');
    };

    const togglePlayAudio = () => {
        const brief = alertData?.dailySummaryBrief;
        if (!brief?.audioScript) return;
        if (isPlaying) {
            pauseAudio();
        } else {
            playAudio();
        }
    };

    const playWebSpeechFallback = () => {
        const brief = alertData?.dailySummaryBrief;
        if (!brief?.audioScript || typeof window === 'undefined' || !window.speechSynthesis) return;

        setTtsError('Notice: Playing browser synthetic voice fallback. To hear natural Gemini 3.1 TTS audio, click an Executive Voice.');

        window.speechSynthesis.cancel();
        if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

        const textToSpeak = brief.audioScript;
        const utterance = new SpeechSynthesisUtterance(textToSpeak);
        utterance.rate = playbackRate;
        utterance.pitch = 1.0;

        const sentences = textToSpeak.split('.');
        const totalDurationSec = brief.durationSeconds || 90;
        let elapsed = 0;

        timerIntervalRef.current = setInterval(() => {
            elapsed += 1;
            setCurrentTimeSec(elapsed);
            setAudioProgress(Math.min((elapsed / totalDurationSec) * 100, 100));

            const sentenceIdx = Math.floor((elapsed / totalDurationSec) * sentences.length);
            setCurrentSpokenIndex(Math.min(sentenceIdx, sentences.length - 1));

            if (elapsed >= totalDurationSec) {
                clearInterval(timerIntervalRef.current);
                setIsPlaying(false);
            }
        }, 1000 / playbackRate);

        utterance.onend = () => {
            setIsPlaying(false);
            if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
            setAudioProgress(100);
            setCurrentTimeSec(totalDurationSec);
        };

        synthUtteranceRef.current = utterance;
        window.speechSynthesis.speak(utterance);
        setIsPlaying(true);
    };

    const handleRestartAudio = () => {
        pauseAudio();
        setCurrentTimeSec(0);
        setAudioProgress(0);
        setCurrentSpokenIndex(0);
        if (audioElementRef.current) {
            audioElementRef.current.currentTime = 0;
        }
        if (typeof window !== 'undefined' && window.speechSynthesis) {
            window.speechSynthesis.cancel();
        }
        playAudio();
    };

    const handleSeek = (e: React.ChangeEvent<HTMLInputElement>) => {
        const newProgress = Number(e.target.value);
        setAudioProgress(newProgress);
        const duration = alertData?.dailySummaryBrief?.durationSeconds || 90;
        const newTime = (newProgress / 100) * duration;
        setCurrentTimeSec(Math.floor(newTime));

        if (audioElementRef.current && audioElementRef.current.duration) {
            audioElementRef.current.currentTime = (newProgress / 100) * audioElementRef.current.duration;
        }
    };

    const handleSpeedChange = (speed: number) => {
        setPlaybackRate(speed);
        if (audioElementRef.current) {
            audioElementRef.current.playbackRate = speed;
        }
        if (isPlaying && typeof window !== 'undefined' && window.speechSynthesis) {
            handleRestartAudio();
        }
    };

    const handleToggleMute = () => {
        const newMuted = !isMuted;
        setIsMuted(newMuted);
        if (audioElementRef.current) {
            audioElementRef.current.muted = newMuted;
        }
    };

    const handleVoiceChange = async (voiceName: string) => {
        const brief = alertData?.dailySummaryBrief;
        if (!brief?.audioScript) return;
        setSelectedVoice(voiceName);
        setIsGeneratingTts(true);
        setTtsError(null);
        try {
            const res = await generatePodcastTTS(brief.audioScript, voiceName, resolvedCompany, 'gemini-3.1-flash-tts-preview');
            if (res && res.audioUrl) {
                const updatedBrief = {
                    ...brief,
                    audioUrl: res.audioUrl,
                    voiceName,
                    ttsModel: res.model || 'gemini-3.1-flash-tts-preview'
                };
                const updatedAlertData = {
                    ...alertData,
                    dailySummaryBrief: updatedBrief
                };
                setAlertData(updatedAlertData);
                if (audioElementRef.current) {
                    audioElementRef.current.pause();
                    audioElementRef.current = new Audio(res.audioUrl);
                }
                await autoSaveDualRuns(updatedAlertData, monitoredKeyword);
            }
        } catch (err: any) {
            console.error('Gemini 3.1 TTS voice generation error [Zero Silent Fallback]:', err);
            setTtsError(`Gemini 3.1 TTS error: ${err.message || err}`);
        } finally {
            setIsGeneratingTts(false);
        }
    };

    const handleRegenerateAudioBrief = async () => {
        setIsGeneratingAudioBrief(true);
        setTtsError(null);
        try {
            const groundedResult = { alerts: immediateGroundedAlerts };
            const ytData = youtubeAlertData;
            const stmData = steamAlertData;

            const synthesizedReport = await synthesizeAlertsReportAndTalkTrack(
                monitoredKeyword,
                resolvedCompany,
                groundedResult,
                ytData,
                stmData
            );

            if (selectedVoice && synthesizedReport?.dailySummaryBrief?.audioScript) {
                try {
                    const ttsResult = await generatePodcastTTS(
                        synthesizedReport.dailySummaryBrief.audioScript,
                        selectedVoice,
                        resolvedCompany,
                        'gemini-3.1-flash-tts-preview'
                    );
                    if (ttsResult && ttsResult.audioUrl) {
                        synthesizedReport.dailySummaryBrief.audioUrl = ttsResult.audioUrl;
                        synthesizedReport.dailySummaryBrief.voiceName = selectedVoice;
                        synthesizedReport.dailySummaryBrief.ttsModel = ttsResult.model || 'gemini-3.1-flash-tts-preview';
                    }
                } catch (e: any) {
                    console.error('Gemini 3.1 TTS custom voice error [Zero Silent Fallback]:', e);
                    setTtsError(`Gemini 3.1 TTS voice error: ${e.message || e}`);
                }
            }

            const updatedAlertData = {
                ...(alertData || {}),
                ...synthesizedReport,
                monitoredKeyword
            };
            setAlertData(updatedAlertData);
            setTalkTrackSynced(true);
            await autoSaveDualRuns(updatedAlertData, monitoredKeyword);
        } catch (e: any) {
            console.error('Regenerate audio brief error [Zero Silent Fallback]:', e);
            setTtsError(`Failed to generate briefing: ${e.message || e}`);
        } finally {
            setIsGeneratingAudioBrief(false);
        }
    };

    const formatTime = (seconds: number) => {
        const mins = Math.floor(seconds / 60);
        const secs = Math.floor(seconds % 60);
        return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
    };

    return {
        isPlaying,
        audioProgress,
        currentTimeSec,
        playbackRate,
        isMuted,
        ttsError,
        setTtsError,
        isGeneratingTts,
        isGeneratingAudioBrief,
        currentSpokenIndex,
        showFullTranscript,
        setShowFullTranscript,
        togglePlayAudio,
        playWebSpeechFallback,
        handleRestartAudio,
        handleSeek,
        handleSpeedChange,
        handleToggleMute,
        handleVoiceChange,
        handleRegenerateAudioBrief,
        formatTime
    };
};
