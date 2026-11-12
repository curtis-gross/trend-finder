import { useState, useEffect } from 'react';
import {
    getSourcesFromListenTable,
    loadStageDataFromGCS,
    NoiseSourceConfig
} from '../../services/noiseFilterService';

export interface SentimentAnomalyAlertsProps {
    rows?: any[];
    bulkData?: any;
}

export type ThreadStatus = 'idle' | 'running' | 'completed' | 'error';
export type SentimentFilterType = 'all' | 'positive' | 'negative' | 'neutral';
export type ChannelFilterType = 'all' | 'pipeline' | 'reddit' | 'youtube' | 'steam' | 'grounded';

export interface ThreadStatusMap {
    pipeline: ThreadStatus;
    grounded: ThreadStatus;
    youtube: ThreadStatus;
    steam: ThreadStatus;
    synthesis: ThreadStatus;
}

export const formatVideoTitle = (title?: string, company: string = 'test-company'): string => {
    const cleanCompany = company || 'test-company';
    if (!title) return `${cleanCompany} Customer Sentiment & Product Reviews`;
    if (title.startsWith('Target Video:') || title.includes('youtube.com/watch') || title.includes('youtu.be/')) {
        return `${cleanCompany} In-Depth Customer Review & Feedback`;
    }
    return title;
};

