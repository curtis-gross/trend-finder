/** @vitest-environment jsdom */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { useState } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import fs from 'fs';
import path from 'path';

const { loadStageDataSpy } = vi.hoisted(() => ({
  loadStageDataSpy: vi.fn()
}));

vi.mock('../services/noiseFilterService', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../services/noiseFilterService')>();
  loadStageDataSpy.mockImplementation((...args: Parameters<typeof actual.loadStageDataFromGCS>) =>
    actual.loadStageDataFromGCS(...args)
  );
  return {
    ...actual,
    loadStageDataFromGCS: (...args: Parameters<typeof actual.loadStageDataFromGCS>) =>
      loadStageDataSpy(...args)
  };
});

import App from '../App';
import { CompanyProvider } from '../context/CompanyContext';
import { SystemReadinessProvider, useSystemReadiness } from '../context/SystemReadinessContext';
import { LandingSetupReadinessCard, SystemReadinessBanner } from '../components/SystemReadinessBanner';
import { InsightsHome } from '../components/InsightsHome';
import { TrendsDualColumnWidget } from '../components/insightsHome/TrendsDualColumnWidget';
import { NoiseFilterShell } from '../components/noiseFilter/NoiseFilterShell';
import { InsightsTable } from '../components/trendIntelligence/listenTable/InsightsTable';
import { ThemeProvider } from '../contexts/ThemeContext';
import { SystemReadinessChecks } from '../types';

const ROOT_DIR = path.resolve(__dirname, '..');

function makeChecks(overrides: Partial<SystemReadinessChecks> = {}): SystemReadinessChecks {
  return {
    gcs: {
      status: 'success',
      connected: true,
      hasContent: true,
      bucket: 'test-bucket',
      blobCount: 4,
      message: 'GCS bucket connected (4 snapshots).'
    },
    filterPipeline: {
      status: 'success',
      hasItems: true,
      itemCount: 3,
      message: '3 sources configured.'
    },
    steam: {
      status: 'success',
      configured: true,
      requiresApiKey: false,
      message: 'Steam Store & Reviews API ready (free public endpoints, no API key required).'
    },
    youtube: {
      status: 'success',
      configured: true,
      message: 'YouTube Data API configured.'
    },
    gemini: {
      status: 'success',
      configured: true,
      hasApiKey: true,
      project: 'demo-proj',
      message: 'Vertex AI / Gemini configured.'
    },
    ...overrides
  };
}

function mockFetchStartupChecks(
  handler: (url: string) => Promise<{ ok: boolean; status: number; statusText?: string; json?: () => Promise<any>; text?: () => Promise<string> }>
) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
    const url = typeof input === 'string' ? input : input.toString();
    return handler(url);
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

const ReadinessProbe: React.FC = () => {
  const { checks, isLoading, error, refreshReadiness } = useSystemReadiness();
  return (
    <div>
      <button type="button" onClick={() => void refreshReadiness('acme-corp')}>
        Switch Company
      </button>
      <span data-testid="probe-loading">{String(isLoading)}</span>
      <span data-testid="probe-error">{error ?? 'none'}</span>
      <span data-testid="probe-gcs">{checks?.gcs?.message ?? 'none'}</span>
    </div>
  );
};

