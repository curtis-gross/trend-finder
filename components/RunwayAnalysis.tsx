import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Bell, FileText, Filter, LayoutDashboard, Radio, Share2, TrendingUp } from 'lucide-react';
import { brandConfig } from '../config';
import { AppMode } from '../types';
import { useAppConfig } from '../context/AppConfigContext';
import { useCompanyContext } from '../context/CompanyContext';
import { useSystemReadiness } from '../context/SystemReadinessContext';
import { useTheme } from '../contexts/ThemeContext';
import { InsightAudit } from './InsightAudit';
import { InsightsHome } from './InsightsHome';
import { NoiseFilter } from './NoiseFilter';
import { SentimentAnomalyAlerts } from './SentimentAnomalyAlerts';
import { SingleAndCompetitiveReportView } from './trendIntelligence/analysisViews/CompetitiveComparisonView';
import { useListenRowsHydration } from './trendIntelligence/controllers/useListenRowsHydration';
import { usePipelineBulkScanner } from './trendIntelligence/controllers/usePipelineBulkScanner';
import { useSingleAndCompetitiveAnalysis } from './trendIntelligence/controllers/useSingleAndCompetitiveAnalysis';
import { FindInsightsModal } from './trendIntelligence/findInsights/FindInsightsModal';
import { InsightsTable } from './trendIntelligence/listenTable/InsightsTable';
import { getVideoId, normalizeUrlKey } from './trendIntelligence/typesAndConstants';

export { FindInsightsModal, InsightsTable, normalizeUrlKey };

type MainTab = 'home' | 'listen' | 'filter' | 'topic_graph' | 'topic_trajectory' | 'ad_opportunities' | 'summarize';

/** Combined Trend Intelligence top tabs. Filter Pipeline lives in its own Sidebar item. */
export const TREND_INTELLIGENCE_TABS = [
    { id: 'home', label: 'Overview', icon: LayoutDashboard },
    { id: 'topic_graph', label: 'Graph', icon: Share2 },
    { id: 'topic_trajectory', label: 'Trajectory', icon: TrendingUp },
    { id: 'summarize', label: 'Summary', icon: FileText }
] as const;

