export interface AbcdScore {
    score: number;
    observation: string;
}

export interface ObservationItem {
    category: string;
    notes: string;
}

export interface BrandingTimelineItem {
    time_segment: string;
    presence_percent: number;
    action: string;
}

export interface AnalysisResult {
    abcd_scores: {
        attract: AbcdScore;
        brand: AbcdScore;
        connect: AbcdScore;
        direct: AbcdScore;
    };
    branding_timeline?: BrandingTimelineItem[];
    observations: ObservationItem[];
    takeaways: string[];
    summary: string;
    timestamp: string;
    type?: string;
    counts?: {
        positive?: number;
        negative?: number;
        neutral?: number;
    };
    star_distribution?: {
        star_5?: number;
        star_4?: number;
        star_3?: number;
        star_2?: number;
        star_1?: number;
    };
    sentiment_score?: number;
    retail_dimensions?: Array<{
        dimension: string;
        sentiment: string;
        score: number;
        summary: string;
        strengths?: string[];
        pain_points?: string[];
    }>;
    reviews?: any;
    strategic_recommendations?: Array<{
        priority: string;
        area: string;
        recommendation: string;
        expected_impact?: string;
    }>;
    business_info?: {
        name?: string;
        domain?: string;
        trustScore?: string;
        rating?: string;
        reviewCount?: number;
        logo?: string;
        categories?: string[];
    };
    findings?: {
        positive?: string[];
        negative?: string[];
        neutral?: string[];
    };
    word_cloud?: string[];
    hashtag?: string;
    tag?: string;
    sampleSize?: number;
    timeRange?: string;
    totalViews?: string;
    totalPostsFound?: number;
    topVideos?: any[];
    sampledComments?: any[];
    viral_themes?: Array<{
        theme: string;
        share: number;
        sentiment: string;
        description: string;
        resonance?: string;
    }>;
    audio_trends?: Array<{
        soundName: string;
        creator: string;
        uses: string;
        mood: string;
    }>;
    [key: string]: any;
}

export const typePageTitles: { [key: string]: string } = {
    abcd: "ABCD Framework Analysis",
    competitor_abcd: "Competitor ABCD Analysis",
    youtube_sentiment: "YouTube Sentiment (Video & Comments)",
    sentiment_video: "Video Sentiment Analysis",
    sentiment_comments: "Comments Sentiment Analysis",
    fashion_analysis: "Trend Analysis",
    trend_analysis: "General Trend Analysis",
    creator_partner: "Creator Partner Audit & Analysis",
    steam_reviews: "Steam Review Analysis",
    trustpilot_sentiment: "Trustpilot Sentiment Analysis",
    tiktok_hashtag: "TikTok Hashtag Sentiment & Viral Analysis",
    social_intelligence: "Social & Community Intelligence",
    website_analysis: "Website Analysis",
    grounded_search: "Grounded Search",
    competitive: "Competitive Analysis",
    abcd_comparative: "ABCD Comparative Analysis",
    comparative: "General Comparative Analysis",
    video_metadata: "Video Metadata Extraction",
};

export const SUPPORTED_INSIGHT_TYPES = [
    { id: 'youtube_sentiment', label: 'YouTube: Video & Comment Sentiment' },
    { id: 'steam_reviews', label: 'Steam: Software & Product Reviews' },
    { id: 'metacritic_reviews', label: 'Metacritic: Critic & User Reviews (JSON-LD)' },
    { id: 'reddit', label: 'Reddit: Community Sentiment' },
    { id: 'tiktok', label: 'TikTok Trend Sentiment' },
    { id: 'abcd', label: 'ABCD Framework' },
    { id: 'tiktok_hashtag', label: 'TikTok Hashtag' },
    { id: 'creator_partner', label: 'Creator Partner Analysis' },
    { id: 'fashion_analysis', label: 'Video Trend Review' },
    { id: 'trend_analysis', label: 'Trend Analysis' },
    { id: 'video_metadata', label: 'Video Metadata' },
    { id: 'competitive', label: 'Competitive (Single)' },
    { id: 'abcd_comparative', label: 'ABCD Comparative' },
    { id: 'comparative', label: 'General Comparative' },
    { id: 'trustpilot_sentiment', label: 'Trustpilot Sentiment' },
    { id: 'website_analysis', label: 'Website Analysis' },
    { id: 'grounded_search', label: 'Grounded Search' },
    { id: 'competitor_abcd', label: 'ABCD Competitor' },
    { id: 'competitor_sentiment_video', label: 'Competitor Sentiment (Video)' },
    { id: 'competitor_sentiment_comments', label: 'Competitor Sentiment (Comments)' }
];

