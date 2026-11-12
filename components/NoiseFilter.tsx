import React, { useState, useEffect, useRef } from 'react';
import { useCompanyContext } from '../context/CompanyContext';
import { useTheme } from '../contexts/ThemeContext';
import { matchTopicToTaxonomy, NoiseSourceConfig, RawComment, Stage2FilteredResult, Stage3KeywordResult, NoiseFilterResult, GraphNode } from '../services/noiseFilterService';
import { detectAccurateCommentLanguage, getCountryFlag } from './noiseFilter/languageAndGraphHelpers';
import { dmlMemoryCache, ensureRedditSourcesInList, assignRedditCommentsToThreads } from './noiseFilter/sourceBlocklistHelpers';
import { useStageHydrationAndCache } from './noiseFilter/useStageHydrationAndCache';
import { usePipelineExecutionRunner } from './noiseFilter/usePipelineExecutionRunner';
import { useUniqueSignalComments, useGraphNodeCommentMatcher } from './noiseFilter/useGraphNodeCommentMatcher';
import { useRelationshipGraphLayout } from './noiseFilter/useRelationshipGraphLayout';
import { useStageChartMemos } from './noiseFilter/useStageChartMemos';
import { useTrajectoryAndNodeMemos } from './noiseFilter/useTrajectoryAndNodeMemos';
import { NoiseFilterShell } from './noiseFilter/NoiseFilterShell';
import { Stage1RawIngestionView } from './noiseFilter/stages/Stage1RawIngestionView';
import { Stage2NoiseRemovalView } from './noiseFilter/stages/Stage2NoiseRemovalView';
import { Stage3TopicExtractionView } from './noiseFilter/stages/Stage3TopicExtractionView';
import { TopicDrilldownModal } from './noiseFilter/stages/TopicDrilldownModal';
import { GraphSvgCanvas } from './noiseFilter/stages/GraphSvgCanvas';
import { GraphNodeInspectorDrawer, Stage4CompleteBanner, Stage4EmptyOrLoadingState } from './noiseFilter/stages/GraphNodeInspectorDrawer';
import { Stage5SentimentTrajectoryView } from './noiseFilter/stages/Stage5SentimentTrajectoryView';

export { detectAccurateCommentLanguage, getCountryFlag };

export interface NoiseFilterProps {
    stageMode?: 'all' | 'pipeline' | 'graph' | 'trajectory';
    initialStage?: 'listen' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5';
    initialSelectedTopic?: string | null;
    listenTableComponent?: React.ReactNode;
    onWipeListenData?: () => void;
    onScanAllVideos?: (onProgress?: (msg: string) => void) => Promise<Record<string, any> | void>;
    onPipelineComplete?: (result?: NoiseFilterResult) => void;
}

