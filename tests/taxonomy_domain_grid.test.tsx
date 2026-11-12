import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { TaxonomyDomainGrid } from '../components/TaxonomyDomainGrid';

describe('TaxonomyDomainGrid Modernized Layout Suite', () => {
  const sampleClusters = [
    {
      category: 'Long Category Title For Core Product Experience & Platform Reliability',
      keywordCount: 3,
      topKeywords: ['Workflow Automation', 'Dashboard Speed', 'API Reliability'],
      sentimentBreakdown: { positive: 65, negative: 15, neutral: 20 }
    }
  ];

  it('renders category title spanning its own row without truncate and with break-words leading-snug', () => {
    render(<TaxonomyDomainGrid clusters={sampleClusters} />);
    const heading = screen.getByRole('heading', { level: 4, name: /Long Category Title For Core Product Experience & Platform Reliability/i });

    expect(heading).toBeDefined();
    expect(heading.className).toContain('text-sm');
    expect(heading.className).toContain('font-bold');
    expect(heading.className).toContain('break-words');
    expect(heading.className).toContain('leading-snug');
    expect(heading.className).not.toContain('truncate');
  });

  it('renders Topics badge and All button on dedicated sub-row below category title', () => {
    render(<TaxonomyDomainGrid clusters={sampleClusters} />);

    const topicsBadge = screen.getByText('3 Topics');
    expect(topicsBadge).toBeDefined();

    const allButton = screen.getByRole('button', { name: /^All \(/ });
    expect(allButton).toBeDefined();

    const subRow = topicsBadge.closest('.flex.items-center.justify-between');
    expect(subRow).not.toBeNull();
    expect(subRow?.contains(allButton)).toBe(true);
  });

  it('renders category-level SentimentGradientBar and inline global summary metrics', () => {
    render(<TaxonomyDomainGrid clusters={sampleClusters} />);

    const posMetrics = screen.getAllByText(/🟢 \d+% Working Well/);
    const neuMetrics = screen.getAllByText(/🔵 \d+% Neutral/);
    const negMetrics = screen.getAllByText(/🟡 \d+% Needs Attention/);

    expect(posMetrics.length).toBeGreaterThanOrEqual(1);
    expect(neuMetrics.length).toBeGreaterThanOrEqual(1);
    expect(negMetrics.length).toBeGreaterThanOrEqual(1);
  });

  it('renders topic card with SentimentGradientBar progressbar and descriptive tooltip', () => {
    render(<TaxonomyDomainGrid clusters={sampleClusters} />);

    const topicSpan = screen.getByText('#Workflow Automation');
    expect(topicSpan).toBeDefined();

    const topicButton = topicSpan.closest('button');
    expect(topicButton).not.toBeNull();
    expect(topicButton?.getAttribute('title')).toMatch(/Inspect "Workflow Automation"/);

    const progressBar = topicButton?.querySelector('[role="progressbar"]');
    expect(progressBar).not.toBeNull();
  });
});
