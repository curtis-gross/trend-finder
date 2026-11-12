const normalizeMetacriticUrl = (rawUrl: string) => {
    const raw = String(rawUrl || 'https://www.metacritic.com/').trim();
    const isCriticSubpage = /\/critic-reviews\/?(\?.*)?$/i.test(raw);
    const isUserSubpage = /\/user-reviews\/?(\?.*)?$/i.test(raw);
    const subpage: 'landing' | 'critic-reviews' | 'user-reviews' = isCriticSubpage
        ? 'critic-reviews'
        : isUserSubpage
        ? 'user-reviews'
        : 'landing';

    let slug = 'product-review';
    const match = raw.match(/metacritic\.com\/(?:game|movie|tv|music|product)\/([^/?#]+)/i);
    if (match && match[1]) {
        slug = match[1].toLowerCase().replace(/[^a-z0-9-]/g, '');
    } else if (!raw.startsWith('http')) {
        const cleaned = raw.replace(/^\/+|\/+$/g, '').split('/')[0].toLowerCase().replace(/[^a-z0-9-]/g, '');
        if (cleaned) slug = cleaned;
    }

    const baseUrl = raw.startsWith('http') ? raw : `https://www.metacritic.com/product/${slug}/`;
    const criticReviewsUrl = `${baseUrl.replace(/\/+$/, '')}/critic-reviews/`;
    const userReviewsUrl = `${baseUrl.replace(/\/+$/, '')}/user-reviews/`;

    return {
        slug,
        baseUrl,
        criticReviewsUrl,
        userReviewsUrl,
        subpage
    };
};

export const buildRichMetacriticAnalysis = (rawPayload: any, targetUrl: string, fallbackCompany: string = 'test-company') => {
    const data = rawPayload?.result && typeof rawPayload.result === 'object' ? { ...rawPayload, ...rawPayload.result } : (rawPayload || {});
    const meta = data.jsonLdMetadata || data.rawJsonLd || {};
    const normUrls = normalizeMetacriticUrl(data.url || meta.url || targetUrl || '');
    const canonicalUrl = normUrls.baseUrl;
    const slug = data.slug && !String(data.slug).includes('/') ? data.slug : normUrls.slug;
    const titleLabel = meta.name || data.title || fallbackCompany;

    const rawReviews = Array.isArray(data.reviews) && data.reviews.length > 0
        ? data.reviews
        : Array.isArray(data.comments) && data.comments.length > 0
        ? data.comments.map((c: any, idx: number) => ({
            id: c.id || `rev-${idx}`,
            author: c.author || 'Verified Reviewer',
            type: c.reviewType || (c.score > 10 ? 'critic' : 'user'),
            score: c.score ?? (c.sentiment === 'positive' ? 88 : c.sentiment === 'negative' ? 35 : 65),
            quote: c.text || c.rawText || '',
            sentiment: c.sentiment || 'neutral',
            platform: c.platform || 'Web',
            date: c.timestamp || meta.datePublished || new Date().toISOString().slice(0, 10)
        }))
        : [];

    const reviewsList = rawReviews.map((r: any, idx: number) => {
        const revType = (r.type || r.reviewType || (typeof r.score === 'number' && r.score > 10 ? 'critic' : 'user')).toLowerCase();
        const rawScore = typeof r.score === 'number' ? r.score : (revType === 'critic' ? 85 : 8.5);
        const norm100 = revType === 'user' && rawScore <= 10 ? Math.round(rawScore * 10) : rawScore;
        const sent = r.sentiment || (norm100 >= 70 ? 'positive' : norm100 < 50 ? 'negative' : 'neutral');
        return {
            id: r.id || `mc-${idx}`,
            author: r.author || r.publication || (revType === 'critic' ? 'Editorial Publication' : `Client_${idx + 1}`),
            publication: r.publication || (revType === 'critic' ? r.author : 'Verified Client Review'),
            type: revType === 'critic' ? 'critic' : 'user',
            score: rawScore,
            normalizedScore: norm100,
            quote: r.quote || r.body || r.text || r.rawText || '',
            sentiment: sent,
            platform: r.platform || 'Digital Platform',
            date: r.date || r.timestamp || meta.datePublished || new Date().toISOString().slice(0, 10),
            subpageSource: r.subpageSource || (revType === 'critic' ? '/critic-reviews/' : '/user-reviews/'),
            helpfulCount: r.helpfulCount ?? 0
        };
    });

    const criticReviews = reviewsList.filter((r: any) => r.type === 'critic');
    const userReviews = reviewsList.filter((r: any) => r.type !== 'critic');

    const posCount = reviewsList.filter((r: any) => r.sentiment === 'positive').length;
    const negCount = reviewsList.filter((r: any) => r.sentiment === 'negative').length;
    const neuCount = Math.max(0, reviewsList.length - posCount - negCount);

    const criticPos = criticReviews.filter((r: any) => r.sentiment === 'positive').length;
    const criticNeg = criticReviews.filter((r: any) => r.sentiment === 'negative').length;
    const criticMix = Math.max(0, criticReviews.length - criticPos - criticNeg);

    const userPos = userReviews.filter((r: any) => r.sentiment === 'positive').length;
    const userNeg = userReviews.filter((r: any) => r.sentiment === 'negative').length;
    const userMix = Math.max(0, userReviews.length - userPos - userNeg);

    const metascoreVal = Number(meta.metascore ?? data.metascore ?? meta.aggregateRating?.ratingValue ?? 0);
    const userScoreVal = Number(meta.userScore ?? data.userScore ?? 0);
    const userScoreNormalized = userScoreVal <= 10 ? Math.round(userScoreVal * 10) : userScoreVal;
    const scoreGap = Math.abs(metascoreVal - userScoreNormalized);

    const executiveSummary = data.executiveSummary || data.summary || `Harvested ${reviewsList.length} verified reviews for ${titleLabel}.`;
    const rawDiv = data.scoreDivergence || data.criticVsPlayerDivergence || null;
    const scoreDivergence = rawDiv || {
        metascore: metascoreVal,
        userScore: userScoreVal,
        gapPoints: scoreGap,
        headline: `${titleLabel} Editorial vs. Community Sentiment Overview`,
        criticPerspective: `Aggregated across ${criticReviews.length} editorial reviews.`,
        playerPerspective: `Aggregated across ${userReviews.length} community reviews.`,
        rootCauses: []
    };

    const topPraises = Array.isArray(data.topPraises) ? data.topPraises : [];
    const topPainPoints = Array.isArray(data.topPainPoints) ? data.topPainPoints : [];
    const keyThemes = Array.isArray(data.keyThemes) ? data.keyThemes : [];
    const platformBreakdown = Array.isArray(data.platformBreakdown) ? data.platformBreakdown : [];

    const crawledPages = {
        mainUrl: data.crawledPages?.mainUrl || canonicalUrl,
        criticReviewsUrl: data.crawledPages?.criticReviewsUrl || normUrls.criticReviewsUrl,
        userReviewsUrl: data.crawledPages?.userReviewsUrl || normUrls.userReviewsUrl,
        criticReviewsTotal: criticReviews.length,
        userReviewsTotal: userReviews.length,
        totalReviews: reviewsList.length
    };

    return {
        ...data,
        type: 'metacritic_reviews',
        url: canonicalUrl,
        criticReviewsUrl: crawledPages.criticReviewsUrl,
        userReviewsUrl: crawledPages.userReviewsUrl,
        crawledPages,
        subpageScanned: normUrls.subpage,
        slug,
        title: titleLabel,
        jsonLdMetadata: meta,
        rawJsonLd: data.rawJsonLd || meta,
        metascore: metascoreVal,
        userScore: userScoreVal,
        criticReviewCount: criticReviews.length,
        userReviewCount: userReviews.length,
        reviews: reviewsList,
        comments: reviewsList.map((r: any) => ({
            id: r.id,
            text: r.quote,
            rawText: r.quote,
            author: r.author,
            sentiment: r.sentiment,
            score: r.score,
            reviewType: r.type,
            platform: r.platform,
            timestamp: r.date,
            source: 'Editorial & Community Reviews',
            sourceLabel: `Reviews: ${titleLabel}`
        })),
        counts: {
            positive: posCount,
            negative: negCount,
            neutral: neuCount,
            criticPositive: criticPos,
            criticMixed: criticMix,
            criticNegative: criticNeg,
            userPositive: userPos,
            userMixed: userMix,
            userNegative: userNeg
        },
        summary: executiveSummary,
        executiveSummary,
        scoreDivergence,
        topPraises,
        topPainPoints,
        keyThemes,
        platformBreakdown,
        timestamp: data.timestamp || new Date().toISOString()
    };
};
