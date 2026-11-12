export enum AppMode {
  INSIGHTS = 'INSIGHTS',
  FILTER_PIPELINE = 'FILTER_PIPELINE'
}

export type ActivityAction =
  | 'generated'
  | 'saved'
  | 'analyzed'
  | 'created'
  | 'swapped'
  | 'exported';

export interface ActivityEvent {
  id: string;
  timestamp: string;
  mode: string;
  label?: string;
  action: ActivityAction;
  title: string;
  featureId?: string;
  thumbnailUrl?: string;
  meta?: Record<string, any>;
}

export interface StartupIntegrationCheck {
  status: 'success' | 'warning' | 'error';
  message: string;
  connected?: boolean;
  hasContent?: boolean;
  configured?: boolean;
  requiresApiKey?: boolean;
  bucket?: string;
  blobCount?: number;
  hasInsightsTable?: boolean;
  hasPipelineRuns?: boolean;
  hasItems?: boolean;
  itemCount?: number;
  project?: string;
  hasApiKey?: boolean;
  name?: string;
}

export interface SystemReadinessChecks {
  gcs: StartupIntegrationCheck;
  youtube?: StartupIntegrationCheck;
  steam?: StartupIntegrationCheck;
  gemini: StartupIntegrationCheck;
  filterPipeline?: StartupIntegrationCheck;
  company?: StartupIntegrationCheck;
}
