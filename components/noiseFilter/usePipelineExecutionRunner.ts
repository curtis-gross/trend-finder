import React from 'react';
import {
    stage1_harvestRawComments, stage2_filterNoiseComments, stage3_convertToKeywords,
    stage4_buildRelationshipGraph, stage5_rebuildTrajectoryData,
    DEFAULT_NOISE_SOURCES, getSourcesFromListenTable, mergeListenTableSources,
    NoiseSourceConfig, RawComment, Stage2FilteredResult, Stage3KeywordResult, NoiseFilterResult
} from '../../services/noiseFilterService';
import { analyzeAdVideo, analyzeYouTubeSentiment } from '../../services/geminiService';
import { logActivity } from '../../services/activityService';
import {
    ensureAllCategoryHubs, extractCleanYtId, computeAbcdScorePct, saveGraphCheckpointToGCS
} from './languageAndGraphHelpers';
import {
    fetchMetacriticCorpusForPipeline, ensureMetacriticSourceInList, mergeMetacriticReviewsIntoArray
} from './sourceBlocklistHelpers';
import { useSingleStageHandlers } from './useSingleStageHandlers';

export interface UsePipelineExecutionRunnerParams {
    activeCompany: string;
    stageMode: 'all' | 'pipeline' | 'graph' | 'trajectory';
    setActiveStage: React.Dispatch<React.SetStateAction<'listen' | 'stage1' | 'stage2' | 'stage3' | 'stage4' | 'stage5'>>;
    rawComments: RawComment[];
    setRawComments: React.Dispatch<React.SetStateAction<RawComment[]>>;
    stage2Data: Stage2FilteredResult | null;
    setStage2Data: React.Dispatch<React.SetStateAction<Stage2FilteredResult | null>>;
    stage3Data: Stage3KeywordResult | null;
    setStage3Data: React.Dispatch<React.SetStateAction<Stage3KeywordResult | null>>;
    stage4Data: NoiseFilterResult | null;
    setStage4Data: React.Dispatch<React.SetStateAction<NoiseFilterResult | null>>;
    sources: NoiseSourceConfig[];
    setSources: React.Dispatch<React.SetStateAction<NoiseSourceConfig[]>>;
    isLoading: boolean;
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    isRunningFullPipeline: boolean;
    setIsRunningFullPipeline: React.Dispatch<React.SetStateAction<boolean>>;
    setFullPipelineStep: React.Dispatch<React.SetStateAction<number>>;
    setFullPipelineStepStatus: React.Dispatch<React.SetStateAction<string>>;
    setPipelineError: React.Dispatch<React.SetStateAction<string | null>>;
    setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
    setAbcdResultsByVideo: React.Dispatch<React.SetStateAction<Record<string, { scorePct: number; analysisId: string; result: any }>>>;
    setSentimentResultsByVideo: React.Dispatch<React.SetStateAction<Record<string, { scorePct: number; analysisId: string; result: any }>>>;
    onScanAllVideos?: (onProgress?: (msg: string) => void) => Promise<Record<string, any> | void>;
    onPipelineComplete?: (result?: NoiseFilterResult) => void;
}

