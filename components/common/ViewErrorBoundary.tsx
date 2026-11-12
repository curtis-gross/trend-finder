import React from 'react';
import { AlertTriangle, RotateCcw } from 'lucide-react';

export interface ViewErrorBoundaryProps {
  resetKey?: string;
  onReset?: () => void;
  onReturnHome?: () => void;
  children: React.ReactNode;
}

interface ViewErrorBoundaryState {
  error: Error | null;
  componentStack: string;
}

export class ViewErrorBoundary extends React.Component<ViewErrorBoundaryProps, ViewErrorBoundaryState> {
  constructor(props: ViewErrorBoundaryProps) {
    super(props);
    this.state = { error: null, componentStack: '' };
  }

  static getDerivedStateFromError(error: Error): Partial<ViewErrorBoundaryState> {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo): void {
    console.error('[ViewErrorBoundary] Uncaught view render error:', error, info?.componentStack);
    this.setState({ componentStack: info?.componentStack || '' });
  }

  componentDidUpdate(prevProps: ViewErrorBoundaryProps): void {
    if (prevProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null, componentStack: '' });
    }
  }

  handleRetry = (): void => {
    this.setState({ error: null, componentStack: '' });
    this.props.onReset?.();
  };

  handleHome = (): void => {
    this.setState({ error: null, componentStack: '' });
    this.props.onReturnHome?.();
  };

  render() {
    if (this.state.error) {
      const errMsg = this.state.error?.message || String(this.state.error);
      const stackTrace = (this.state.componentStack || this.state.error?.stack || '').trim();
      return (
        <div
          className="bg-white dark:bg-[#020F1D] border border-rose-300 dark:border-rose-900/60 text-rose-950 dark:text-rose-100 rounded-2xl p-6 shadow-lg max-w-4xl mx-auto my-6 space-y-4 animate-fadeIn"
          role="alert"
        >
          <div className="flex items-start gap-3">
            <div className="p-2 rounded-xl bg-rose-50 dark:bg-rose-950/60 border border-rose-200 dark:border-rose-900/60 text-rose-600 dark:text-rose-400 shrink-0">
              <AlertTriangle size={20} />
            </div>
            <div className="space-y-1 min-w-0 flex-1">
              <h2 className="text-base font-black text-rose-950 dark:text-rose-100 tracking-tight">
                Component Render Error
              </h2>
              <p className="text-xs text-rose-800 dark:text-rose-300">
                An unexpected runtime error prevented this view from rendering. Full diagnostic details are shown below and logged to the console.
              </p>
            </div>
          </div>

          <div className="bg-rose-50/70 dark:bg-rose-950/40 border border-rose-200 dark:border-rose-900/60 rounded-xl p-3.5 font-mono text-xs text-rose-800 dark:text-rose-200 font-semibold break-words">
            {errMsg}
          </div>

          {stackTrace && (
            <details className="group" open>
              <summary className="text-[11px] font-bold font-mono text-rose-700 dark:text-rose-300 cursor-pointer select-none mb-1.5">
                Component Stack Trace
              </summary>
              <pre className="bg-slate-50 dark:bg-[#041E3A]/40 border border-rose-200 dark:border-[#041E3A] rounded-xl p-3 text-[11px] font-mono text-rose-900 dark:text-rose-200 overflow-x-auto max-h-56 whitespace-pre-wrap">
                {stackTrace}
              </pre>
            </details>
          )}

          <div className="flex items-center gap-3 pt-1">
            <button
              type="button"
              onClick={this.handleRetry}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-rose-600 text-white text-xs font-bold hover:bg-rose-500 transition-colors cursor-pointer"
            >
              <RotateCcw size={13} /> Retry View
            </button>
            {this.props.onReturnHome && (
              <button
                type="button"
                onClick={this.handleHome}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 dark:bg-[#041E3A] border border-slate-300 dark:border-[#041E3A] text-slate-800 dark:text-slate-100 text-xs font-bold hover:bg-slate-200 dark:hover:bg-[#1A222E] transition-colors cursor-pointer"
              >
                Reset View
              </button>
            )}
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export { ViewErrorBoundary as ErrorBoundary };
export default ViewErrorBoundary;
