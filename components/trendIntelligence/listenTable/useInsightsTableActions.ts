import React, { useEffect, useRef, useState } from 'react';
import { analyzeAdVideo, analyzeYouTubeSentiment } from '../../../services/geminiService';
import {
    executeRowAnalysisRequest,
    extractCommentsFromAnalysisPayload,
    fetchRowPreviewData
} from './rowAnalysisExecutor';
import {
    computeRowsAfterCategoryDelete,
    computeRowsAfterRemoveAbcd,
    computeRowsAfterSingleDelete
} from './rowDeleteHelpers';

export { extractCommentsFromAnalysisPayload };

export function useInsightsTableActions({
    companyName,
    videoTitles,
    getVideoId,
    fetchVideoTitle,
    rows,
    setRows
}: {
    companyName: string;
    videoTitles: Record<string, any>;
    getVideoId: (url: string) => string;
    fetchVideoTitle: (videoId: string, type?: string) => Promise<void>;
    rows: any[];
    setRows: React.Dispatch<React.SetStateAction<any[]>>;
}) {
    const activeBrand = companyName || 'test-company';
    const [isSaving, setIsSaving] = useState(false);
    const [notification, setNotification] = useState<string | null>(null);
    const [analyzingRowIds, setAnalyzingRowIds] = useState<Set<string>>(new Set());
    const [isAnalyzingAll, setIsAnalyzingAll] = useState(false);
    const [analyzeAllProgress, setAnalyzeAllProgress] = useState<{ current: number; total: number; title: string } | null>(null);
    const [activeCategoryFilter, setActiveCategoryFilter] = useState<'all' | 'sentiment' | 'reddit' | 'abcd' | 'other'>('all');
    const [expandedPreviewRowIds, setExpandedPreviewRowIds] = useState<Set<string>>(new Set());
    const [previewDataByRowId, setPreviewDataByRowId] = useState<Record<string, { loading: boolean; analysis?: any; abcdAnalysis?: any; comments?: any[]; error?: string }>>({});
    const [commentSearchByRowId, setCommentSearchByRowId] = useState<Record<string, string>>({});

    const rowsRef = useRef(rows);
    const saveLock = useRef(false);

    useEffect(() => { rowsRef.current = rows; }, [rows]);

    const showNotification = (msg: string) => {
        setNotification(msg);
        setTimeout(() => setNotification(null), 3500);
    };

    useEffect(() => {
        const handleNotif = (e: any) => { if (e.detail) showNotification(e.detail); };
        window.addEventListener('listen-table-notification', handleNotif);
        return () => window.removeEventListener('listen-table-notification', handleNotif);
    }, []);

    const handleSaveTable = async (updatedRows = rows) => {
        while (saveLock.current) {
            await new Promise(resolve => setTimeout(resolve, 100));
        }
        saveLock.current = true;
        setIsSaving(true);

        const trimmedRows = (updatedRows || []).map(row => ({
            ...row,
            videos: (row.videos || []).map((url: string) => getVideoId(url))
        }));
        try {
            const res = await fetch('/api/insights/table', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeBrand, data: trimmedRows })
            });
            if (res.ok) {
                setRows(trimmedRows);
                showNotification("Table saved to GCS.");
            }
        } catch (error) {
            console.error("Failed to save table data:", error);
            showNotification("Failed to save table.");
        } finally {
            setIsSaving(false);
            saveLock.current = false;
        }
    };

    const handleAddRow = (presetType: string = 'youtube_sentiment') => {
        const newRow = {
            id: `${presetType}_${Math.random().toString(36).substr(2, 9)}`,
            type: presetType,
            videos: [''],
            status: 'pending',
            analysisId: null
        };
        setRows([newRow, ...rows]);
        if (presetType === 'reddit' && activeCategoryFilter !== 'all') setActiveCategoryFilter('reddit');
        else if (presetType === 'abcd' && activeCategoryFilter !== 'all') setActiveCategoryFilter('abcd');
    };

    const handleDeleteRow = (id: string) => {
        const { updatedRows, rowToDelete } = computeRowsAfterSingleDelete(rows, id, activeBrand, getVideoId);
        setRows(updatedRows);
        setExpandedPreviewRowIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        handleSaveTable(updatedRows);
        showNotification(`Removed ${rowToDelete?.type === 'reddit' ? 'Reddit thread' : rowToDelete?.type === 'abcd' ? 'ABCD analysis' : 'item'} from Listen table.`);
    };

    const handleRemoveAbcdFromRow = (row: any) => {
        const { updatedRows, ytId } = computeRowsAfterRemoveAbcd(rows, row, activeBrand, getVideoId);
        setRows(updatedRows);
        handleSaveTable(updatedRows);
        showNotification(`Removed ABCD analysis for ${ytId || 'video'}.`);
    };

    const handleDeleteCategoryRows = (categoryRows: any[], categoryLabel: string, extraToken?: string) => {
        if (!Array.isArray(categoryRows) || categoryRows.length === 0) return;
        const updatedRows = computeRowsAfterCategoryDelete(rows, categoryRows, activeBrand, getVideoId, extraToken);
        setRows(updatedRows);
        handleSaveTable(updatedRows);
        showNotification(`Removed all ${categoryRows.length} ${categoryLabel} items from Listen table.`);
    };

    const handleToggleRowPreview = async (row: any) => {
        const rowId = row.id;
        if (expandedPreviewRowIds.has(rowId)) {
            setExpandedPreviewRowIds(prev => { const next = new Set(prev); next.delete(rowId); return next; });
            return;
        }
        setExpandedPreviewRowIds(prev => new Set(prev).add(rowId));

        const initialAnalysis = row.result || row.preloadedResult || null;
        const initialComments = extractCommentsFromAnalysisPayload(initialAnalysis, row);
        setPreviewDataByRowId(prev => ({
            ...prev,
            [rowId]: {
                loading: true,
                analysis: initialAnalysis || prev[rowId]?.analysis || null,
                abcdAnalysis: row.type === 'abcd' ? initialAnalysis : prev[rowId]?.abcdAnalysis || null,
                comments: initialComments.length > 0 ? initialComments : (prev[rowId]?.comments || [])
            }
        }));

        try {
            const loaded = await fetchRowPreviewData({ row, companyName: activeBrand, getVideoId, fetchVideoTitle });
            setPreviewDataByRowId(prev => ({ ...prev, [rowId]: loaded }));
        } catch (err: any) {
            setPreviewDataByRowId(prev => ({
                ...prev,
                [rowId]: {
                    loading: false,
                    analysis: initialAnalysis,
                    abcdAnalysis: row.type === 'abcd' ? initialAnalysis : null,
                    comments: initialComments,
                    error: err?.message || 'Failed to load preview data.'
                }
            }));
        }
    };

    const handleUpdateRow = (id: string, field: string, value: any) => {
        const updatedRows = (rows || []).map(r => {
            if (r.id === id) {
                const updatedValue = field === 'videos' ? (Array.isArray(value) ? value.map((url: string) => getVideoId(url)) : []) : value;
                const updatedRow = { ...r, [field]: updatedValue };
                if (field === 'type' && value === 'comparative' && (updatedRow.videos || []).length < 2) {
                    updatedRow.videos = [...(updatedRow.videos || []), ''];
                }
                if (field === 'videos') {
                    updatedRow.status = 'pending';
                    updatedRow.analysisId = null;
                }
                return updatedRow;
            }
            return r;
        });
        setRows(updatedRows);
    };

    const handleAnalyze = async (id: string) => {
        const row = rows.find(r => r.id === id);
        if (!row) return;
        setAnalyzingRowIds(prev => new Set(prev).add(id));
        await handleSaveTable();

        try {
            const { analysisId } = await executeRowAnalysisRequest({ row, companyName: activeBrand, getVideoId });
            const updatedRows = (rowsRef.current || []).map(r => r.id === id ? { ...r, status: 'completed', analysisId, error: null } : r);
            await handleSaveTable(updatedRows);
            showNotification("Analysis complete and saved to storage!");
        } catch (error: any) {
            const errorMsg = error?.message || "Analysis failed.";
            const updatedRows = (rowsRef.current || []).map(r => r.id === id ? { ...r, status: 'error', error: errorMsg } : r);
            await handleSaveTable(updatedRows);
            showNotification(`Analysis failed: ${errorMsg}`);
        } finally {
            setAnalyzingRowIds(prev => { const next = new Set(prev); next.delete(id); return next; });
        }
    };

    const handleRunAbcdOnRow = async (row: any) => {
        const rawVid = (Array.isArray(row?.videos) && row.videos[0]) || row?.url || '';
        const videoId = getVideoId(rawVid) || rawVid;
        if (!videoId) return;
        const abcdLoaderKey = `abcd_${row.id}`;
        setAnalyzingRowIds(prev => new Set(prev).add(abcdLoaderKey));
        try {
            const fullUrl = videoId.startsWith('http') ? videoId : `https://www.youtube.com/watch?v=${videoId}`;
            const result = await analyzeAdVideo(fullUrl, activeBrand);
            const s = result?.abcd_scores || result?.scores;
            const scorePct = s ? Math.round(((Number(s.attract?.score ?? 8.5) + Number(s.brand?.score ?? 8.5) + Number(s.connect?.score ?? 8.0) + Number(s.direct?.score ?? 8.0)) / 4) * 10) : 85;
            const cleanVidId = String(videoId).replace(/[^a-zA-Z0-9_-]/g, '_');
            const analysisId = `analysis_abcd_${cleanVidId}`;
            await fetch('/api/insights/analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeBrand, analysisId, result: { ...result, type: 'abcd', videos: [videoId] } })
            });

            const currentRows = rowsRef.current || [];
            const existingAbcdRow = currentRows.find(r => (r.type === 'abcd' || r.type === 'youtube_abcd') && (getVideoId(r.videos?.[0] || r.url || '') === videoId));
            let updatedRows = currentRows.map(r => (r.id === row.id || (getVideoId(r.videos?.[0] || r.url || '') === videoId))
                ? { ...r, abcdStatus: 'completed', abcdAnalysisId: analysisId, abcdScore: scorePct }
                : r
            );
            if (!existingAbcdRow && row.type !== 'abcd') {
                updatedRows = [{
                    id: `abcd-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    type: 'abcd',
                    videos: [videoId],
                    title: row.title || videoTitles[videoId]?.title || videoTitles[videoId] || `ABCD Framework: ${videoId}`,
                    status: 'completed',
                    analysisId,
                    abcdScore: scorePct,
                    abcdAnalysisId: analysisId
                }, ...updatedRows];
            } else if (existingAbcdRow) {
                updatedRows = updatedRows.map(r => r.id === existingAbcdRow.id ? { ...r, status: 'completed', analysisId, abcdScore: scorePct, abcdAnalysisId: analysisId } : r);
            }
            await handleSaveTable(updatedRows);
            showNotification(`ABCD Framework completed (${scorePct}%) and saved!`);
        } catch (err: any) {
            showNotification(`ABCD analysis failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setAnalyzingRowIds(prev => { const next = new Set(prev); next.delete(abcdLoaderKey); return next; });
        }
    };

    const handleRunSentimentOnRow = async (row: any) => {
        const rawVid = (Array.isArray(row?.videos) && row.videos[0]) || row?.url || '';
        const videoId = getVideoId(rawVid) || rawVid;
        if (!videoId) return;
        const sentLoaderKey = `sent_${row.id}`;
        setAnalyzingRowIds(prev => new Set(prev).add(sentLoaderKey));
        try {
            const fullUrl = videoId.startsWith('http') ? videoId : `https://www.youtube.com/watch?v=${videoId}`;
            const result = await analyzeYouTubeSentiment(fullUrl, activeBrand);
            const scorePct = typeof result?.overallScorePercent === 'number' ? Math.round(result.overallScorePercent) : 78;
            const cleanVidId = String(videoId).replace(/[^a-zA-Z0-9_-]/g, '_');
            const analysisId = `analysis_sentiment_${cleanVidId}`;
            await fetch('/api/insights/analysis', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ companyName: activeBrand, analysisId, result: { ...result, type: 'youtube_sentiment', videos: [videoId] } })
            });

            const currentRows = rowsRef.current || [];
            const existingSentRow = currentRows.find(r => (r.type === 'youtube_sentiment' || r.type === 'sentiment_video') && (getVideoId(r.videos?.[0] || r.url || '') === videoId));
            let updatedRows = currentRows.map(r => (r.id === row.id || (getVideoId(r.videos?.[0] || r.url || '') === videoId))
                ? { ...r, sentimentStatus: 'completed', sentimentAnalysisId: analysisId, sentimentScore: scorePct }
                : r
            );
            if (!existingSentRow && row.type === 'abcd') {
                updatedRows = [{
                    id: `youtube_sentiment-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
                    type: 'youtube_sentiment',
                    videos: [videoId],
                    title: row.title || videoTitles[videoId]?.title || videoTitles[videoId] || `YouTube Sentiment: ${videoId}`,
                    status: 'completed',
                    analysisId,
                    sentimentScore: scorePct,
                    sentimentAnalysisId: analysisId
                }, ...updatedRows];
            }
            await handleSaveTable(updatedRows);
            showNotification(`YouTube Sentiment completed (${scorePct}%) and saved!`);
        } catch (err: any) {
            showNotification(`Sentiment analysis failed: ${err?.message || 'Unknown error'}`);
        } finally {
            setAnalyzingRowIds(prev => { const next = new Set(prev); next.delete(sentLoaderKey); return next; });
        }
    };

    const handleAnalyzeAll = async () => {
        const pendingRows = (rows || []).filter(r => r.status !== 'completed');
        if (pendingRows.length === 0) {
            showNotification("All items are already analyzed.");
            return;
        }
        setIsAnalyzingAll(true);
        const CONCURRENCY = 4;
        const total = pendingRows.length;
        let completedCount = 0;
        let successCount = 0;
        let failCount = 0;
        let runningRows = [...(rows || [])];
        const activeIds = new Set<string>();
        let queueIndex = 0;

        const worker = async () => {
            while (queueIndex < pendingRows.length) {
                const currentIndex = queueIndex++;
                const row = pendingRows[currentIndex];
                if (!row) break;
                activeIds.add(row.id);
                setAnalyzingRowIds(new Set(activeIds));
                setAnalyzeAllProgress({ current: completedCount, total, title: row.title || (row.videos && row.videos[0]) || row.type });

                try {
                    const { analysisId } = await executeRowAnalysisRequest({ row, companyName: activeBrand, getVideoId });
                    runningRows = runningRows.map(r => r.id === row.id ? { ...r, status: 'completed', analysisId, error: null } : r);
                    setRows([...runningRows]);
                    successCount++;
                } catch (err: any) {
                    const errorMsg = err?.message || "Analysis failed.";
                    runningRows = runningRows.map(r => r.id === row.id ? { ...r, status: 'error', error: errorMsg } : r);
                    setRows([...runningRows]);
                    failCount++;
                } finally {
                    completedCount++;
                    activeIds.delete(row.id);
                    setAnalyzingRowIds(new Set(activeIds));
                    setAnalyzeAllProgress({ current: completedCount, total, title: `${completedCount} of ${total} finished` });
                }
            }
        };

        await Promise.all(Array.from({ length: Math.min(CONCURRENCY, pendingRows.length) }, () => worker()));
        await handleSaveTable(runningRows);
        setIsAnalyzingAll(false);
        setAnalyzeAllProgress(null);
        showNotification(failCount === 0 ? `Analyzed all ${successCount} items successfully! (4 at a time)` : `Batch complete: ${successCount} succeeded, ${failCount} failed.`);
    };

    return {
        isSaving, notification, setNotification, analyzingRowIds, isAnalyzingAll, analyzeAllProgress,
        activeCategoryFilter, setActiveCategoryFilter, expandedPreviewRowIds, previewDataByRowId,
        commentSearchByRowId, setCommentSearchByRowId,
        handleSaveTable, handleAddRow, handleDeleteRow, handleRemoveAbcdFromRow,
        handleDeleteCategoryRows, handleToggleRowPreview, handleUpdateRow,
        handleAnalyze, handleRunAbcdOnRow, handleRunSentimentOnRow, handleAnalyzeAll
    };
}
