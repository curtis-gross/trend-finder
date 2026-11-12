import React from 'react';
import { ExternalLink, Eye, Sparkles, Trash2 } from 'lucide-react';

interface RowContentPreviewColumnProps {
    row: any;
    firstVidRaw: string;
    videoId: string;
    isValidYtId: boolean;
    unembeddableVideos: Record<string, boolean>;
    previewAnalysis: any;
    previewAbcd: any;
    handleAnalyze: (id: string) => void;
    handleDeleteRow: (id: string) => void;
    handleRemoveAbcdFromRow: (row: any) => void;
}

export const RowContentPreviewColumn: React.FC<RowContentPreviewColumnProps> = ({
    row,
    firstVidRaw,
    videoId,
    isValidYtId,
    unembeddableVideos,
    previewAnalysis,
    previewAbcd,
    handleAnalyze,
    handleDeleteRow,
    handleRemoveAbcdFromRow
}) => {
    const summaryObj = previewAnalysis || row.result || row.preloadedResult || null;

    return (
        <div className="lg:col-span-6 space-y-4">
            <div className="flex items-center justify-between">
                <h5 className="text-xs font-black uppercase tracking-wider text-[var(--app-muted)] font-mono flex items-center gap-1.5">
                    <Eye size={14} className="text-indigo-600" />
                    <span>Content Preview</span>
                </h5>
                {firstVidRaw && (
                    <a
                        href={
                            firstVidRaw.startsWith('http')
                                ? firstVidRaw
                                : isValidYtId
                                ? `https://www.youtube.com/watch?v=${videoId}`
                                : `https://www.reddit.com/${firstVidRaw.replace(/^\/+/, '')}`
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="text-[11px] font-mono font-bold text-indigo-600 hover:text-indigo-800 inline-flex items-center gap-1"
                    >
                        <ExternalLink size={11} />
                        <span>Open Source URL</span>
                    </a>
                )}
            </div>

            {isValidYtId && (
                unembeddableVideos[videoId] ? (
                    <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[var(--app-border)] bg-slate-950 flex flex-col justify-between p-6 shadow-xs group">
                        <img
                            src={`https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`}
                            alt="Video Thumbnail"
                            className="absolute inset-0 w-full h-full object-cover opacity-35 filter blur-[1px] group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />

                        <div className="relative z-10 flex items-center justify-between">
                            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                                <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                Creator disabled external iframe embedding
                            </span>
                        </div>

                        <div className="relative z-10 space-y-3">
                            <p className="text-xs text-slate-300 font-medium">
                                Full comments &amp; sentiment analysis are available below.
                            </p>
                            <div>
                                <a
                                    href={`https://www.youtube.com/watch?v=${videoId}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#041E3A] hover:bg-[#072B54] text-white keep-white-text border border-white/20 shadow-md transition-all hover:scale-105 cursor-pointer"
                                >
                                    <span>Watch on YouTube</span>
                                    <ExternalLink size={13} />
                                </a>
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[var(--app-border)] bg-slate-900 shadow-xs">
                        <iframe
                            src={`https://www.youtube.com/embed/${videoId}`}
                            title={row.title || videoId}
                            className="w-full h-full"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )
            )}

            {row.type === 'reddit' && (
                <div className="p-4 rounded-2xl bg-orange-50/60 border border-orange-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-orange-600 text-white">
                            {row.subreddit || previewAnalysis?.subreddit || 'Reddit'}
                        </span>
                        {typeof previewAnalysis?.sentiment_score === 'number' && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Sentiment Score: {previewAnalysis.sentiment_score}/100
                            </span>
                        )}
                    </div>
                    {(previewAnalysis?.summary || row.overallSummary) && (
                        <p className="text-xs text-[var(--app-text)] leading-relaxed">
                            {previewAnalysis?.summary || row.overallSummary}
                        </p>
                    )}
                    {Array.isArray(previewAnalysis?.debates) && previewAnalysis.debates.length > 0 && (
                        <div className="pt-2 border-t border-orange-200/70 space-y-1.5">
                            <div className="text-[10px] font-mono font-bold uppercase text-orange-800">
                                Key Community Consensus
                            </div>
                            {previewAnalysis.debates.slice(0, 2).map((d: any, dIdx: number) => (
                                <div key={dIdx} className="text-xs text-[var(--app-muted)] bg-[var(--app-card)] p-2.5 rounded-xl border border-orange-200/80">
                                    <strong className="text-[var(--app-text)]">{d.topic}:</strong> {d.consensus}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {(row.type === 'abcd' || row.type === 'competitor_abcd' || previewAbcd?.abcd_scores || previewAbcd?.scores) && (() => {
                const abcdSource = previewAbcd || previewAnalysis || {};
                const scoresObj = abcdSource.abcd_scores || abcdSource.scores;
                if (!scoresObj) {
                    return (
                        <div className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] text-xs text-[var(--app-muted)] flex items-center justify-between">
                            <span>ABCD evaluation has not been run on this video yet.</span>
                            <button
                                type="button"
                                onClick={() => handleAnalyze(row.id)}
                                className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#041E3A] text-white keep-white-text hover:bg-[#072B54] cursor-pointer"
                            >
                                Run ABCD Now
                            </button>
                        </div>
                    );
                }
                return (
                    <div className="p-4 rounded-2xl bg-violet-50/50 border border-violet-200 space-y-3">
                        <div className="flex items-center justify-between flex-wrap gap-2">
                            <span className="text-xs font-black uppercase font-mono text-violet-800 flex items-center gap-1.5">
                                <Sparkles size={13} className="text-violet-600" />
                                <span>Google ABCD 4-Pillar Scorecard</span>
                            </span>
                            <button
                                type="button"
                                onClick={() => row.type === 'abcd' ? handleDeleteRow(row.id) : handleRemoveAbcdFromRow(row)}
                                className="px-2.5 py-1 rounded-lg text-[11px] font-bold bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 transition inline-flex items-center gap-1 cursor-pointer"
                            >
                                <Trash2 size={11} />
                                <span>Remove ABCD Analysis</span>
                            </button>
                        </div>
                        <div className="grid grid-cols-2 gap-2.5">
                            {(['attract', 'brand', 'connect', 'direct'] as const).map(pillar => {
                                const pData = scoresObj?.[pillar] || {};
                                const rawScore = pData && typeof pData === 'object' ? pData.score : pData;
                                const pScore =
                                    typeof rawScore === 'number' && !Number.isNaN(rawScore)
                                        ? rawScore
                                        : (typeof rawScore === 'string' && rawScore.trim() !== '' && !Number.isNaN(Number(rawScore))
                                            ? Number(rawScore)
                                            : null);
                                const pObs = typeof pData?.observation === 'string' ? pData.observation : '';
                                return (
                                    <div key={pillar} className="p-2.5 rounded-xl bg-[var(--app-card)] border border-violet-200/80 space-y-1">
                                        <div className="flex items-center justify-between">
                                            <span className="text-[11px] font-black uppercase font-mono text-[var(--app-text)]">{pillar}</span>
                                            <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-violet-100 text-violet-800">
                                                {pScore !== null ? `${pScore}/10` : '—'}
                                            </span>
                                        </div>
                                        {pObs && <p className="text-[11px] text-[var(--app-muted)] leading-snug">{pObs}</p>}
                                    </div>
                                );
                            })}
                        </div>
                        {abcdSource.summary && (
                            <p className="text-xs text-[var(--app-muted)] bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] leading-relaxed">
                                <strong className="text-[var(--app-text)]">Executive Summary:</strong> {abcdSource.summary}
                            </p>
                        )}
                    </div>
                );
            })()}

            {row.type !== 'reddit' && row.type !== 'abcd' && previewAnalysis?.summary && (
                <div className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] space-y-2">
                    <div className="flex items-center justify-between">
                        <span className="text-[11px] font-mono font-bold uppercase text-[var(--app-muted)]">
                            Analysis Summary
                        </span>
                        {(typeof previewAnalysis.overallScorePercent === 'number' || typeof previewAnalysis.sentiment_score === 'number') && (
                            <span className="px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                                Score: {previewAnalysis.overallScorePercent ?? previewAnalysis.sentiment_score}%
                            </span>
                        )}
                    </div>
                    <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                        {previewAnalysis.summary}
                    </p>
                    {summaryObj?.why_it_matters && (
                        <p className="text-xs text-[var(--app-muted)] leading-relaxed break-words">{summaryObj.why_it_matters}</p>
                    )}
                </div>
            )}
        </div>
    );
};
