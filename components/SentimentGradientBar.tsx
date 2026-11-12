import React from 'react';

export interface SentimentGradientBarProps extends React.HTMLAttributes<HTMLDivElement> {
  posPct: number;
  neuPct: number;
  negPct: number;
  posCount?: number;
  neuCount?: number;
  negCount?: number;
  showInlineNumbers?: boolean;
  heightClassName?: string; // Default: 'h-1.5' (6px)
  className?: string;
  ariaLabel?: string;
  title?: string;
}

/**
 * SentimentGradientBar (Vector Charlie)
 *
 * Continuous sentiment track.
 * Uses CSS custom properties (--pos-end, --neu-end) and CSS linear-gradient.
 * When showInlineNumbers={true} (e.g. Overall Sentiment Split), renders the
 * Positive / Neutral / Negative numbers directly inside the chart bar.
 *
 * Color Stops:
 * - Positive: #10B981 (Emerald-500)
 * - Neutral:  #38BDF8 (Sky-400)
 * - Negative: #FACC15 (Yellow-400)
 */
export const SentimentGradientBar: React.FC<SentimentGradientBarProps> = ({
  posPct,
  neuPct,
  negPct,
  posCount,
  neuCount,
  negCount,
  showInlineNumbers = false,
  heightClassName = 'h-1.5',
  className = '',
  ariaLabel,
  title,
  style,
  ...rest
}) => {
  const safePos = Number.isFinite(posPct) ? Math.max(0, Math.min(100, Math.round(posPct))) : 0;
  const safeNeu = Number.isFinite(neuPct) ? Math.max(0, Math.min(100, Math.round(neuPct))) : 0;
  const safeNeg = Number.isFinite(negPct) ? Math.max(0, Math.min(100, Math.round(negPct))) : 0;
  const hasData = (safePos + safeNeu + safeNeg) > 0;

  const posEnd = `${safePos}%`;
  const neuEnd = `${Math.min(100, safePos + safeNeu)}%`;

  const defaultLabel = hasData
    ? `${safePos}% Working Well, ${safeNeu}% Neutral, ${safeNeg}% Needs Attention`
    : '0% Working Well, 0% Neutral, 0% Needs Attention';
  const defaultTitle = hasData
    ? `${safePos}% Working Well • ${safeNeu}% Neutral • ${safeNeg}% Needs Attention`
    : '0% Working Well • 0% Neutral • 0% Needs Attention';

  const backgroundStyle = hasData
    ? 'linear-gradient(to right, #10B981 0% var(--pos-end), #38BDF8 var(--pos-end) var(--neu-end), #FACC15 var(--neu-end) 100%)'
    : 'transparent';

  if (showInlineNumbers) {
    return (
      <div
        role="progressbar"
        aria-valuenow={safePos}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={ariaLabel || defaultLabel}
        title={title || defaultTitle}
        className={`relative flex items-center justify-between px-3 w-full rounded-full overflow-hidden bg-slate-200 dark:bg-[#061C36] transition-all duration-300 ${heightClassName} ${className}`.trim()}
        style={{
          '--pos-end': posEnd,
          '--neu-end': neuEnd,
          background: backgroundStyle,
          ...style
        } as React.CSSProperties}
        {...rest}
      >
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black bg-white/95 dark:bg-[#041527]/95 text-emerald-800 dark:text-emerald-300 px-2 py-0.5 rounded-full border border-emerald-200 dark:border-emerald-800/60 shadow-2xs">
          🟢 {safePos}% Working Well{typeof posCount === 'number' ? ` (${posCount.toLocaleString()})` : ''}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black bg-white/95 dark:bg-[#041527]/95 text-sky-800 dark:text-sky-300 px-2 py-0.5 rounded-full border border-sky-200 dark:border-sky-800/60 shadow-2xs">
          🔵 {safeNeu}% Neutral{typeof neuCount === 'number' ? ` (${neuCount.toLocaleString()})` : ''}
        </span>
        <span className="inline-flex items-center gap-1 text-[11px] font-mono font-black bg-white/95 dark:bg-[#041527]/95 text-amber-800 dark:text-amber-300 px-2 py-0.5 rounded-full border border-amber-200 dark:border-amber-800/60 shadow-2xs">
          🟡 {safeNeg}% Needs Attention{typeof negCount === 'number' ? ` (${negCount.toLocaleString()})` : ''}
        </span>
      </div>
    );
  }

  return (
    <div
      role="progressbar"
      aria-valuenow={safePos}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={ariaLabel || defaultLabel}
      title={title || defaultTitle}
      className={`w-full rounded-full overflow-hidden bg-slate-200 dark:bg-[#061C36] transition-all duration-300 ${heightClassName} ${className}`.trim()}
      style={{
        '--pos-end': posEnd,
        '--neu-end': neuEnd,
        background: backgroundStyle,
        ...style
      } as React.CSSProperties}
      {...rest}
    />
  );
};

export default SentimentGradientBar;
