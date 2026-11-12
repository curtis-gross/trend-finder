// Helper to extract clean YouTube ID from URL or raw string
export const extractYouTubeId = (urlOrId: string): string => {
    if (!urlOrId) return '';
    const match = urlOrId.match(/(?:youtu\.be\/|youtube\.com\/(?:embed\/|v\/|watch\?v=|shorts\/|watch\?.+&v=))([\w-]{11})/);
    if (match) return match[1];
    const trimmed = urlOrId.trim();
    if (/^[\w-]{11}$/.test(trimmed)) return trimmed;
    return '';
};

// Helper to extract clean Steam App ID from URL or raw string
export const extractSteamAppId = (target: string): string => {
    if (!target) return '';
    const match = target.match(/app\/(\d+)/);
    if (match) return match[1];
    if (/^\d+$/.test(target.trim())) return target.trim();
    return target.trim();
};

// Helper to extract canonical Metacritic slug from any URL or subpage (/critic-reviews/, /user-reviews/)
export const extractMetacriticSlugFromTarget = (input?: string): string => {
    if (!input || typeof input !== 'string') return 'test-company';
    const trimmed = input
        .trim()
        .replace(/\/?(?:critic-reviews|user-reviews)\/?$/i, '')
        .replace(/[-_](?:critic[-_]reviews|user[-_]reviews)[-_]*$/i, '');
    const m = trimmed.match(/metacritic(?:\.com|_com)[/_]game[/_]([^/?#_]+)/i) ||
              trimmed.match(/^\/?game\/([^/?#]+)/i);
    if (m && m[1]) {
        return m[1]
            .toLowerCase()
            .replace(/[-_](?:critic[-_]reviews|user[-_]reviews)$/i, '')
            .replace(/_+$/, '')
            .trim();
    }
    if (/^https?:\/\//i.test(trimmed)) {
        return '';
    }
    return trimmed.toLowerCase() || 'test-company';
};

// Helper to collect and deduplicate Metacritic Critic & User reviews across all row/analysis shapes
export const collectAndDedupeMetacriticReviews = (...sources: any[]): any[] => {
    const combined: any[] = [];
    const seen = new Set<string>();

    const pushWithRole = (items: any, explicitRole?: 'critic' | 'user') => {
        if (!Array.isArray(items)) return;
        for (const item of items) {
            if (!item || typeof item !== 'object') continue;
            const text = String(item.text || item.quote || item.comment || item.body || item.content || '').trim();
            if (!text) continue;
            const rawRole = String(explicitRole || item.reviewType || item.type || '').toLowerCase();
            const isCritic = rawRole === 'critic' || Boolean(item.publicationName) || (typeof item.maxScore === 'number' && item.maxScore === 100) || (typeof item.score === 'number' && item.score > 10);
            const reviewType: 'critic' | 'user' = isCritic ? 'critic' : 'user';
            const author = String(item.author || item.publicationName || (isCritic ? 'Metacritic Critic' : 'Metacritic User')).trim();
            const dedupeKey = `${reviewType}::${author.toLowerCase()}::${text.slice(0, 120).toLowerCase()}`;
            if (seen.has(dedupeKey)) continue;
            seen.add(dedupeKey);
            combined.push({
                ...item,
                text,
                quote: text,
                author,
                reviewType,
                type: reviewType
            });
        }
    };

    for (const src of sources) {
        if (!src) continue;
        if (Array.isArray(src)) {
            pushWithRole(src);
            continue;
        }
        pushWithRole(src.criticReviews, 'critic');
        pushWithRole(src.userReviews, 'user');
        pushWithRole(src.metacritic_reviews);
        pushWithRole(src.cachedReviews);
        pushWithRole(src.reviews);
        pushWithRole(src.comments);
        if (src.result) {
            pushWithRole(src.result.criticReviews, 'critic');
            pushWithRole(src.result.userReviews, 'user');
            pushWithRole(src.result.metacritic_reviews);
            pushWithRole(src.result.reviews);
            pushWithRole(src.result.comments);
        }
        if (src.analysis) {
            pushWithRole(src.analysis.criticReviews, 'critic');
            pushWithRole(src.analysis.userReviews, 'user');
            pushWithRole(src.analysis.metacritic_reviews);
            pushWithRole(src.analysis.reviews);
            pushWithRole(src.analysis.comments);
        }
        if (src.preloadedResult) {
            pushWithRole(src.preloadedResult.criticReviews, 'critic');
            pushWithRole(src.preloadedResult.userReviews, 'user');
            pushWithRole(src.preloadedResult.metacritic_reviews);
            pushWithRole(src.preloadedResult.cachedReviews);
            pushWithRole(src.preloadedResult.reviews);
            pushWithRole(src.preloadedResult.comments);
        }
    }

    return combined;
};

// ============================================================================
// LISTEN TABLE DELETION BLOCKLIST & ROW SANITIZATION
// ============================================================================

export const getDeletedListenItemIds = (companyName: string = 'test-company'): Set<string> => {
    const set = new Set<string>();
    if (typeof window === 'undefined' || !window.localStorage) return set;
    try {
        const candidateKeys = new Set<string>([
            'deleted_listen_item_ids',
            `dml_deleted_listen_items_${companyName}`,
            'listen_table_deleted_ids_v1',
            `listen_table_deleted_ids_${companyName}`
        ]);
        for (let i = 0; i < window.localStorage.length; i++) {
            const k = window.localStorage.key(i);
            if (
                k &&
                (k === 'deleted_listen_item_ids' ||
                    k.startsWith('dml_deleted_listen_items_') ||
                    k.startsWith('listen_table_deleted_ids_'))
            ) {
                candidateKeys.add(k);
            }
        }
        candidateKeys.forEach(k => {
            const raw = window.localStorage.getItem(k);
            if (!raw) return;
            try {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => {
                        if (item !== null && item !== undefined) {
                            const norm = String(item).toLowerCase().trim();
                            if (norm) set.add(norm);
                        }
                    });
                }
            } catch {}
        });
    } catch {}
    return set;
};

export const isListenTableItemDeleted = (
    item: any,
    companyName: string = 'test-company',
    preloadedSet?: Set<string>
): boolean => {
    if (!item) return false;
    const deletedSet = preloadedSet || getDeletedListenItemIds(companyName);
    if (deletedSet.size === 0) return false;

    const id = String(item.id || '').toLowerCase().trim();
    const analysisId = String(item.analysisId || '').toLowerCase().trim();
    const abcdAnalysisId = String(item.abcdAnalysisId || '').toLowerCase().trim();
    const sentimentAnalysisId = String(item.sentimentAnalysisId || '').toLowerCase().trim();
    const label = String(item.label || item.title || '').toLowerCase().trim();
    const rawType = String(item.type || '').toLowerCase().trim();
    const rawTarget = String(
        item.target ||
            item.url ||
            (Array.isArray(item.videos) && item.videos.length > 0 ? item.videos[0] : '') ||
            item.videoId ||
            ''
    ).trim();
    const targetLower = rawTarget.toLowerCase();
    const ytId = extractYouTubeId(rawTarget).toLowerCase();

    if (id && deletedSet.has(id)) return true;
    if (analysisId && deletedSet.has(analysisId)) return true;
    if (label && deletedSet.has(label)) return true;

    const isAbcd = rawType === 'abcd' || rawType === 'youtube_abcd' || rawType === 'competitor_abcd';
    const isYtSentiment =
        rawType === 'youtube' ||
        rawType === 'youtube_sentiment' ||
        rawType === 'sentiment_video' ||
        rawType === 'sentiment_comments';
    const isReddit = rawType === 'reddit' || targetLower.includes('reddit.com');

    if (isAbcd) {
        if (deletedSet.has('__all_abcd__')) return true;
        if (abcdAnalysisId && deletedSet.has(abcdAnalysisId)) return true;
        if (ytId && (deletedSet.has(`abcd:${ytId}`) || deletedSet.has(`youtube_abcd:${ytId}`))) return true;
        if (targetLower && (deletedSet.has(`abcd:${targetLower}`) || deletedSet.has(`youtube_abcd:${targetLower}`))) return true;
        return false;
    }

    if (isYtSentiment) {
        if (sentimentAnalysisId && deletedSet.has(sentimentAnalysisId)) return true;
        if (ytId && (deletedSet.has(`youtube:${ytId}`) || deletedSet.has(`youtube_sentiment:${ytId}`))) return true;
        if (targetLower && (deletedSet.has(`youtube:${targetLower}`) || deletedSet.has(`youtube_sentiment:${targetLower}`))) return true;
        return false;
    }

    if (isReddit) {
        if (deletedSet.has('__all_reddit__')) return true;
        if (targetLower && (deletedSet.has(targetLower) || deletedSet.has(`reddit:${targetLower}`))) return true;
        return false;
    }

    if (targetLower && (deletedSet.has(targetLower) || deletedSet.has(`${rawType}:${targetLower}`))) return true;
    return false;
};

export const getDefaultListenTableRows = (_companyName: string = 'test-company'): any[] => {
    return [];
};