export const RunwayAnalysis: React.FC<{
    initialTab?: 'home' | 'listen' | 'filter' | 'ad_opportunities' | 'summarize' | 'insights' | 'bulk' | 'alerts' | 'daily_summary' | 'audit' | 'topic_graph' | 'topic_trajectory';
    initialTopic?: string | null;
    onTopicCleared?: () => void;
    appMode?: AppMode;
    onChangeAppMode?: (mode: AppMode) => void;
}> = ({ initialTab, initialTopic, onTopicCleared, appMode, onChangeAppMode }) => {
    const { config } = useAppConfig();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const themeColors = config?.branding.colors || brandConfig.colors;
    const { name: rawCompanyName } = useCompanyContext();
    const companyName = rawCompanyName || 'test-company';
    const { refreshReadiness } = useSystemReadiness();

    const [internalMode, setInternalMode] = useState<AppMode>(
        (initialTab === 'filter' || initialTab === 'listen' || Boolean(initialTopic)) ? AppMode.FILTER_PIPELINE : AppMode.INSIGHTS
    );
    const effectiveMode = appMode ?? internalMode;
    const isPipelineMode = effectiveMode === AppMode.FILTER_PIPELINE;

    const [activeMainTab, setActiveMainTab] = useState<MainTab>(
        initialTab === 'listen' || initialTab === 'filter' ? 'filter' :
        initialTab === 'topic_graph' ? 'topic_graph' :
        initialTab === 'topic_trajectory' ? 'topic_trajectory' :
        (initialTab === 'summarize' || initialTab === 'alerts' || initialTab === 'daily_summary' || initialTab === 'audit') ? 'summarize' : 'home'
    );
    const [summarizeTab, setSummarizeTab] = useState<'alerts' | 'audit'>(initialTab === 'audit' ? 'audit' : 'alerts');
    const [selectedFilterTopic, setSelectedFilterTopic] = useState<string | null>(() => {
        if (initialTopic) return initialTopic;
        try { return sessionStorage.getItem('deep_media_initial_topic'); } catch { return null; }
    });

    useEffect(() => {
        if (initialTopic) {
            setSelectedFilterTopic(initialTopic);
            switchAppMode(AppMode.FILTER_PIPELINE);
        } else {
            try {
                const stored = sessionStorage.getItem('deep_media_initial_topic');
                if (stored) setSelectedFilterTopic(stored);
            } catch {}
        }
    }, [initialTopic]);

    useEffect(() => {
        if (selectedFilterTopic) {
            try {
                sessionStorage.removeItem('deep_media_initial_topic');
                sessionStorage.removeItem('deep_media_initial_topic_keywords');
            } catch {}
            onTopicCleared?.();
        }
    }, [selectedFilterTopic]);

    useEffect(() => {
        if (!initialTab) return;
        if (initialTab === 'listen' || initialTab === 'filter') switchAppMode(AppMode.FILTER_PIPELINE);
        else if (initialTab === 'topic_graph') setActiveMainTab('topic_graph');
        else if (initialTab === 'topic_trajectory') setActiveMainTab('topic_trajectory');
        else if (initialTab === 'ad_opportunities' || initialTab === 'home') setActiveMainTab('home');
        else if (initialTab === 'summarize' || initialTab === 'alerts' || initialTab === 'daily_summary') {
            setActiveMainTab('summarize');
            setSummarizeTab('alerts');
        } else if (initialTab === 'audit') {
            setActiveMainTab('summarize');
            setSummarizeTab('audit');
        }
    }, [initialTab]);

    const hydration = useListenRowsHydration({
        companyName,
        setActiveMainTab
    });
    const { companyNameRef, videoTitles, unembeddableVideos, rows, setRows, isLoadingTable, fetchVideoTitle } = hydration;

    const singleCtrl = useSingleAndCompetitiveAnalysis({ companyName, rows, videoTitles });
    const { activeAnalysisId, setActiveAnalysisId, setActiveVideos, setSelectedVideoId, setActiveTab } = singleCtrl;

    const switchAppMode = useCallback((next: AppMode) => {
        if (next === AppMode.INSIGHTS) setActiveAnalysisId(null);
        setInternalMode(next);
        onChangeAppMode?.(next);
    }, [onChangeAppMode, setActiveAnalysisId]);

    // Legacy 'filter' / 'listen' tabs now live in the Sidebar Filter Pipeline view.
    const insightsTab: MainTab = (activeMainTab === 'filter' || activeMainTab === 'listen') ? 'home' : activeMainTab;

    const { bulkAnalysis, handleScanAllVideosForPipeline } = usePipelineBulkScanner({
        companyName, companyNameRef, config, rows, setRows, activeMainTab: isPipelineMode ? 'filter' : insightsTab
    });

    const readinessTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const scheduleReadinessRefresh = useCallback((delayMs = 300) => {
        if (readinessTimerRef.current) clearTimeout(readinessTimerRef.current);
        readinessTimerRef.current = setTimeout(() => {
            readinessTimerRef.current = null;
            void refreshReadiness(companyName);
        }, delayMs);
    }, [companyName, refreshReadiness]);

    useEffect(() => {
        const handleReadinessSync = () => scheduleReadinessRefresh(350);
        window.addEventListener('listen-table-notification', handleReadinessSync);
        window.addEventListener('pipeline-wiped', handleReadinessSync);
        return () => {
            window.removeEventListener('listen-table-notification', handleReadinessSync);
            window.removeEventListener('pipeline-wiped', handleReadinessSync);
            if (readinessTimerRef.current) clearTimeout(readinessTimerRef.current);
        };
    }, [scheduleReadinessRefresh]);

    const handleListenTableRowsChange: React.Dispatch<React.SetStateAction<any[]>> = useCallback((nextRows) => {
        setRows(nextRows);
        scheduleReadinessRefresh(300);
    }, [setRows, scheduleReadinessRefresh]);

    const handleWipeListenData = useCallback(() => {
        setRows([]);
        scheduleReadinessRefresh(250);
    }, [setRows, scheduleReadinessRefresh]);

    // Trend Intelligence always opens cleanly, without a stale single-video report.
    useEffect(() => {
        if (effectiveMode === AppMode.INSIGHTS) setActiveAnalysisId(null);
    }, [effectiveMode]);

    const listenTable = (
        <InsightsTable
            companyName={companyName}
            onViewAnalysis={(analysisId, videos) => {
                setActiveAnalysisId(analysisId);
                setActiveVideos(videos);
                setSelectedVideoId(videos[0]);
                setActiveTab('analysis');
            }}
            videoTitles={videoTitles}
            unembeddableVideos={unembeddableVideos}
            getVideoId={getVideoId}
            fetchVideoTitle={fetchVideoTitle}
            rows={rows}
            setRows={handleListenTableRowsChange}
            isLoadingTable={isLoadingTable}
        />
    );

    const reportView = (
        <SingleAndCompetitiveReportView
            companyName={companyName}
            isDark={isDark}
            themeColors={themeColors}
            singleCtrl={singleCtrl}
            videoTitles={videoTitles}
            unembeddableVideos={unembeddableVideos}
        />
    );

    if (isPipelineMode) {
        return (
            <div className="max-w-7xl mx-auto w-full space-y-6 pb-16 bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)] dark:text-slate-100">
                <div className="flex items-center gap-3 bg-[var(--app-card)] dark:bg-[#041527] px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs">
                    <span className="p-2 bg-indigo-50 dark:bg-[#061C36] text-indigo-600 dark:text-sky-400 rounded-xl border border-indigo-200 dark:border-[#041E3A] shrink-0">
                        <Filter size={20} />
                    </span>
                    <div className="min-w-0">
                        <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-[var(--app-text)] dark:text-white">
                            Filter Pipeline
                        </h1>
                        <p className="text-xs text-[var(--app-muted)] dark:text-[#D8E1EB]">
                            Multi-channel source listening, noise isolation, and topic extraction
                        </p>
                    </div>
                </div>
                <div className="flex-1 bg-[#F7F8FA] dark:bg-[#020F1D]">
                    {activeAnalysisId ? reportView : (
                        <NoiseFilter
                            stageMode="pipeline"
                            initialStage={initialTab === 'listen' ? 'listen' : undefined}
                            initialSelectedTopic={selectedFilterTopic}
                            onWipeListenData={handleWipeListenData}
                            onScanAllVideos={handleScanAllVideosForPipeline}
                            listenTableComponent={listenTable}
                        />
                    )}
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 pb-16 bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)] dark:text-slate-100">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-3 bg-[var(--app-card)] dark:bg-[#041527] px-4 sm:px-6 py-3.5 sm:py-4 rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs">
                <div className="flex flex-row flex-wrap items-center justify-between gap-3 w-full">
                    <div className="flex items-center gap-3 min-w-0">
                        <span className="p-2 bg-indigo-50 dark:bg-[#061C36] text-indigo-600 dark:text-sky-400 rounded-xl border border-indigo-200 dark:border-[#041E3A] shrink-0">
                            <Radio size={20} />
                        </span>
                        <h1 className="text-lg sm:text-xl md:text-2xl font-black tracking-tight text-[var(--app-text)] dark:text-white whitespace-nowrap truncate">
                            Deep Media Listening
                        </h1>
                    </div>

                    <nav className="flex items-center gap-1 bg-[var(--app-surface)] dark:bg-[#020F1D] p-1 rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] overflow-x-auto no-scrollbar max-w-full shrink-0">
                        {TREND_INTELLIGENCE_TABS.map((tab) => {
                            const Icon = tab.icon;
                            const isActive = insightsTab === tab.id;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => {
                                        if (tab.id === 'home') setSelectedFilterTopic(null);
                                        setActiveMainTab(tab.id);
                                    }}
                                    className={`px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 whitespace-nowrap shrink-0 ${
                                        isActive
                                            ? 'bg-[var(--app-card)] dark:bg-[#041E3A] text-[var(--app-text)] dark:text-white border border-[var(--app-border)] dark:border-[#041E3A] shadow-2xs'
                                            : 'text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white hover:bg-[var(--app-surface)] dark:hover:bg-[#1A222E]'
                                    }`}
                                >
                                    <Icon className={`w-3.5 h-3.5 shrink-0 ${isActive ? 'text-indigo-600 dark:text-white' : 'text-[var(--app-muted)] dark:text-[#D8E1EB]'}`} />
                                    <span>{tab.label}</span>
                                </button>
                            );
                        })}
                    </nav>
                </div>
            </div>

            <div className="flex-1 bg-[#F7F8FA] dark:bg-[#020F1D]">
                {activeAnalysisId ? reportView : insightsTab === 'home' || insightsTab === 'ad_opportunities' ? (
                    <div className="p-4 md:p-8 bg-[#F7F8FA] dark:bg-[#020F1D]">
                        <InsightsHome
                            initialSelectedTopic={selectedFilterTopic}
                            onNavigateToTopic={(topicName) => { setSelectedFilterTopic(topicName); switchAppMode(AppMode.FILTER_PIPELINE); }}
                            onNavigateToTab={(tabName) => {
                                if (tabName === 'filter' || tabName === 'listen') {
                                    switchAppMode(AppMode.FILTER_PIPELINE);
                                } else {
                                    setActiveMainTab(tabName === 'ad_opportunities' ? 'home' : tabName);
                                }
                            }}
                        />
                    </div>
                ) : insightsTab === 'topic_graph' ? (
                    <NoiseFilter stageMode="graph" initialStage="stage4" onWipeListenData={handleWipeListenData} onScanAllVideos={handleScanAllVideosForPipeline} />
                ) : insightsTab === 'topic_trajectory' ? (
                    <NoiseFilter stageMode="trajectory" initialStage="stage5" onWipeListenData={handleWipeListenData} onScanAllVideos={handleScanAllVideosForPipeline} />
                ) : insightsTab === 'summarize' ? (
                    <div className="w-full space-y-6 bg-[#F7F8FA] dark:bg-[#020F1D]">
                        <div className="bg-[var(--app-card)] dark:bg-[#041527] border-b border-[var(--app-border)] dark:border-[#041E3A] px-4 sm:px-6 py-3 shadow-2xs">
                            <div className="max-w-7xl mx-auto flex flex-row items-center gap-2 overflow-x-auto no-scrollbar">
                                <button
                                    onClick={() => setSummarizeTab('alerts')}
                                    className={`flex flex-row items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                        summarizeTab === 'alerts'
                                            ? 'bg-[#041E3A] dark:bg-[#041E3A] text-white dark:text-white keep-white-text shadow-xs font-bold'
                                            : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A]'
                                    }`}
                                >
                                    <Bell size={14} className="shrink-0" /> Alerts &amp; Daily Summary
                                </button>
                                <button
                                    onClick={() => setSummarizeTab('audit')}
                                    className={`flex flex-row items-center gap-1.5 px-3 sm:px-3.5 py-1.5 sm:py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                                        summarizeTab === 'audit'
                                            ? 'bg-[#041E3A] dark:bg-[#041E3A] text-white dark:text-white keep-white-text shadow-xs font-bold'
                                            : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A]'
                                    }`}
                                >
                                    <FileText size={14} className="shrink-0" /> Strategic Roadmap &amp; Audit
                                </button>
                            </div>
                        </div>
                        <div className="px-2 bg-[#F7F8FA] dark:bg-[#020F1D]">
                            {summarizeTab === 'alerts' ? <SentimentAnomalyAlerts rows={rows} bulkData={bulkAnalysis} /> : <InsightAudit />}
                        </div>
                    </div>
                ) : null}
            </div>
        </div>
    );
};

export default RunwayAnalysis;
