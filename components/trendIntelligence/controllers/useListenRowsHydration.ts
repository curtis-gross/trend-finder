import { useEffect, useRef, useState } from 'react';
import { buildRichMetacriticAnalysis } from '../metacritic/metacriticNormalizer';
import { getVideoId, normalizeUrlKey } from '../typesAndConstants';
import {
    getDeletedListenItemsSetForCompany,
    isRowInDeletedBlocklist,
    normalizeAndFilterListenRows,
    resolveVideoTitleAndEmbed
} from './videoTitleResolver';

export { getDeletedListenItemsSetForCompany, isRowInDeletedBlocklist, normalizeAndFilterListenRows };

export function useListenRowsHydration({
    companyName,
    setActiveMainTab
}: {
    companyName: string;
    setActiveMainTab: (tab: any) => void;
}) {
    const activeBrand = companyName || 'test-company';
    const companyNameRef = useRef(activeBrand);
    useEffect(() => {
        companyNameRef.current = activeBrand;
    }, [activeBrand]);

    const [videoTitles, setVideoTitles] = useState<{ [key: string]: any }>({});
    const [unembeddableVideos, setUnembeddableVideos] = useState<Record<string, boolean>>({});
    const [rows, setRows] = useState<any[]>([]);
    const [, setDummyRender] = useState({});
    const [isLoadingTable, setIsLoadingTable] = useState(true);

    const fetchVideoTitle = async (videoId: string, type?: string) => {
        await resolveVideoTitleAndEmbed(videoId, type, videoTitles, setVideoTitles, setUnembeddableVideos);
    };

    useEffect(() => {
        const handleUpdate = () => setDummyRender({});
        window.addEventListener('find-insights-modal-update', handleUpdate);

        const handleSwitchTab = (e: any) => {
            if (e.detail && ['insights', 'bulk', 'alerts', 'daily_summary', 'audit'].includes(e.detail)) {
                setActiveMainTab(e.detail);
            }
        };
        window.addEventListener('switch-main-tab', handleSwitchTab);

        const handleAdd = (e: Event) => {
            const selected = (e as CustomEvent).detail;
            if (!selected || !Array.isArray(selected) || selected.length === 0) return;

            const newRows: any[] = [];
            const titleUpdates: Record<string, any> = {};

            selected.forEach((item: any) => {
                let rowType = item.type || 'abcd';
                if (item.type === 'reddit' || item.subType === 'reddit') rowType = 'reddit';
                else if (item.type === 'tiktok' || item.subType === 'tiktok' || item.type === 'tiktok_hashtag') rowType = 'tiktok';
                else if (item.type === 'social_intelligence' || item.subType === 'social_intelligence') rowType = 'social_intelligence';
                else if (item.type === 'steam' || item.subType === 'steam_reviews') rowType = 'steam_reviews';
                else if (item.type === 'trustpilot' || item.subType === 'trustpilot_sentiment') rowType = 'trustpilot_sentiment';
                else if (item.type === 'metacritic_reviews' || item.subType === 'metacritic_reviews') rowType = 'metacritic_reviews';
                else if (item.type === 'website' || item.subType === 'website_analysis') rowType = 'website_analysis';
                else if (item.type === 'grounded_search' || item.subType === 'grounded_search') rowType = 'grounded_search';
                else if (item.type === 'youtube') rowType = item.subType || 'youtube_sentiment';
                else if (item.type === 'youtube_sentiment' || item.subType === 'youtube_sentiment') rowType = 'youtube_sentiment';

                const rawUrl = item.url || item.tag || item.query || item.id || '';

                if (item.image || item.title) {
                    const cleanId = getVideoId(rawUrl);
                    if (cleanId) titleUpdates[cleanId] = { title: item.title || cleanId, image: item.image || null };
                    if (rawUrl) titleUpdates[rawUrl] = { title: item.title || rawUrl, image: item.image || null };
                    if (item.id) titleUpdates[String(item.id)] = { title: item.title || String(item.id), image: item.image || null };
                }

                const uniqueRowId = `${rowType}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`;
                const cleanRowId = String(uniqueRowId).replace(/[^a-zA-Z0-9_\-]/g, '_');
                const savedAnalysisId = `analysis_${cleanRowId}`;
                const hasPreloaded = Boolean(item.preloadedResult);
                const activeComp = companyNameRef.current || activeBrand;
                const enrichedPreloaded = hasPreloaded
                    ? (rowType === 'metacritic_reviews'
                        ? buildRichMetacriticAnalysis(item.preloadedResult, rawUrl, activeComp)
                        : item.preloadedResult)
                    : undefined;
                if (hasPreloaded && enrichedPreloaded) {
                    const payload = { ...enrichedPreloaded, type: rowType, videos: item.videos || [rawUrl] };
                    fetch('/api/insights/analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyName: activeComp, analysisId: savedAnalysisId, result: payload, data: payload })
                    }).catch(err => console.error('Failed to persist preloaded analysis:', err));
                }

                newRows.push({
                    id: uniqueRowId,
                    type: rowType,
                    url: rawUrl,
                    tag: item.tag || (rowType === 'social_intelligence' ? rawUrl : undefined),
                    query: item.query || (rowType === 'social_intelligence' ? rawUrl : undefined),
                    title: item.title || (rowType === 'social_intelligence' ? `${rawUrl} Social & Community Pulse` : `Insight for ${activeComp}`),
                    timeframe: item.timeframe || '7d',
                    focus: item.focus || item.guidance || undefined,
                    guidance: item.guidance || undefined,
                    status: hasPreloaded ? 'completed' : 'pending',
                    analysisId: hasPreloaded ? savedAnalysisId : undefined,
                    preloadedResult: enrichedPreloaded,
                    videos: item.videos || [rawUrl]
                });
            });

            if (Object.keys(titleUpdates).length > 0) {
                setVideoTitles(prev => ({ ...prev, ...titleUpdates }));
            }

            const getRowDedupFamily = (t?: string): string => {
                const raw = String(t || '').toLowerCase();
                if (raw === 'abcd' || raw === 'youtube_abcd') return 'abcd';
                if (raw === 'competitor_abcd') return 'competitor_abcd';
                if (raw === 'youtube_sentiment' || raw === 'sentiment_video' || raw === 'sentiment_comments' || raw === 'youtube') return 'youtube_sentiment';
                if (raw === 'competitor_sentiment_video' || raw === 'competitor_sentiment_comments' || raw === 'competitor_youtube_sentiment') return 'competitor_sentiment';
                if (raw === 'comparative' || raw === 'abcd_comparative') return 'comparative';
                return raw || 'default';
            };

            setRows(prev => {
                const existingTargets = new Set(
                    (Array.isArray(prev) ? prev : []).flatMap(r => {
                        const family = getRowDedupFamily(r.type);
                        return [r.url, r.tag, r.query, r.id, ...(r.videos || [])].filter(Boolean).map(u => {
                            const k = normalizeUrlKey(u);
                            return k ? `${family}::${k}` : '';
                        }).filter(Boolean);
                    })
                );
                const seenBatch = new Set<string>();
                const uniqueNewRows = newRows.filter(r => {
                    const key = normalizeUrlKey(r.url || r.tag || r.query || (r.videos && r.videos[0]) || r.id);
                    if (!key) return true;
                    const compositeKey = `${getRowDedupFamily(r.type)}::${key}`;
                    if (existingTargets.has(compositeKey) || seenBatch.has(compositeKey)) return false;
                    seenBatch.add(compositeKey);
                    return true;
                });

                if (uniqueNewRows.length === 0) return prev;

                const updated = [...uniqueNewRows, ...prev];
                const trimmedRows = (updated || []).map(row => ({
                    ...row,
                    videos: (row.videos || []).map((url: string) => getVideoId(url))
                }));
                const activeComp = companyNameRef.current || activeBrand;
                fetch('/api/insights/table', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ companyName: activeComp, data: trimmedRows })
                }).catch(err => console.error("Failed to auto-save table after adding insights:", err));

                window.dispatchEvent(new CustomEvent('listen-table-notification', {
                    detail: `Added ${uniqueNewRows.length} item${uniqueNewRows.length > 1 ? 's' : ''} to Listen Table`
                }));

                return updated;
            });
        };

        const handlePipelineWiped = () => setRows([]);
        window.addEventListener('add-selected-insights', handleAdd);
        window.addEventListener('pipeline-wiped', handlePipelineWiped);

        return () => {
            window.removeEventListener('find-insights-modal-update', handleUpdate);
            window.removeEventListener('switch-main-tab', handleSwitchTab);
            window.removeEventListener('add-selected-insights', handleAdd);
            window.removeEventListener('pipeline-wiped', handlePipelineWiped);
        };
    }, []);

    useEffect(() => {
        const fetchTableData = async () => {
            setIsLoadingTable(true);
            try {
                const [res, analysesRes] = await Promise.all([
                    fetch(`/api/insights/table?companyName=${encodeURIComponent(activeBrand)}`, { cache: 'no-store' }),
                    fetch(`/api/insights/analyses-all?companyName=${encodeURIComponent(activeBrand)}`, { cache: 'no-store' }).catch(() => null)
                ]);
                const tableData = res.ok ? await res.json().catch(() => []) : [];
                const allAnalyses = analysesRes && analysesRes.ok ? await analysesRes.json().catch(() => []) : [];
                const deletedSet = getDeletedListenItemsSetForCompany(activeBrand);

                const rawTableArray = Array.isArray(tableData)
                    ? tableData
                    : (Array.isArray(tableData?.rows) ? tableData.rows : (Array.isArray(tableData?.data) ? tableData.data : []));
                let baseRows = normalizeAndFilterListenRows(rawTableArray, activeBrand);

                if (Array.isArray(allAnalyses) && allAnalyses.length > 0) {
                    const existingRowAnalysisIds = new Set(baseRows.map((r: any) => String(r?.analysisId || '').toLowerCase()).filter(Boolean));
                    const existingTypeTargetSet = new Set(
                        baseRows.map((r: any) => {
                            const v = (Array.isArray(r?.videos) && r.videos[0]) || r?.url || '';
                            const cleanV = getVideoId(String(v)) || String(v);
                            return `${String(r?.type || '').toLowerCase()}:${cleanV.toLowerCase()}`;
                        })
                    );

                    const extraAbcdRows: any[] = [];
                    allAnalyses.forEach((item: any) => {
                        if (!item) return;
                        const aId = String(item._analysisId || item.analysisId || '');
                        const vidRaw = (Array.isArray(item.videos) && item.videos[0]) || item.videoId || item.videoUrl || '';
                        const cleanVid = getVideoId(String(vidRaw)) || String(vidRaw);
                        const isAbcd = item.type === 'abcd' || aId.startsWith('analysis_abcd_') || aId.startsWith('ad_analysis_');

                        baseRows = baseRows.map((r: any) => {
                            const rVid = getVideoId(String((Array.isArray(r?.videos) && r.videos[0]) || r?.url || ''));
                            if (
                                (aId && (r.analysisId === aId || r.abcdAnalysisId === aId)) ||
                                (cleanVid && rVid === cleanVid && ((isAbcd && r.type === 'abcd') || (!isAbcd && r.type === item.type)))
                            ) {
                                return {
                                    ...r,
                                    status: r.status || 'completed',
                                    analysisId: r.analysisId || aId,
                                    result: r.result || item,
                                    preloadedResult: r.preloadedResult || item
                                };
                            }
                            return r;
                        });

                        if (isAbcd && cleanVid) {
                            const candidateRow = {
                                id: aId || `abcd_${cleanVid}`,
                                type: 'abcd',
                                videos: [cleanVid],
                                title: item.title || item.adTitle || `ABCD Creative Analysis (${cleanVid})`,
                                status: 'completed',
                                analysisId: aId || `analysis_abcd_${cleanVid}`,
                                abcdAnalysisId: aId || `analysis_abcd_${cleanVid}`,
                                result: item,
                                preloadedResult: item
                            };
                            const typeKey = `abcd:${cleanVid.toLowerCase()}`;
                            if (
                                !isRowInDeletedBlocklist(candidateRow, deletedSet) &&
                                !existingRowAnalysisIds.has(String(candidateRow.analysisId).toLowerCase()) &&
                                !existingTypeTargetSet.has(typeKey)
                            ) {
                                existingRowAnalysisIds.add(String(candidateRow.analysisId).toLowerCase());
                                existingTypeTargetSet.add(typeKey);
                                extraAbcdRows.push(candidateRow);
                            }
                        }
                    });

                    if (extraAbcdRows.length > 0) {
                        baseRows = [...baseRows, ...extraAbcdRows];
                    }
                }

                setRows(baseRows.filter((r: any) => !isRowInDeletedBlocklist(r, deletedSet)));
            } catch (error) {
                console.error("Failed to fetch table data:", error);
                setRows(prev => normalizeAndFilterListenRows(prev, activeBrand));
            } finally {
                setIsLoadingTable(false);
            }
        };
        fetchTableData();
    }, [activeBrand]);

    useEffect(() => {
        rows.forEach(row => {
            (Array.isArray(row?.videos) ? row.videos : []).forEach((vid: string) => {
                const id = getVideoId(vid);
                if (id) fetchVideoTitle(id, row.type);
            });
        });
    }, [rows]);

    return {
        companyNameRef,
        videoTitles,
        setVideoTitles,
        unembeddableVideos,
        setUnembeddableVideos,
        rows,
        setRows,
        isLoadingTable,
        fetchVideoTitle
    };
}
