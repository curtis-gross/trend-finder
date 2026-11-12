import React, { useEffect, useState } from 'react';
import { generateBulkAnalysis } from '../../../services/geminiService';
import { getVideoId } from '../typesAndConstants';
import { scanSinglePipelineRow } from './pipelineRowScanner';

export function usePipelineBulkScanner({
    companyName,
    companyNameRef,
    config,
    rows,
    setRows,
    activeMainTab
}: {
    companyName: string;
    companyNameRef: React.MutableRefObject<string>;
    config: any;
    rows: any[];
    setRows: React.Dispatch<React.SetStateAction<any[]>>;
    activeMainTab: string;
}) {
    const activeBrand = companyName || 'test-company';
    const [bulkAnalysis, setBulkAnalysis] = useState<any>(null);
    const [isBulkAnalyzing, setIsBulkAnalyzing] = useState(false);

    const handleRunBulkAnalysis = async () => {
        setIsBulkAnalyzing(true);
        try {
            let analyses: any[] = [];
            try {
                const res = await fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeBrand)}`);
                if (res.ok) {
                    const contentType = res.headers.get("content-type");
                    if (contentType && contentType.includes("application/json")) {
                        analyses = await res.json();
                    }
                }
            } catch (fetchErr) {
                console.warn("Fetch analyses-all failed:", fetchErr);
            }

            const activeTableRows = rows.filter(r => r.status === 'completed' || r.analysis || r.result || r.type === 'trustpilot_sentiment' || r.analysisId);
            activeTableRows.forEach(r => {
                const existingIdx = analyses.findIndex(a => a._analysisId === r.analysisId || a._analysisId === r.id || (a.videos && a.videos[0] === (r.videos && r.videos[0])));
                const rowPayload = {
                    videos: r.videos || [r.url || r.id],
                    title: r.title || (r.type === 'trustpilot_sentiment' ? `${activeBrand} Verified Trustpilot Reviews` : r.type),
                    type: r.type,
                    analysis: r.analysis || r.result || (r.type === 'trustpilot_sentiment' ? { source: 'Trustpilot', summary: `Verified Trustpilot customer reviews and ratings for ${activeBrand}` } : undefined),
                    _analysisId: r.analysisId || r.id
                };
                if (existingIdx >= 0) {
                    analyses[existingIdx] = { ...analyses[existingIdx], ...rowPayload };
                } else {
                    analyses.push(rowPayload);
                }
            });

            const brandSlug = activeBrand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'testcompany';
            if (!analyses || analyses.length === 0) {
                analyses = (rows && rows.length > 0) ? rows.map(r => ({
                    videos: r.videos || [r.url || r.id],
                    title: r.title || (r.type === 'trustpilot_sentiment' ? `${activeBrand} Trustpilot Reviews` : r.type),
                    type: r.type,
                    _analysisId: r.analysisId || r.id
                })) : [
                    { title: `${activeBrand} Verified Trustpilot Reviews`, type: 'trustpilot_sentiment', videos: [`https://www.trustpilot.com/review/${brandSlug}.com`] }
                ];
            }

            const enrichedAnalyses = (analyses || []).map((a: any) => {
                if (!a.videos && a._analysisId) {
                    const row = rows.find(r => r.analysisId === a._analysisId || r.id === a._analysisId);
                    if (row) return { ...a, videos: row.videos };
                }
                return a;
            });

            const result = await generateBulkAnalysis(enrichedAnalyses, activeBrand, config?.branding.industryType);
            if (result) {
                setBulkAnalysis(result);
                await fetch('/api/insights/analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        companyName: activeBrand,
                        analysisId: 'bulk_analysis',
                        result: { ...result, type: 'bulk' }
                    })
                }).catch(saveErr => console.warn("Failed to persist bulk analysis:", saveErr));
            }
        } catch (error) {
            console.error("Bulk analysis failed:", error);
        } finally {
            setIsBulkAnalyzing(false);
        }
    };

    const handleScanAllVideosForPipeline = async (onProgress?: (msg: string) => void): Promise<Record<string, any>> => {
        const activeComp = companyNameRef.current || activeBrand;
        let currentRows = Array.isArray(rows) && rows.length > 0 ? [...rows] : [];

        const cachedById: Record<string, any> = {};
        const cachedAbcdByVid: Record<string, any> = {};
        const cachedSentByVid: Record<string, any> = {};
        const cachedByTarget: Record<string, any> = {};

        try {
            onProgress?.(`Hydrating cached analyses & listening sources for ${activeComp}...`);
            const [tableRes, analysesRes] = await Promise.all([
                currentRows.length === 0
                    ? fetch(`/api/insights/table?companyName=${encodeURIComponent(activeComp)}`, { cache: 'no-store' }).catch(() => null)
                    : Promise.resolve(null),
                fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeComp)}`, { cache: 'no-store' }).catch(() => null)
            ]);

            if (tableRes && tableRes.ok) {
                const tableData = await tableRes.json().catch(() => null);
                if (Array.isArray(tableData) && tableData.length > 0) {
                    currentRows = tableData;
                    setRows(tableData);
                }
            }

            if (analysesRes && analysesRes.ok) {
                const allAnalyses = await analysesRes.json().catch(() => null);
                if (Array.isArray(allAnalyses)) {
                    for (const item of allAnalyses) {
                        if (!item || typeof item !== 'object') continue;
                        const aId = String(item._analysisId || item.analysisId || '');
                        if (aId) cachedById[aId] = item;
                        const rawVid = (Array.isArray(item.videos) && item.videos[0]) || item.videoId || item.videoUrl || item.url || '';
                        if (rawVid) cachedByTarget[String(rawVid)] = item;
                        const vidId = getVideoId(String(rawVid));
                        if (vidId) {
                            if (item.type === 'abcd' || aId.startsWith('analysis_abcd_') || aId.startsWith('ad_analysis_') || item.abcd_scores || item.scores) {
                                cachedAbcdByVid[vidId] = item;
                            }
                            if (item.type === 'youtube_sentiment' || item.type === 'sentiment_video' || aId.startsWith('analysis_sentiment_') || item.commentsSentiment || item.commentsResult) {
                                cachedSentByVid[vidId] = item;
                            }
                        }
                    }
                }
            }
        } catch (err) {
            console.warn("[Pipeline Scan] Cache hydration warning:", err);
        }

        const resultsMap: Record<string, any> = {};
        if (currentRows.length === 0) return resultsMap;

        const CONCURRENCY = 8;
        const total = currentRows.length;
        let completedCount = 0;
        let queueIndex = 0;
        let runningRows = [...currentRows];
        const processedYtIds = new Set<string>();
        const pendingSaves: Promise<any>[] = [];

        const queueSaveAnalysis = (analysisId: string, payload: any) => {
            pendingSaves.push(
                fetch('/api/insights/analysis', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyName: activeComp, analysisId, result: payload, data: payload })
                }).catch(() => {})
            );
        };

        const updateRunningRows = (updater: (prev: any[]) => any[]) => {
            runningRows = updater(runningRows);
            setRows([...runningRows]);
        };

        const worker = async () => {
            while (queueIndex < currentRows.length) {
                const idx = queueIndex++;
                const row = currentRows[idx];
                if (!row) break;
                const label = row.title || (Array.isArray(row.videos) && row.videos[0]) || row.url || row.type;
                onProgress?.(`Scanning (${idx + 1}/${total}): ${label}...`);
                try {
                    await scanSinglePipelineRow(row, {
                        activeComp,
                        cachedById,
                        cachedAbcdByVid,
                        cachedSentByVid,
                        cachedByTarget,
                        processedYtIds,
                        resultsMap,
                        queueSaveAnalysis,
                        updateRunningRows
                    });
                } catch (err) {
                    console.warn(`[Pipeline Scan] Row ${row.id} warning:`, err);
                } finally {
                    completedCount++;
                    onProgress?.(`Scanned ${completedCount} of ${total} sources...`);
                }
            }
        };

        const workerCount = Math.min(CONCURRENCY, currentRows.length);
        await Promise.all(Array.from({ length: workerCount }, () => worker()));

        const trimmedRows = runningRows.map(r => ({
            ...r,
            videos: (r.videos || []).map((u: string) => getVideoId(u))
        }));
        await Promise.allSettled([
            ...pendingSaves,
            fetch('/api/insights/table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeComp, data: trimmedRows })
            }),
            fetch('/api/save-run', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    companyName: activeComp,
                    featureId: 'bulk_insights',
                    data: { items: trimmedRows, results: resultsMap, updatedAt: new Date().toISOString() }
                })
            })
        ]);

        return resultsMap;
    };

    useEffect(() => {
        const checkSavedBulk = async () => {
            try {
                let res = await fetch(`/api/insights/analysis?companyName=${encodeURIComponent(activeBrand)}&analysisId=bulk_analysis`);
                let data = res.ok ? await res.json().catch(() => null) : null;
                if (!data) {
                    res = await fetch(`/api/load-run/bulk_analysis?companyName=${encodeURIComponent(activeBrand)}`);
                    data = res.ok ? await res.json().catch(() => null) : null;
                }
                if (data) {
                    if (data?.runData) data = data.runData;
                    if (data?.data && typeof data.data === 'object' && !data.summary && !data.key_takeaways) data = data.data;
                    if (data) setBulkAnalysis(data);
                }
            } catch (error) {
                console.warn("No saved bulk analysis found:", error);
            }
        };
        checkSavedBulk();
    }, [activeMainTab, activeBrand]);

    return {
        bulkAnalysis,
        setBulkAnalysis,
        isBulkAnalyzing,
        handleRunBulkAnalysis,
        handleScanAllVideosForPipeline
    };
}
