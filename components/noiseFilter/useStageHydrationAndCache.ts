import React, { useEffect } from 'react';
import {
    loadStageDataFromGCS, getSourcesFromListenTable, mergeListenTableSources,
    NoiseSourceConfig, RawComment, Stage2FilteredResult, Stage3KeywordResult,
    NoiseFilterResult, GraphNode, GraphLink
} from '../../services/noiseFilterService';
import {
    isPlatformOrSourceKeyword, normalizeCategoryName, computeHybridNodeScore,
    ensureAllCategoryHubs, extractCleanYtId, computeAbcdScorePct,
    saveGraphCheckpointToGCS, normalizeTrajectoryPillarsList
} from './languageAndGraphHelpers';
import {
    dmlMemoryCache, cachedMetacriticCorpus, fetchMetacriticCorpusForPipeline,
    getDeletedListenItemsSet, isSourceDeletedInBlocklist,
    ensureMetacriticSourceInList, mergeMetacriticReviewsIntoArray
} from './sourceBlocklistHelpers';

export { saveGraphCheckpointToGCS, normalizeTrajectoryPillarsList };

export interface UseStageHydrationParams {
    activeCompany: string;
    companyCacheKey: string;
    stageMode: 'all' | 'pipeline' | 'graph' | 'trajectory';
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
    setIsHydratingCheckpoints: React.Dispatch<React.SetStateAction<boolean>>;
    isRunningFullPipeline: boolean;
    setStatusMessage: React.Dispatch<React.SetStateAction<string>>;
    confirmingWipe: boolean;
    setConfirmingWipe: React.Dispatch<React.SetStateAction<boolean>>;
    setSelectedTopic: React.Dispatch<React.SetStateAction<string | null>>;
    setSelectedNode: React.Dispatch<React.SetStateAction<GraphNode | null>>;
    setAbcdResultsByVideo: React.Dispatch<React.SetStateAction<Record<string, { scorePct: number; analysisId: string; result: any }>>>;
    setSentimentResultsByVideo: React.Dispatch<React.SetStateAction<Record<string, { scorePct: number; analysisId: string; result: any }>>>;
    onWipeListenData?: () => void;
}

const buildNodesFromClustersFallback = (clusters: any[], graphNodes: GraphNode[], graphLinks: GraphLink[]) => {
    clusters.forEach((fc: any, cIdx: number) => {
        const catLabel = normalizeCategoryName(String(fc?.category || `Category ${cIdx + 1}`));
        const catId = `cat_${catLabel.toLowerCase().replace(/[^a-z0-9]+/g, '_')}`;
        const fcPos = fc?.sentimentBreakdown?.positive ?? 0;
        const fcNeg = fc?.sentimentBreakdown?.negative ?? 0;
        const fcNeu = fc?.sentimentBreakdown?.neutral ?? 0;
        const fcTot = fcPos + fcNeg + fcNeu;
        const fcHybrid = computeHybridNodeScore(fcPos, fcNeg, fcNeu, fc?.positiveRatio, fc?.sentiment);
        graphNodes.push({
            id: catId,
            label: catLabel,
            type: 'category',
            category: catLabel,
            size: 30,
            mentionCount: fcTot > 0 ? fcTot : (fc?.commentCount || fc?.keywordCount || 0),
            positiveRatio: fcHybrid.positiveRatio,
            sentiment: fcHybrid.sentiment
        });
        const kws = Array.isArray(fc?.topKeywords) ? fc.topKeywords : Array.isArray(fc?.keywords) ? fc.keywords : [];
        kws.forEach((kw: any, kIdx: number) => {
            const kwLabel = String(typeof kw === 'string' ? kw : kw?.keyword || kw?.name || `Topic ${kIdx + 1}`);
            if (isPlatformOrSourceKeyword(kwLabel)) return;
            const nodeId = `feat_${cIdx}_${kIdx}`;
            const kwHybrid = computeHybridNodeScore(fcPos, fcNeg, fcNeu, fcHybrid.positiveRatio, fcHybrid.sentiment);
            const kwMentions = typeof kw === 'object' ? (Number(kw?.mentions ?? kw?.count) || 0) : 0;
            graphNodes.push({
                id: nodeId,
                label: kwLabel,
                type: 'feature',
                category: catLabel,
                sentiment: kwHybrid.sentiment,
                size: 18,
                mentionCount: kwMentions,
                positiveRatio: kwHybrid.positiveRatio,
                tier: kIdx < 3 ? 'core' : 'micro'
            });
            graphLinks.push({ source: catId, target: nodeId, weight: 8, sentiment: kwHybrid.sentiment });
        });
    });
};

