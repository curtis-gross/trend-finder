import React from 'react';
import {
    stage1_harvestRawComments, stage2_filterNoiseComments, stage3_convertToKeywords,
    stage4_buildRelationshipGraph, stage4_reanalyzeGraphOnly, stage5_rebuildTrajectoryData,
    loadStageDataFromGCS, getSourcesFromListenTable, mergeListenTableSources,
    NoiseSourceConfig, RawComment, Stage2FilteredResult, Stage3KeywordResult, NoiseFilterResult
} from '../../services/noiseFilterService';
import { logActivity } from '../../services/activityService';
import { ensureAllCategoryHubs, saveGraphCheckpointToGCS } from './languageAndGraphHelpers';
import {
    fetchMetacriticCorpusForPipeline, ensureMetacriticSourceInList, mergeMetacriticReviewsIntoArray
} from './sourceBlocklistHelpers';

export interface SingleStageHandlersParams {
    activeCompany: string;
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
    setIsLoading: React.Dispatch<React.SetStateAction<boolean>>;
    setPipelineError: React.Dispatch<React.SetStateAction<string | null>>;
    setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
}

export const useSingleStageHandlers = ({
    activeCompany, rawComments, setRawComments, stage2Data, setStage2Data,
    stage3Data, setStage3Data, stage4Data, setStage4Data, sources, setSources,
    setIsLoading, setPipelineError, setStatusMessage
}: SingleStageHandlersParams) => {
    const handleReloadRawComments = async () => {
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage('Syncing listening channels...');
        try {
            const [tableSources, mcCorpus] = await Promise.all([
                getSourcesFromListenTable(activeCompany),
                fetchMetacriticCorpusForPipeline(activeCompany, true)
            ]);
            const currentCombined = ensureMetacriticSourceInList(
                mergeListenTableSources(sources, tableSources),
                mcCorpus.enrichedReviews.length
            );
            setSources(currentCombined);
            if (currentCombined.length === 0) {
                setStatusMessage('Please add at least one source in the Listen tab before running Stage 1.');
                return;
            }
            setStatusMessage(`Harvesting across ${currentCombined.length} sources...`);
            const { rawComments: newRaw, sourcesUsed } = await stage1_harvestRawComments(
                currentCombined, activeCompany, (msg) => setStatusMessage(msg)
            );
            const mergedRaw = mergeMetacriticReviewsIntoArray(newRaw, mcCorpus.enrichedReviews);
            const mergedSources = ensureMetacriticSourceInList(sourcesUsed, mcCorpus.enrichedReviews.length);
            setRawComments(mergedRaw);
            setSources(mergedSources);
            setStatusMessage(`Stage 1 Complete: Ingested ${mergedRaw.length} raw comments across ${mergedSources.length} sources.`);
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error harvesting raw comments.';
            setPipelineError(`Stage 1 Ingest Error: ${errMsg}`);
            setStatusMessage(`Error harvesting raw comments: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleFilterComments = async () => {
        if (!rawComments.length) {
            setStatusMessage('No raw comments available. Please run Stage 1 Ingest first.');
            return;
        }
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage(`Filtering noise across ${rawComments.length} comments using parallel Gemini workers...`);
        try {
            const mcCorpus = await fetchMetacriticCorpusForPipeline(activeCompany);
            const res = await stage2_filterNoiseComments(rawComments, activeCompany, (msg) => setStatusMessage(msg));
            const mergedFiltered = mergeMetacriticReviewsIntoArray(res.filteredComments || [], mcCorpus.enrichedReviews);
            const sigCount = mergedFiltered.filter((c: any) => !c?.isNoise).length;
            const nseCount = mergedFiltered.filter((c: any) => c?.isNoise).length;
            const totCount = mergedFiltered.length;
            const updatedRes: Stage2FilteredResult = {
                ...res,
                filteredComments: mergedFiltered,
                totalCount: totCount,
                signalCount: sigCount,
                noiseCount: nseCount,
                signalPercentage: totCount > 0 ? Math.round((sigCount / totCount) * 100) : 100,
                noisePercentage: totCount > 0 ? Math.round((nseCount / totCount) * 100) : 0
            };
            setStage2Data(updatedRes);
            setStatusMessage(`Stage 2 Complete: Isolated ${updatedRes.signalCount} high-signal comments (${updatedRes.signalPercentage}%).`);
            logActivity({
                mode: 'DEEP_MEDIA_LISTENING',
                label: 'Deep Media Listening',
                action: 'analyzed',
                title: `Stage 2 noise filter complete — isolated ${updatedRes.signalCount} high-signal comments (${updatedRes.signalPercentage}%)`,
                featureId: 'noise_filter',
                meta: { stage: 2, signalCount: updatedRes.signalCount, noiseCount: updatedRes.noiseCount, signalPercentage: updatedRes.signalPercentage }
            }, activeCompany);
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error filtering comments.';
            setPipelineError(`Stage 2 Noise Filter Error: ${errMsg}`);
            setStatusMessage(`Error filtering comments: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleConvertToKeywords = async () => {
        const signalComments = stage2Data?.filteredComments.filter(c => !c.isNoise) || [];
        if (!signalComments.length) {
            setStatusMessage('No filtered signal comments available. Please run Stage 2 first.');
            return;
        }
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage(`Extracting granular keywords from ${signalComments.length} signal comments...`);
        try {
            const mcCorpus = await fetchMetacriticCorpusForPipeline(activeCompany);
            const res = await stage3_convertToKeywords(signalComments, activeCompany, (msg) => setStatusMessage(msg));
            const mergedEnriched = mergeMetacriticReviewsIntoArray(res.enrichedComments || [], mcCorpus.enrichedReviews);
            const updatedRes: Stage3KeywordResult = {
                ...res,
                enrichedComments: mergedEnriched,
                totalEnriched: mergedEnriched.length
            };
            setStage3Data(updatedRes);
            setStatusMessage(`Stage 3 Complete: Enriched ${updatedRes.totalEnriched} comments across ${updatedRes.featureClusters.length} categories.`);
            logActivity({
                mode: 'DEEP_MEDIA_LISTENING',
                label: 'Deep Media Listening',
                action: 'analyzed',
                title: `Stage 3 keyword enrichment complete — ${updatedRes.totalEnriched} comments across ${updatedRes.featureClusters.length} categories`,
                featureId: 'noise_filter',
                meta: { stage: 3, totalEnriched: updatedRes.totalEnriched, categoryCount: updatedRes.featureClusters.length }
            }, activeCompany);
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error converting to keywords.';
            setPipelineError(`Stage 3 Topic Extraction Error: ${errMsg}`);
            setStatusMessage(`Error converting to keywords: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleBuildRelationshipGraph = async () => {
        if (!stage3Data?.enrichedComments.length) {
            setStatusMessage('No keyword-enriched comments available. Please run Stage 3 first.');
            return;
        }
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage('Synthesizing Master 60+ Node Relationship Graph & Cross-Release Trajectories...');
        try {
            const totalHarvested = rawComments.length || stage2Data?.totalCount || stage3Data.totalEnriched;
            const noiseCount = stage2Data?.noiseCount || 0;
            const signalCount = stage2Data?.signalCount || stage3Data.totalEnriched;
            const res = await stage4_buildRelationshipGraph(
                stage3Data, totalHarvested, noiseCount, signalCount, sources, activeCompany, (msg) => setStatusMessage(msg)
            );
            res.nodes = ensureAllCategoryHubs(res.nodes, totalHarvested);
            setStage4Data(res);
            await saveGraphCheckpointToGCS(activeCompany, res, true);
            setStatusMessage(`Stage 4 Complete: Master Relationship Graph built with ${res.nodes.length} nodes and saved to GCS!`);
            logActivity({
                mode: 'DEEP_MEDIA_LISTENING',
                label: 'Deep Media Listening',
                action: 'analyzed',
                title: `Stage 4 relationship graph built — ${res.nodes.length} nodes from ${signalCount} signal comments`,
                featureId: 'noise_filter',
                meta: { stage: 4, nodeCount: res.nodes.length, totalHarvested, noiseCount, signalCount }
            }, activeCompany);
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error building relationship graph.';
            setPipelineError(`Stage 4 Graph Build Error: ${errMsg}`);
            setStatusMessage(`Error building relationship graph: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleReanalyzeGraph = async () => {
        let currentStage3 = stage3Data;
        if (!currentStage3?.enrichedComments?.length) {
            const keyGcs = await loadStageDataFromGCS('noise_filter_keywords', activeCompany);
            if (keyGcs?.enrichedComments?.length) {
                currentStage3 = keyGcs;
                setStage3Data(keyGcs);
            }
        }
        if (!currentStage3?.enrichedComments?.length) {
            setStatusMessage('No Stage 3 topic data available. Please run Stage 3 topic extraction first.');
            return;
        }
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage('Re-analyzing Relationship Graph from saved Stage 3 topics...');
        try {
            const res = await stage4_reanalyzeGraphOnly(currentStage3, stage4Data, activeCompany, (msg) => setStatusMessage(msg));
            res.nodes = ensureAllCategoryHubs(res.nodes, res.totalHarvested || 1000);
            setStage4Data(res);
            await saveGraphCheckpointToGCS(activeCompany, res, true);
            setStatusMessage(`Graph Re-analysis Complete: Generated ${res.nodes.length} nodes and saved to GCS!`);
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error re-analyzing graph.';
            setPipelineError(`Stage 4 Graph Re-analysis Error: ${errMsg}`);
            setStatusMessage(`Error re-analyzing graph: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    const handleRebuildTrajectory = async () => {
        let currentStage3 = stage3Data;
        if (!currentStage3?.enrichedComments?.length) {
            const keyGcs = await loadStageDataFromGCS('noise_filter_keywords', activeCompany);
            if (keyGcs?.enrichedComments?.length) {
                currentStage3 = keyGcs;
                setStage3Data(keyGcs);
            }
        }
        if (!currentStage3?.enrichedComments?.length) {
            setStatusMessage('No Stage 3 topic data available. Please run Stage 3 topic extraction first.');
            return;
        }
        setIsLoading(true);
        setPipelineError(null);
        setStatusMessage('Rebuilding multi-release trajectory intelligence from saved comment analysis...');
        try {
            const res = await stage5_rebuildTrajectoryData(currentStage3, activeCompany, (msg) => setStatusMessage(msg));
            if (res && res.length > 0) {
                setStage4Data(prev => prev ? ({ ...prev, crossReleaseEvolution: res }) : ({
                    totalHarvested: currentStage3!.totalEnriched,
                    noiseCount: 0,
                    signalCount: currentStage3!.totalEnriched,
                    noisePercentage: 0,
                    signalPercentage: 100,
                    comments: currentStage3!.enrichedComments,
                    nodes: ensureAllCategoryHubs([], currentStage3!.totalEnriched || 1000),
                    links: [],
                    featureClusters: currentStage3!.featureClusters || [],
                    crossReleaseEvolution: res,
                    sourcesUsed: sources,
                    generatedAt: 'Today • Trajectory Rebuild'
                }));
                setStatusMessage(`Trajectory Rebuild Complete: Synthesized ${res.length} pillars and saved to dedicated checkpoint!`);
            } else {
                setStatusMessage('Trajectory rebuild finished with no new pillars.');
            }
        } catch (e: any) {
            const errMsg = e?.message || String(e) || 'Error rebuilding trajectory.';
            setPipelineError(`Stage 5 Trajectory Rebuild Error: ${errMsg}`);
            setStatusMessage(`Error rebuilding trajectory: ${errMsg}`);
        } finally {
            setIsLoading(false);
        }
    };

    return {
        handleReloadRawComments,
        handleFilterComments,
        handleConvertToKeywords,
        handleBuildRelationshipGraph,
        handleReanalyzeGraph,
        handleRebuildTrajectory
    };
};
