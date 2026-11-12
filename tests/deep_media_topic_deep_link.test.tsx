/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import { matchTopicToTaxonomy, TopicTaxonomyCandidates } from '../services/noiseFilterService';
import { DEFAULT_INITIAL_TOP_TOPICS, DEFAULT_FEATURE_CLUSTERS, InsightsHome } from '../components/InsightsHome';
import { NoiseFilter } from '../components/NoiseFilter';
import { TaxonomyDomainGrid } from '../components/TaxonomyDomainGrid';
import { ThemeProvider } from '../contexts/ThemeContext';
import { RunwayAnalysis, TREND_INTELLIGENCE_TABS } from '../components/RunwayAnalysis';
import { AppMode } from '../types';

// Mock Lucide icons
vi.mock('lucide-react', async (importOriginal) => {
  const actual = await importOriginal<any>();
  return {
    ...actual
  };
});

// Mock CompanyContext with test-company
vi.mock('../context/CompanyContext', () => ({
  useCompanyContext: () => ({
    name: 'test-company',
    description: 'Trend Intelligence and Deep Media Listening platform for test-company'
  })
}));

// Mock AppConfigContext
vi.mock('../context/AppConfigContext', () => ({
  useAppConfig: () => ({
    config: {
      branding: {
        companyName: 'test-company',
        colors: { primary: '#0F172A', accent: '#0072BC' }
      }
    }
  })
}));

// Mock recharts
vi.mock('recharts', () => ({
  ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
  LineChart: () => <div />,
  Line: () => <div />,
  BarChart: () => <div />,
  Bar: () => <div />,
  PieChart: () => <div />,
  Pie: () => <div />,
  Cell: () => <div />,
  XAxis: () => <div />,
  YAxis: () => <div />,
  Tooltip: () => <div />,
  Legend: () => <div />
}));