export const usePipelineExecutionRunner = (params: UsePipelineExecutionRunnerParams) => {
    const {
        activeCompany, stageMode, setActiveStage, rawComments, setRawComments,
        stage2Data, setStage2Data, stage3Data, setStage3Data, stage4Data, setStage4Data,
        sources, setSources, isLoading, setIsLoading, isRunningFullPipeline,
        setIsRunningFullPipeline, setFullPipelineStep, setFullPipelineStepStatus,
        setPipelineError, setStatusMessage, setAbcdResultsByVideo, setSentimentResultsByVideo,
        onScanAllVideos, onPipelineComplete
    } = params;

    const singleStageHandlers = useSingleStageHandlers({
        activeCompany, rawComments, setRawComments, stage2Data, setStage2Data,
        stage3Data, setStage3Data, stage4Data, setStage4Data, sources, setSources,
        setIsLoading, setPipelineError, setStatusMessage
    });

    const handleRunEntirePipeline = async () => {
        if (isLoading || isRunningFullPipeline) return;
        setIsLoading(true);
        setIsRunningFullPipeline(true);
        setPipelineError(null);
        let activeStepTracker = 1;

        try {
            activeStepTracker = 1;
            setFullPipelineStep(1);
            const step1StartMsg = 'Step 1/6: Scanning media channels (ABCD & sentiment)...';
            setFullPipelineStepStatus(step1StartMsg);
            setStatusMessage(step1StartMsg);
            if (stageMode === 'all' || stageMode === 'pipeline') setActiveStage('listen');

            const [scanResults, mcCorpus] = await Promise.all([
                onScanAllVideos
                    ? onScanAllVideos((msg) => {
                          const formatted = `Step 1/6 (Scan Media): ${msg}`;
                          setFullPipelineStepStatus(formatted);
                          setStatusMessage(formatted);
                      })
                    : Promise.resolve(null),
                fetchMetacriticCorpusForPipeline(activeCompany, true)
            ]);

            const tableSources = await getSourcesFromListenTable(activeCompany);
            let currentCombined = ensureMetacriticSourceInList(
                mergeListenTableSources(sources, tableSources),
                mcCorpus.enrichedReviews.length,
                mcCorpus
            );

            if (scanResults && typeof scanResults === 'object' && !Array.isArray(scanResults)) {
                const dict = scanResults as Record<string, any>;
                currentCombined = currentCombined.map(s => {
                    const rawUrl = (s as any).url || '';
                    const vId = extractCleanYtId(s.target || rawUrl);
                    const matchedScan = dict[s.id] || dict[s.target] || (rawUrl ? dict[rawUrl] : undefined) || (vId ? dict[vId] : undefined);
                    return matchedScan ? { ...s, preloadedResult: matchedScan?.result || matchedScan || s.preloadedResult } : s;
                });
            }

            if (!onScanAllVideos) {
                const ytSources = currentCombined.filter(
                    s => s.type === 'youtube' || s.type === 'youtube_abcd' || String(s.target || '').includes('youtube.com') || String(s.target || '').includes('youtu.be')
                );
                for (let i = 0; i < ytSources.length; i++) {
                    const src = ytSources[i];
                    const vidId = extractCleanYtId(src.target);
                    const videoUrl = src.target.startsWith('http') ? src.target : `https://www.youtube.com/watch?v=${vidId}`;
                    const progressLabel = `Step 1/6: Scanning video ${i + 1}/${ytSources.length} (${src.label})...`;
                    setFullPipelineStepStatus(progressLabel);
                    setStatusMessage(progressLabel);

                    const abcdRes = await analyzeAdVideo(videoUrl, activeCompany);
                    const abcdPct = computeAbcdScorePct(abcdRes);
                    const abcdId = `analysis_abcd_${vidId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                    await fetch('/api/insights/analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyName: activeCompany, analysisId: abcdId, result: { ...abcdRes, type: 'abcd', videos: [vidId] } })
                    });
                    setAbcdResultsByVideo(prev => ({ ...prev, [vidId]: { scorePct: abcdPct, analysisId: abcdId, result: abcdRes } }));

                    const sentRes = await analyzeYouTubeSentiment(videoUrl, activeCompany);
                    const sentPct = typeof sentRes?.overallScorePercent === 'number' ? Math.round(sentRes.overallScorePercent) : 78;
                    const sentId = `analysis_sentiment_${vidId.replace(/[^a-zA-Z0-9_-]/g, '_')}`;
                    await fetch('/api/insights/analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyName: activeCompany, analysisId: sentId, result: { ...sentRes, type: 'youtube_sentiment', videos: [vidId] } })
                    });
                    setSentimentResultsByVideo(prev => ({ ...prev, [vidId]: { scorePct: sentPct, analysisId: sentId, result: sentRes } }));
                }
            }

            if (currentCombined.length === 0) {
                currentCombined = ensureMetacriticSourceInList(DEFAULT_NOISE_SOURCES, mcCorpus.enrichedReviews.length, mcCorpus);
            }
            setSources(currentCombined);

            activeStepTracker = 2;
            setFullPipelineStep(2);
            if (stageMode === 'all' || stageMode === 'pipeline') setActiveStage('stage1');
            const step2Msg = `Step 2/6: Running Stage 1 — Multi-Channel Ingest across ${currentCombined.length} sources...`;
            setFullPipelineStepStatus(step2Msg);
            setStatusMessage(step2Msg);

            const { rawComments: harvestedRaw, sourcesUsed: harvestedSources } = await stage1_harvestRawComments(
                currentCombined, activeCompany, (msg) => {
                    const formatted = `Step 2/6 (Ingest): ${msg}`;
                    setFullPipelineStepStatus(formatted);
                    setStatusMessage(formatted);
                }
            );

            const s1RawComments = mergeMetacriticReviewsIntoArray(harvestedRaw || [], mcCorpus.enrichedReviews);
            const s1SourcesUsed = ensureMetacriticSourceInList(harvestedSources || currentCombined, mcCorpus.enrichedReviews.length, mcCorpus);
            if (!s1RawComments || s1RawComments.length === 0) {
                throw new Error('Stage 1 Ingest returned 0 raw comments. Check active listening channels and API credentials.');
            }
            setRawComments(s1RawComments);
            setSources(s1SourcesUsed);

            activeStepTracker = 3;
            setFullPipelineStep(3);
            if (stageMode === 'all' || stageMode === 'pipeline') setActiveStage('stage2');
            const rawS2Result = await stage2_filterNoiseComments(s1RawComments, activeCompany, (msg) => {
                const formatted = `Step 3/6 (Filter): ${msg}`;
                setFullPipelineStepStatus(formatted);
                setStatusMessage(formatted);
            });
            const mergedFilteredComments = mergeMetacriticReviewsIntoArray(rawS2Result?.filteredComments || [], mcCorpus.enrichedReviews);
            const s2SignalComments = mergedFilteredComments.filter(c => !c.isNoise);
            const s2NoiseComments = mergedFilteredComments.filter(c => c.isNoise);
            const s2Total = mergedFilteredComments.length;
            const s2Result: Stage2FilteredResult = {
                ...rawS2Result,
                filteredComments: mergedFilteredComments,
                totalCount: s2Total,
                signalCount: s2SignalComments.length,
                noiseCount: s2NoiseComments.length,
                signalPercentage: s2Total > 0 ? Math.round((s2SignalComments.length / s2Total) * 100) : 100,
                noisePercentage: s2Total > 0 ? Math.round((s2NoiseComments.length / s2Total) * 100) : 0
            };
            if (!s2SignalComments.length) {
                throw new Error('Stage 2 Noise Filter retained 0 signal comments. Cannot proceed to Topic Extraction.');
            }
            setStage2Data(s2Result);

            activeStepTracker = 4;
            setFullPipelineStep(4);
            if (stageMode === 'all' || stageMode === 'pipeline') setActiveStage('stage3');
            const rawS3Result = await stage3_convertToKeywords(s2SignalComments, activeCompany, (msg) => {
                const formatted = `Step 4/6 (Topics): ${msg}`;
                setFullPipelineStepStatus(formatted);
                setStatusMessage(formatted);
            });
            const mergedEnrichedComments = mergeMetacriticReviewsIntoArray(rawS3Result?.enrichedComments || [], mcCorpus.enrichedReviews);
            const s3Result: Stage3KeywordResult = {
                ...rawS3Result,
                enrichedComments: mergedEnrichedComments,
                totalEnriched: mergedEnrichedComments.length
            };
            if (!s3Result?.enrichedComments?.length) {
                throw new Error('Stage 3 Topic Induction produced 0 enriched comments.');
            }
            setStage3Data(s3Result);

            activeStepTracker = 5;
            setFullPipelineStep(5);
            if (stageMode === 'all' || stageMode === 'graph') setActiveStage('stage4');
            const totalHarvested = s1RawComments.length;
            const noiseCount = s2Result.noiseCount || 0;
            const signalCount = s2Result.signalCount || s3Result.totalEnriched;
            const s4Result = await stage4_buildRelationshipGraph(
                s3Result, totalHarvested, noiseCount, signalCount, s1SourcesUsed, activeCompany, (msg) => {
                    const formatted = `Step 5/6 (Graph): ${msg}`;
                    setFullPipelineStepStatus(formatted);
                    setStatusMessage(formatted);
                }
            );
            s4Result.nodes = ensureAllCategoryHubs(s4Result.nodes, totalHarvested);
            s4Result.comments = mergeMetacriticReviewsIntoArray(s4Result.comments || [], mcCorpus.enrichedReviews);
            s4Result.sourcesUsed = s1SourcesUsed;
            setStage4Data(s4Result);
            await saveGraphCheckpointToGCS(activeCompany, s4Result, true);

            activeStepTracker = 6;
            setFullPipelineStep(6);
            if (stageMode === 'all' || stageMode === 'trajectory') setActiveStage('stage5');
            const s5Pillars =
                Array.isArray(s4Result?.crossReleaseEvolution) && s4Result.crossReleaseEvolution.length > 0
                    ? s4Result.crossReleaseEvolution
                    : await stage5_rebuildTrajectoryData(s3Result, activeCompany, (msg) => {
                          const formatted = `Step 6/6 (Trajectory): ${msg}`;
                          setFullPipelineStepStatus(formatted);
                          setStatusMessage(formatted);
                      });

            const finalStage4Data: NoiseFilterResult = {
                ...s4Result,
                crossReleaseEvolution: Array.isArray(s5Pillars) && s5Pillars.length > 0 ? s5Pillars : s4Result.crossReleaseEvolution || []
            };
            setStage4Data(finalStage4Data);
            await saveGraphCheckpointToGCS(activeCompany, finalStage4Data, true);

            const completeMsg = `Full Build Pipeline Complete: Scanned ${s1SourcesUsed.length} channels • ${totalHarvested.toLocaleString()} raw comments • ${signalCount.toLocaleString()} signal comments • ${s3Result.featureClusters.length} topic domains • ${finalStage4Data.nodes.length} graph nodes.`;
            setFullPipelineStepStatus(completeMsg);
            setStatusMessage(completeMsg);

            logActivity({
                mode: 'DEEP_MEDIA_LISTENING',
                label: 'Deep Media Listening',
                action: 'analyzed',
                title: `Full 6-Stage Pipeline Complete — ${totalHarvested} comments, ${finalStage4Data.nodes.length} graph nodes`,
                featureId: 'noise_filter',
                meta: { stage: 'all', totalHarvested, signalCount, nodeCount: finalStage4Data.nodes.length }
            }, activeCompany);

            window.dispatchEvent(new CustomEvent('pipeline-completed', { detail: { companyName: activeCompany } }));
            onPipelineComplete?.(finalStage4Data);
        } catch (err: any) {
            const errMsg = err?.message || String(err) || 'Unknown pipeline failure';
            setPipelineError(`Pipeline Failed at Step ${activeStepTracker}/6: ${errMsg}`);
            setStatusMessage(`Pipeline Failed at Step ${activeStepTracker}/6: ${errMsg}`);
        } finally {
            setIsRunningFullPipeline(false);
            setFullPipelineStep(0);
            setIsLoading(false);
        }
    };

    return {
        ...singleStageHandlers,
        handleRunEntirePipeline
    };
};