export const useStageHydrationAndCache = (params: UseStageHydrationParams) => {
    const {
        activeCompany, companyCacheKey, stageMode, rawComments, setRawComments,
        stage2Data, setStage2Data, stage3Data, setStage3Data, stage4Data, setStage4Data,
        sources, setSources, setIsLoading, setIsHydratingCheckpoints, isRunningFullPipeline,
        setStatusMessage, confirmingWipe, setConfirmingWipe, setSelectedTopic, setSelectedNode,
        setAbcdResultsByVideo, setSentimentResultsByVideo, onWipeListenData
    } = params;

    useEffect(() => {
        dmlMemoryCache[companyCacheKey] = {
            ...(dmlMemoryCache[companyCacheKey] || {}),
            ...(rawComments.length > 0 ? { rawComments } : {}),
            ...(stage2Data ? { stage2: stage2Data } : {}),
            ...(stage3Data ? { stage3: stage3Data } : {}),
            ...(stage4Data ? { stage4: stage4Data } : {}),
            ...(sources.length > 0 ? { sources } : {})
        };
    }, [companyCacheKey, rawComments, stage2Data, stage3Data, stage4Data, sources]);

    const initCheckpoints = async () => {
        try {
            const memCached = (window as any).__dmlGraphCache?.[activeCompany];
            const lsRaw = !memCached ? localStorage.getItem(`dml_graph_cache_${activeCompany}`) : null;
            const cachedGraph = memCached || (lsRaw ? JSON.parse(lsRaw) : null);
            const cachedNodes = Array.isArray(cachedGraph?.nodes) ? cachedGraph.nodes : Array.isArray(cachedGraph?.graphNodes) ? cachedGraph.graphNodes : [];
            if (cachedNodes.length >= 15 && !stage4Data?.nodes?.length) {
                const cachedHarvested = cachedGraph?.totalHarvested ?? 0;
                setStage4Data(prev => ({
                    totalHarvested: prev?.totalHarvested ?? cachedHarvested,
                    noiseCount: prev?.noiseCount ?? cachedGraph?.noiseCount ?? 0,
                    signalCount: prev?.signalCount ?? cachedGraph?.signalCount ?? 0,
                    noisePercentage: prev?.noisePercentage ?? cachedGraph?.noisePercentage ?? 0,
                    signalPercentage: prev?.signalPercentage ?? cachedGraph?.signalPercentage ?? 0,
                    comments: prev?.comments || [],
                    nodes: ensureAllCategoryHubs(cachedNodes, cachedHarvested),
                    links: Array.isArray(cachedGraph?.links) ? cachedGraph.links : Array.isArray(cachedGraph?.graphLinks) ? cachedGraph.graphLinks : [],
                    featureClusters: prev?.featureClusters || cachedGraph?.featureClusters || [],
                    crossReleaseEvolution: prev?.crossReleaseEvolution || [],
                    sourcesUsed: prev?.sourcesUsed || [],
                    generatedAt: cachedGraph?.savedAt || 'Saved Checkpoint'
                }));
            }
        } catch {}

        setIsHydratingCheckpoints(true);
        try {
            const [graphOnlyGcs, graphGcs, trajGcs] = await Promise.all([
                loadStageDataFromGCS('noise_filter_graph', activeCompany),
                loadStageDataFromGCS('noise_filter', activeCompany),
                loadStageDataFromGCS('noise_filter_trajectory', activeCompany)
            ]);

            const rawPillars = trajGcs?.crossReleaseEvolution && Array.isArray(trajGcs.crossReleaseEvolution)
                ? trajGcs.crossReleaseEvolution
                : Array.isArray(trajGcs?.pillars) ? trajGcs.pillars : Array.isArray(trajGcs) ? trajGcs : Array.isArray(graphGcs?.crossReleaseEvolution) ? graphGcs.crossReleaseEvolution : null;
            const trajectoryPillars = normalizeTrajectoryPillarsList(rawPillars);

            const extractNodesFromObj = (obj: any): any[] =>
                Array.isArray(obj?.nodes) ? obj.nodes : Array.isArray(obj?.graphNodes) ? obj.graphNodes : Array.isArray(obj?.graphData?.nodes) ? obj.graphData.nodes : [];
            const extractLinksFromObj = (obj: any): any[] =>
                Array.isArray(obj?.links) ? obj.links : Array.isArray(obj?.graphLinks) ? obj.graphLinks : Array.isArray(obj?.graphData?.links) ? obj.graphData.links : [];

            const dedicatedNodes = extractNodesFromObj(graphOnlyGcs);
            const dedicatedLinks = extractLinksFromObj(graphOnlyGcs);
            const masterNodes = extractNodesFromObj(graphGcs);
            const masterLinks = extractLinksFromObj(graphGcs);

            let graphNodes: GraphNode[] = (dedicatedNodes.length >= 15 ? dedicatedNodes : masterNodes).filter((n: any) => !isPlatformOrSourceKeyword(n?.label));
            let graphLinks: GraphLink[] = dedicatedLinks.length > 0 ? dedicatedLinks : masterLinks;
            let needsGcsGraphSync = dedicatedNodes.length < 15;

            if (graphNodes.length > 0 || (trajectoryPillars && trajectoryPillars.length > 0)) {
                const gcsTotalHarvested = graphGcs?.totalHarvested ?? graphOnlyGcs?.totalHarvested ?? 0;
                const fastNodes = ensureAllCategoryHubs(graphNodes, gcsTotalHarvested);
                const fastStage4: NoiseFilterResult = {
                    ...(graphGcs || {}),
                    totalHarvested: gcsTotalHarvested,
                    noiseCount: graphGcs?.noiseCount ?? graphOnlyGcs?.noiseCount ?? 0,
                    signalCount: graphGcs?.signalCount ?? graphOnlyGcs?.signalCount ?? 0,
                    noisePercentage: graphGcs?.noisePercentage ?? graphOnlyGcs?.noisePercentage ?? 0,
                    signalPercentage: graphGcs?.signalPercentage ?? graphOnlyGcs?.signalPercentage ?? 0,
                    comments: graphGcs?.comments || [],
                    nodes: fastNodes,
                    links: graphLinks,
                    featureClusters: graphGcs?.featureClusters || graphOnlyGcs?.featureClusters || [],
                    crossReleaseEvolution: trajectoryPillars || normalizeTrajectoryPillarsList(graphGcs?.crossReleaseEvolution) || [],
                    sourcesUsed: graphGcs?.sourcesUsed || [],
                    generatedAt: graphOnlyGcs?.savedAt || graphGcs?.generatedAt || 'Saved Checkpoint'
                };
                setStage4Data(fastStage4);
                if (needsGcsGraphSync && fastNodes.length >= 15) {
                    saveGraphCheckpointToGCS(activeCompany, fastStage4, false).catch(() => {});
                }
            }

            setIsHydratingCheckpoints(false);

            const [tableSources, mcCorpus, rawGcs, filterGcs, keyGcs] = await Promise.all([
                getSourcesFromListenTable(activeCompany),
                fetchMetacriticCorpusForPipeline(activeCompany),
                loadStageDataFromGCS('noise_filter_raw_comments', activeCompany),
                loadStageDataFromGCS('noise_filter_filtered_comments', activeCompany),
                loadStageDataFromGCS('noise_filter_keywords', activeCompany)
            ]);

            let activeSourcesList = ensureMetacriticSourceInList(tableSources, mcCorpus.enrichedReviews.length, mcCorpus);
            if (rawGcs?.rawComments && Array.isArray(rawGcs.rawComments) && rawGcs.rawComments.length > 0) {
                const mergedRaw = mergeMetacriticReviewsIntoArray(rawGcs.rawComments, mcCorpus.enrichedReviews);
                setRawComments(mergedRaw as RawComment[]);
                if (rawGcs.sourcesUsed && Array.isArray(rawGcs.sourcesUsed)) {
                    activeSourcesList = ensureMetacriticSourceInList(mergeListenTableSources(rawGcs.sourcesUsed, tableSources), mcCorpus.enrichedReviews.length, mcCorpus);
                }
            } else if (mcCorpus.enrichedReviews.length > 0) {
                setRawComments(mcCorpus.enrichedReviews as RawComment[]);
            }
            setSources(activeSourcesList);

            if (stageMode === 'all' || stageMode === 'pipeline') {
                fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeCompany)}`)
                    .then(async r => {
                        if (!r.ok) {
                            if (r.status === 404) return null;
                            throw new Error(`Failed to hydrate saved video analyses (HTTP ${r.status})`);
                        }
                        return r.json();
                    })
                    .then(allAnalyses => {
                        if (!Array.isArray(allAnalyses) || allAnalyses.length === 0) return;
                        const abcdMap: Record<string, { scorePct: number; analysisId: string; result: any }> = {};
                        const sentMap: Record<string, { scorePct: number; analysisId: string; result: any }> = {};
                        allAnalyses.forEach((item: any) => {
                            const vidRaw = (Array.isArray(item?.videos) && item.videos[0]) || item?.videoId || item?.videoUrl || '';
                            const vidId = extractCleanYtId(String(vidRaw));
                            const aId = String(item?._analysisId || item?.analysisId || '');
                            if (!vidId) return;
                            if (item?.type === 'abcd' || aId.startsWith('analysis_abcd_') || aId.startsWith('ad_analysis_')) {
                                abcdMap[vidId] = { scorePct: computeAbcdScorePct(item), analysisId: aId || `analysis_abcd_${vidId}`, result: item };
                            } else if (item?.type === 'youtube_sentiment' || item?.type === 'sentiment_video' || aId.startsWith('analysis_sentiment_')) {
                                const scorePct = typeof item?.overallScorePercent === 'number'
                                    ? Math.round(item.overallScorePercent)
                                    : typeof item?.overallScore === 'number'
                                    ? Math.round(item.overallScore <= 10 ? item.overallScore * 10 : item.overallScore)
                                    : 0;
                                sentMap[vidId] = { scorePct, analysisId: aId || `analysis_sentiment_${vidId}`, result: item };
                            }
                        });
                        if (Object.keys(abcdMap).length > 0) setAbcdResultsByVideo(abcdMap);
                        if (Object.keys(sentMap).length > 0) setSentimentResultsByVideo(sentMap);
                    })
                    .catch(err => {
                        const msg = err?.message || String(err);
                        console.warn('Could not auto-hydrate saved video analyses in NoiseFilter:', msg);
                        setStatusMessage(`Hydration error (analyses): ${msg}`);
                    });
            }

            if (filterGcs?.filteredComments) {
                const mergedFiltered = mergeMetacriticReviewsIntoArray(filterGcs.filteredComments, mcCorpus.enrichedReviews);
                const sigCount = mergedFiltered.filter((c: any) => !c?.isNoise).length;
                const nseCount = mergedFiltered.filter((c: any) => c?.isNoise).length;
                const totCount = mergedFiltered.length;
                setStage2Data({
                    ...filterGcs,
                    filteredComments: mergedFiltered,
                    totalCount: totCount,
                    signalCount: sigCount,
                    noiseCount: nseCount,
                    signalPercentage: totCount > 0 ? Math.round((sigCount / totCount) * 100) : 0,
                    noisePercentage: totCount > 0 ? Math.round((nseCount / totCount) * 100) : 0
                });
            }

            if (keyGcs?.enrichedComments) {
                const mergedEnriched = mergeMetacriticReviewsIntoArray(keyGcs.enrichedComments, mcCorpus.enrichedReviews);
                const normalizedClusters = (Array.isArray(keyGcs.featureClusters) ? keyGcs.featureClusters : []).map((fc: any) => {
                    const catName = normalizeCategoryName(fc?.category || 'General Experience');
                    const cleanTopKws = (Array.isArray(fc?.topKeywords) ? fc.topKeywords : Array.isArray(fc?.keywords) ? fc.keywords : [])
                        .filter((kw: any) => !isPlatformOrSourceKeyword(typeof kw === 'string' ? kw : kw?.keyword || kw?.name || ''));
                    return {
                        ...fc,
                        category: catName,
                        topKeywords: cleanTopKws,
                        keywordCount: fc?.keywordCount ?? fc?.commentCount ?? cleanTopKws.length ?? 0,
                        sentimentBreakdown: {
                            positive: fc?.sentimentBreakdown?.positive ?? 0,
                            negative: fc?.sentimentBreakdown?.negative ?? 0,
                            neutral: fc?.sentimentBreakdown?.neutral ?? 0
                        }
                    };
                });
                setStage3Data({ ...keyGcs, enrichedComments: mergedEnriched, totalEnriched: mergedEnriched.length, featureClusters: normalizedClusters });
            }

            if (graphNodes.length === 0 && (Array.isArray(graphGcs?.topTopics) || Array.isArray(keyGcs?.featureClusters) || Array.isArray(graphGcs?.featureClusters))) {
                const clusters = Array.isArray(keyGcs?.featureClusters) ? keyGcs.featureClusters : Array.isArray(graphGcs?.featureClusters) ? graphGcs.featureClusters : [];
                buildNodesFromClustersFallback(clusters, graphNodes, graphLinks);
                if (graphNodes.length > 0) needsGcsGraphSync = true;
            }

            if (graphNodes.length > 0 || (trajectoryPillars && trajectoryPillars.length > 0)) {
                const mergedGraphComments = mergeMetacriticReviewsIntoArray(graphGcs?.comments || keyGcs?.enrichedComments || [], mcCorpus.enrichedReviews);
                const mergedTotalHarvested = Math.max(graphGcs?.totalHarvested || rawGcs?.count || (rawGcs?.rawComments || []).length || 0, mergedGraphComments.length);
                const mergedSignalCount = Math.max(graphGcs?.signalCount ?? filterGcs?.signalCount ?? keyGcs?.totalEnriched ?? 0, mergedGraphComments.length);
                const enrichedStage4: NoiseFilterResult = {
                    ...(graphGcs || {}),
                    totalHarvested: mergedTotalHarvested,
                    noiseCount: graphGcs?.noiseCount ?? filterGcs?.noiseCount ?? 0,
                    signalCount: mergedSignalCount,
                    noisePercentage: graphGcs?.noisePercentage ?? filterGcs?.noisePercentage ?? 0,
                    signalPercentage: graphGcs?.signalPercentage ?? filterGcs?.signalPercentage ?? (mergedTotalHarvested > 0 ? Math.round((mergedSignalCount / mergedTotalHarvested) * 100) : 0),
                    comments: mergedGraphComments,
                    nodes: ensureAllCategoryHubs(graphNodes, mergedTotalHarvested),
                    links: graphLinks,
                    featureClusters: keyGcs?.featureClusters || graphGcs?.featureClusters || [],
                    crossReleaseEvolution: trajectoryPillars || normalizeTrajectoryPillarsList(graphGcs?.crossReleaseEvolution) || [],
                    sourcesUsed: ensureMetacriticSourceInList(mergeListenTableSources(rawGcs?.sourcesUsed || [], tableSources), mcCorpus.enrichedReviews.length),
                    generatedAt: graphGcs?.generatedAt || 'Saved Checkpoint'
                };
                setStage4Data(enrichedStage4);
                if (needsGcsGraphSync && enrichedStage4.nodes.length >= 15) {
                    saveGraphCheckpointToGCS(activeCompany, enrichedStage4, true).catch(() => {});
                }
            }
        } catch (e: any) {
            const msg = e?.message || String(e);
            console.warn('Checkpoint hydration error:', msg);
            setStatusMessage(`Checkpoint hydration error: ${msg}`);
        } finally {
            setIsHydratingCheckpoints(false);
        }
    };

    useEffect(() => {
        initCheckpoints();
        const onPipelineCompleted = () => {
            if (!isRunningFullPipeline) initCheckpoints();
        };
        window.addEventListener('pipeline-completed', onPipelineCompleted);
        return () => window.removeEventListener('pipeline-completed', onPipelineCompleted);
    }, [activeCompany]);

    useEffect(() => {
        const handleListenTableUpdated = (e: any) => {
            const deletedSet = getDeletedListenItemsSet();
            const deletedTargets: string[] = Array.isArray(e?.detail?.deletedTargets)
                ? e.detail.deletedTargets.map((t: any) => String(t || '').toLowerCase().trim()).filter(Boolean)
                : [];
            deletedTargets.forEach(t => deletedSet.add(t));
            setSources(prev => prev.filter(s => !isSourceDeletedInBlocklist(s, deletedSet) && !deletedSet.has(extractCleanYtId(s.target).toLowerCase())));
        };
        window.addEventListener('listen-table-updated', handleListenTableUpdated);
        return () => window.removeEventListener('listen-table-updated', handleListenTableUpdated);
    }, []);

    const handleWipePipeline = async () => {
        if (!confirmingWipe) {
            setConfirmingWipe(true);
            setTimeout(() => setConfirmingWipe(false), 6000);
            return;
        }
        setConfirmingWipe(false);
        setIsLoading(true);
        setStatusMessage(`Wiping local and GCS checkpoints for ${activeCompany}...`);
        try {
            const res = await fetch('/api/pipeline/wipe', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeCompany, includeListenTable: true })
            });
            const data = await res.json();
            await fetch('/api/insights/table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeCompany, rows: [] })
            }).catch(() => {});
            if (res.ok) {
                setRawComments([]); setStage2Data(null); setStage3Data(null); setStage4Data(null);
                setSelectedTopic(null); setSelectedNode(null); setSources([]);
                setAbcdResultsByVideo({}); setSentimentResultsByVideo({});
                delete dmlMemoryCache[companyCacheKey]; delete cachedMetacriticCorpus[companyCacheKey];
                onWipeListenData?.();
                try {
                    if ((window as any).__dmlGraphCache) delete (window as any).__dmlGraphCache[activeCompany];
                    localStorage.removeItem('insights_home_cache_' + activeCompany);
                    localStorage.removeItem('dml_graph_cache_' + activeCompany);
                } catch {}
                window.dispatchEvent(new CustomEvent('pipeline-wiped', { detail: { companyName: activeCompany } }));
                setStatusMessage(`Pipeline & Listen channels wiped (${data.deletedFilesCount || 0} local files, ${data.deletedGcsBlobsCount || 0} cloud blobs removed). Ready for fresh ingest.`);
            } else {
                setStatusMessage(`Wipe failed: ${data.error || 'Unknown error'}`);
            }
        } catch (e: any) {
            setStatusMessage(`Error wiping pipeline: ${e.message}`);
        } finally {
            setIsLoading(false);
        }
    };

    return { initCheckpoints, handleWipePipeline };
};
