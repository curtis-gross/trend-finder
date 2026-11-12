export interface NoiseSourceConfig {
    id: string;
    type: 'youtube' | 'youtube_abcd' | 'steam' | 'reddit' | 'metacritic';
    target: string;
    label: string;
    targetCount?: number; // Target volume (e.g. 750 for Steam/YouTube, 250 for Metacritic, 200 for Reddit)
    abcdScore?: number;
    abcdAnalysisId?: string;
    abcdResult?: any;
    sentimentScore?: number;
    sentimentAnalysisId?: string;
    contentPreview?: string;
    description?: string;
    summary?: string;
    overallSummary?: string;
    comments?: any[];
    sampleComments?: any[];
    subreddit?: string;
    sourceStage?: string;
    channelTitle?: string;
    publishedAt?: string;
    url?: string;
    videoId?: string;
    cachedReviews?: any[];
    criticReviews?: any[];
    userReviews?: any[];
    metacritic_reviews?: any[];
    reviews?: any[];
    cachedJsonLdMetadata?: any;
    crawledPages?: any;
    preloadedResult?: any;
}

export interface RawComment {
    id: string;
    rawText: string;
    author: string;
    release?: string; // Backwards-compatible alias for existing checkpoints
    period?: string; // Universal operational period (e.g. 'Historical' | 'Prior' | 'Current' | 'Target')
    horizon?: string;
    source: 'Steam Reviews' | 'YouTube Comments' | 'Reddit Discussion' | 'Metacritic' | string;
    sourceLabel?: string;
    timestamp?: string; // Formatted Date/Time stamp (e.g. 'Oct 14, 2024')
    language?: string; // e.g. 'English', 'Spanish', 'German', 'Portuguese', 'French', 'Japanese', 'Italian'
    country?: string; // Backwards-compatible alias for detected language / origin
    isHistoricalBackfill?: boolean;
    likes?: number | string;
    videoTitle?: string;
    reviewType?: 'critic' | 'user' | 'json-ld' | string;
    score?: number;
    maxScore?: number;
    publication?: string | null;
    publicationName?: string | null;
    subpageUrl?: string;
    platform?: string;
    // Real source provenance (never synthesized): video page, thread permalink, or review page.
    sourceUrl?: string;
    videoUrl?: string;
    videoId?: string;
    channelTitle?: string;
}

/** A verified source (video, thread, or review page) backing a topic. */
export interface TopicSourceRef {
    url: string;
    title?: string;
    source: string;
    videoId?: string;
    channelTitle?: string;
    commentCount: number;
}

export interface FilteredComment extends RawComment {
    isNoise: boolean;
    noiseReason?: string;
}

export interface EnrichedComment extends FilteredComment {
    featureCategory?: string;
    keywords: string[];
    structuredKeywords?: string[];
    discoveredTopics?: string[];
    sentiment: 'positive' | 'negative' | 'neutral';
    constructiveSummary?: string;
    actionableSuggestion?: string;
}

export interface GraphNode {
    id: string;
    label: string;
    type: 'release' | 'feature' | 'keyword' | 'source' | 'category';
    category?: string;
    sentiment?: 'positive' | 'negative' | 'neutral' | 'mixed';
    size: number;
    mentionCount: number;
    releaseDistribution?: {
        priorPeriod: number;
        currentPeriod: number;
        nextPeriod: number;
        year2024?: number;
        year2025?: number;
        year2026?: number;
        year2027?: number;
        baseline?: number;
        prior?: number;
        current?: number;
        target?: number;
    };
    positiveRatio?: number;
    velocityChange?: number;
    tier?: 'core' | 'micro';
    x?: number;
    y?: number;
}

export interface GraphLink {
    source: string;
    target: string;
    weight: number;
    sentiment: 'positive' | 'negative' | 'neutral' | 'mixed';
    relationship?: 'co_mentioned' | 'comment_overlap' | 'shared_source' | 'cross_category_bridge' | 'category_pillar' | 'semantic_affinity' | string;
    sharedComments?: number;
    reason?: string;
}

export interface FeatureCluster {
    category: string;
    keywordCount: number;
    sentimentBreakdown: { positive: number; negative: number; neutral: number };
    topKeywords: string[];
}

export interface CrossReleaseEvolution {
    feature: string;
    category?: string;
    year2022Sentiment?: number; // 2022 Foundation Baseline
    year2023Sentiment?: number; // 2023 Historical Baseline
    year2024Sentiment?: number; // 2024 Benchmark
    year2025Sentiment?: number; // 2025 Prior Year
    year2026Sentiment?: number; // 2026 Current Year
    year2027Sentiment?: number; // 2027 Strategic Target
    baselineSentiment?: number; // Historical Baseline
    priorSentiment?: number;    // Prior Cycle
    currentSentiment?: number;  // Current Horizon
    targetSentiment?: number;   // Strategic Mandate Target
    priorPeriodSentiment?: number;
    currentPeriodSentiment?: number;
    nextPeriodSentiment?: number;
    trajectory: 'improving' | 'declining' | 'stable' | 'emerging' | 'critical';
    keyDrivers?: string[];
    actionableMandate?: string;
    riskIfIgnored?: string;
    summary: string;
}

export interface NoiseFilterResult {
    totalHarvested: number;
    noiseCount: number;
    signalCount: number;
    noisePercentage: number;
    signalPercentage: number;
    comments: EnrichedComment[];
    nodes: GraphNode[];
    links: GraphLink[];
    graphNodes?: GraphNode[];
    graphLinks?: GraphLink[];
    featureClusters: FeatureCluster[];
    crossReleaseEvolution: CrossReleaseEvolution[];
    sourcesUsed: NoiseSourceConfig[];
    generatedAt: string;
    savedAt?: string;
}

export interface Stage2FilteredResult {
    totalCount: number;
    signalCount: number;
    noiseCount: number;
    signalPercentage: number;
    noisePercentage: number;
    filteredComments: FilteredComment[];
    savedAt: string;
}
export type Stage2Output = Stage2FilteredResult;

export interface Stage3KeywordResult {
    totalEnriched: number;
    enrichedComments: EnrichedComment[];
    topKeywords: {
        keyword: string;
        category: string;
        mentions: number;
        sentiment: string;
        positiveRatio?: number;
        sentimentBreakdown?: { positive: number; negative: number; neutral: number };
        releaseBreakdown?: GraphNode['releaseDistribution'];
        frequencyPercentage?: number;
        velocityChange?: number;
        isBreakout?: boolean;
        language?: string;
        country?: string;
        sourceUrl?: string;
        videoUrl?: string;
        sourceTitle?: string;
        sourceUrls?: TopicSourceRef[];
    }[];
    featureClusters: FeatureCluster[];
    savedAt: string;
}
export type Stage3Output = Stage3KeywordResult;

export interface InducedCategory {
    name: string;
    description: string;
}

export interface HarvestSourceError {
    sourceLabel: string;
    sourceType: string;
    target: string;
    message: string;
}

// Default pre-configured sources (empty by default so only user-configured Listen channels are used)
export const DEFAULT_NOISE_SOURCES: NoiseSourceConfig[] = [];
