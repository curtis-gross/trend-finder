import { useMemo } from 'react';
import {
  SentimentSplit,
  TaxonomyMetricsResult,
  FeatureClusterOverview,
  DEFAULT_FEATURE_CLUSTERS,
  computeSplit,
  resolveKeywords,
  computeDeterministicSplit
} from './taxonomyDefaultsAndMatcher';

export type {
  SentimentSplit,
  TaxonomyMetricsResult,
  FeatureClusterOverview
};

export {
  DEFAULT_FEATURE_CLUSTERS,
  computeSplit,
  resolveKeywords,
  computeDeterministicSplit
};

interface SentimentTally {
  pos: number;
  neg: number;
  neu: number;
  total: number;
}

/**
 * Custom React hook that precomputes taxonomy domain metrics and topic sentiment splits
 * using a single O(N) inverted token index pass over enrichedComments.
 * Memoized with useMemo to deliver O(1) lookups and eliminate render CPU jitter.
 */
export function useTaxonomyMetrics(
  clusters?: any[] | null,
  enrichedComments?: any[] | null
): TaxonomyMetricsResult {
  return useMemo(() => {
    const clusterList: any[] = (Array.isArray(clusters) && clusters.length > 0)
      ? clusters
      : DEFAULT_FEATURE_CLUSTERS;

    const commentsList: any[] = Array.isArray(enrichedComments) ? enrichedComments : [];

    // 1. Calculate globalTotals and globalSplit
    const globalTotals = clusterList.reduce(
      (acc, c) => {
        acc.pos += Number(c?.sentimentBreakdown?.positive) || 0;
        acc.neg += Number(c?.sentimentBreakdown?.negative) || 0;
        acc.neu += Number(c?.sentimentBreakdown?.neutral) || 0;
        return acc;
      },
      { pos: 0, neg: 0, neu: 0 }
    );
    const globalSplit = computeSplit(globalTotals.pos, globalTotals.neg, globalTotals.neu);

    // 2. Precompute domain splits and map topic -> category baseline
    const domainSplitsMap = new Map<string, SentimentSplit>();
    const topicToCategoryMap = new Map<
      string,
      { category: string; breakdown: { positive: number; negative: number; neutral: number } }
    >();
    const allKnownTopics = new Set<string>();

    for (const cluster of clusterList) {
      if (!cluster || typeof cluster !== 'object') continue;
      const catKey = String(cluster?.category || cluster?.name || cluster?.title || '').toLowerCase().trim();
      const breakdown = {
        positive: Number.isFinite(cluster?.sentimentBreakdown?.positive) ? Math.max(0, Number(cluster.sentimentBreakdown.positive)) : 0,
        negative: Number.isFinite(cluster?.sentimentBreakdown?.negative) ? Math.max(0, Number(cluster.sentimentBreakdown.negative)) : 0,
        neutral: Number.isFinite(cluster?.sentimentBreakdown?.neutral) ? Math.max(0, Number(cluster.sentimentBreakdown.neutral)) : 0
      };
      const dSplit = computeSplit(breakdown.positive, breakdown.negative, breakdown.neutral);
      if (catKey) {
        domainSplitsMap.set(catKey, dSplit);
      }

      const clusterKws = resolveKeywords(cluster);
      for (const kw of clusterKws) {
        const cleanKw = kw.toLowerCase().trim();
        if (cleanKw) {
          allKnownTopics.add(cleanKw);
          topicToCategoryMap.set(cleanKw, {
            category: cluster?.category || '',
            breakdown
          });
        }
      }
    }

    // 3. Build Inverted Token Index over enrichedComments in a SINGLE O(N) pass
    const tokenIndex = new Map<string, SentimentTally>();

    const recordToken = (token: string, isPos: boolean, isNeg: boolean) => {
      let tally = tokenIndex.get(token);
      if (!tally) {
        tally = { pos: 0, neg: 0, neu: 0, total: 0 };
        tokenIndex.set(token, tally);
      }
      tally.total++;
      if (isPos) tally.pos++;
      else if (isNeg) tally.neg++;
      else tally.neu++;
    };

    const targetTopicArray = Array.from(allKnownTopics);

    for (let i = 0; i < commentsList.length; i++) {
      const comment = commentsList[i];
      if (!comment || typeof comment !== 'object') continue;

      const sent = String(comment.sentiment || '').toLowerCase().trim();
      const isPos = sent === 'positive' || sent === 'pos';
      const isNeg = sent === 'negative' || sent === 'neg' || sent === 'critical';

      const commentKeywords: string[] = [];
      if (Array.isArray(comment.keywords)) {
        for (const kw of comment.keywords) {
          const val = typeof kw === 'string' ? kw : (kw?.keyword || kw?.name || kw?.topic || kw?.title || '');
          const clean = String(val).replace(/^#/, '').toLowerCase().trim();
          if (clean && !commentKeywords.includes(clean)) {
            commentKeywords.push(clean);
            recordToken(clean, isPos, isNeg);
          }
        }
      }

      const rawTextLower = typeof comment.rawText === 'string'
        ? comment.rawText.toLowerCase()
        : typeof comment.text === 'string'
        ? comment.text.toLowerCase()
        : typeof comment.comment === 'string'
        ? comment.comment.toLowerCase()
        : '';

      for (let j = 0; j < targetTopicArray.length; j++) {
        const target = targetTopicArray[j];
        if (!target || commentKeywords.includes(target)) {
          continue;
        }

        let matches = false;
        for (let k = 0; k < commentKeywords.length; k++) {
          const cKw = commentKeywords[k];
          if (cKw === target || (cKw.length >= 3 && target.includes(cKw)) || (target.length >= 3 && cKw.includes(target))) {
            matches = true;
            break;
          }
        }
        if (!matches && rawTextLower && rawTextLower.includes(target)) {
          matches = true;
        }

        if (matches) {
          recordToken(target, isPos, isNeg);
        }
      }
    }

    // 4. Precompute Topic Splits for all known taxonomy topics (O(T))
    const topicSplitCache = new Map<string, SentimentSplit>();

    for (const topic of targetTopicArray) {
      const tally = tokenIndex.get(topic);
      const catInfo = topicToCategoryMap.get(topic);
      const baseSplit = catInfo
        ? computeSplit(catInfo.breakdown.positive, catInfo.breakdown.negative, catInfo.breakdown.neutral)
        : globalSplit;

      if (tally && tally.total >= 3) {
        topicSplitCache.set(topic, computeSplit(tally.pos, tally.neg, tally.neu));
      } else {
        const matchedCount = tally ? tally.total : 0;
        topicSplitCache.set(topic, computeDeterministicSplit(topic, baseSplit, matchedCount));
      }
    }

    // 5. Result Accessors
    const getDomainSplit = (category: string): SentimentSplit => {
      const cleanCat = String(category || '').toLowerCase().trim();
      const cached = domainSplitsMap.get(cleanCat);
      if (cached) return cached;

      const fallback = DEFAULT_FEATURE_CLUSTERS.find(
        c => c && typeof c === 'object' && String(c.category || '').toLowerCase().trim() === cleanCat
      );
      if (fallback?.sentimentBreakdown) {
        return computeSplit(
          fallback.sentimentBreakdown.positive,
          fallback.sentimentBreakdown.negative,
          fallback.sentimentBreakdown.neutral
        );
      }
      return computeSplit(0, 0, 0);
    };

    const getTopicSplit = (
      topicName: string,
      categoryBreakdown?: { positive: number; negative: number; neutral: number }
    ): SentimentSplit => {
      const clean = String(topicName || '').replace(/^#/, '').toLowerCase().trim();
      if (!clean) return { posPct: 50, neuPct: 25, negPct: 25, total: 0 };

      const cached = topicSplitCache.get(clean);
      const catInfo = topicToCategoryMap.get(clean);

      if (cached) {
        if (!categoryBreakdown) return cached;
        if (
          catInfo &&
          Number(catInfo.breakdown.positive) === Number(categoryBreakdown.positive) &&
          Number(catInfo.breakdown.negative) === Number(categoryBreakdown.negative) &&
          Number(catInfo.breakdown.neutral) === Number(categoryBreakdown.neutral)
        ) {
          return cached;
        }
      }

      const tally = tokenIndex.get(clean);
      if (tally && tally.total >= 3) {
        return computeSplit(tally.pos, tally.neg, tally.neu);
      }

      let base: SentimentSplit;
      if (categoryBreakdown) {
        base = computeSplit(
          categoryBreakdown.positive,
          categoryBreakdown.negative,
          categoryBreakdown.neutral
        );
      } else if (catInfo) {
        base = computeSplit(
          catInfo.breakdown.positive,
          catInfo.breakdown.negative,
          catInfo.breakdown.neutral
        );
      } else {
        base = globalSplit;
      }

      const matchedCount = tally ? tally.total : 0;
      return computeDeterministicSplit(clean, base, matchedCount);
    };

    return {
      globalTotals,
      globalSplit,
      getDomainSplit,
      getTopicSplit,
      resolveKeywords: (cluster: any) => resolveKeywords(cluster)
    };
  }, [clusters, enrichedComments]);
}

export default useTaxonomyMetrics;