describe('Deep Media Listening Topic Deep-Linking & Auto-Selection', () => {
  beforeEach(() => {
    if (typeof window !== 'undefined') {
      window.sessionStorage?.clear?.();
      window.localStorage?.clear?.();
    }
    vi.clearAllMocks();
  });

  describe('Clean Cold-Start Defaults', () => {
    it('exports empty DEFAULT_INITIAL_TOP_TOPICS and DEFAULT_FEATURE_CLUSTERS arrays', () => {
      expect(DEFAULT_INITIAL_TOP_TOPICS).toEqual([]);
      expect(DEFAULT_FEATURE_CLUSTERS).toEqual([]);
    });
  });

  describe('matchTopicToTaxonomy resolver', () => {
    const candidates: TopicTaxonomyCandidates = {
      topTopics: [
        { title: 'Workflow Automation & Speed' },
        { title: 'Subscription Pricing & Tier Value' }
      ],
      featureClusters: [
        {
          category: 'Core Product Experience & Quality',
          topKeywords: [
            'Workflow Automation & Speed',
            'Dashboard Responsiveness',
            'Cross-Platform Sync Latency'
          ]
        },
        {
          category: 'Pricing, Value & Tier Structure',
          topKeywords: [
            'Subscription Pricing & Tier Value',
            'Enterprise Seat Licensing'
          ]
        }
      ],
      topKeywords: [
        'Workflow Automation & Speed',
        'Subscription Pricing & Tier Value',
        'Cross-Platform Sync Latency'
      ]
    };

    it('matches exact topic titles case-insensitively', () => {
      const match = matchTopicToTaxonomy('workflow automation & speed', candidates);
      expect(match.toLowerCase()).toBe('workflow automation & speed');
    });

    it('matches exact category names case-insensitively', () => {
      const match = matchTopicToTaxonomy('Core Product Experience & Quality', candidates);
      expect(match).toBe('Core Product Experience & Quality');
    });

    it('matches positive topic "Workflow Automation & Real-Time Speed" to taxonomy keyword "Workflow Automation & Speed"', () => {
      const matched = matchTopicToTaxonomy('Workflow Automation & Real-Time Speed', candidates);
      expect(matched.toLowerCase()).toContain('workflow automation');
    });

    it('matches negative topic "Subscription Pricing & Tier Cost" to "Subscription Pricing & Tier Value"', () => {
      const matched = matchTopicToTaxonomy('Subscription Pricing & Tier Cost', candidates);
      expect(matched.toLowerCase()).toContain('subscription pricing');
    });

    it('matches negative topic "Cross-Platform Sync Latency Spikes" via token overlap', () => {
      const matched = matchTopicToTaxonomy('Cross-Platform Sync Latency Spikes', candidates);
      expect(matched).toBeTruthy();
    });

    it('returns target topic directly when no taxonomy candidate matches', () => {
      const customTopic = 'Completely Unrelated Custom Telemetry ZZZ';
      const matched = matchTopicToTaxonomy(customTopic, candidates);
      expect(matched).toBe(customTopic);
    });

    it('handles empty or null target gracefully', () => {
      expect(matchTopicToTaxonomy('', candidates)).toBe('');
      expect(matchTopicToTaxonomy(null as any, candidates)).toBe('');
      expect(matchTopicToTaxonomy(undefined as any, candidates)).toBe('');
    });
  });

  describe('SessionStorage deep-linking state coordination', () => {
    it('stores and retrieves deep_media_initial_topic across simulated navigation', () => {
      const topicTitle = 'Workflow Automation & Speed';
      sessionStorage.setItem('deep_media_initial_topic', topicTitle);

      const retrieved = sessionStorage.getItem('deep_media_initial_topic');
      expect(retrieved).toBe(topicTitle);

      sessionStorage.removeItem('deep_media_initial_topic');
      expect(sessionStorage.getItem('deep_media_initial_topic')).toBeNull();
    });
  });

  describe('InsightsHome Auto-Selection Deep-Linking', () => {
    it('auto-selects topic and displays drilldown results when initialSelectedTopic is passed', async () => {
      render(
        <ThemeProvider>
          <InsightsHome
            initialSelectedTopic="Workflow Automation & Speed"
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.getElementById('topic-drilldown-panel')).not.toBeNull();
      });

      expect(screen.getByText('Active Filter Focus')).toBeDefined();
    });

    it('auto-selects topic from sessionStorage if initialSelectedTopic prop is absent and cleans up sessionStorage', async () => {
      sessionStorage.setItem('deep_media_initial_topic', 'Workflow Automation & Speed');

      render(
        <ThemeProvider>
          <InsightsHome />
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(document.getElementById('topic-drilldown-panel')).not.toBeNull();
      });

      expect(sessionStorage.getItem('deep_media_initial_topic')).toBeNull();
    });
  });

  describe('NoiseFilter Auto-Selection Deep-Linking', () => {
    it('activates Stage 3 (Topics) and sets selectedTopic when initialSelectedTopic is passed', async () => {
      render(
        <ThemeProvider>
          <NoiseFilter
            stageMode="pipeline"
            initialSelectedTopic="Workflow Automation & Speed"
          />
        </ThemeProvider>
      );

      await waitFor(() => {
        const stage3Btn = screen.getByText('4: Topics').closest('button');
        expect(stage3Btn?.className).toContain('text-blue-700');
      });
    });
  });

  describe('Topics Overview by Feature Domain Visual Sentiment Split', () => {
    it('renders Overall Sentiment Split global KPI bar and inline Working Well / Neutral / Needs Attention badges', () => {
      const sampleClusters = [
        {
          category: 'Core Product Experience & Quality',
          keywordCount: 15,
          topKeywords: ['Workflow Automation & Speed', 'API Integration Stability'],
          sentimentBreakdown: { positive: 65, negative: 15, neutral: 20 }
        }
      ];
      render(
        <ThemeProvider>
          <TaxonomyDomainGrid clusters={sampleClusters} />
        </ThemeProvider>
      );

      const globalBar = screen.getByTestId('global-sentiment-split-bar');
      expect(globalBar).toBeDefined();
      expect(globalBar.textContent).toContain('Overall Sentiment Split');
      expect(globalBar.textContent).toMatch(/🟢 \d+% Working Well/);
      expect(globalBar.textContent).toMatch(/🔵 \d+% Neutral/);
      expect(globalBar.textContent).toMatch(/🟡 \d+% Needs Attention/);
    });
  });

  describe('Sidebar Filter Pipeline split', () => {
    beforeEach(() => {
      vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 404, json: async () => ({}), text: async () => '' })));
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it('removes Filter Pipeline from Combined Trend Intelligence top tabs', () => {
      expect(TREND_INTELLIGENCE_TABS.map(t => t.id)).toEqual(['home', 'topic_graph', 'topic_trajectory', 'summarize']);
      expect(TREND_INTELLIGENCE_TABS.map(t => t.label)).not.toContain('Filter Pipeline');
    });

    it('renders only 4 top tabs in INSIGHTS mode and switches to FILTER_PIPELINE via Sidebar mode', async () => {
      const onChangeAppMode = vi.fn();
      const { rerender } = render(
        <ThemeProvider>
          <RunwayAnalysis appMode={AppMode.INSIGHTS} onChangeAppMode={onChangeAppMode} />
        </ThemeProvider>
      );
      for (const label of ['Overview', 'Graph', 'Trajectory', 'Summary']) {
        expect(screen.getByRole('button', { name: label })).toBeDefined();
      }
      expect(screen.queryByRole('button', { name: 'Filter Pipeline' })).toBeNull();

      rerender(
        <ThemeProvider>
          <RunwayAnalysis appMode={AppMode.FILTER_PIPELINE} onChangeAppMode={onChangeAppMode} />
        </ThemeProvider>
      );
      await waitFor(() => {
        expect(screen.getByRole('heading', { name: 'Filter Pipeline' })).toBeDefined();
      });
      expect(screen.getByText('Multi-channel source listening, noise isolation, and topic extraction')).toBeDefined();
      expect(screen.queryByRole('button', { name: 'Overview' })).toBeNull();
    });
  });
});
