import React, { useState, useEffect, useCallback, Suspense } from 'react';
import { ThemeProvider } from './contexts/ThemeContext';
import { brandConfig } from './config';
import { AppMode } from './types';
import { Navigation } from './components/Navigation';
import { AppConfigProvider, useAppConfig } from './context/AppConfigContext';
import { CompanyProvider, useCompanyContext } from './context/CompanyContext';
import { SystemReadinessProvider } from './context/SystemReadinessContext';
import { SystemReadinessBanner } from './components/SystemReadinessBanner';
import { syncStudioUrlParams } from './hooks/useStudioUrlTab';
import { ViewErrorBoundary } from './components/common/ViewErrorBoundary';

function lazyNamed<T extends Record<string, any>, K extends keyof T>(
  loader: () => Promise<T>,
  exportName: K
): React.LazyExoticComponent<T[K]> {
  return React.lazy(async () => {
    const mod = await loader();
    const resolved = mod[exportName] ?? (mod as any).default;
    if (!resolved) {
      throw new Error(`Lazy route module is missing expected export "${String(exportName)}".`);
    }
    return { default: resolved as T[K] };
  });
}

const RunwayAnalysis = lazyNamed(() => import('./components/RunwayAnalysis'), 'RunwayAnalysis');

const SIDEBAR_MODES: readonly AppMode[] = [AppMode.INSIGHTS, AppMode.FILTER_PIPELINE];
const PIPELINE_URL_TABS = ['filter', 'listen'] as const;
type PipelineUrlTab = (typeof PIPELINE_URL_TABS)[number];

/** Clamp any unknown or legacy mode to Trend Intelligence. */
function clampAppMode(raw: unknown): AppMode {
  const id = String(raw ?? '').toUpperCase();
  return (SIDEBAR_MODES as readonly string[]).includes(id) ? (id as AppMode) : AppMode.INSIGHTS;
}

function readUrlPipelineTab(): PipelineUrlTab | undefined {
  if (typeof window === 'undefined') return undefined;
  const tab = new URLSearchParams(window.location.search).get('tab');
  return (PIPELINE_URL_TABS as readonly string[]).includes(tab || '') ? (tab as PipelineUrlTab) : undefined;
}

/** Resolve the first Sidebar mode from `?mode=`, `?tab=filter|listen`, or a pending deep-link topic. */
function resolveInitialAppMode(): AppMode {
  if (typeof window === 'undefined') return AppMode.INSIGHTS;
  const fromUrl = clampAppMode(new URLSearchParams(window.location.search).get('mode'));
  if (fromUrl === AppMode.FILTER_PIPELINE || readUrlPipelineTab()) return AppMode.FILTER_PIPELINE;
  try {
    if (window.sessionStorage.getItem('deep_media_initial_topic')) return AppMode.FILTER_PIPELINE;
  } catch {
    // sessionStorage unavailable
  }
  return AppMode.INSIGHTS;
}

function App() {
  return (
    <ThemeProvider>
      <AppConfigProvider>
        <CompanyProvider>
          <SystemReadinessProvider>
            <ViewErrorBoundary resetKey="app-root">
              <AppContent />
            </ViewErrorBoundary>
          </SystemReadinessProvider>
        </CompanyProvider>
      </AppConfigProvider>
    </ThemeProvider>
  );
}