export const normalizeUrlKey = (u: string): string => {
    if (!u || typeof u !== 'string') return '';
    const raw = u.trim();
    const ytMatch = raw.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (ytMatch && ytMatch[1]) return `youtube:${ytMatch[1]}`;
    if (/^[a-zA-Z0-9_-]{11}$/.test(raw) && !raw.startsWith('http')) return `youtube:${raw}`;
    const steamMatch = raw.match(/store\.steampowered\.com\/app\/(\d+)/i);
    if (steamMatch && steamMatch[1]) return `steam:${steamMatch[1]}`;
    if (/^\d{5,9}$/.test(raw)) return `steam:${raw}`;
    let cleaned = raw.toLowerCase().replace(/^https?:\/\//, '').replace(/^www\./, '');
    cleaned = cleaned.split('?')[0].split('#')[0].replace(/\/+$/, '');
    return cleaned;
};

export const extractYouTubeId = (input?: string): string => {
    if (!input || typeof input !== 'string') return '';
    const trimmed = input.trim();
    const match = trimmed.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    if (match) return match[1];
    if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) {
        return trimmed;
    }
    return '';
};

export const getVideoId = (url: string): string => {
    if (!url) return '';
    const match = url.match(/(?:https?:\/\/)?(?:www\.)?(?:youtube\.com\/(?:[^\/\n\s]+\/\S+\/|(?:v|e(?:mbed)?)\/|\S*?[?&]v=)|youtu\.be\/|youtube\.com\/shorts\/)([a-zA-Z0-9_-]{11})/i);
    return match ? match[1] : url;
};

export const getWordCloud = (data: any): string[] => {
    if (data?.word_cloud && Array.isArray(data.word_cloud) && data.word_cloud.length > 0) {
        return data.word_cloud;
    }

    const words = new Set<string>();
    const addText = (text?: string) => {
        if (!text || typeof text !== 'string') return;
        const parts = text.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()?"']/g, " ")
            .split(/\s+/);
        parts.forEach(w => {
            if (w.length > 4 && !['about', 'their', 'there', 'would', 'could', 'should', 'these', 'which', 'other', 'under', 'using', 'first', 'shown', 'video', 'brand', 'theme', 'point', 'music', 'character', 'product', 'people', 'focused', 'highlights'].includes(w)) {
                words.add(w.charAt(0).toUpperCase() + w.slice(1));
            }
        });
    };

    addText(data?.summary);
    data?.products?.forEach((p: any) => { addText(p.name); addText(p.description); });
    data?.themes?.forEach((t: any) => { addText(t.name); addText(t.description); });
    data?.characters?.forEach((c: any) => { addText(c.name); addText(c.role_description); });
    data?.music?.forEach((m: any) => { addText(m.description); addText(m.vibe); });
    data?.talking_points?.forEach((tp: any) => { addText(tp.point); addText(tp.speaker); });

    const list = Array.from(words).slice(0, 20);
    return list.length > 0 ? list : ['Aesthetics', 'Product', 'Brand', 'Campaign', 'Video', 'Soundtrack', 'Narrative'];
};
