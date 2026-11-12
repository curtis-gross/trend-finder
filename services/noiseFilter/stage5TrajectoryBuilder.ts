import { GEMINI_MODELS, generateText, safeJsonParse } from '../geminiService';
import {
    type CrossReleaseEvolution,
    type Stage3KeywordResult,
} from './noiseTypes';
import { getCommentYear, getStratifiedSample } from './languageAndTimeUtils';
import { isPlatformOrSourceNode, stripSourceMetadataPrefix } from './nodeStemmingUtils';
import {
    loadStageDataFromGCS,
    saveStageDataToGCS,
    sendTerminalLog,
} from './stageGcsCacheClient';

// ============================================================================
// STAGE 5: DEDICATED TRAJECTORY REBUILD & PERSISTENCE
// ============================================================================
export const stage5_rebuildTrajectoryData = async (
    stage3Data: Stage3KeywordResult,
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void,
    syncMasterFile: boolean = true
): Promise<CrossReleaseEvolution[]> => {
    await sendTerminalLog(`STAGE 5 TRAJECTORY REBUILD STARTING: Synthesizing longitudinal trajectory from saved topic analysis with ${GEMINI_MODELS.FLASH}...`, 'header');
    if (onProgress) onProgress(`Synthesizing 12-16 dynamic trajectory pillars from saved topic analysis...`);

    const signalCount = stage3Data.totalEnriched || stage3Data.enrichedComments.length;
    const savedTopTopics = (stage3Data.topKeywords || [])
        .filter((k: any) => !isPlatformOrSourceNode(k?.keyword || k?.title))
        .slice(0, 35)
        .map((k: any) => ({
            topic: k.keyword || k.title,
            category: k.category,
            count: k.mentions || k.count,
            sentiment: k.sentiment,
            isBreakout: k.isBreakout
        }));

    const allEnrichedTraj = stage3Data.enrichedComments || [];
    const mcCriticTrajCount = allEnrichedTraj.filter(c => c.source === 'Metacritic' && c.reviewType === 'critic').length;
    const mcUserTrajCount = allEnrichedTraj.filter(c => c.source === 'Metacritic' && c.reviewType === 'user').length;
    const sampleCritiques = getStratifiedSample(allEnrichedTraj, 32).map(c => {
        const cleanBody = stripSourceMetadataPrefix(c.rawText);
        return {
            text: cleanBody ? (cleanBody.length > 140 ? cleanBody.slice(0, 140) + '...' : cleanBody) : '',
            year: getCommentYear(c),
            source: c.source,
            reviewType: c.reviewType,
            score: c.score,
            structuredKeywords: (c.structuredKeywords || []).filter(k => !isPlatformOrSourceNode(k)),
            discoveredTopics: (c.discoveredTopics || c.keywords || []).filter(k => !isPlatformOrSourceNode(k)),
            sentiment: c.sentiment
        };
    });

    const roleTitle = 'Principal Consumer Intelligence & Product Experience Strategist';
    const scopeDesc = `across core product categories, operations, and customer experience pillars for ${companyName} based on saved customer feedback (including Metacritic Critic Reviews from /critic-reviews/ and Metacritic User Reviews from /user-reviews/).`;

    const trajectoryPrompt = `You are the ${roleTitle} for ${companyName}.
Analyze and synthesize **12 to 16 Comprehensive Longitudinal Sentiment Trajectory Pillars** ${scopeDesc}

DATA INPUTS FROM SAVED STAGE 3 ANALYSIS:
- Total Signal Comments: ${signalCount} (including ${mcCriticTrajCount} Metacritic Critic Reviews from /critic-reviews/ and ${mcUserTrajCount} Metacritic User Reviews from /user-reviews/)
- Feature Categories: ${JSON.stringify(stage3Data.featureClusters.filter(c => !isPlatformOrSourceNode(c.category)).map(c => c.category))}
- Top Discovered Community Topics: ${JSON.stringify(savedTopTopics)}
- Stratified Multi-Channel Feedback Sample (Critic Reviews, User Reviews, Steam, Reddit, YouTube): ${JSON.stringify(sampleCritiques)}

TASK:
Produce 12 to 16 detailed trajectory intelligence pillars organized by comment year progression (2022 Foundation → 2023 Historical → 2024 Benchmark → 2025 Prior Year → 2026 Current Year → 2027 Predictive Outlook) based DIRECTLY on the discovered customer feedback topics above.
For each pillar provide:
- feature: Descriptive pillar title based on discovered topic themes (e.g. "White Glove Delivery & Logistics Reliability", "Solid Wood Dining Craftsmanship", "Sectional Cushion Comfort & Resilience", "Customer Care & Return Resolution", "Pricing Transparency & Perceived Value")
- category: One of the core discovered feature categories
- year2022Sentiment: 0-100 score reflecting 2022 Foundation (Historical baseline customer sentiment)
- year2023Sentiment: 0-100 score reflecting 2023 Historical (Pre-friction / historical horizon)
- year2024Sentiment: 0-100 score reflecting 2024 Benchmark (Recorded feedback)
- year2025Sentiment: 0-100 score reflecting 2025 Prior Year (Previous year customer feedback)
- year2026Sentiment: 0-100 score reflecting 2026 Current Year (Active customer feedback; CRITICAL RULE: Apply a 2-3% [2.5%] threshold for trajectory classification: if the change vs prior year is within ±2.5% [-2.5% < delta < +2.5%], label trajectory as "stable"; if it improved by >= +2.5%, label as "improving"; if it declined by <= -2.5%, label as "declining" or "critical")
- year2027Sentiment: 0-100 score reflecting 2027 Predictive Outlook (Directional extrapolation based on 2022-2026 trajectory. CRITICAL RULE: 2027 must be a realistic prediction on the direction of the lines rather than optimistic. If a pillar has been declining or is critical across 2024-2026, 2027 must predict continued downward trajectory or leveling off, NEVER an unrealistic spike up to 75-80)
- baselineSentiment: 0-100 score reflecting 2024 Benchmark
- priorSentiment: 0-100 score reflecting 2025 Prior Year
- currentSentiment: 0-100 score reflecting 2026 Current Year
- targetSentiment: 0-100 score reflecting 2027 Predictive Outlook
- trajectory: "improving" | "declining" | "stable" | "emerging" | "critical"
- keyDrivers: [2-3 specific customer experience catalysts grounded in feedback]
- actionableMandate: explicit brand, product, or operational mandate for 2027
- riskIfIgnored: customer churn, return rate increase, or brand reputation risk if unaddressed
- summary: 1-2 sentence concise high-signal summary

REQUIRED OUTPUT SCHEMA (JSON only):
{
  "crossReleaseEvolution": [
    {
      "feature": "White Glove Delivery & Logistics Reliability",
      "category": "Delivery & Logistics",
      "year2022Sentiment": 48,
      "year2023Sentiment": 42,
      "year2024Sentiment": 35,
      "year2025Sentiment": 42,
      "year2026Sentiment": 38,
      "year2027Sentiment": 34,
      "baselineSentiment": 35,
      "priorSentiment": 42,
      "currentSentiment": 38,
      "targetSentiment": 34,
      "trajectory": "critical",
      "keyDrivers": ["Carrier dispatch delays", "Unscheduled delivery windows", "Assembly damage on site"],
      "actionableMandate": "Implement real-time SMS tracking updates and specialized white-glove packaging protocols for 2027.",
      "riskIfIgnored": "Elevated return rates, customer churn, and negative online review cascades.",
      "summary": "Delivery window friction and packaging damages drove notable customer dissatisfaction across 2025-2026."
    }
  ]
}
Return JSON only.`;

    try {
        const text = await generateText(trajectoryPrompt, GEMINI_MODELS.FLASH, {
            responseMimeType: 'application/json',
            temperature: 0.25,
            thinkingConfig: { thinkingLevel: 'LOW' }
        });
        const parsed = safeJsonParse(text);
        if (!parsed || !Array.isArray(parsed.crossReleaseEvolution) || parsed.crossReleaseEvolution.length === 0) {
            throw new Error('Invalid response structure from trajectory model');
        }
        const toNumOrNull = (val: unknown): number | null =>
            typeof val === 'number' && !Number.isNaN(val) ? val : null;

        const trajectoryList: CrossReleaseEvolution[] = parsed.crossReleaseEvolution
            .filter((p: any) => !isPlatformOrSourceNode(p?.feature))
            .map((p: any) => {
                const base = toNumOrNull(p.year2024Sentiment ?? p.baselineSentiment);
                const prior = toNumOrNull(p.year2025Sentiment ?? p.priorSentiment ?? p.priorPeriodSentiment);
                const curr = toNumOrNull(p.year2026Sentiment ?? p.currentSentiment ?? p.currentPeriodSentiment);
                const delta = (curr !== null && prior !== null) ? (curr - prior) : null;
                const multiYearDelta = (curr !== null && base !== null) ? ((curr - base) / 2) : null;
                const effectiveSlope = (delta !== null && multiYearDelta !== null)
                    ? Math.round((delta * 0.6) + (multiYearDelta * 0.4))
                    : (delta !== null ? Math.round(delta) : null);
                const predicted2027 = (curr !== null && effectiveSlope !== null)
                    ? Math.max(15, Math.min(95, Math.round(curr + (effectiveSlope * 0.8))))
                    : null;

                let target = toNumOrNull(p.year2027Sentiment ?? p.targetSentiment ?? p.nextPeriodSentiment) ?? predicted2027;
                if (curr !== null && target !== null && delta !== null && predicted2027 !== null) {
                    if ((curr < 50 && target >= 68) || (delta < 0 && target > curr + 5) || (target - curr > 14)) {
                        target = predicted2027;
                    }
                }

                const y22 = toNumOrNull(p.year2022Sentiment);
                const y23 = toNumOrNull(p.year2023Sentiment);
                const mandate = p.actionableMandate || '';

                let traj = p.trajectory;
                if (delta !== null && curr !== null) {
                    if (delta > -2.5 && delta < 2.5) {
                        if (traj !== 'emerging') traj = 'stable';
                    } else if (delta >= 2.5) {
                        if (traj !== 'emerging') traj = 'improving';
                    } else if (delta <= -2.5) {
                        if (traj !== 'critical' && traj !== 'declining') {
                            traj = (curr <= 42 || delta <= -8) ? 'critical' : 'declining';
                        }
                    }
                }

                return {
                    ...p,
                    year2022Sentiment: y22,
                    year2023Sentiment: y23,
                    year2024Sentiment: base,
                    year2025Sentiment: prior,
                    year2026Sentiment: curr,
                    year2027Sentiment: target,
                    baselineSentiment: base,
                    priorSentiment: prior,
                    currentSentiment: curr,
                    targetSentiment: target,
                    priorPeriodSentiment: prior,
                    currentPeriodSentiment: curr,
                    nextPeriodSentiment: target,
                    actionableMandate: mandate,
                    trajectory: traj
                };
            });

        await sendTerminalLog(`Saving dedicated Trajectory checkpoint to GCS (noise_filter_trajectory)...`, 'info');
        await saveStageDataToGCS('noise_filter_trajectory', {
            crossReleaseEvolution: trajectoryList,
            totalPillars: trajectoryList.length,
            savedAt: new Date().toISOString()
        }, companyName);

        if (syncMasterFile) {
            const existingGraph = await loadStageDataFromGCS('noise_filter', companyName);
            if (existingGraph) {
                const preservedNodes = Array.isArray(existingGraph.nodes) && existingGraph.nodes.length > 0
                    ? existingGraph.nodes
                    : (Array.isArray(existingGraph.graphNodes) ? existingGraph.graphNodes : []);
                const preservedLinks = Array.isArray(existingGraph.links) && existingGraph.links.length > 0
                    ? existingGraph.links
                    : (Array.isArray(existingGraph.graphLinks) ? existingGraph.graphLinks : []);
                await saveStageDataToGCS('noise_filter', {
                    ...existingGraph,
                    nodes: preservedNodes,
                    links: preservedLinks,
                    graphNodes: preservedNodes,
                    graphLinks: preservedLinks,
                    crossReleaseEvolution: trajectoryList,
                    savedAt: new Date().toISOString()
                }, companyName);
            }
        }

        await sendTerminalLog(`✅ STAGE 5 COMPLETE: Rebuilt ${trajectoryList.length} trajectory pillars and saved dedicated checkpoint.`, 'success');
        return trajectoryList;
    } catch (e) {
        console.error('Trajectory rebuild failed:', e);
        await sendTerminalLog(`[Trajectory Rebuild Error] Failed: ${e instanceof Error ? e.message : String(e)}`, 'error');
        throw e;
    }
};
