import { GEMINI_MODELS, generateText, safeJsonParse } from '../geminiService';
import type { InsightAuditEvidence, InsightAuditReport } from './insightAuditTypesAndHydrator';

// Generate Comprehensive Strategic Audit via Gemini 3.8 Flash (Low Thinking)
export const generateInsightAuditReport = async (
    evidence: InsightAuditEvidence,
    companyName: string = 'test-company',
    onProgress?: (msg: string) => void
): Promise<InsightAuditReport> => {
    const activeCompany = companyName || 'test-company';
    console.log(`\n======================================================`);
    console.log(`📑 [INSIGHT AUDIT] Generating Strategic Audit Report for ${activeCompany} via Gemini 3.8 Flash (Low Thinking)`);
    console.log(`======================================================\n`);

    if (onProgress) onProgress('Synthesizing evidence across Individual Insights, Bulk, Noise Filter & Alerts...');

    const indivSummary = evidence.individualAnalyses.slice(0, 15).map(a => ({
        id: a.id || a.analysisId,
        title: a.title,
        type: a.type,
        overallSentiment: a.sentiment_overall || a.sentiment,
        keyFindings: a.summary || a.top_positives || []
    }));

    const bulkSummary = evidence.bulkAnalysis ? {
        takeaways: evidence.bulkAnalysis.gemini_summary || evidence.bulkAnalysis.takeaways || [],
        overallScore: evidence.bulkAnalysis.overall_sentiment_score || 72
    } : null;

    const noiseSummary = evidence.noiseFilterData ? {
        totalHarvested: evidence.noiseFilterData.totalHarvested,
        signalCount: evidence.noiseFilterData.signalCount,
        noisePercentage: evidence.noiseFilterData.noisePercentage,
        signalPercentage: evidence.noiseFilterData.signalPercentage,
        topFeatures: (evidence.noiseFilterData.nodes || []).filter((n: any) => n.type === 'feature').slice(0, 12).map((n: any) => ({
            label: n.label,
            category: n.category,
            sentiment: n.sentiment,
            positiveRatio: n.positiveRatio
        })),
        crossReleaseEvolution: evidence.noiseFilterData.crossReleaseEvolution || []
    } : null;

    const alertsSummary = evidence.alertsData ? {
        activeAlerts: (evidence.alertsData.alerts || []).slice(0, 5).map((al: any) => ({
            title: al.title,
            severity: al.severity,
            channel: al.channel,
            summary: al.summary
        }))
    } : null;

    const prompt = `You are the Chief Product Officer, Executive Strategy Director, and Analytics Lead for ${activeCompany}.
Your objective is to conduct a strategic **INSIGHT AUDIT** by evaluating all findings across 4 core evidence channels:
1. Individual Insights (Video, Reviews, Social Pulse, Reddit)
2. Bulk Research Analysis (Cross-channel synthesis)
3. Noise Filter Results (High-signal product attributes isolated from pile-on negativity, multi-period trajectory)
4. Sentiment Anomaly Alerts (Friction spikes, service or quality flags)

==================================================
UPSTREAM EVIDENCE CORPUS:
==================================================
- Individual Analyses Count: ${evidence.individualAnalyses.length}
- Individual Samples: ${JSON.stringify(indivSummary, null, 2)}
- Bulk Research Summary: ${JSON.stringify(bulkSummary, null, 2)}
- Noise Filter High-Signal Summary: ${JSON.stringify(noiseSummary, null, 2)}
- Anomaly Alerts Summary: ${JSON.stringify(alertsSummary, null, 2)}

==================================================
STRATEGIC DIRECTIVES:
==================================================
1. Executive Health Scorecard: Determine overall customer sentiment trajectory (0-100), top breakthrough, and primary friction.
2. Horizon Action Plan:
   - 1-Week Plan: Immediate fixes, operational tuning, urgent customer communications.
   - 1-Month Plan: Upcoming cycle updates, quality refinements, and experience adjustments.
   - 1-Year Plan: Long-term architectural, platform, and product investments.
3. Near-Term Action Priorities (Double Down Features):
   - Identify 4-5 product features or strengths with high positive signal that should receive maximum investment and promotion in upcoming releases.
4. Next-Cycle Go / No-Go Decision Matrix:
   - Provide concrete strategic verdicts for the next release cycle:
     - GO: Features to greenlight and expand.
     - NO-GO: Legacy features or friction points to sunset/deprecate.
     - RE-ARCHITECT: Capabilities that need a ground-up redesign.

==================================================
REQUIRED OUTPUT SCHEMA:
==================================================
Return a valid JSON object matching this schema:
{
  "id": "audit-${Date.now()}",
  "companyName": "${activeCompany}",
  "generatedAt": "Today • Real-Time Insight Audit",
  "executiveSummary": {
    "healthScore": 78,
    "healthVerdict": "Strong Core Foundation with Addressable Operational Friction",
    "topPositiveBreakthrough": "Core Product Craftsmanship & Digital Discovery Experience",
    "primaryFrictionVector": "Fulfillment Latency & Tiered Onboarding Complexity",
    "summaryNarrative": "Executive narrative summarizing community sentiment across prior, current, and forward release periods."
  },
  "roadmap": {
    "oneWeek": {
      "theme": "Immediate Service Stabilization & Rapid Response",
      "items": [
        {
          "id": "w1-1",
          "title": "Resolve High-Priority Checkout & Verification Friction",
          "description": "Eliminate top customer friction vector identified in recent review threads.",
          "owner": "Core Platform Team",
          "priority": "critical",
          "expectedImpact": "Reduce negative support spikes within 48 hours.",
          "evidenceSource": "Customer Reviews & Reddit Feedback"
        }
      ]
    },
    "oneMonth": {
      "theme": "Near-Term Experience & Quality Refinements",
      "items": [
        {
          "id": "m1-1",
          "title": "Streamline Onboarding & Tier Progression Milestones",
          "description": "Replace high-friction requirements with clear milestone progression.",
          "owner": "Product Experience Team",
          "priority": "high",
          "expectedImpact": "Increase active customer engagement by +25%.",
          "evidenceSource": "Noise Filter Signal Extraction"
        }
      ]
    },
    "oneYear": {
      "theme": "Next-Cycle Architecture & Core Platform Evolution",
      "items": [
        {
          "id": "y1-1",
          "title": "Unify Cross-Channel Personalization & Fulfillment Engine",
          "description": "Complete architectural upgrade for end-to-end reliability and speed.",
          "owner": "Architecture Group",
          "priority": "high",
          "expectedImpact": "Establish industry-leading benchmark for next release cycle.",
          "evidenceSource": "Multi-Period Sentiment Trajectory"
        }
      ]
    }
  },
  "nearTermDoubleDownFeatures": [
    {
      "id": "dd-1",
      "name": "Core Product Quality & Design Finish",
      "category": "Product Innovation",
      "positiveSignalRate": 88,
      "whyDoubleDown": "Highest positive signal across creator and customer channels.",
      "recommendedPatchActions": [
        "Expand flagship feature visibility across onboarding flows",
        "Introduce guided customization templates"
      ],
      "riskIfIgnored": "Missed opportunity to convert high organic advocacy."
    }
  ],
  "nextCycleGoNoGoMatrix": [
    {
      "id": "gng-1",
      "featureName": "Streamlined Digital Discovery Flow",
      "category": "Core Experience",
      "decision": "GO",
      "sentimentScore": 90,
      "communityVerdict": "Strong Acclaim • Essential Brand Pillar",
      "strategicRationale": "Proven retention driver across new and returning cohorts.",
      "nextCycleRecommendation": "Position as primary pillar for the next release cycle."
    }
  ],
  "evidenceSummary": {
    "individualCount": ${evidence.individualAnalyses.length},
    "hasBulkAnalysis": ${Boolean(evidence.bulkAnalysis)},
    "noiseFilterSignalCount": ${evidence.noiseFilterData?.signalCount || 0},
    "noiseFilterTotal": ${evidence.noiseFilterData?.totalHarvested || 0},
    "alertsCount": ${(evidence.alertsData?.alerts || []).length}
  }
}

Return JSON only. No markdown formatting, no backticks.`;

    try {
        const text = await generateText(prompt, GEMINI_MODELS.FLASH, {
            responseMimeType: 'application/json',
            temperature: 0.2
        });

        const parsed = safeJsonParse(text);
        if (parsed && parsed.executiveSummary && parsed.roadmap) {
            const nearTerm = Array.isArray(parsed.nearTermDoubleDownFeatures)
                ? parsed.nearTermDoubleDownFeatures
                : [];
            const matrix = (Array.isArray(parsed.nextCycleGoNoGoMatrix) ? parsed.nextCycleGoNoGoMatrix : []).map((item: any) => ({
                ...item,
                nextCycleRecommendation: item.nextCycleRecommendation || item.recommendation || '',
                recommendation: item.recommendation || item.nextCycleRecommendation || ''
            }));
            return {
                ...parsed,
                companyName: parsed.companyName || activeCompany,
                nearTermDoubleDownFeatures: nearTerm,
                nextCycleGoNoGoMatrix: matrix
            };
        }
        throw new Error('Invalid Insight Audit JSON structure');
    } catch (e) {
        console.error('Insight audit generation failed:', e);
        throw e;
    }
};
