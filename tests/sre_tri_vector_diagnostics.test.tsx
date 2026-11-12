/** @vitest-environment jsdom */
import { describe, it, expect, vi } from 'vitest';
import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';
import { renderHook } from '@testing-library/react';
import {
  computeSplit,
  computeDeterministicSplit,
  resolveKeywords,
  useTaxonomyMetrics,
  DEFAULT_FEATURE_CLUSTERS
} from '../hooks/useTaxonomyMetrics';
import { SentimentGradientBar } from '../components/SentimentGradientBar';
import { TaxonomyDomainGrid } from '../components/TaxonomyDomainGrid';

describe('SRE & Zero-Fallback Bug Hunter Suite (Wave 3 Tri-Vector Diagnostics)', () => {
  describe('Vector Bravo: Metric Calculations & Edge Case Resiliency', () => {
    it('handles NaN, Infinity, negative, and null inputs in computeSplit without throwing or emitting NaNs', () => {
      const nanSplit = computeSplit(NaN as any, NaN as any, NaN as any);
      expect(nanSplit.posPct).toBe(50);
      expect(nanSplit.neuPct).toBe(25);
      expect(nanSplit.negPct).toBe(25);
      expect(nanSplit.total).toBe(0);

      const infSplit = computeSplit(Infinity as any, 10, 10);
      expect(Number.isFinite(infSplit.posPct)).toBe(true);
      expect(Number.isFinite(infSplit.neuPct)).toBe(true);
      expect(Number.isFinite(infSplit.negPct)).toBe(true);
      expect(infSplit.posPct + infSplit.neuPct + infSplit.negPct).toBe(100);

      const nullSplit = computeSplit(null as any, undefined as any, -50 as any);
      expect(nullSplit.posPct).toBe(50);
      expect(nullSplit.total).toBe(0);
    });

    it('prevents crashes in computeDeterministicSplit when topicName or base is malformed or null', () => {
      const nullTopic = computeDeterministicSplit(null as any, { posPct: 50, neuPct: 25, negPct: 25, total: 100 });
      expect(nullTopic.posPct + nullTopic.neuPct + nullTopic.negPct).toBe(100);
      expect(Number.isFinite(nullTopic.posPct)).toBe(true);

      const nanBase = computeDeterministicSplit('Performance regression tuning', { posPct: NaN, neuPct: NaN, negPct: NaN, total: NaN } as any, NaN);
      expect(Number.isFinite(nanBase.posPct)).toBe(true);
      expect(Number.isFinite(nanBase.neuPct)).toBe(true);
      expect(Number.isFinite(nanBase.negPct)).toBe(true);
      expect(Number.isFinite(nanBase.total)).toBe(true);
      expect(nanBase.posPct + nanBase.neuPct + nanBase.negPct).toBe(100);
    });

    it('safely resolves cluster keywords across primitive strings, object shapes, and malformed structures', () => {
      expect(resolveKeywords(null)).toEqual([]);
      expect(resolveKeywords(undefined)).toEqual([]);
      expect(resolveKeywords('string-not-object' as any)).toEqual([]);
      expect(resolveKeywords(12345 as any)).toEqual([]);

      const malformedCluster = {
        category: 'Test Category',
        topKeywords: [
          null,
          undefined,
          '',
          '#',
          '#Workflow Engine',
          { keyword: '#Performance Tuning' },
          { name: 'Cloud Sync' },
          { topic: 'Subscription Tiers' },
          { title: 'API Latency' },
          { label: 'Export Pipeline' }
        ]
      };

      const resolved = resolveKeywords(malformedCluster, null as any);
      expect(resolved).toEqual([
        'Workflow Engine',
        'Performance Tuning',
        'Cloud Sync',
        'Subscription Tiers',
        'API Latency',
        'Export Pipeline'
      ]);
    });

    it('handles sparse, malformed cluster arrays and non-standard comment sentiment cases', () => {
      const sparseClusters = [
        null,
        undefined,
        {},
        { category: 'Sparse Cat', sentimentBreakdown: null }
      ];

      const multiFormatComments = [
        null,
        undefined,
        {},
        { sentiment: 'Positive', keywords: ['#Sparse Cat'], rawText: 'Capitalized Positive!' },
        { sentiment: 'NEGATIVE', keywords: ['#Sparse Cat'], text: 'All caps negative' },
        { sentiment: 'critical', keywords: ['#Sparse Cat'], comment: 'Alternative critical tag' }
      ];

      const { result } = renderHook(() => useTaxonomyMetrics(sparseClusters, multiFormatComments));
      expect(result.current.globalTotals).toBeDefined();
      expect(result.current.globalSplit).toBeDefined();

      const split = result.current.getTopicSplit('Sparse Cat');
      expect(split.posPct + split.neuPct + split.negPct).toBe(100);
      expect(split.total).toBeGreaterThanOrEqual(1);
    });

    it('handles unknown domain queries gracefully without throwing', () => {
      const { result } = renderHook(() => useTaxonomyMetrics(null, null));
      const unknown = result.current.getDomainSplit(null as any);
      expect(unknown.total).toBe(0);
      expect(unknown.posPct + unknown.neuPct + unknown.negPct).toBe(100);
    });
  });

  describe('Vector Charlie: SentimentGradientBar Visual Transparency & Clamping', () => {
    it('renders transparent background when total sentiment values are zero to prevent false negative red bars', () => {
      render(
        <SentimentGradientBar posPct={0} neuPct={0} negPct={0} data-testid="zero-bar" />
      );

      const bar = screen.getByTestId('zero-bar');
      expect(bar.style.background).toBe('transparent');
      expect(bar.getAttribute('aria-label')).toContain('0% Working Well, 0% Neutral, 0% Needs Attention');
    });

    it('sanitizes NaN and out-of-bound percentages cleanly', () => {
      render(
        <SentimentGradientBar posPct={NaN} neuPct={undefined as any} negPct={null as any} data-testid="nan-bar" />
      );

      const bar = screen.getByTestId('nan-bar');
      expect(bar.getAttribute('aria-valuenow')).toBe('0');
      expect(bar.style.getPropertyValue('--pos-end')).toBe('0%');
      expect(bar.style.getPropertyValue('--neu-end')).toBe('0%');
      expect(bar.style.background).toBe('transparent');
    });

    it('clamps negative and excessive percentage values', () => {
      render(
        <SentimentGradientBar posPct={-25} neuPct={150} negPct={-10} data-testid="clamped-bar" />
      );

      const bar = screen.getByTestId('clamped-bar');
      expect(bar.getAttribute('aria-valuenow')).toBe('0');
      expect(bar.style.getPropertyValue('--pos-end')).toBe('0%');
      expect(bar.style.getPropertyValue('--neu-end')).toBe('100%');
      expect(bar.style.background).toContain('linear-gradient');
    });
  });

  describe('Vector Alpha: TaxonomyDomainGrid Host Diagnostics & A11y', () => {
    it('renders a diagnostic empty state when clusters is an empty array', () => {
      render(<TaxonomyDomainGrid clusters={[]} />);
      expect(screen.getByText('No Feature Domains Available')).toBeDefined();
      expect(screen.getByText(/No taxonomy pillars match the current selection/i)).toBeDefined();
      expect(screen.getByText(/🟢 0% Working Well/i)).toBeDefined();
    });

    it('renders clean empty state when clusters is null or undefined (since DEFAULT_FEATURE_CLUSTERS is empty)', () => {
      expect(DEFAULT_FEATURE_CLUSTERS).toEqual([]);
      render(<TaxonomyDomainGrid clusters={null as any} />);
      expect(screen.getByText('No Feature Domains Available')).toBeDefined();
    });

    it('filters out malformed/null cluster entries from rendering broken cards', () => {
      const clustersWithCorruptEntries = [
        null,
        undefined,
        {},
        { category: 'Valid Pillar', keywordCount: 10, topKeywords: ['Pillar Topic'], sentimentBreakdown: { positive: 5, negative: 3, neutral: 2 } }
      ];

      render(<TaxonomyDomainGrid clusters={clustersWithCorruptEntries} />);
      expect(screen.getByText('10 Topics')).toBeDefined();
      expect(screen.getByText('Valid Pillar')).toBeDefined();
    });

    it('supports keyboard accessibility (Enter/Space) on domain headers', () => {
      const handleSelect = vi.fn();
      render(
        <TaxonomyDomainGrid
          clusters={[{ category: 'Accessibility Test', keywordCount: 2, topKeywords: ['A11y Topic'], sentimentBreakdown: { positive: 10, negative: 2, neutral: 1 } }]}
          onSelectTopic={handleSelect}
        />
      );

      const headerButton = screen.getByRole('button', { name: /Accessibility Test/i });
      fireEvent.keyDown(headerButton, { key: 'Enter', code: 'Enter' });
      expect(handleSelect).toHaveBeenCalledWith('Accessibility Test');

      fireEvent.keyDown(headerButton, { key: ' ', code: 'Space' });
      expect(handleSelect).toHaveBeenCalledWith('Accessibility Test');
    });

    it('displays diagnostic placeholder when a feature domain has zero keywords', () => {
      const clusterWithNoKeywords = [
        { category: 'Empty Pillar', keywordCount: 0, topKeywords: [], sentimentBreakdown: { positive: 0, negative: 0, neutral: 0 } }
      ];

      render(<TaxonomyDomainGrid clusters={clusterWithNoKeywords} />);
      expect(screen.getByText('No subtopics available')).toBeDefined();
    });

    it('does not falsely highlight categories or topic pills when selectedTopic is empty string or null', () => {
      const sampleClusters = [
        { category: 'Core Product Experience', keywordCount: 2, topKeywords: ['Workflow Speed', 'API Uptime'], sentimentBreakdown: { positive: 12, negative: 2, neutral: 4 } }
      ];
      const { container } = render(
        <TaxonomyDomainGrid
          clusters={sampleClusters}
          selectedTopic={null}
        />
      );

      expect(container.querySelectorAll('.ring-1').length).toBe(0);
    });
  });
});
