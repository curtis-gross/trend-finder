import React from 'react';
import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Cpu,
  Database,
  Gamepad2,
  ListFilter,
  RefreshCw,
  XCircle,
  Youtube
} from 'lucide-react';
import { useSystemReadiness } from '../context/SystemReadinessContext';
import { StartupIntegrationCheck, SystemReadinessChecks } from '../types';

type CheckTone = 'ready' | 'warning' | 'error';

interface ReadinessChecklistItem {
  id: 'gcs' | 'filterPipeline' | 'steam' | 'youtube' | 'gemini';
  label: string;
  badge: string;
  tone: CheckTone;
  detail: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

interface ReadinessWarningItem {
  id: 'gcs' | 'filterPipeline' | 'youtube' | 'gemini';
  tone: 'warning' | 'error';
  title: string;
  detail: string;
}

const STEAM_READY_LABEL = 'Steam Store API • Free Public Endpoint (No Key Required)';

function isCheckConfigured(check?: StartupIntegrationCheck): boolean {
  if (!check) return true;
  if (check.configured !== undefined) return check.configured;
  return check.status === 'success';
}

function evaluateReadiness(checks: SystemReadinessChecks | null) {
  const warnings: ReadinessWarningItem[] = [];
  const gcs = checks?.gcs;
  const gcsDisconnected = Boolean(
    gcs &&
      (gcs.connected === false ||
        gcs.status === 'error' ||
        (gcs.status === 'warning' && gcs.connected !== true && gcs.hasContent === undefined))
  );
  const gcsEmpty = Boolean(gcs && !gcsDisconnected && gcs.hasContent === false);

  if (gcsDisconnected && gcs) {
    warnings.push({
      id: 'gcs',
      tone: 'error',
      title: 'GCS Not Connected',
      detail: `${gcs.message} Set GCS_BUCKET_NAME in .env and configure ADC (gcloud auth application-default login or GOOGLE_APPLICATION_CREDENTIALS).`
    });
  } else if (gcsEmpty && gcs) {
    warnings.push({
      id: 'gcs',
      tone: 'warning',
      title: 'No GCS Snapshots Saved Yet',
      detail: `${gcs.message || 'GCS bucket has no saved pipeline snapshots yet.'} Connect GCS or run Filter Pipeline to save topic checkpoints.`
    });
  }

  const filterPipeline = checks?.filterPipeline;
  const pipelineEmpty = Boolean(
    filterPipeline &&
      (filterPipeline.hasItems === false ||
        (filterPipeline.hasItems === undefined &&
          (filterPipeline.itemCount === 0 || filterPipeline.status !== 'success')))
  );
  if (pipelineEmpty && filterPipeline) {
    warnings.push({
      id: 'filterPipeline',
      tone: 'warning',
      title: 'Filter Pipeline Has 0 Sources',
      detail:
        filterPipeline.message ||
        'Add YouTube, Steam, Reddit, or web sources in Filter Pipeline (1: Listen) to begin harvesting.'
    });
  }

  const youtube = checks?.youtube;
  const youtubeMissing = Boolean(youtube && !isCheckConfigured(youtube));
  if (youtubeMissing && youtube) {
    warnings.push({
      id: 'youtube',
      tone: 'warning',
      title: 'YouTube API Key Not Found',
      detail: `${youtube.message || 'YOUTUBE_API_KEY is missing in .env.'} Add YOUTUBE_API_KEY in .env to harvest YouTube videos and comments.`
    });
  }

  const gemini = checks?.gemini;
  const geminiMissing = Boolean(gemini && !isCheckConfigured(gemini));
  if (geminiMissing && gemini) {
    warnings.push({
      id: 'gemini',
      tone: gemini.status === 'error' ? 'error' : 'warning',
      title: 'Gemini / Vertex AI Not Configured',
      detail: `${gemini.message || 'Gemini / Vertex AI credentials not found.'} Set GOOGLE_CLOUD_API_KEY or GOOGLE_CLOUD_PROJECT in .env.`
    });
  }

  const steamReady = checks?.steam?.status !== 'error';

  const checklist: ReadinessChecklistItem[] = [
    {
      id: 'gcs',
      label: 'Google Cloud Storage',
      badge: !gcs ? 'Pending' : gcsDisconnected ? 'Disconnected' : gcsEmpty ? 'No Snapshots' : 'Connected',
      tone: !gcs ? 'warning' : gcsDisconnected ? 'error' : gcsEmpty ? 'warning' : 'ready',
      detail: !gcs
        ? 'Checking GCS bucket connectivity and workspace snapshots.'
        : gcsDisconnected
          ? `${gcs.message} Set GCS_BUCKET_NAME in .env and run gcloud auth application-default login (or set GOOGLE_APPLICATION_CREDENTIALS).`
          : gcsEmpty
            ? `${gcs.message || 'Connected to GCS bucket, but no saved snapshots exist yet.'} Run Filter Pipeline to persist topic data.`
            : gcs.message,
      icon: Database
    },
    {
      id: 'filterPipeline',
      label: 'Filter Pipeline (1: Listen)',
      badge: !filterPipeline
        ? 'Pending'
        : pipelineEmpty
          ? '0 Items'
          : `${filterPipeline.itemCount ?? 'Ready'} Items`,
      tone: !filterPipeline ? 'warning' : pipelineEmpty ? 'warning' : 'ready',
      detail: !filterPipeline
        ? 'Checking saved Listen table sources.'
        : pipelineEmpty
          ? 'Filter Pipeline has 0 sources. Open Filter Pipeline 1: Listen to add YouTube, Steam, Reddit, or web sources.'
          : filterPipeline.message,
      icon: ListFilter
    },
    {
      id: 'steam',
      label: 'Steam Store API',
      badge: steamReady ? 'Ready • Free' : 'Error',
      tone: steamReady ? 'ready' : 'error',
      detail: checks?.steam?.message ? `${STEAM_READY_LABEL} — ${checks.steam.message}` : STEAM_READY_LABEL,
      icon: Gamepad2
    },
    {
      id: 'youtube',
      label: 'YouTube Data API',
      badge: !youtube ? 'Pending' : youtubeMissing ? 'Key Missing' : 'Connected',
      tone: !youtube ? 'warning' : youtubeMissing ? 'warning' : 'ready',
      detail: !youtube
        ? 'Checking YOUTUBE_API_KEY in .env.'
        : youtubeMissing
          ? 'YOUTUBE_API_KEY is missing in .env. Add it to harvest YouTube videos, or harvest Steam and Reddit without a YouTube key.'
          : youtube.message,
      icon: Youtube
    },
    {
      id: 'gemini',
      label: 'Gemini / Vertex AI',
      badge: !gemini ? 'Pending' : geminiMissing ? 'Not Configured' : 'Connected',
      tone: !gemini ? 'warning' : geminiMissing ? 'error' : 'ready',
      detail: !gemini
        ? 'Checking Vertex AI project and Gemini API key.'
        : geminiMissing
          ? `${gemini.message || 'Gemini / Vertex AI not configured.'} Set GOOGLE_CLOUD_API_KEY or GOOGLE_CLOUD_PROJECT in .env.`
          : gemini.message,
      icon: Cpu
    }
  ];

  return {
    warnings,
    checklist,
    gcsDisconnected,
    gcsEmpty,
    pipelineEmpty,
    youtubeMissing,
    geminiMissing
  };
}

function getTonePillClasses(tone: CheckTone): string {
  if (tone === 'ready') {
    return 'bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30';
  }
  if (tone === 'error') {
    return 'bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-500/30';
  }
  return 'bg-amber-50 dark:bg-amber-500/15 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-500/30';
}

function getToneIconClasses(tone: CheckTone): string {
  if (tone === 'ready') return 'text-emerald-600 dark:text-emerald-400';
  if (tone === 'error') return 'text-rose-600 dark:text-rose-400';
  return 'text-amber-600 dark:text-amber-400';
}

const ToneIcon: React.FC<{ tone: CheckTone; size?: number }> = ({ tone, size = 14 }) => {
  if (tone === 'ready') return <CheckCircle2 size={size} className={getToneIconClasses(tone)} />;
  if (tone === 'error') return <XCircle size={size} className={getToneIconClasses(tone)} />;
  return <AlertTriangle size={size} className={getToneIconClasses(tone)} />;
};

const ActionButtonsRow: React.FC<{
  onNavigateToPipeline: () => void;
  onRefresh: () => void;
  isLoading: boolean;
}> = ({ onNavigateToPipeline, onRefresh, isLoading }) => (
  <div className="flex flex-row items-center gap-2 shrink-0 flex-nowrap overflow-x-auto max-w-full">
    <button
      type="button"
      onClick={onNavigateToPipeline}
      className="px-3 py-1.5 rounded-xl bg-[#0072BC] hover:bg-[#0284C7] text-white keep-white-text border border-[#0072BC] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 shadow-xs transition-colors cursor-pointer"
    >
      <span>Open Filter Pipeline</span>
      <ArrowRight size={13} />
    </button>
    <button
      type="button"
      onClick={onRefresh}
      disabled={isLoading}
      className="px-3 py-1.5 rounded-xl bg-[#FFFFFF] dark:bg-[#061C36] hover:bg-slate-50 dark:hover:bg-[#1A222E] text-[var(--app-text)] dark:text-slate-100 border border-[#E2E8F0] dark:border-[#041E3A] text-xs font-bold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-colors disabled:opacity-50 cursor-pointer"
    >
      <RefreshCw size={12} className={isLoading ? 'animate-spin text-[#0072BC] dark:text-[#38BDF8]' : ''} />
      <span>Refresh Checks</span>
    </button>
  </div>
);

/** Global workspace readiness alert bar rendered above main studio views when attention is needed. */
export const SystemReadinessBanner: React.FC<{ onNavigateToPipeline: () => void }> = ({
  onNavigateToPipeline
}) => {
  const { checks, isLoading, error, refreshReadiness } = useSystemReadiness();
  const { warnings } = evaluateReadiness(checks);

  if (!error && !checks) return null;
  if (!error && warnings.length === 0) return null;

  const hasError = Boolean(error) || warnings.some(w => w.tone === 'error');

  return (
    <div
      role="status"
      data-testid="system-readiness-banner"
      className={`max-w-7xl mx-auto w-full mb-4 rounded-2xl border p-4 shadow-xs bg-[#FFFFFF] dark:bg-[#041527] ${
        hasError
          ? 'border-rose-300 dark:border-rose-500/40'
          : 'border-amber-300 dark:border-amber-500/40'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[#E2E8F0] dark:border-[#041E3A]">
        <div className="flex items-center gap-2.5 min-w-0 flex-wrap">
          <ToneIcon tone={hasError ? 'error' : 'warning'} size={16} />
          <span className="text-xs font-black uppercase tracking-wider text-[var(--app-text)] dark:text-white">
            {error ? 'Startup Readiness Check Failed' : 'Workspace Connection Warnings'}
          </span>
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-semibold border bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-500/30">
            <Gamepad2 size={11} />
            <span>{STEAM_READY_LABEL}</span>
          </span>
        </div>

        <ActionButtonsRow
          onNavigateToPipeline={onNavigateToPipeline}
          onRefresh={() => void refreshReadiness()}
          isLoading={isLoading}
        />
      </div>

      {error ? (
        <div className="mt-3 rounded-xl border border-rose-200 dark:border-rose-500/30 bg-rose-50 dark:bg-rose-500/10 p-3 text-xs text-rose-800 dark:text-rose-200">
          <p className="font-bold">Could not load /api/startup-checks</p>
          <p className="mt-0.5 break-words">{error}</p>
        </div>
      ) : (
        <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-2.5">
          {warnings.map(item => (
            <div
              key={item.id}
              className="rounded-xl border border-[#E2E8F0] dark:border-[#041E3A] bg-slate-50 dark:bg-[#061C36] p-3 flex items-start gap-2.5"
            >
              <span className="mt-0.5 shrink-0">
                <ToneIcon tone={item.tone} size={14} />
              </span>
              <div className="min-w-0 space-y-0.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-bold text-[var(--app-text)] dark:text-white">{item.title}</span>
                  <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border ${getTonePillClasses(item.tone)}`}>
                    {item.tone === 'error' ? 'Action Required' : 'Warning'}
                  </span>
                </div>
                <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">{item.detail}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/** Landing-page executive checklist showing connected services and next setup steps. */
export const LandingSetupReadinessCard: React.FC<{
  onNavigateToPipeline: () => void;
  hasTopicData?: boolean;
}> = ({ onNavigateToPipeline, hasTopicData = false }) => {
  const { checks, isLoading, error, refreshReadiness } = useSystemReadiness();
  const { checklist } = evaluateReadiness(checks);

  return (
    <section
      data-testid="landing-setup-readiness-card"
      className="bg-[#FFFFFF] dark:bg-[#041527] border border-[#E2E8F0] dark:border-[#041E3A] rounded-3xl p-6 shadow-xs space-y-5"
    >
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-4 border-b border-[#E2E8F0] dark:border-[#041E3A]">
        <div className="space-y-1 min-w-0">
          <div className="flex items-center gap-2">
            <Cloud size={17} className="text-[#0072BC] dark:text-[#38BDF8] shrink-0" />
            <h2 className="text-base font-black text-[var(--app-text)] dark:text-white tracking-tight">
              Workspace Setup &amp; Connection Guide
            </h2>
          </div>
          <p className="text-xs text-[var(--app-muted)] dark:text-slate-300">
            {hasTopicData
              ? 'Live integration status for GCS snapshots, channel harvesters, and Gemini.'
              : 'Connect your data sources below and open Filter Pipeline (1: Listen) to populate Trend Intelligence.'}
          </p>
        </div>

        <ActionButtonsRow
          onNavigateToPipeline={onNavigateToPipeline}
          onRefresh={() => void refreshReadiness()}
          isLoading={isLoading}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-2xl border border-rose-300 dark:border-rose-500/40 bg-rose-50 dark:bg-rose-500/10 p-3.5 flex items-start gap-2.5 text-xs text-rose-800 dark:text-rose-200"
        >
          <XCircle size={15} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
          <div className="min-w-0">
            <p className="font-bold">Startup Readiness Probe Error</p>
            <p className="mt-0.5 break-words">{error}</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {checklist.map(item => {
          const Icon = item.icon;
          return (
            <div
              key={item.id}
              data-testid={`readiness-item-${item.id}`}
              className="rounded-2xl border border-[#E2E8F0] dark:border-[#041E3A] bg-slate-50 dark:bg-[#061C36] p-4 flex flex-col justify-between gap-2.5"
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  <Icon size={15} className={`${getToneIconClasses(item.tone)} shrink-0`} />
                  <span className="text-xs font-bold text-[var(--app-text)] dark:text-white truncate">
                    {item.label}
                  </span>
                </div>
                <span
                  className={`px-2 py-0.5 rounded-full text-[10px] font-bold border whitespace-nowrap shrink-0 ${getTonePillClasses(item.tone)}`}
                >
                  {item.badge}
                </span>
              </div>
              <p className="text-xs text-[var(--app-muted)] dark:text-slate-300 leading-relaxed">
                {item.detail}
              </p>
            </div>
          );
        })}
      </div>
    </section>
  );
};