function AppContent() {
  const [viewResetNonce, setViewResetNonce] = useState(0);
  const [mode, setModeState] = useState<AppMode>(resolveInitialAppMode);
  const [initialPipelineTab] = useState<PipelineUrlTab | undefined>(readUrlPipelineTab);
  const [isMobileMenuOpen, setIsMobileMenuOpenState] = useState<boolean>(false);
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  const { config, isLoading: isConfigLoading } = useAppConfig();
  const { name: contextCompanyName, isLoaded: isCompanyLoaded } = useCompanyContext();

  const syncModeToUrl = useCallback((currentMode: AppMode) => {
    syncStudioUrlParams({ mode: currentMode, tab: null });
  }, []);

  const setMode = useCallback(
    (nextMode: React.SetStateAction<AppMode>) => {
      setModeState(prev => {
        const rawResolved =
          typeof nextMode === 'function'
            ? (nextMode as (prevState: AppMode) => AppMode)(prev)
            : nextMode;
        const resolved = rawResolved ? clampAppMode(rawResolved) : prev;
        syncModeToUrl(resolved);
        return resolved;
      });
    },
    [syncModeToUrl]
  );

  useEffect(() => {
    syncModeToUrl(mode);
  }, [mode, syncModeToUrl]);

  const setIsMobileMenuOpen = useCallback((open: boolean) => {
    setIsMobileMenuOpenState(open);
    if (!open && typeof window !== 'undefined' && window.innerWidth < 768) {
      setIsSidebarCollapsed(true);
    }
  }, []);

  const toggleSidebarCollapse = useCallback(() => {
    setIsSidebarCollapsed(prev => {
      const nextCollapsed = !prev;
      if (nextCollapsed) {
        setIsMobileMenuOpenState(false);
      } else if (typeof window !== 'undefined' && window.innerWidth < 768) {
        setIsMobileMenuOpenState(true);
      }
      return nextCollapsed;
    });
  }, []);

  useEffect(() => {
    if (isConfigLoading || !isCompanyLoaded) return;
    const companyName =
      config?.branding?.companyName ||
      contextCompanyName ||
      brandConfig?.companyName ||
      'test-company';
    const viewTitle = mode === AppMode.FILTER_PIPELINE ? 'Filter Pipeline' : 'Trend Intelligence';
    document.title = `${companyName || 'test-company'} | ${viewTitle}`;
  }, [config, isConfigLoading, isCompanyLoaded, contextCompanyName, mode]);

  const mainLayoutClasses = isSidebarCollapsed
    ? 'pt-14 px-4 pb-4 md:px-8 md:pb-8'
    : !isMobileMenuOpen
      ? 'pt-14 md:pt-6 px-4 pb-4 md:px-8 md:pb-8'
      : 'p-4 md:pt-6 md:px-8 md:pb-8';

  return (
    <div className="app-container font-sans flex min-h-screen w-full relative bg-[#FAF8F5] dark:bg-[#020F1D] text-[#0F172A] dark:text-[#F8F6F0]">
      <Navigation
        currentMode={mode}
        setMode={setMode}
        isMobileMenuOpen={isMobileMenuOpen}
        setIsMobileMenuOpen={setIsMobileMenuOpen}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={toggleSidebarCollapse}
      />

      <main className={`main-content flex-1 min-w-0 w-full ml-0 bg-[#FAF8F5] dark:bg-[#020F1D] text-[#0F172A] dark:text-[#F8F6F0] transition-all duration-300 ${mainLayoutClasses}`}>
        {isConfigLoading || !isCompanyLoaded ? (
          <div className="flex items-center justify-center min-h-[60vh] text-slate-600 dark:text-slate-400 text-sm font-medium gap-3">
            <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-[#041E3A] border-t-[#041E3A] dark:border-t-slate-200 animate-spin" />
            <span>Loading...</span>
          </div>
        ) : (
          <ViewErrorBoundary
            key={`${viewResetNonce}`}
            resetKey={`${mode}-${viewResetNonce}`}
            onReset={() => setViewResetNonce(n => n + 1)}
          >
            <SystemReadinessBanner onNavigateToPipeline={() => setMode(AppMode.FILTER_PIPELINE)} />
            <Suspense
              fallback={
                <div className="flex items-center justify-center min-h-[60vh] text-slate-600 dark:text-slate-400 text-sm font-medium gap-3">
                  <div className="w-4 h-4 rounded-full border-2 border-slate-300 dark:border-[#041E3A] border-t-[#041E3A] dark:border-t-slate-200 animate-spin" />
                  <span>Loading studio module...</span>
                </div>
              }
            >
              <RunwayAnalysis appMode={mode} onChangeAppMode={setMode} initialTab={initialPipelineTab} />
            </Suspense>
          </ViewErrorBoundary>
        )}
      </main>
    </div>
  );
}

export default App;
