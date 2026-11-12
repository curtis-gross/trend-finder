import { DEFAULT_NOISE_SOURCES } from './noiseTypes';
import { getCommentYear } from './languageAndTimeUtils';
import { isPlatformOrSourceNode } from './nodeStemmingUtils';

// Helper to stream logs directly to the user's terminal running server.js
export const sendTerminalLog = async (
    message: string,
    level: 'info' | 'header' | 'phase' | 'worker' | 'success' | 'error' = 'info'
) => {
    try {
        console.log(`[Terminal Log] ${message}`);
        await fetch('/api/terminal-log', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message, level })
        });
    } catch {
        // Silent catch if proxy is offline
    }
};

// Generic GCS Save & Load Helpers for Checkpoint States
export const saveStageDataToGCS = async (
    featureId: string,
    data: any,
    companyName: string = 'test-company'
): Promise<boolean> => {
    try {
        const res = await fetch(`/api/save-run/${featureId}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                featureId,
                companyName,
                data
            })
        });
        if (res.ok) {
            await sendTerminalLog(`Checkpoint saved to GCS: [${featureId}] (${companyName})`, 'info');
        }
        return res.ok;
    } catch (e) {
        console.warn(`Failed to save checkpoint ${featureId} to GCS:`, e);
        return false;
    }
};

export const loadStageDataFromGCS = async (
    featureId: string,
    companyName: string = 'test-company'
): Promise<any | null> => {
    const sanitizeCommentList = (list: any[]) => {
        if (!Array.isArray(list)) return;
        list.forEach(item => {
            if (item) {
                const yr = getCommentYear(item);
                item.release = yr;
                item.period = yr;
            }
        });
    };

    const normalizeGraphPayload = (payload: any) => {
        if (!payload || typeof payload !== 'object') return payload;
        const rawNodes = Array.isArray(payload.nodes) && payload.nodes.length > 0
            ? payload.nodes
            : (Array.isArray(payload.graphNodes) ? payload.graphNodes : []);
        const rawLinks = Array.isArray(payload.links) && payload.links.length > 0
            ? payload.links
            : (Array.isArray(payload.graphLinks) ? payload.graphLinks : []);
        if (rawNodes.length > 0) {
            const cleanNodes = rawNodes.filter((n: any) => n && !isPlatformOrSourceNode(n.id) && !isPlatformOrSourceNode(n.label));
            const validIds = new Set(cleanNodes.map((n: any) => n.id));
            const cleanLinks = rawLinks.filter((l: any) => {
                const src = typeof l?.source === 'object' ? l?.source?.id : l?.source;
                const tgt = typeof l?.target === 'object' ? l?.target?.id : l?.target;
                return validIds.has(src) && validIds.has(tgt);
            });
            payload.nodes = cleanNodes;
            payload.graphNodes = cleanNodes;
            payload.links = cleanLinks;
            payload.graphLinks = cleanLinks;
        }
        if (Array.isArray(payload.featureClusters)) {
            payload.featureClusters = payload.featureClusters.filter((fc: any) => !isPlatformOrSourceNode(fc?.category));
        }
        return payload;
    };

    const WRAPPER_META_KEYS = new Set([
        'fingerprint',
        '_fingerprint',
        'md5',
        '_md5',
        'status',
        'updatedAt',
        '_updatedAt',
        'featureId',
        'companyName',
        'company',
        'success'
    ]);

    const isStaleCrossBrandPayload = (obj: any): boolean => {
        if (!obj || typeof obj !== 'object' || Array.isArray(obj)) return false;
        const payloadCompany = String(obj.companyName || obj.company || '').toLowerCase().trim();
        const targetCompany = String(companyName || 'test-company').toLowerCase().trim();
        if (payloadCompany && targetCompany && payloadCompany !== targetCompany) {
            return true;
        }
        return false;
    };

    const unwrapAndValidateStagePayload = (raw: any): any | null => {
        if (raw === null || raw === undefined || typeof raw !== 'object') return null;
        if (!Array.isArray(raw)) {
            if (
                raw.status === 'empty' ||
                raw.notModified === true ||
                raw.status === 'not_modified' ||
                raw.unchanged === true ||
                ('data' in raw && raw.data === null)
            ) {
                return null;
            }
            if ('data' in raw && raw.data !== undefined) {
                const inner = raw.data;
                if (inner === null || inner === undefined || typeof inner !== 'object') return null;
                if (!Array.isArray(inner) && Object.keys(inner).length === 0) return null;
                if (isStaleCrossBrandPayload(inner)) return null;
                return inner;
            }
            const meaningfulKeys = Object.keys(raw).filter(k => !WRAPPER_META_KEYS.has(k));
            if (meaningfulKeys.length === 0) return null;
        } else if (raw.length === 0) {
            return null;
        }
        if (isStaleCrossBrandPayload(raw)) return null;
        return raw;
    };

    const fetchStageWithStaticFallback = async (stageKey: string): Promise<any | null> => {
        try {
            const res = await fetch(
                `/api/load-run/${encodeURIComponent(stageKey)}?companyName=${encodeURIComponent(companyName)}`,
                { cache: 'no-store' }
            );
            if (res.ok) {
                return unwrapAndValidateStagePayload(await res.json());
            }
        } catch (err) {
            console.warn(`[loadStageDataFromGCS] Primary /api/load-run/${stageKey} fetch warning:`, err);
        }

        try {
            const staticRes = await fetch(
                `/data/configuration/runs/${encodeURIComponent(companyName)}/${encodeURIComponent(stageKey)}_run.json`,
                { cache: 'no-store' }
            );
            if (staticRes.ok) {
                const staticParsed = unwrapAndValidateStagePayload(await staticRes.json());
                if (staticParsed) return staticParsed;
            }
        } catch {
            // Static snapshot optional
        }

        if (typeof window !== 'undefined' && window.localStorage) {
            for (const lsKey of [`gcs_cache_${companyName}_${stageKey}`, `${stageKey}_${companyName}`]) {
                try {
                    const lsRaw = window.localStorage.getItem(lsKey);
                    if (lsRaw) {
                        const lsParsed = unwrapAndValidateStagePayload(JSON.parse(lsRaw));
                        if (lsParsed) return lsParsed;
                    }
                } catch {
                    // Ignore malformed localStorage entry
                }
            }
        }

        return null;
    };

    try {
        let data: any = await fetchStageWithStaticFallback(featureId);

        if (featureId === 'noise_filter') {
            if (data) normalizeGraphPayload(data);
            const needsGraph = !data || !Array.isArray(data.nodes) || data.nodes.length === 0;
            const needsTrajectory = !data || !Array.isArray(data.crossReleaseEvolution) || data.crossReleaseEvolution.length === 0;

            if (needsGraph) {
                try {
                    const rawGraph = await fetchStageWithStaticFallback('noise_filter_graph');
                    const graphData = rawGraph ? normalizeGraphPayload(rawGraph) : null;
                    if (graphData && Array.isArray(graphData.nodes) && graphData.nodes.length > 0) {
                        data = {
                            ...(data || {}),
                            totalHarvested: data?.totalHarvested || graphData.totalHarvested || 0,
                            noiseCount: data?.noiseCount ?? graphData.noiseCount ?? 0,
                            signalCount: data?.signalCount || graphData.signalCount || 0,
                            noisePercentage: data?.noisePercentage ?? graphData.noisePercentage ?? 0,
                            signalPercentage: data?.signalPercentage ?? graphData.signalPercentage ?? 100,
                            comments: data?.comments || [],
                            nodes: graphData.nodes,
                            links: graphData.links || [],
                            graphNodes: graphData.nodes,
                            graphLinks: graphData.links || [],
                            featureClusters: (Array.isArray(data?.featureClusters) && data.featureClusters.length > 0)
                                ? data.featureClusters
                                : (graphData.featureClusters || []),
                            crossReleaseEvolution: data?.crossReleaseEvolution || [],
                            sourcesUsed: data?.sourcesUsed || DEFAULT_NOISE_SOURCES,
                            generatedAt: data?.generatedAt || graphData.savedAt || 'Loaded from GCS'
                        };
                    }
                } catch (graphErr) {
                    console.warn('Fallback noise_filter_graph load warning:', graphErr);
                }
            }

            if (data && needsTrajectory) {
                try {
                    const trajData = await fetchStageWithStaticFallback('noise_filter_trajectory');
                    if (trajData && Array.isArray(trajData.crossReleaseEvolution) && trajData.crossReleaseEvolution.length > 0) {
                        data.crossReleaseEvolution = trajData.crossReleaseEvolution;
                    }
                } catch (trajErr) {
                    console.warn('Fallback noise_filter_trajectory load warning:', trajErr);
                }
            }
        } else if (featureId === 'noise_filter_graph' && data) {
            normalizeGraphPayload(data);
        }

        if (data) {
            if (data.rawComments) sanitizeCommentList(data.rawComments);
            if (data.filteredComments) sanitizeCommentList(data.filteredComments);
            if (data.enrichedComments) sanitizeCommentList(data.enrichedComments);
            if (data.comments) sanitizeCommentList(data.comments);
            return data;
        }
    } catch (e) {
        console.warn(`No checkpoint found for ${featureId} in GCS:`, e);
    }
    return null;
};