export const useAlertsPersistence = (activeCompany: string = 'test-company') => {
    const resolvedCompany = activeCompany || 'test-company';

    const [pipelineSources, setPipelineSources] = useState<NoiseSourceConfig[]>([]);
    const [pipelineCommentsCount, setPipelineCommentsCount] = useState<number>(0);
    const [monitoredKeyword, setMonitoredKeyword] = useState<string>(resolvedCompany);

    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [progressPercent, setProgressPercent] = useState<number>(0);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [apiError, setApiError] = useState<string | null>(null);
    const [threadStatus, setThreadStatus] = useState<ThreadStatusMap>({
        pipeline: 'idle',
        grounded: 'idle',
        youtube: 'idle',
        steam: 'idle',
        synthesis: 'idle'
    });

    const [immediateGroundedAlerts, setImmediateGroundedAlerts] = useState<any[]>([]);
    const [youtubeAlertData, setYoutubeAlertData] = useState<any>(null);
    const [steamAlertData, setSteamAlertData] = useState<any>(null);
    const [alertData, setAlertData] = useState<any>(null);
    const [talkTrackSynced, setTalkTrackSynced] = useState<boolean>(false);
    const [pastRuns, setPastRuns] = useState<any[]>([]);
    const [selectedVoice, setSelectedVoice] = useState<string>('Aoede');

    const fetchPastRunsHistory = async () => {
        try {
            const res = await fetch(`/api/runs-history/sentiment_anomaly_alerts?companyName=${encodeURIComponent(resolvedCompany)}`);
            if (res.ok) {
                const history = await res.json();
                if (Array.isArray(history) && history.length > 0) {
                    setPastRuns(history);
                }
            }
        } catch (e) {
            console.warn('Failed to load past runs history:', e);
        }
    };

    const hydrateAlertPayload = async (rawPayload: any) => {
        let data = rawPayload;
        if (data?.runData) data = data.runData;
        if (data && data.data && typeof data.data === 'object' && !data.alertMetadata && !data.executiveSummary) {
            data = data.data;
        }
        if (data && (data.alertMetadata || data.dailySummaryBrief || data.executiveSummary || data.immediateGroundedAlerts)) {
            if (!data.dailySummaryBrief) {
                try {
                    const briefRes = await fetch(`/api/load-run/daily_summary?companyName=${encodeURIComponent(resolvedCompany)}`);
                    if (briefRes.ok) {
                        let briefJson = await briefRes.json();
                        if (briefJson?.runData) briefJson = briefJson.runData;
                        if (briefJson?.data && typeof briefJson.data === 'object' && !briefJson.audioScript) briefJson = briefJson.data;
                        if (briefJson && briefJson.audioScript) {
                            data = { ...data, dailySummaryBrief: briefJson };
                        }
                    }
                } catch {}
            }
            setAlertData(data);
            if (data.monitoredKeyword) {
                setMonitoredKeyword(data.monitoredKeyword);
            }
            if (data.immediateGroundedAlerts) {
                setImmediateGroundedAlerts(data.immediateGroundedAlerts);
            }
            if (data.youtubeAlertData) {
                setYoutubeAlertData(data.youtubeAlertData);
            }
            if (data.steamAlertData) {
                setSteamAlertData(data.steamAlertData);
            }
            if (data.dailySummaryBrief) {
                setTalkTrackSynced(true);
                if (data.dailySummaryBrief.voiceName) {
                    setSelectedVoice(data.dailySummaryBrief.voiceName);
                }
            }
            setStatusMessage('Loaded cached anomaly alert & talk track run from GCS.');
            return true;
        }
        return false;
    };

    const loadSavedRun = async (isInitialMount = false): Promise<boolean> => {
        setIsLoading(true);
        setApiError(null);
        try {
            const res = await fetch(`/api/load-run/sentiment_anomaly_alerts?companyName=${encodeURIComponent(resolvedCompany)}`);
            if (res.ok) {
                const data = await res.json();
                if (await hydrateAlertPayload(data)) {
                    setIsLoading(false);
                    return true;
                }
            }

            const histRes = await fetch(`/api/runs-history/sentiment_anomaly_alerts?companyName=${encodeURIComponent(resolvedCompany)}`);
            if (histRes.ok) {
                const history = await histRes.json();
                if (Array.isArray(history) && history.length > 0) {
                    setPastRuns(history);
                    if (await hydrateAlertPayload(history[0]?.data || history[0])) {
                        setIsLoading(false);
                        return true;
                    }
                }
            }

            if (!isInitialMount) {
                setApiError(`No saved anomaly alert session found for ${resolvedCompany}. Click 'Scan Live Feeds' to run a fresh scan.`);
            }
        } catch (e: any) {
            console.warn('No existing GCS run found for sentiment_anomaly_alerts:', e);
            if (!isInitialMount) {
                setApiError(`Failed to load previous session: ${e?.message || e}`);
            }
        } finally {
            setIsLoading(false);
        }
        return false;
    };

    const handleSelectPastRun = (record: any) => {
        if (!record || !record.data) return;
        const data = record.data;
        setAlertData(data);
        const kw = record.keyword || data.monitoredKeyword || resolvedCompany;
        setMonitoredKeyword(kw);
        setImmediateGroundedAlerts(data.immediateGroundedAlerts || []);
        setYoutubeAlertData(data.youtubeAlertData || null);
        setSteamAlertData(data.steamAlertData || null);
        setTalkTrackSynced(Boolean(data.dailySummaryBrief));
        setStatusMessage(`Loaded past run for "${kw}" (${record.timestamp || 'Saved Run'}).`);
    };

    const autoSaveDualRuns = async (reportData: any, keyword: string) => {
        try {
            const payload = { ...reportData, monitoredKeyword: keyword };

            await fetch('/api/save-run/sentiment_anomaly_alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    featureId: 'sentiment_anomaly_alerts',
                    companyName: resolvedCompany,
                    data: payload
                })
            });

            await fetch('/api/save-run-history/sentiment_anomaly_alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    featureId: 'sentiment_anomaly_alerts',
                    companyName: resolvedCompany,
                    data: payload
                })
            });

            if (reportData?.dailySummaryBrief) {
                await fetch('/api/save-run/daily_summary', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        featureId: 'daily_summary',
                        companyName: resolvedCompany,
                        data: reportData.dailySummaryBrief
                    })
                });
            }
        } catch (e) {
            console.warn('Dual GCS save warning:', e);
        }
    };

    useEffect(() => {
        const syncPipelineListenConfig = async () => {
            try {
                const tableSources = await getSourcesFromListenTable(resolvedCompany);
                if (Array.isArray(tableSources) && tableSources.length > 0) {
                    setPipelineSources(tableSources);
                }
                const filteredData = await loadStageDataFromGCS('noise_filter_filtered_comments', resolvedCompany);
                if (filteredData && Array.isArray(filteredData.filteredComments)) {
                    setPipelineCommentsCount(filteredData.filteredComments.length);
                } else {
                    const rawData = await loadStageDataFromGCS('noise_filter_raw_comments', resolvedCompany);
                    if (rawData && Array.isArray(rawData.rawComments)) {
                        setPipelineCommentsCount(rawData.rawComments.length);
                    }
                }
            } catch (e) {
                console.warn('Error syncing filter pipeline listen configuration:', e);
            }
        };

        void syncPipelineListenConfig();
        void loadSavedRun(true);
        void fetchPastRunsHistory();
    }, [resolvedCompany]);

    return {
        pipelineSources,
        pipelineCommentsCount,
        setPipelineCommentsCount,
        monitoredKeyword,
        setMonitoredKeyword,
        isLoading,
        setIsLoading,
        progressPercent,
        setProgressPercent,
        statusMessage,
        setStatusMessage,
        apiError,
        setApiError,
        threadStatus,
        setThreadStatus,
        immediateGroundedAlerts,
        setImmediateGroundedAlerts,
        youtubeAlertData,
        setYoutubeAlertData,
        steamAlertData,
        setSteamAlertData,
        alertData,
        setAlertData,
        talkTrackSynced,
        setTalkTrackSynced,
        pastRuns,
        selectedVoice,
        setSelectedVoice,
        fetchPastRunsHistory,
        loadSavedRun,
        handleSelectPastRun,
        autoSaveDualRuns
    };
};
