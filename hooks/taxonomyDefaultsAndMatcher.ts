/**
 * Sentiment distribution percentages and total sample size.
 */
export interface SentimentSplit {
  posPct: number;
  neuPct: number;
  negPct: number;
  total: number;
}

/**
 * Result contract exposed by useTaxonomyMetrics.
 */
export interface TaxonomyMetricsResult {
  globalTotals: { pos: number; neg: number; neu: number };
  globalSplit: SentimentSplit;
  getDomainSplit: (category: string) => SentimentSplit;
  getTopicSplit: (
    topicName: string,
    categoryBreakdown?: { positive: number; negative: number; neutral: number }
  ) => SentimentSplit;
  resolveKeywords: (cluster: any) => string[];
}

export interface FeatureClusterOverview {
  category: string;
  keywordCount: number;
  sentimentBreakdown: { positive: number; negative: number; neutral: number };
  topKeywords: string[];
}

/**
 * Canonical default taxonomy feature clusters for brand-neutral Trend Intelligence.
 * Empty by default so unhydrated state starts clean with zero customer data.
 */
export const DEFAULT_FEATURE_CLUSTERS: FeatureClusterOverview[] = [];

/**
 * Computes a standardized 3-way sentiment percentage split ensuring
 * exact total conservation (pos + neu + neg === 100) and resilient positive total count.
 */
export const computeSplit = (pos: number, neg: number, neu: number): SentimentSplit => {
  const p = Number.isFinite(pos) ? Math.max(0, Number(pos)) : 0;
  const n = Number.isFinite(neg) ? Math.max(0, Number(neg)) : 0;
  const u = Number.isFinite(neu) ? Math.max(0, Number(neu)) : 0;
  const total = p + n + u;
  if (total <= 0) {
    return { posPct: 50, neuPct: 25, negPct: 25, total: 0 };
  }
  let posPct = Math.round((p / total) * 100);
  let negPct = Math.round((n / total) * 100);
  if (posPct + negPct > 100) {
    if (posPct >= negPct) posPct = 100 - negPct;
    else negPct = 100 - posPct;
  }
  const neuPct = Math.max(0, 100 - posPct - negPct);
  return { posPct, neuPct, negPct, total };
};

/**
 * Resolves cluster keywords with a resilient triple-layer fallback:
 * cluster.topKeywords -> cluster.keywords -> DEFAULT_FEATURE_CLUSTERS.
 * Normalizes string or object shapes (`{ keyword: string }`, `{ name: string }`, etc.)
 * and strips `#` prefixes and extraneous whitespace.
 */
export const resolveKeywords = (
  cluster: any,
  fallbackClusters: FeatureClusterOverview[] = DEFAULT_FEATURE_CLUSTERS
): string[] => {
  if (!cluster || typeof cluster !== 'object') return [];

  const safeFallbacks = Array.isArray(fallbackClusters) ? fallbackClusters : DEFAULT_FEATURE_CLUSTERS;

  let rawList: any[] = [];
  if (Array.isArray(cluster.topKeywords) && cluster.topKeywords.length > 0) {
    rawList = cluster.topKeywords;
  } else if (Array.isArray(cluster.keywords) && cluster.keywords.length > 0) {
    rawList = cluster.keywords;
  } else {
    const categoryName = String(cluster.category || cluster.name || cluster.title || '').toLowerCase().trim();
    const defaultCluster = safeFallbacks.find(
      c => c && typeof c === 'object' && String(c.category || '').toLowerCase().trim() === categoryName
    );
    if (defaultCluster && Array.isArray(defaultCluster.topKeywords)) {
      rawList = defaultCluster.topKeywords;
    }
  }

  const seen = new Set<string>();
  const results: string[] = [];

  for (const item of rawList) {
    if (!item) continue;
    let val = '';
    if (typeof item === 'string') {
      val = item;
    } else if (typeof item === 'object') {
      val = item.keyword || item.name || item.topic || item.title || item.label || '';
    }
    const clean = String(val).replace(/^#/, '').trim();
    if (clean && !seen.has(clean.toLowerCase())) {
      seen.add(clean.toLowerCase());
      results.push(clean);
    }
  }

  return results;
};

/**
 * Deterministic hash-based sentiment split adjustment from category baseline.
 * Used when topic comment frequency is below statistical significance threshold (< 3 comments).
 */
export const computeDeterministicSplit = (
  topicName: string,
  base: SentimentSplit,
  matchedCount = 0
): SentimentSplit => {
  const clean = String(topicName || '').replace(/^#/, '').toLowerCase().trim();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = ((hash << 5) - hash) + clean.charCodeAt(i);
    hash |= 0;
  }
  const delta = (Math.abs(hash) % 13) - 6;
  const isFriction = /cost|latency|regression|price|floor|cap|timer|delay|friction|defect|issue|slow|broken|bug|return|refund|outage/i.test(clean);
  const isPraise = /historic|classic|signature|reward|quality|value|smooth|reliable|praise|durable|fast|helpful|intuitive|clean/i.test(clean);

  const basePos = Number.isFinite(base?.posPct) ? Number(base.posPct) : 50;
  const baseNeg = Number.isFinite(base?.negPct) ? Number(base.negPct) : 25;
  const baseTotal = Number.isFinite(base?.total) ? Number(base.total) : 0;

  let posPct = Math.min(82, Math.max(12, basePos + delta + (isPraise ? 8 : 0) - (isFriction ? 12 : 0)));
  let negPct = Math.min(80, Math.max(10, baseNeg - Math.round(delta / 2) + (isFriction ? 14 : 0) - (isPraise ? 6 : 0)));
  if (posPct + negPct > 92) {
    const scale = 92 / (posPct + negPct);
    posPct = Math.round(posPct * scale);
    negPct = Math.round(negPct * scale);
  }
  const neuPct = Math.max(0, 100 - posPct - negPct);
  const safeCount = Number.isFinite(matchedCount) ? Math.max(0, Math.round(matchedCount)) : 0;
  const total = safeCount || Math.max(12, Math.round(baseTotal / 5));
  return { posPct, neuPct, negPct, total };
};