export const NoiseFilter: React.FC<NoiseFilterProps> = ({
    stageMode = 'all', initialStage, initialSelectedTopic, listenTableComponent, onWipeListenData, onScanAllVideos, onPipelineComplete
}) => {
    const { name: activeCompanyRaw } = useCompanyContext();
    const { theme } = useTheme();
    const isDark = theme === 'dark';
    const activeCompany = activeCompanyRaw || 'test-company';
    const companyCacheKey = activeCompany.toUpperCase();

    const [activeStage, setActiveStage] = useState<'listen' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5'>(() => {
        if (stageMode === 'graph') return 'stage4';
        if (stageMode === 'trajectory') return 'stage5';
        if (initialSelectedTopic) return 'stage3';
        try { if (sessionStorage.getItem('deep_media_initial_topic')) return 'stage3'; } catch {}
        return initialStage || 'listen';
    });
    useEffect(() => {
        if (stageMode === 'graph') setActiveStage('stage4');
        else if (stageMode === 'trajectory') setActiveStage('stage5');
    }, [stageMode]);

    const [rawComments, setRawComments] = useState<RawComment[]>(() => assignRedditCommentsToThreads(dmlMemoryCache[companyCacheKey]?.rawComments || []));
    const [stage2Data, setStage2Data] = useState<Stage2FilteredResult | null>(() => dmlMemoryCache[companyCacheKey]?.stage2 || null);
    const [stage3Data, setStage3Data] = useState<Stage3KeywordResult | null>(() => dmlMemoryCache[companyCacheKey]?.stage3 || null);
    const [stage4Data, setStage4Data] = useState<NoiseFilterResult | null>(() => dmlMemoryCache[companyCacheKey]?.stage4 || null);
    const [isLoading, setIsLoading] = useState(false);
    const [isHydratingCheckpoints, setIsHydratingCheckpoints] = useState(false);
    const [isRunningFullPipeline, setIsRunningFullPipeline] = useState(false);
    const [fullPipelineStep, setFullPipelineStep] = useState<number>(0);
    const [fullPipelineStepStatus, setFullPipelineStepStatus] = useState<string>('');
    const [pipelineError, setPipelineError] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState('');
    const [sources, setSources] = useState<NoiseSourceConfig[]>(() => ensureRedditSourcesInList(dmlMemoryCache[companyCacheKey]?.sources || []));
    const [confirmingWipe, setConfirmingWipe] = useState(false);
    const [, setAbcdResultsByVideo] = useState<Record<string, { scorePct: number; analysisId: string; result: any }>>({});
    const [, setSentimentResultsByVideo] = useState<Record<string, { scorePct: number; analysisId: string; result: any }>>({});
    const [rawSearchQuery, setRawSearchQuery] = useState('');
    const [stage2SearchQuery, setStage2SearchQuery] = useState('');
    const [stage2ReleaseFilter, setStage2ReleaseFilter] = useState<string>('ALL');
    const [stage2SourceFilter, setStage2SourceFilter] = useState<string>('ALL');
    const [stage3SearchQuery, setStage3SearchQuery] = useState('');
    const [selectedTopic, setSelectedTopic] = useState<string | null>(() => {
        if (initialSelectedTopic) return initialSelectedTopic;
        try { return sessionStorage.getItem('deep_media_initial_topic'); } catch { return null; }
    });
    const [drilldownSentimentFilter, setDrilldownSentimentFilter] = useState<'ALL' | 'positive' | 'negative' | 'neutral'>('ALL');
    const [drilldownReleaseFilter, setDrilldownReleaseFilter] = useState<string>('ALL');
    const [drilldownSourceFilter, setDrilldownSourceFilter] = useState<string>('ALL');
    const [drilldownSearch, setDrilldownSearch] = useState<string>('');
    const [stage1Page, setStage1Page] = useState(1);
    const [stage1ViewAll, setStage1ViewAll] = useState(false);
    const [stage2ShowAllSignal, setStage2ShowAllSignal] = useState(false);
    const [stage2ShowAllNoise, setStage2ShowAllNoise] = useState(false);
    const [stage3Page, setStage3Page] = useState(1);
    const [stage3ViewAll, setStage3ViewAll] = useState(false);

    useEffect(() => { setStage1Page(1); }, [rawSearchQuery, rawComments?.length]);
    useEffect(() => { setStage3Page(1); }, [stage3SearchQuery, stage3Data]);
    useEffect(() => {
        const raw = initialSelectedTopic || (() => { try { return sessionStorage.getItem('deep_media_initial_topic'); } catch { return null; } })();
        if (!raw) return;
        setActiveStage('stage3');
        const matched = matchTopicToTaxonomy(raw, {
            featureClusters: (stage3Data?.featureClusters || []).map((fc: any) => ({ category: fc?.category || '', topKeywords: Array.isArray(fc?.topKeywords) ? fc.topKeywords : Array.isArray(fc?.keywords) ? fc.keywords : [] })),
            topKeywords: stage3Data?.topKeywords || []
        });
        setSelectedTopic(matched); setStage3SearchQuery(matched);
        try { sessionStorage.removeItem('deep_media_initial_topic'); sessionStorage.removeItem('deep_media_initial_topic_keywords'); } catch {}
    }, [initialSelectedTopic, stage3Data]);
    useEffect(() => {
        if (!selectedTopic) return;
        const handleKeyDown = (e: KeyboardEvent) => { if (e.key === 'Escape') setSelectedTopic(null); };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTopic]);

    const handleTopicClick = (topicName: string) => {
        const selClean = String(selectedTopic || '').toLowerCase().replace(/^#/, '').trim();
        const nextClean = String(topicName || '').toLowerCase().replace(/^#/, '').trim();
        setSelectedTopic(selClean && selClean === nextClean ? null : topicName);
    };

    const [densityMode, setDensityMode] = useState<'all' | 'core'>('all');
    const [selectedSentiment, setSelectedSentiment] = useState<'ALL' | 'positive' | 'negative' | 'mixed'>('ALL');
    const [selectedCategory, setSelectedCategory] = useState<string>('ALL');
    const [trajectoryFilter, setTrajectoryFilter] = useState<'ALL' | 'improving' | 'critical' | 'emerging' | 'stable'>('ALL');
    const [graphSearchQuery, setGraphSearchQuery] = useState('');
    const [selectedNode, setSelectedNode] = useState<GraphNode | null>(null);
    const [hoveredNodeId, setHoveredNodeId] = useState<string | null>(null);
    const [selectedPillar, setSelectedPillar] = useState<string | null>(null);
    const [hoveredPieIndex, setHoveredPieIndex] = useState<number | null>(null);
    const [hoveredStage1PieIndex, setHoveredStage1PieIndex] = useState<number | null>(null);
    const [hoveredKeywordIndex, setHoveredKeywordIndex] = useState<number | null>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    const { initCheckpoints, handleWipePipeline } = useStageHydrationAndCache({
        activeCompany, companyCacheKey, stageMode, rawComments, setRawComments, stage2Data, setStage2Data, stage3Data, setStage3Data,
        stage4Data, setStage4Data, sources, setSources, setIsLoading, setIsHydratingCheckpoints, isRunningFullPipeline,
        setStatusMessage, confirmingWipe, setConfirmingWipe, setSelectedTopic, setSelectedNode, setAbcdResultsByVideo, setSentimentResultsByVideo, onWipeListenData
    });
    const { handleReloadRawComments, handleFilterComments, handleConvertToKeywords, handleBuildRelationshipGraph, handleReanalyzeGraph, handleRebuildTrajectory, handleRunEntirePipeline } =
        usePipelineExecutionRunner({
            activeCompany, stageMode, setActiveStage, rawComments, setRawComments, stage2Data, setStage2Data, stage3Data, setStage3Data,
            stage4Data, setStage4Data, sources, setSources, isLoading, setIsLoading, isRunningFullPipeline, setIsRunningFullPipeline,
            setFullPipelineStep, setFullPipelineStepStatus, setPipelineError, setStatusMessage, setAbcdResultsByVideo, setSentimentResultsByVideo, onScanAllVideos, onPipelineComplete
        });
    const allUniqueSignalComments = useUniqueSignalComments(stage3Data, stage4Data, rawComments);
    const { availableCategories, positionedNodes, filteredNodes, enhancedGraphLinks, activeGraphFocusNodeId, connectedNeighborIds, selectedNodeConnections } =
        useRelationshipGraphLayout({ stage4Data, stage3Data, stage2Data, rawComments, allUniqueSignalComments, densityMode, graphSearchQuery, selectedSentiment, selectedCategory, hoveredNodeId, selectedNode });
    const { selectedNodeComments, totalDatasetCount, effectiveNodeMetrics } =
        useGraphNodeCommentMatcher({ selectedNode, positionedNodes, stage4Data, stage3Data, allUniqueSignalComments, rawComments });
    const {
        stage1Analytics, totalRawCount, totalRawPages, currentRawPage, displayedRawComments, availableStage2Releases, stage2PieData, stage2NoiseReasons,
        filteredRetainedComments, displayedRetainedComments, filteredNoiseComments, displayedNoiseComments, stage3Analytics, totalStage3Count, totalStage3Pages, currentStage3Page, displayedStage3Comments
    } = useStageChartMemos({
        sources, rawComments, rawSearchQuery, stage1Page, stage1ViewAll, stage2Data, stage2ReleaseFilter, stage2SourceFilter,
        stage2SearchQuery, stage2ShowAllSignal, stage2ShowAllNoise, stage3Data, stage3SearchQuery, stage3Page, stage3ViewAll
    });
    const { availableDrilldownReleases, stage5TimelineData, activeTopicItem, activeTopicComments } =
        useTrajectoryAndNodeMemos({ stage3Data, stage4Data, stage3Analytics, selectedTopic, drilldownSentimentFilter, drilldownReleaseFilter, drilldownSourceFilter, drilldownSearch });

    return (
        <div className="max-w-7xl mx-auto w-full space-y-6 animate-fadeIn bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)] dark:text-slate-100">
            <NoiseFilterShell
                stageMode={stageMode} activeStage={activeStage} setActiveStage={setActiveStage} isLoading={isLoading} isHydratingCheckpoints={isHydratingCheckpoints}
                isRunningFullPipeline={isRunningFullPipeline} fullPipelineStep={fullPipelineStep} fullPipelineStepStatus={fullPipelineStepStatus}
                pipelineError={pipelineError} setPipelineError={setPipelineError} statusMessage={statusMessage} setStatusMessage={setStatusMessage}
                confirmingWipe={confirmingWipe} hasRawComments={rawComments.length > 0} hasStage2Data={Boolean(stage2Data)} hasStage3Data={Boolean(stage3Data)} hasStage4Data={Boolean(stage4Data)}
                onRunEntirePipeline={handleRunEntirePipeline} onInitCheckpoints={initCheckpoints} onWipePipeline={handleWipePipeline}
                onReloadRawComments={handleReloadRawComments} onFilterComments={handleFilterComments} onConvertToKeywords={handleConvertToKeywords}
                onBuildRelationshipGraph={handleBuildRelationshipGraph} onRebuildTrajectory={handleRebuildTrajectory}
            />
            {activeStage === 'listen' && <div className="space-y-6 animate-fadeIn">{listenTableComponent}</div>}
            {activeStage === 'stage1' && (
                <Stage1RawIngestionView isDark={isDark} rawComments={rawComments} displayedRawComments={displayedRawComments} rawSearchQuery={rawSearchQuery} setRawSearchQuery={setRawSearchQuery} stage1Analytics={stage1Analytics} hoveredStage1PieIndex={hoveredStage1PieIndex} setHoveredStage1PieIndex={setHoveredStage1PieIndex} totalRawCount={totalRawCount} totalRawPages={totalRawPages} currentRawPage={currentRawPage} setStage1Page={setStage1Page} stage1ViewAll={stage1ViewAll} setStage1ViewAll={setStage1ViewAll} onProceedToStage2={() => setActiveStage('stage2')} />
            )}
            {activeStage === 'stage2' && (
                <Stage2NoiseRemovalView isDark={isDark} rawCommentsCount={rawComments.length} stage2Data={stage2Data} stage2PieData={stage2PieData} stage2NoiseReasons={stage2NoiseReasons} hoveredPieIndex={hoveredPieIndex} setHoveredPieIndex={setHoveredPieIndex} availableStage2Releases={availableStage2Releases} stage2ReleaseFilter={stage2ReleaseFilter} setStage2ReleaseFilter={setStage2ReleaseFilter} stage2SourceFilter={stage2SourceFilter} setStage2SourceFilter={setStage2SourceFilter} stage2SearchQuery={stage2SearchQuery} setStage2SearchQuery={setStage2SearchQuery} stage1Analytics={stage1Analytics} filteredRetainedComments={filteredRetainedComments} displayedRetainedComments={displayedRetainedComments} stage2ShowAllSignal={stage2ShowAllSignal} setStage2ShowAllSignal={setStage2ShowAllSignal} filteredNoiseComments={filteredNoiseComments} displayedNoiseComments={displayedNoiseComments} stage2ShowAllNoise={stage2ShowAllNoise} setStage2ShowAllNoise={setStage2ShowAllNoise} onProceedToStage3={() => setActiveStage('stage3')} />
            )}
            {activeStage === 'stage3' && (
                <>
                    <Stage3TopicExtractionView isDark={isDark} stage3Data={stage3Data} stage3Analytics={stage3Analytics} stage3SearchQuery={stage3SearchQuery} setStage3SearchQuery={setStage3SearchQuery} selectedTopic={selectedTopic} setSelectedTopic={setSelectedTopic} onTopicClick={handleTopicClick} hoveredKeywordIndex={hoveredKeywordIndex} setHoveredKeywordIndex={setHoveredKeywordIndex} displayedStage3Comments={displayedStage3Comments} totalStage3Count={totalStage3Count} totalStage3Pages={totalStage3Pages} currentStage3Page={currentStage3Page} setStage3Page={setStage3Page} stage3ViewAll={stage3ViewAll} setStage3ViewAll={setStage3ViewAll} onProceedToStage4={() => setActiveStage('stage4')} />
                    {stage3Data && selectedTopic && activeTopicItem && (
                        <TopicDrilldownModal selectedTopic={selectedTopic} activeTopicItem={activeTopicItem} activeTopicComments={activeTopicComments} availableDrilldownReleases={availableDrilldownReleases} drilldownSentimentFilter={drilldownSentimentFilter} setDrilldownSentimentFilter={setDrilldownSentimentFilter} drilldownReleaseFilter={drilldownReleaseFilter} setDrilldownReleaseFilter={setDrilldownReleaseFilter} drilldownSourceFilter={drilldownSourceFilter} setDrilldownSourceFilter={setDrilldownSourceFilter} drilldownSearch={drilldownSearch} setDrilldownSearch={setDrilldownSearch} onClose={() => setSelectedTopic(null)} />
                    )}
                </>
            )}
            {activeStage === 'stage4' && (
                <div className="space-y-6 animate-fadeIn">
                    {stage4Data && Array.isArray(stage4Data.nodes) && stage4Data.nodes.length > 0 ? (
                        <div className="space-y-6">
                            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                                <GraphSvgCanvas isDark={isDark} isLoading={isLoading} svgRef={svgRef} densityMode={densityMode} setDensityMode={setDensityMode} selectedSentiment={selectedSentiment} setSelectedSentiment={setSelectedSentiment} availableCategories={availableCategories} selectedCategory={selectedCategory} setSelectedCategory={setSelectedCategory} graphSearchQuery={graphSearchQuery} setGraphSearchQuery={setGraphSearchQuery} onReanalyzeGraph={handleReanalyzeGraph} positionedNodes={positionedNodes} filteredNodes={filteredNodes} enhancedGraphLinks={enhancedGraphLinks} selectedNode={selectedNode} setSelectedNode={setSelectedNode} hoveredNodeId={hoveredNodeId} setHoveredNodeId={setHoveredNodeId} activeGraphFocusNodeId={activeGraphFocusNodeId} connectedNeighborIds={connectedNeighborIds} />
                                <GraphNodeInspectorDrawer selectedNode={selectedNode} setSelectedNode={setSelectedNode} setHoveredNodeId={setHoveredNodeId} effectiveNodeMetrics={effectiveNodeMetrics} totalDatasetCount={totalDatasetCount} selectedNodeConnections={selectedNodeConnections} selectedNodeComments={selectedNodeComments} />
                            </div>
                            <Stage4CompleteBanner onProceedToStage5={() => setActiveStage('stage5')} />
                        </div>
                    ) : (
                        <Stage4EmptyOrLoadingState isHydratingCheckpoints={isHydratingCheckpoints} isLoading={isLoading} onBuildRelationshipGraph={handleBuildRelationshipGraph} onReanalyzeGraph={handleReanalyzeGraph} />
                    )}
                </div>
            )}
            {activeStage === 'stage5' && (
                <Stage5SentimentTrajectoryView isDark={isDark} isLoading={isLoading} hasEvolutionData={Boolean(stage4Data?.crossReleaseEvolution && stage4Data.crossReleaseEvolution.length > 0)} trajectoryFilter={trajectoryFilter} setTrajectoryFilter={setTrajectoryFilter} selectedPillar={selectedPillar} setSelectedPillar={setSelectedPillar} stage5TimelineData={stage5TimelineData} onRebuildTrajectory={handleRebuildTrajectory} />
            )}
        </div>
    );
};
