const recordDeletedItemsInStorage = (activeBrand: string, tokensToAdd: string[]) => {
    if (typeof window === 'undefined' || tokensToAdd.length === 0) return;
    const cleanTokens = tokensToAdd.map(t => String(t || '').toLowerCase().trim()).filter(Boolean);
    const keys = ['deleted_listen_item_ids', `dml_deleted_listen_items_${activeBrand}`];
    keys.forEach(k => {
        try {
            const raw = localStorage.getItem(k);
            const existing: string[] = raw ? JSON.parse(raw) : [];
            const merged = Array.from(new Set([...(Array.isArray(existing) ? existing : []), ...cleanTokens]));
            localStorage.setItem(k, JSON.stringify(merged));
        } catch {}
    });
};

const collectDeleteTokensForRow = (row: any, getVideoId: (url: string) => string): string[] => {
    if (!row) return [];
    const tokens: string[] = [];
    if (row.id) tokens.push(String(row.id));
    if (row.analysisId) tokens.push(String(row.analysisId));
    if (row.abcdAnalysisId) tokens.push(String(row.abcdAnalysisId));
    const firstVid = String((Array.isArray(row.videos) && row.videos[0]) || row.url || '').trim();
    const cleanVid = getVideoId(firstVid) || firstVid;
    if (firstVid) {
        tokens.push(`${String(row.type || '').toLowerCase()}:${firstVid.toLowerCase()}`);
        if (row.type === 'reddit') tokens.push(firstVid);
    }
    if (cleanVid) {
        tokens.push(`${String(row.type || '').toLowerCase()}:${cleanVid.toLowerCase()}`);
        if (row.type === 'abcd' || row.type === 'competitor_abcd') {
            tokens.push(`analysis_abcd_${cleanVid}`, `abcd_${cleanVid}`);
        }
    }
    return tokens;
};

export const computeRowsAfterSingleDelete = (rows: any[], id: string, activeBrand: string, getVideoId: (url: string) => string) => {
    const rowToDelete = (rows || []).find(r => r.id === id);
    const tokens = collectDeleteTokensForRow(rowToDelete, getVideoId);
    recordDeletedItemsInStorage(activeBrand, tokens);

    const deletedVid = rowToDelete ? (getVideoId(String((Array.isArray(rowToDelete.videos) && rowToDelete.videos[0]) || rowToDelete.url || '')) || '') : '';
    const isDeletingAbcd = rowToDelete?.type === 'abcd' || rowToDelete?.type === 'competitor_abcd';

    const updatedRows = (rows || [])
        .filter(r => r.id !== id)
        .map(r => {
            if (isDeletingAbcd && deletedVid && (getVideoId(String((Array.isArray(r.videos) && r.videos[0]) || r.url || '')) === deletedVid)) {
                return { ...r, abcdScore: undefined, abcdAnalysisId: undefined, abcdStatus: undefined };
            }
            return r;
        });

    window.dispatchEvent(new CustomEvent('listen-table-updated', {
        detail: { companyName: activeBrand, rows: updatedRows, deletedTargets: tokens, clearedAbcdVideoId: isDeletingAbcd ? deletedVid : undefined }
    }));

    return { updatedRows, rowToDelete };
};

export const computeRowsAfterRemoveAbcd = (rows: any[], row: any, activeBrand: string, getVideoId: (url: string) => string) => {
    const rawVid = (Array.isArray(row?.videos) && row.videos[0]) || row?.url || '';
    const ytId = getVideoId(String(rawVid)) || String(rawVid);
    const linkedAbcdRows = (rows || []).filter(
        r => (r.type === 'abcd' || r.type === 'competitor_abcd') && (getVideoId(String((Array.isArray(r.videos) && r.videos[0]) || r.url || '')) === ytId)
    );
    const tokens: string[] = [`abcd:${ytId}`, `analysis_abcd_${ytId}`, `abcd_${ytId}`, ...(row.abcdAnalysisId ? [String(row.abcdAnalysisId)] : [])];
    linkedAbcdRows.forEach(lr => tokens.push(...collectDeleteTokensForRow(lr, getVideoId)));
    recordDeletedItemsInStorage(activeBrand, tokens);

    const linkedIds = new Set(linkedAbcdRows.map(lr => lr.id));
    const updatedRows = (rows || [])
        .filter(r => !linkedIds.has(r.id) && !(r.id === row.id && (r.type === 'abcd' || r.type === 'competitor_abcd')))
        .map(r => {
            const rVid = getVideoId(String((Array.isArray(r.videos) && r.videos[0]) || r.url || ''));
            if (r.id === row.id || (ytId && rVid === ytId)) {
                return { ...r, abcdScore: undefined, abcdAnalysisId: undefined, abcdStatus: undefined };
            }
            return r;
        });

    window.dispatchEvent(new CustomEvent('listen-table-updated', {
        detail: { companyName: activeBrand, rows: updatedRows, deletedTargets: tokens, clearedAbcdVideoId: ytId }
    }));

    return { updatedRows, ytId };
};

export const computeRowsAfterCategoryDelete = (
    rows: any[],
    categoryRows: any[],
    activeBrand: string,
    getVideoId: (url: string) => string,
    extraToken?: string
) => {
    const idsToRemove = new Set(categoryRows.map(r => r.id));
    const tokens: string[] = extraToken ? [extraToken] : [];
    const deletedAbcdVids = new Set<string>();
    categoryRows.forEach(r => {
        tokens.push(...collectDeleteTokensForRow(r, getVideoId));
        if (r.type === 'abcd' || r.type === 'competitor_abcd') {
            const v = getVideoId(String((Array.isArray(r.videos) && r.videos[0]) || r.url || ''));
            if (v) deletedAbcdVids.add(v);
        }
    });
    recordDeletedItemsInStorage(activeBrand, tokens);

    const updatedRows = (rows || [])
        .filter(r => !idsToRemove.has(r.id))
        .map(r => {
            const rVid = getVideoId(String((Array.isArray(r.videos) && r.videos[0]) || r.url || ''));
            if (rVid && deletedAbcdVids.has(rVid)) {
                return { ...r, abcdScore: undefined, abcdAnalysisId: undefined, abcdStatus: undefined };
            }
            return r;
        });

    window.dispatchEvent(new CustomEvent('listen-table-updated', {
        detail: { companyName: activeBrand, rows: updatedRows, deletedTargets: tokens }
    }));

    return updatedRows;
};