describe('UI Cleanup, System Readiness & Landing Setup', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage?.clear?.();
    window.sessionStorage?.clear?.();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe('SystemReadinessContext', () => {
    it('returns safe default state outside SystemReadinessProvider without throwing', async () => {
      render(<ReadinessProbe />);
      expect(screen.getByTestId('probe-loading').textContent).toBe('false');
      expect(screen.getByTestId('probe-error').textContent).toBe('none');
      expect(screen.getByTestId('probe-gcs').textContent).toBe('none');
    });

    it('fetches /api/startup-checks on mount and company change, and surfaces HTTP failures via error', async () => {
      const fetchMock = mockFetchStartupChecks(async (url) => {
        if (url.includes('/api/load-run/company_context')) {
          return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
        }
        if (url.includes('companyName=acme-corp')) {
          return {
            ok: false,
            status: 502,
            statusText: 'Bad Gateway',
            text: async () => JSON.stringify({ detail: 'Startup probe upstream down' })
          };
        }
        return {
          ok: true,
          status: 200,
          json: async () => ({ success: true, checks: makeChecks() })
        };
      });

      render(
        <CompanyProvider>
          <SystemReadinessProvider>
            <ReadinessProbe />
          </SystemReadinessProvider>
        </CompanyProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('probe-gcs').textContent).toContain('GCS bucket connected');
      });
      expect(fetchMock).toHaveBeenCalledWith(
        '/api/startup-checks?companyName=test-company',
        expect.objectContaining({ cache: 'no-store' })
      );

      fireEvent.click(screen.getByRole('button', { name: 'Switch Company' }));

      await waitFor(() => {
        expect(screen.getByTestId('probe-error').textContent).toContain('Startup probe upstream down');
      });
    });
  });

  describe('SystemReadinessBanner & LandingSetupReadinessCard', () => {
    it('renders explicit warnings for disconnected GCS, empty Filter Pipeline, missing YouTube key, missing Gemini, and shows Steam API as free/ready', async () => {
      const disconnectedChecks = makeChecks({
        gcs: {
          status: 'error',
          connected: false,
          hasContent: false,
          bucket: 'missing-bucket',
          message: 'Bucket missing-bucket not reachable.'
        },
        filterPipeline: {
          status: 'warning',
          hasItems: false,
          itemCount: 0,
          message: 'No sources saved in Filter Pipeline.'
        },
        youtube: {
          status: 'warning',
          configured: false,
          message: 'YOUTUBE_API_KEY is not set.'
        },
        gemini: {
          status: 'warning',
          configured: false,
          hasApiKey: false,
          message: 'Gemini API key not configured.'
        }
      });

      mockFetchStartupChecks(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, checks: disconnectedChecks })
      }));

      const onNavigate = vi.fn();
      render(
        <SystemReadinessProvider>
          <SystemReadinessBanner onNavigateToPipeline={onNavigate} />
          <LandingSetupReadinessCard onNavigateToPipeline={onNavigate} hasTopicData={false} />
        </SystemReadinessProvider>
      );

      await waitFor(() => {
        expect(screen.getAllByText(/GCS Not Connected/i).length).toBeGreaterThan(0);
      });

      expect(screen.getAllByText(/GCS_BUCKET_NAME/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Filter Pipeline Has 0 Sources/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/YOUTUBE_API_KEY/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Gemini \/ Vertex AI Not Configured/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Steam Store API • Free Public Endpoint \(No Key Required\)/i).length).toBe(2);

      const pipelineButtons = screen.getAllByRole('button', { name: /Open Filter Pipeline/i });
      const refreshButtons = screen.getAllByRole('button', { name: /Refresh Checks/i });
      expect(pipelineButtons.length).toBe(2);
      expect(refreshButtons.length).toBe(2);
      expect(pipelineButtons[0].parentElement?.className).toContain('flex-row');
      expect(pipelineButtons[0].className).toContain('whitespace-nowrap');
      expect(refreshButtons[0].className).toContain('whitespace-nowrap');

      fireEvent.click(pipelineButtons[0]);
      expect(onNavigate).toHaveBeenCalledTimes(1);
    });

    it('renders explicit warning when GCS is connected but has no saved snapshots yet', async () => {
      const emptyGcsChecks = makeChecks({
        gcs: {
          status: 'warning',
          connected: true,
          hasContent: false,
          bucket: 'ready-bucket',
          blobCount: 0,
          message: 'Connected to ready-bucket, but 0 runs found.'
        }
      });

      mockFetchStartupChecks(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, checks: emptyGcsChecks })
      }));

      render(
        <SystemReadinessProvider>
          <SystemReadinessBanner onNavigateToPipeline={vi.fn()} />
          <LandingSetupReadinessCard onNavigateToPipeline={vi.fn()} hasTopicData={false} />
        </SystemReadinessProvider>
      );

      await waitFor(() => {
        expect(screen.getByText(/No GCS Snapshots Saved Yet/i)).toBeDefined();
      });
      expect(screen.getByText(/No Snapshots/i)).toBeDefined();
      expect(screen.getAllByText(/Steam Store API • Free Public Endpoint \(No Key Required\)/i).length).toBe(2);
    });

    it('hides SystemReadinessBanner when all integrations pass without error', async () => {
      mockFetchStartupChecks(async () => ({
        ok: true,
        status: 200,
        json: async () => ({ success: true, checks: makeChecks() })
      }));

      render(
        <SystemReadinessProvider>
          <SystemReadinessBanner onNavigateToPipeline={vi.fn()} />
        </SystemReadinessProvider>
      );

      await waitFor(() => {
        expect(global.fetch).toHaveBeenCalled();
      });
      expect(screen.queryByTestId('system-readiness-banner')).toBeNull();
    });
  });

  describe('App Default Sidebar Visibility & Readiness Banner Integration', () => {
    it('renders Navigation sidebar visible (isCollapsed false) and SystemReadinessBanner inside main by default', async () => {
      const warningChecks = makeChecks({
        youtube: { status: 'warning', configured: false, message: 'YOUTUBE_API_KEY missing.' }
      });

      mockFetchStartupChecks(async (url) => {
        if (url.includes('/api/admin/config')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              branding: { companyName: 'test-company', workspaceName: 'test-company', colors: { primary: '#0F172A', accent: '#0072BC' } },
              navigation: [
                { id: 'INSIGHTS', label: 'Trend Intelligence', icon: 'Radar', visible: true },
                { id: 'FILTER_PIPELINE', label: 'Filter Pipeline', icon: 'Filter', visible: true }
              ]
            })
          };
        }
        if (url.includes('/api/startup-checks')) {
          return { ok: true, status: 200, json: async () => ({ success: true, checks: warningChecks }) };
        }
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      });

      const { container } = render(<App />);

      const nav = container.querySelector('nav.nav-sidebar');
      expect(nav).not.toBeNull();
      expect(nav?.className).toContain('w-72');
      expect(nav?.className).not.toContain('collapsed');
      expect(nav?.getAttribute('aria-hidden')).toBeNull();

      await waitFor(() => {
        expect(screen.getByTestId('system-readiness-banner')).toBeDefined();
      });
      expect(screen.getByText(/YouTube API Key Not Found/i)).toBeDefined();
    });
  });

  describe('InsightsHome Landing Setup Card, Hydration Error & TrendsDualColumnWidget', () => {
    it('renders LandingSetupReadinessCard and real hydrationError when GCS hydration fails', async () => {
      loadStageDataSpy.mockRejectedValueOnce(new Error('GCS 503 Service Unavailable'));

      mockFetchStartupChecks(async (url) => {
        if (url.includes('/api/startup-checks')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({
              success: true,
              checks: makeChecks({
                gcs: { status: 'warning', connected: true, hasContent: false, message: 'No GCS snapshots saved.' }
              })
            })
          };
        }
        return { ok: false, status: 404, json: async () => ({}), text: async () => '' };
      });

      render(
        <ThemeProvider>
          <CompanyProvider>
            <SystemReadinessProvider>
              <InsightsHome onNavigateToTab={vi.fn()} />
            </SystemReadinessProvider>
          </CompanyProvider>
        </ThemeProvider>
      );

      await waitFor(() => {
        expect(screen.getByTestId('landing-setup-readiness-card')).toBeDefined();
      });

      expect(screen.getByTestId('topics-hydration-error').textContent).toContain('GCS 503 Service Unavailable');
      expect(screen.getAllByText(/No GCS topic snapshots yet — connect GCS and add sources in Filter Pipeline\./i).length).toBe(2);
    });

    it('distinguishes empty GCS state vs active searchQuery in TrendsDualColumnWidget and keeps Refresh label visible', () => {
      const baseProps = {
        region: 'GLOBAL',
        onRegionChange: vi.fn(),
        timeRange: 'all' as const,
        onTimeRangeChange: vi.fn(),
        onSearchQueryChange: vi.fn(),
        isLoading: false,
        onRefresh: vi.fn(),
        filteredTopTopics: [],
        filteredRisingTopics: [],
        selectedTopic: null,
        onTopicClick: vi.fn()
      };

      const { rerender } = render(
        <TrendsDualColumnWidget {...baseProps} searchQuery="" />
      );

      expect(screen.getAllByText('No GCS topic snapshots yet — connect GCS and add sources in Filter Pipeline.').length).toBe(2);
      expect(screen.queryByText(/matching search criteria/i)).toBeNull();

      const refreshBtn = screen.getByRole('button', { name: /Refresh/i });
      const refreshLabel = refreshBtn.querySelector('span');
      expect(refreshLabel?.className || '').not.toContain('hidden sm:inline');

      rerender(<TrendsDualColumnWidget {...baseProps} searchQuery="battery" />);
      expect(screen.getAllByText(/matching search criteria/i).length).toBe(2);
    });
  });

  describe('NoiseFilterShell & InsightsTable UI Cleanup', () => {
    it('NoiseFilterShell has zero rainbow multi-stop gradient classes (from-red-600, via-rose-600)', () => {
      const shellSource = fs.readFileSync(
        path.join(ROOT_DIR, 'components/noiseFilter/NoiseFilterShell.tsx'),
        'utf8'
      );
      expect(shellSource).not.toContain('from-red-600');
      expect(shellSource).not.toContain('via-rose-600');

      const { container } = render(
        <NoiseFilterShell
          stageMode="pipeline"
          activeStage="listen"
          setActiveStage={vi.fn()}
          isLoading={false}
          isHydratingCheckpoints={false}
          isRunningFullPipeline={false}
          fullPipelineStep={0}
          fullPipelineStepStatus=""
          pipelineError={null}
          setPipelineError={vi.fn()}
          statusMessage=""
          setStatusMessage={vi.fn()}
          confirmingWipe={false}
          hasRawComments={false}
          hasStage2Data={false}
          hasStage3Data={false}
          hasStage4Data={false}
          onRunEntirePipeline={vi.fn()}
          onInitCheckpoints={vi.fn()}
          onWipePipeline={vi.fn()}
          onReloadRawComments={vi.fn()}
          onFilterComments={vi.fn()}
          onConvertToKeywords={vi.fn()}
          onBuildRelationshipGraph={vi.fn()}
          onRebuildTrajectory={vi.fn()}
        />
      );

      expect(container.innerHTML).not.toContain('from-red-600');
      expect(container.innerHTML).not.toContain('via-rose-600');
    });

    it('InsightsTable has zero .content-card wrapper and zero overflow-x-auto table scroll trap', () => {
      const tableSource = fs.readFileSync(
        path.join(ROOT_DIR, 'components/trendIntelligence/listenTable/InsightsTable.tsx'),
        'utf8'
      );
      expect(tableSource).not.toContain('content-card');
      expect(tableSource).not.toMatch(/overflow-x-auto[^>]*>\s*<table/s);

      const InsightsTableHarness: React.FC = () => {
        const [rows, setRows] = useState<any[]>([
          {
            id: 'steam-1',
            type: 'steam_reviews',
            target: 'https://store.steampowered.com/app/570',
            status: 'pending'
          }
        ]);
        return (
          <InsightsTable
            companyName="test-company"
            onViewAnalysis={vi.fn()}
            videoTitles={{}}
            getVideoId={(url) => url}
            fetchVideoTitle={vi.fn(async () => {})}
            rows={rows}
            setRows={setRows}
            isLoadingTable={false}
          />
        );
      };

      const { container } = render(<InsightsTableHarness />);
      expect(container.querySelector('.content-card')).toBeNull();
      const table = container.querySelector('table');
      expect(table).not.toBeNull();
      expect(table?.closest('.overflow-x-auto')).toBeNull();
    });
  });
});
