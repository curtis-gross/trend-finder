export interface ActionItem {
    id: string;
    title: string;
    description: string;
    owner: string;
    priority: 'critical' | 'high' | 'medium';
    expectedImpact: string;
    evidenceSource: string;
}

export interface DoubleDownFeature {
    id: string;
    name: string;
    category: string;
    positiveSignalRate: number; // e.g. 88%
    whyDoubleDown: string;
    recommendedPatchActions: string[];
    riskIfIgnored: string;
}

export interface GoNoGoDecision {
    id: string;
    featureName: string;
    category: string;
    decision: 'GO' | 'NO-GO' | 'RE-ARCHITECT';
    sentimentScore: number; // 0 - 100
    communityVerdict: string;
    strategicRationale: string;
    nextCycleRecommendation: string;
    recommendation?: string;
}

export interface InsightAuditReport {
    id: string;
    companyName: string;
    generatedAt: string;
    executiveSummary: {
        healthScore: number; // 0 - 100
        healthVerdict: string;
        topPositiveBreakthrough: string;
        primaryFrictionVector: string;
        summaryNarrative: string;
    };
    roadmap: {
        oneWeek: {
            theme: string;
            items: ActionItem[];
        };
        oneMonth: {
            theme: string;
            items: ActionItem[];
        };
        oneYear: {
            theme: string;
            items: ActionItem[];
        };
    };
    nearTermDoubleDownFeatures: DoubleDownFeature[];
    nextCycleGoNoGoMatrix: GoNoGoDecision[];
    evidenceSummary: {
        individualCount: number;
        hasBulkAnalysis: boolean;
        noiseFilterSignalCount: number;
        noiseFilterTotal: number;
        alertsCount: number;
    };
}

export interface InsightAuditEvidence {
    individualAnalyses: any[];
    bulkAnalysis: any;
    noiseFilterData: any;
    alertsData: any;
}

// Hydrate upstream evidence across all 4 Insights components
export const hydrateInsightAuditEvidence = async (
    companyName: string = 'test-company'
): Promise<InsightAuditEvidence> => {
    const activeCompany = companyName || 'test-company';
    let individualAnalyses: any[] = [];
    let bulkAnalysis: any = null;
    let noiseFilterData: any = null;
    let alertsData: any = null;

    // 1. Individual Insights
    try {
        const res = await fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeCompany)}`);
        if (res.ok) {
            const data = await res.json();
            if (Array.isArray(data)) individualAnalyses = data;
        }
    } catch (e) {
        console.warn('Could not load individual analyses for audit:', e);
    }

    // 2. Bulk Analysis
    try {
        const res = await fetch(`/api/insights/analysis?analysisId=bulk_analysis&companyName=${encodeURIComponent(activeCompany)}`);
        if (res.ok) {
            bulkAnalysis = await res.json();
        }
    } catch (e) {
        console.warn('Could not load bulk analysis for audit:', e);
    }

    // 3. Noise Filter
    try {
        const res = await fetch(`/api/load-run/noise_filter?companyName=${encodeURIComponent(activeCompany)}`);
        if (res.ok) {
            noiseFilterData = await res.json();
        }
    } catch (e) {
        console.warn('Could not load noise filter data for audit:', e);
    }

    // 4. Alerts
    try {
        const res = await fetch(`/api/insights/analysis?analysisId=sentiment_alerts&companyName=${encodeURIComponent(activeCompany)}`);
        if (res.ok) {
            alertsData = await res.json();
        }
    } catch (e) {
        console.warn('Could not load alerts data for audit:', e);
    }

    return {
        individualAnalyses,
        bulkAnalysis,
        noiseFilterData,
        alertsData
    };
};
