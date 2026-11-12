import { useState, useEffect, useMemo } from 'react';
import {
    InsightAuditReport,
    generateInsightAuditReport,
    hydrateInsightAuditEvidence
} from '../../services/insightAuditService';

export type HorizonOption = 'all' | 'oneWeek' | 'oneMonth' | 'oneYear';
export type AuditFilterSection = 'all' | 'roadmap' | 'doubledown' | 'gonogo' | 'evidence';

export interface AuditVisualTelemetry {
    healthScore: number;
    healthPieData: { name: string; value: number; color: string }[];
    horizonData: { horizon: string; label: string; items: number; color: string; theme: string }[];
    decisionPieData: { name: string; value: number; color: string }[];
    goCount: number;
    reArchCount: number;
    noGoCount: number;
    doubleDownData: { name: string; fullName: string; score: number; category: string }[];
}

export const useInsightAuditState = (companyName: string, isDark: boolean) => {
    const activeCompany = companyName || 'test-company';
    const [auditReport, setAuditReport] = useState<InsightAuditReport | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(false);
    const [isSaving, setIsSaving] = useState<boolean>(false);
    const [statusMessage, setStatusMessage] = useState<string>('');
    const [selectedHorizon, setSelectedHorizon] = useState<HorizonOption>('all');
    const [filterSection, setFilterSection] = useState<AuditFilterSection>('all');

    const visualTelemetry = useMemo<AuditVisualTelemetry | null>(() => {
        if (!auditReport) return null;

        const rawHealth = auditReport.executiveSummary?.healthScore;
        const healthScore = typeof rawHealth === 'number' && !Number.isNaN(rawHealth) ? rawHealth : 0;
        const healthPieData = [
            { name: 'Health Score', value: healthScore, color: '#10B981' },
            { name: 'Improvement Gap', value: Math.max(0, 100 - healthScore), color: isDark ? '#061C36' : '#E2E8F0' }
        ];

        const horizonData = [
            {
                horizon: '1 Week',
                label: 'Hotfixes',
                items: auditReport.roadmap?.oneWeek?.items?.length ?? 0,
                color: '#EF4444',
                theme: auditReport.roadmap?.oneWeek?.theme || 'Urgent Hotfixes'
            },
            {
                horizon: '1 Month',
                label: 'Updates',
                items: auditReport.roadmap?.oneMonth?.items?.length ?? 0,
                color: '#0077C8',
                theme: auditReport.roadmap?.oneMonth?.theme || 'Release Updates'
            },
            {
                horizon: '1 Year',
                label: 'Architecture',
                items: auditReport.roadmap?.oneYear?.items?.length ?? 0,
                color: '#8B5CF6',
                theme: auditReport.roadmap?.oneYear?.theme || 'Strategic Roadmap'
            }
        ];

        let goCount = 0;
        let noGoCount = 0;
        let reArchCount = 0;

        const matrixItems = auditReport.nextCycleGoNoGoMatrix || [];
        matrixItems.forEach(item => {
            const d = (item.decision || '').toUpperCase();
            if (d === 'GO') goCount++;
            else if (d === 'NO-GO' || d === 'NO GO') noGoCount++;
            else reArchCount++;
        });

        const decisionPieData = [
            { name: 'GO (Greenlit)', value: goCount, color: '#10B981' },
            { name: 'RE-ARCHITECT', value: reArchCount, color: '#F59E0B' },
            { name: 'NO-GO (Halt)', value: noGoCount, color: '#EF4444' }
        ];

        const priorityFeatures = auditReport.nearTermDoubleDownFeatures || [];
        const doubleDownData = priorityFeatures.map(f => {
            const fName = String(f?.name || 'Feature');
            return {
                name: fName.length > 16 ? fName.substring(0, 14) + '...' : fName,
                fullName: fName,
                score: f?.positiveSignalRate || 0,
                category: f?.category || 'General'
            };
        });

        return {
            healthScore,
            healthPieData,
            horizonData,
            decisionPieData,
            goCount,
            reArchCount,
            noGoCount,
            doubleDownData
        };
    }, [auditReport, isDark]);

    const loadSavedAudit = async (isInitial = false) => {
        setIsLoading(true);
        if (isInitial) setAuditReport(null);
        else setStatusMessage('Checking GCS for latest saved Insight Audit...');
        let keepMessage = false;
        try {
            const companyParam = encodeURIComponent(activeCompany);
            const res = await fetch(`/api/load-run/insight_audit?companyName=${companyParam}`);
            if (res.ok) {
                let data = await res.json();
                if (data?.runData) data = data.runData;
                if (data?.data && typeof data.data === 'object' && !data.roadmap) data = data.data;
                if (data && (data.roadmap || data.executiveSummary || data.workstreams)) {
                    setAuditReport(data);
                    try { localStorage.setItem(`insight_audit_run_${activeCompany}`, JSON.stringify(data)); } catch {}
                    if (!isInitial) setStatusMessage('Loaded latest Insight Audit from GCS.');
                    return;
                }
            } else if (res.status !== 404) {
                const errText = await res.text().catch(() => '');
                let detail = errText;
                try {
                    const parsedErr = errText ? JSON.parse(errText) : null;
                    detail = parsedErr?.detail?.error || parsedErr?.detail || parsedErr?.error || errText;
                } catch {}
                keepMessage = true;
                setStatusMessage(`Failed to load Insight Audit from GCS (HTTP ${res.status})${detail ? `: ${typeof detail === 'string' ? detail : JSON.stringify(detail)}` : ''}`);
                return;
            }
            try {
                const cached = localStorage.getItem(`insight_audit_run_${activeCompany}`);
                if (cached) {
                    const parsed = JSON.parse(cached);
                    if (parsed && (parsed.roadmap || parsed.executiveSummary || parsed.workstreams)) {
                        setAuditReport(parsed);
                        if (!isInitial) setStatusMessage('Loaded latest Insight Audit from local cache.');
                        return;
                    }
                }
            } catch {}
            if (!isInitial) setStatusMessage('No previous audit run found in GCS. Click "Run Insight Audit" to generate.');
        } catch (e: any) {
            console.error('Error loading insight audit:', e);
            keepMessage = true;
            setStatusMessage(`Failed to load Insight Audit from GCS: ${e?.message || String(e)}`);
        } finally {
            setIsLoading(false);
            if (!keepMessage) {
                setTimeout(() => setStatusMessage(''), 4000);
            }
        }
    };

    const autoSaveToGCS = async (dataToSave: any) => {
        try {
            try { localStorage.setItem(`insight_audit_run_${activeCompany}`, JSON.stringify(dataToSave)); } catch {}
            await fetch('/api/save-run/insight_audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    featureId: 'insight_audit',
                    companyName: activeCompany,
                    timestamp: new Date().toISOString(),
                    data: dataToSave
                })
            });
        } catch (e) {
            console.warn('Auto-save to GCS failed:', e);
        }
    };

    const handleRunAudit = async () => {
        setIsLoading(true);
        setStatusMessage('Ingesting upstream telemetry & synthesizing cross-insight audit...');
        try {
            const evidence = await hydrateInsightAuditEvidence(activeCompany);
            const report = await generateInsightAuditReport(evidence, activeCompany, (status) => {
                setStatusMessage(status);
            });
            setAuditReport(report);
            setStatusMessage('Insight Audit synthesis complete and saved to GCS.');
            await autoSaveToGCS(report);
        } catch (e: any) {
            console.error('Error running insight audit:', e);
            setStatusMessage(`Synthesis failed: ${e.message || 'Unknown error'}`);
        } finally {
            setIsLoading(false);
            setTimeout(() => setStatusMessage(''), 4000);
        }
    };

    const handleManualSave = async () => {
        if (!auditReport) return;
        setIsSaving(true);
        setStatusMessage('Saving current audit report to GCS bucket...');
        try {
            const res = await fetch('/api/save-run/insight_audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    featureId: 'insight_audit',
                    companyName: activeCompany,
                    timestamp: new Date().toISOString(),
                    data: auditReport
                })
            });
            if (res.ok) {
                setStatusMessage('Successfully saved Insight Audit to GCS.');
            } else {
                setStatusMessage('Failed to save to GCS.');
            }
        } catch {
            setStatusMessage('Error saving to GCS.');
        } finally {
            setIsSaving(false);
            setTimeout(() => setStatusMessage(''), 4000);
        }
    };

    useEffect(() => {
        void loadSavedAudit(true);
    }, [activeCompany]);

    return {
        auditReport,
        isLoading,
        isSaving,
        statusMessage,
        selectedHorizon,
        setSelectedHorizon,
        filterSection,
        setFilterSection,
        visualTelemetry,
        loadSavedAudit,
        handleRunAudit,
        handleManualSave
    };
};
