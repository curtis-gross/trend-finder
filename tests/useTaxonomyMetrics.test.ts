/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import { renderHook } from '@testing-library/react';
import {
  useTaxonomyMetrics,
  computeSplit,
  resolveKeywords,
  computeDeterministicSplit,
  DEFAULT_FEATURE_CLUSTERS,
  FeatureClusterOverview
} from '../hooks/useTaxonomyMetrics';

const SAMPLE_CLUSTERS: FeatureClusterOverview[] = [
  {
    category: 'Core Product Experience & Quality',
    keywordCount: 342,
    sentimentBreakdown: { positive: 185, negative: 98, neutral: 59 },
    topKeywords: [
      'Workflow Automation & Speed',
      'Dashboard Responsiveness',
      'Custom Workspace Setup',
      'Performance Regression Tuning',
      'Team Collaboration Sync'
    ]
  },
  {
    category: 'Pricing, Value & Tier Structure',
    keywordCount: 288,
    sentimentBreakdown: { positive: 110, negative: 132, neutral: 46 },
    topKeywords: [
      'Subscription Tier Cost',
      'Enterprise Price Floors',
      'Annual Billing Discounts'
    ]
  }
];

describe('useTaxonomyMetrics Hook & Metric Utilities (Vector Bravo)', () => {
  describe('computeSplit', () => {
    it('calculates balanced percentage split summing to 100%', () => {
      const split = computeSplit(60, 20, 20);
      expect(split.posPct).toBe(60);
      expect(split.negPct).toBe(20);
      expect(split.neuPct).toBe(20);
      expect(split.posPct + split.neuPct + split.negPct).toBe(100);
      expect(split.total).toBe(100);
    });

    it('handles zero total by returning 50/25/25 default with total 0', () => {
      const split = computeSplit(0, 0, 0);
      expect(split.posPct).toBe(50);
      expect(split.neuPct).toBe(25);
      expect(split.negPct).toBe(25);
      expect(split.total).toBe(0);
    });

    it('normalizes rounding when posPct + negPct exceed 100', () => {
      const split = computeSplit(67, 34, 0);
      expect(split.posPct + split.neuPct + split.negPct).toBe(100);
    });

    it('coerces negative or NaN inputs safely', () => {
      const split = computeSplit(-10, NaN, 50);
      expect(split.posPct).toBe(0);
      expect(split.negPct).toBe(0);
      expect(split.neuPct).toBe(100);
      expect(split.total).toBe(50);
    });
  });

  describe('resolveKeywords', () => {
    it('exports empty DEFAULT_FEATURE_CLUSTERS array by default', () => {
      expect(DEFAULT_FEATURE_CLUSTERS).toEqual([]);
    });

    it('prefers topKeywords when present as string array', () => {
      const cluster = {
        category: 'Custom Category',
        topKeywords: ['#Workflow Automation', 'API Stability']
      };
      const resolved = resolveKeywords(cluster);
      expect(resolved).toEqual(['Workflow Automation', 'API Stability']);
    });

    it('falls back to keywords if topKeywords is missing or empty', () => {
      const cluster = {
        category: 'Custom Category',
        topKeywords: [],
        keywords: ['#Enterprise Pricing', 'Seat Bundles']
      };
      const resolved = resolveKeywords(cluster);
      expect(resolved).toEqual(['Enterprise Pricing', 'Seat Bundles']);
    });

    it('falls back to provided fallbackClusters when cluster has no keywords but matches category', () => {
      const cluster = {
        category: 'Core Product Experience & Quality',
        sentimentBreakdown: { positive: 10, negative: 5, neutral: 5 }
      };
      const resolved = resolveKeywords(cluster, SAMPLE_CLUSTERS);
      expect(resolved).toEqual([
        'Workflow Automation & Speed',
        'Dashboard Responsiveness',
        'Custom Workspace Setup',
        'Performance Regression Tuning',
        'Team Collaboration Sync'
      ]);
    });

    it('normalizes mixed object shapes ({ keyword: string }, { name: string })', () => {
      const cluster = {
        topKeywords: [
          { keyword: '#Workflow' },
          { name: 'Dashboard Speed ' },
          { topic: '#Performance Tuning' },
          'Clean String'
        ]
      };
      const resolved = resolveKeywords(cluster);
      expect(resolved).toEqual(['Workflow', 'Dashboard Speed', 'Performance Tuning', 'Clean String']);
    });

    it('returns empty array on null or non-object input', () => {
      expect(resolveKeywords(null)).toEqual([]);
      expect(resolveKeywords(undefined)).toEqual([]);
      expect(resolveKeywords('invalid' as any)).toEqual([]);
    });
  });

  describe('computeDeterministicSplit', () => {
    const baseSplit = { posPct: 50, neuPct: 25, negPct: 25, total: 100 };

    it('boosts positive sentiment for praise terms (e.g. classic, reward, expansion)', () => {
      const praise = computeDeterministicSplit('classic reward expansion', baseSplit);
      expect(praise.posPct).toBeGreaterThanOrEqual(baseSplit.posPct);
      expect(praise.posPct + praise.neuPct + praise.negPct).toBe(100);
    });

    it('boosts negative sentiment for friction terms (e.g. cost, latency, delay)', () => {
      const friction = computeDeterministicSplit('subscription cost latency delay', baseSplit);
      expect(friction.negPct).toBeGreaterThanOrEqual(baseSplit.negPct);
      expect(friction.posPct + friction.neuPct + friction.negPct).toBe(100);
    });

    it('clamps posPct and negPct within defined bounds and maintains conservation', () => {
      const extreme = computeDeterministicSplit('extreme price cost latency delay regression', baseSplit);
      expect(extreme.posPct).toBeGreaterThanOrEqual(12);
      expect(extreme.negPct).toBeLessThanOrEqual(80);
      expect(extreme.posPct + extreme.neuPct + extreme.negPct).toBe(100);
    });
  });

  describe('useTaxonomyMetrics Hook Execution', () => {
    it('computes globalTotals and globalSplit from provided clusters', () => {
      const { result } = renderHook(() => useTaxonomyMetrics(SAMPLE_CLUSTERS, []));

      expect(result.current.globalTotals.pos).toBeGreaterThan(0);
      expect(result.current.globalTotals.neg).toBeGreaterThan(0);
      expect(result.current.globalTotals.neu).toBeGreaterThan(0);

      const split = result.current.globalSplit;
      expect(split.posPct + split.neuPct + split.negPct).toBe(100);
      expect(split.total).toBe(
        result.current.globalTotals.pos +
        result.current.globalTotals.neg +
        result.current.globalTotals.neu
      );
    });

    it('provides getDomainSplit for existing and non-existing categories', () => {
      const { result } = renderHook(() => useTaxonomyMetrics(SAMPLE_CLUSTERS, []));

      const domainSplit = result.current.getDomainSplit('Core Product Experience & Quality');
      expect(domainSplit.total).toBe(185 + 98 + 59);
      expect(domainSplit.posPct).toBe(54);

      const unknownSplit = result.current.getDomainSplit('Unknown Domain');
      expect(unknownSplit.total).toBe(0);
      expect(unknownSplit.posPct).toBe(50);
    });

    it('uses deterministic split for topics with < 3 matching comments', () => {
      const { result } = renderHook(() => useTaxonomyMetrics(SAMPLE_CLUSTERS, []));

      const split = result.current.getTopicSplit('Dashboard Responsiveness');
      expect(split.posPct).toBeGreaterThan(0);
      expect(split.negPct).toBeGreaterThan(0);
      expect(split.neuPct).toBeGreaterThan(0);
      expect(split.posPct + split.neuPct + split.negPct).toBe(100);
    });

    it('uses calculated comment split when inverted index finds >= 3 comments', () => {
      const comments = [
        { keywords: ['workflow automation & speed'], sentiment: 'positive', rawText: 'Amazing workflow automation!' },
        { keywords: ['workflow automation & speed'], sentiment: 'positive', rawText: 'Smooth workflow automation' },
        { keywords: ['workflow automation & speed'], sentiment: 'positive', rawText: 'Loving the workflow mechanics' },
        { keywords: ['workflow automation & speed'], sentiment: 'negative', rawText: 'Still some workflow delay' }
      ];

      const { result } = renderHook(() => useTaxonomyMetrics(SAMPLE_CLUSTERS, comments));

      const split = result.current.getTopicSplit('workflow automation & speed');
      expect(split.posPct).toBe(75);
      expect(split.negPct).toBe(25);
      expect(split.neuPct).toBe(0);
      expect(split.total).toBe(4);
    });

    it('normalizes topic queries with leading #', () => {
      const { result } = renderHook(() => useTaxonomyMetrics(SAMPLE_CLUSTERS, []));
      const withHash = result.current.getTopicSplit('#Dashboard Responsiveness');
      const withoutHash = result.current.getTopicSplit('Dashboard Responsiveness');

      expect(withHash).toEqual(withoutHash);
    });

    it('memoizes calculation result to prevent CPU jitter across re-renders with stable references', () => {
      const clusters = [...SAMPLE_CLUSTERS];
      const comments: any[] = [];

      const { result, rerender } = renderHook(
        ({ c, com }) => useTaxonomyMetrics(c, com),
        { initialProps: { c: clusters, com: comments } }
      );

      const firstRef = result.current;
      rerender({ c: clusters, com: comments });
      const secondRef = result.current;

      expect(firstRef).toBe(secondRef);
    });
  });
});
