import { GEMINI_MODELS, generateText, safeJsonParse } from '../geminiService';
import {
    type CrossReleaseEvolution,
    type FeatureCluster,
    type GraphLink,
    type GraphNode,
    type NoiseFilterResult,
    type Stage3KeywordResult,
    DEFAULT_NOISE_SOURCES,
} from './noiseTypes';
import { getStratifiedSample, sortCommentsBySourcePriority } from './languageAndTimeUtils';
import { isPlatformOrSourceNode, stripSourceMetadataPrefix } from './nodeStemmingUtils';
import {
    classifyHybridNodeSentiment,
    computeCorpusGroundedNodeStats,
    ensureTopicNodesHydrated,
} from './corpusNodeStatsBuilder';
import { enrichGraphLinksWithCommentAndTopicSignals } from './graphLinkEnricher';
import {
    loadStageDataFromGCS,
    saveStageDataToGCS,
    sendTerminalLog,
} from './stageGcsCacheClient';
import {
    buildCategoryHubs,
    normalizeNodeReleaseDistribution,
} from './stage4GraphBuilder';

// ============================================================================
// DEDICATED GRAPH RE-ANALYSIS (Runs on Graph Page using saved Stage 3 topics)
// ============================================================================
export const stage4_reanalyzeGraphOnly = async (
    stage3Data: Stage3KeywordResult,
    existingGraphData?: NoiseFilterResult | null,
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void
): Promise<NoiseFilterResult> => {
    await sendTerminalLog(`STAGE 4 GRAPH RE-ANALYSIS STARTING: Re-synthesizing network graph from saved Stage 3 topics...`, 'header');
    if (onProgress) onProgress(`Re-synthesizing network graph nodes and multi-signal topic relationships from saved comments...`);

    const totalHarvested = existingGraphData?.totalHarvested || stage3Data.totalEnriched;
    const noiseCount = existingGraphData?.noiseCount || 0;
    const signalCount = existingGraphData?.signalCount || stage3Data.totalEnriched;
    const sourcesUsed = existingGraphData?.sourcesUsed || DEFAULT_NOISE_SOURCES;

    const noisePercentage = Math.round((noiseCount / (totalHarvested || 1)) * 100);
    const signalPercentage = 100 - noisePercentage;

    const savedTopTopics = (stage3Data.topKeywords || [])
        .filter(k => !isPlatformOrSourceNode(k?.keyword || (k as any)?.title))
        .slice(0, 40)
        .map(k => ({
            topic: k.keyword || (k as any).title,
            category: k.category,
            mentions: k.mentions || (k as any).count,
            sentiment: k.sentiment
        }));

    const allEnrichedReanalyze = stage3Data.enrichedComments || [];
    const mcCriticReanalyzeCount = allEnrichedReanalyze.filter(c => c.source === 'Metacritic' && c.reviewType === 'critic').length;
    const mcUserReanalyzeCount = allEnrichedReanalyze.filter(c => c.source === 'Metacritic' && c.reviewType === 'user').length;
    const sampleEnrichedCritiques = getStratifiedSample(allEnrichedReanalyze, 36).map(c => {
        const cleanBody = stripSourceMetadataPrefix(c.rawText);
        return {
            period: c.period || c.release,
            sourceLabel: c.sourceLabel || c.source,
            reviewType: c.reviewType,
            score: c.score,
            structuredKeywords: (c.structuredKeywords || []).filter(k => !isPlatformOrSourceNode(k)),
            discoveredTopics: (c.discoveredTopics || c.keywords || []).filter(k => !isPlatformOrSourceNode(k)),
            text: cleanBody ? (cleanBody.length > 140 ? cleanBody.slice(0, 140) + '...' : cleanBody) : '',
            sentiment: c.sentiment
        };
    });

    const validStage3Clusters = (stage3Data.featureClusters || []).filter(fc => !isPlatformOrSourceNode(fc?.category));
    const categoryHubs: GraphNode[] = buildCategoryHubs(validStage3Clusters, totalHarvested);

    const nodeGraphPrompt = `You are the Lead Intelligence Network Architect for ${companyName}.
Synthesize an EXPANDED, HIGH-DENSITY MASTER RELATIONSHIP GRAPH containing **50 to 75+ granular feature and sentiment nodes** and **80+ rich multi-signal links** based on the saved customer feedback topics.

DATA INPUTS FROM SAVED STAGE 3 TOPIC ENRICHMENT:
- Total Signal Harvested: ${signalCount} across ${sourcesUsed.length} sources (including ${mcCriticReanalyzeCount} Metacritic Critic Reviews from /critic-reviews/ and ${mcUserReanalyzeCount} Metacritic User Reviews from /user-reviews/)
- Discovered Category Hubs: ${JSON.stringify(categoryHubs.map(h => h.id))}
- Top Discovered Topics & Keywords: ${JSON.stringify(savedTopTopics)}
- Stratified Multi-Channel Feedback Sample (Critic Reviews, User Reviews, Steam, Reddit, YouTube): ${JSON.stringify(sampleEnrichedCritiques)}

TASK:
Build the comprehensive Relationship Graph with:
1. Category Hubs: ${JSON.stringify(categoryHubs.map(h => h.id))} (type = "category").
2. 50-75+ Feature & Topic Nodes classified into these categories:
   - Ground feature nodes in the REAL discovered topics provided in the data above.
   - CRITICAL RULE: NEVER create a node for a platform, media channel, or review source (such as "Metacritic", "YouTube", "Reddit", "Steam", "TikTok", "Critic Reviews", "User Reviews", or "Metascore"). Every node must represent an actual product feature, service dimension, technical aspect, or customer experience topic.
   - Each node must include: id, label, type ("feature"), category, tier ("core" or "micro"), sentiment ("positive" | "negative" | "mixed"), size (14-34), mentionCount, releaseDistribution { priorPeriod, currentPeriod, nextPeriod }, positiveRatio (0-100).
3. 80+ Weighted Relationship Links connecting:
   - Category Hubs to their spoke Feature/Topic nodes (relationship = "category_pillar")
   - Topic-to-Topic pairs co-mentioned or overlapping in customer comments (relationship = "co_mentioned" or "comment_overlap")
   - Topics discussed together in the same video/thread/review source (relationship = "shared_source")
   - Cross-Category Topic Bridges where an issue or feature in one pillar directly impacts a topic in another pillar (relationship = "cross_category_bridge" or "semantic_affinity")
   - Each link must include: source (exact node id), target (exact node id), weight (4-35), sentiment ("positive" | "negative" | "mixed"), relationship, and reason (concise 1-line explanation of why the two topics are linked).
4. Feature clusters across all core domains.

REQUIRED OUTPUT SCHEMA (JSON only):
{
  "nodes": ${JSON.stringify(categoryHubs)},
  "links": [
    {
      "source": "${categoryHubs[0]?.id || 'Quality'}",
      "target": "${savedTopTopics[0]?.topic || 'Durability'}",
      "weight": 14,
      "sentiment": "negative",
      "relationship": "co_mentioned",
      "reason": "Co-mentioned in customer critiques linking ${categoryHubs[0]?.id || 'Quality'} and ${savedTopTopics[0]?.topic || 'Durability'}"
    }
  ],
  "featureClusters": ${JSON.stringify(validStage3Clusters)}
}
Return JSON only.`;

    let generatedNodes: GraphNode[] = [];
    let rawLinks: GraphLink[] = [];
    let generatedClusters: FeatureCluster[] = validStage3Clusters;

    try {
        const synthText = await generateText(nodeGraphPrompt, GEMINI_MODELS.FLASH, {
            responseMimeType: 'application/json',
            temperature: 0.25,
            thinkingConfig: { thinkingLevel: 'LOW' }
        });
        const parsed = safeJsonParse(synthText);
        if (!parsed || !Array.isArray(parsed.nodes) || parsed.nodes.length === 0) {
            throw new Error('Invalid response structure from graph re-analysis model');
        }
        generatedNodes = parsed.nodes
            .map((n: any, nIdx: number) => {
                const safeLabel = String(n?.label || n?.name || n?.topic || n?.id || `Topic ${nIdx + 1}`).trim();
                const safeId = String(n?.id || safeLabel || `node-${nIdx + 1}`).trim();
                const copy: any = {
                    ...n,
                    id: safeId,
                    label: safeLabel,
                    releaseDistribution: normalizeNodeReleaseDistribution(n?.releaseDistribution),
                    _priorPositiveRatio: typeof n?.positiveRatio === 'number' ? n.positiveRatio : undefined,
                    _priorSentiment: n?.sentiment
                };
                const isCategoryHub = copy.type === 'category' || copy.type === 'release';
                const grounded = computeCorpusGroundedNodeStats(safeLabel, copy.category, isCategoryHub, stage3Data, copy);
                if (typeof grounded.mentionCount === 'number' && grounded.mentionCount > 0 && grounded.mentionCount < totalHarvested) {
                    copy.mentionCount = grounded.mentionCount;
                }
                if (typeof grounded.positiveRatio === 'number') {
                    copy.positiveRatio = grounded.positiveRatio;
                    copy.sentiment = grounded.sentiment || classifyHybridNodeSentiment(grounded.positiveRatio);
                } else if (typeof copy.positiveRatio === 'number') {
                    copy.positiveRatio = Math.max(0, Math.min(100, Math.round(copy.positiveRatio)));
                    copy.sentiment = classifyHybridNodeSentiment(copy.positiveRatio);
                } else {
                    copy.positiveRatio = 50;
                    copy.sentiment = 'positive';
                }
                if (!copy.mentionCount || copy.mentionCount >= totalHarvested) {
                    copy.mentionCount = isCategoryHub
                        ? Math.max(25, Math.round(totalHarvested * 0.22))
                        : Math.max(12, Math.min(220, Math.round((copy.size || 18) * 4.2)));
                }
                return copy;
            })
            .filter((n: any) => !isPlatformOrSourceNode(n.id) && !isPlatformOrSourceNode(n.label));
        rawLinks = parsed.links || [];
        generatedClusters = (parsed.featureClusters || validStage3Clusters).filter((fc: FeatureCluster) => !isPlatformOrSourceNode(fc?.category));
    } catch (e) {
        console.error('Graph re-analysis error:', e);
        await sendTerminalLog(`[Graph Re-Analysis Error] Failed to generate graph: ${e instanceof Error ? e.message : String(e)}`, 'error');
        throw e;
    }

    const hydratedNodes = ensureTopicNodesHydrated(generatedNodes, categoryHubs, stage3Data, totalHarvested);
    const enrichedLinks = enrichGraphLinksWithCommentAndTopicSignals(
        hydratedNodes,
        rawLinks.length > 0 ? rawLinks : (existingGraphData?.links || []),
        stage3Data
    );

    let preservedTrajectory: CrossReleaseEvolution[] = existingGraphData?.crossReleaseEvolution || [];
    if (!Array.isArray(preservedTrajectory) || preservedTrajectory.length === 0) {
        try {
            const savedTraj = await loadStageDataFromGCS('noise_filter_trajectory', companyName);
            if (savedTraj && Array.isArray(savedTraj.crossReleaseEvolution) && savedTraj.crossReleaseEvolution.length > 0) {
                preservedTrajectory = savedTraj.crossReleaseEvolution;
            }
        } catch {
            // Keep empty if none in GCS
        }
    }

    const savedAt = new Date().toISOString();

    await sendTerminalLog(`Saving dedicated Network Graph checkpoint to GCS (noise_filter_graph)...`, 'info');
    await saveStageDataToGCS('noise_filter_graph', {
        nodes: hydratedNodes,
        links: enrichedLinks,
        graphNodes: hydratedNodes,
        graphLinks: enrichedLinks,
        featureClusters: generatedClusters,
        featureCategories: generatedClusters.map(c => c.category),
        totalHarvested,
        noiseCount,
        signalCount,
        noisePercentage,
        signalPercentage,
        savedAt
    }, companyName);

    const finalResult: NoiseFilterResult = {
        totalHarvested,
        noiseCount,
        signalCount,
        noisePercentage,
        signalPercentage,
        comments: sortCommentsBySourcePriority(stage3Data.enrichedComments),
        nodes: hydratedNodes,
        links: enrichedLinks,
        graphNodes: hydratedNodes,
        graphLinks: enrichedLinks,
        featureClusters: generatedClusters,
        crossReleaseEvolution: preservedTrajectory,
        sourcesUsed,
        generatedAt: `Today • Graph Re-analysis (${GEMINI_MODELS.FLASH})`,
        savedAt
    };

    await sendTerminalLog(`STAGE 4 GRAPH RE-ANALYSIS COMPLETE: Generated ${finalResult.nodes.length} nodes & ${finalResult.links.length} multi-signal links. Saving master checkpoint to GCS (noise_filter)...`, 'success');
    await saveStageDataToGCS('noise_filter', finalResult, companyName);

    return finalResult;
};
