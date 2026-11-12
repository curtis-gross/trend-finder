/** @vitest-environment jsdom */
import { describe, it, expect } from 'vitest';
import React from 'react';
import { render, screen } from '@testing-library/react';
import { SentimentGradientBar } from '../SentimentGradientBar';

describe('SentimentGradientBar (Vector Charlie)', () => {
  it('renders a single progressbar element with default properties', () => {
    const { container } = render(
      <SentimentGradientBar posPct={60} neuPct={25} negPct={15} />
    );

    const progressBar = screen.getByRole('progressbar');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('aria-valuenow')).toBe('60');
    expect(progressBar.getAttribute('aria-valuemin')).toBe('0');
    expect(progressBar.getAttribute('aria-valuemax')).toBe('100');
    expect(progressBar.getAttribute('aria-label')).toBe('60% Working Well, 25% Neutral, 15% Needs Attention');
    expect(progressBar.getAttribute('title')).toBe('60% Working Well • 25% Neutral • 15% Needs Attention');

    // Verify it is a single DOM node with no nested children when showInlineNumbers is false
    expect(progressBar.children.length).toBe(0);
    expect(container.firstChild).toBe(progressBar);
  });

  it('sets CSS custom properties for gradient stops', () => {
    render(
      <SentimentGradientBar posPct={45} neuPct={35} negPct={20} data-testid="gradient-bar" />
    );

    const progressBar = screen.getByTestId('gradient-bar');
    expect(progressBar.style.getPropertyValue('--pos-end')).toBe('45%');
    expect(progressBar.style.getPropertyValue('--neu-end')).toBe('80%');
    expect(progressBar.style.background).toContain('linear-gradient');
    expect(progressBar.style.background.toLowerCase()).toMatch(/#38bdf8|rgb\(56,\s*189,\s*248\)/);
    expect(progressBar.style.background.toLowerCase()).toMatch(/#facc15|rgb\(250,\s*204,\s*21\)/);
  });

  it('allows custom ariaLabel and title overrides', () => {
    render(
      <SentimentGradientBar
        posPct={70}
        neuPct={20}
        negPct={10}
        ariaLabel="Product Sentiment Split"
        title="Custom Product Tooltip"
      />
    );

    const progressBar = screen.getByLabelText('Product Sentiment Split');
    expect(progressBar).toBeDefined();
    expect(progressBar.getAttribute('title')).toBe('Custom Product Tooltip');
  });

  it('applies default height h-1.5 and respects custom heightClassName and className', () => {
    render(
      <SentimentGradientBar
        posPct={50}
        neuPct={30}
        negPct={20}
        heightClassName="h-3"
        className="shadow-sm"
        data-testid="styled-bar"
      />
    );

    const progressBar = screen.getByTestId('styled-bar');
    expect(progressBar.className).toContain('h-3');
    expect(progressBar.className).toContain('shadow-sm');
    expect(progressBar.className).toContain('rounded-full');
    expect(progressBar.className).toContain('w-full');
  });
});
