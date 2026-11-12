import React from 'react';
import { GitCompare, Layers, Sparkles, Target, ThumbsDown, ThumbsUp } from 'lucide-react';

interface MetacriticThemesAndDivergenceProps {
    rich: any;
    criticReviews: any[];
    userReviews: any[];
}

export const MetacriticThemesAndDivergence: React.FC<MetacriticThemesAndDivergenceProps> = ({
    rich,
    criticReviews,
    userReviews
}) => {
    return (
        <>
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                <div className="lg:col-span-7 bg-[var(--app-card)] p-6 md:p-8 rounded-3xl border border-[var(--app-border)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <Sparkles size={16} /> Executive Reception &amp; Sentiment Synthesis
                        </h3>
                        <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-muted)]">
                            {criticReviews.length} Critic + {userReviews.length} Community Corpus
                        </span>
                    </div>
                    <div className="space-y-3.5 text-sm text-[var(--app-text)] leading-relaxed whitespace-pre-line">
                        {rich.executiveSummary}
                    </div>
                </div>

                <div className="lg:col-span-5 bg-[var(--app-card)] p-6 md:p-8 rounded-3xl border border-[var(--app-border)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <GitCompare size={16} /> Critic vs. User Score Divergence
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-700/50 text-rose-700 text-[10px] font-black">
                            {rich.scoreDivergence?.gapPoints || 0} pt Spread
                        </span>
                    </div>
                    <p className="text-xs font-bold text-[var(--app-text)]">{rich.scoreDivergence?.headline}</p>

                    <div className="space-y-3">
                        <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-emerald-600">
                                Professional Critic Lens ({rich.metascore}/100 • {criticReviews.length} Reviews)
                            </div>
                            <p className="text-xs text-[var(--app-muted)] leading-relaxed">{rich.scoreDivergence?.criticPerspective}</p>
                        </div>
                        <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 space-y-1">
                            <div className="text-[10px] font-black uppercase tracking-wider text-rose-600">
                                User Community Lens ({rich.userScore}/10 • {userReviews.length} Reviews)
                            </div>
                            <p className="text-xs text-[var(--app-muted)] leading-relaxed">{rich.scoreDivergence?.playerPerspective}</p>
                        </div>
                    </div>

                    {Array.isArray(rich.scoreDivergence?.rootCauses) && (
                        <div className="space-y-1.5 pt-1">
                            <div className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)]">Primary Divergence Drivers:</div>
                            <ul className="space-y-1">
                                {rich.scoreDivergence.rootCauses.map((cause: string, idx: number) => (
                                    <li key={idx} className="text-xs text-[var(--app-muted)] flex items-start gap-2">
                                        <span className="text-amber-600 font-black">•</span>
                                        <span>{cause}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <div className="bg-[var(--app-card)] p-6 md:p-7 rounded-3xl border border-emerald-900/40 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <ThumbsUp size={16} /> Top Praised Strengths (Pros)
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-700/50 text-emerald-700 text-[10px] font-bold">
                            Critic &amp; Community Consensus
                        </span>
                    </div>
                    <div className="space-y-3">
                        {(rich.topPraises || []).map((item: any, idx: number) => {
                            const praiseScore = item.score ?? item.criticAvgScore ?? item.userAvgScore;
                            const praiseQuote = item.quote || item.sampleQuotes?.[0]?.quote || item.sampleQuotes?.[0]?.text;
                            const praiseAuthor = item.author || item.sampleQuotes?.[0]?.author || 'Metacritic Reviewer';
                            return (
                                <div key={idx} className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-emerald-700">{item.title || item.theme}</span>
                                        {praiseScore !== undefined && (
                                            <span className="px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-700/50 text-[10px] font-black shrink-0">
                                                Score: {praiseScore}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed">{item.detail || item.description}</p>
                                    {praiseQuote && (
                                        <div className="pl-3 border-l-2 border-emerald-500/50 text-[11px] italic text-[var(--app-muted)]">
                                            &ldquo;{praiseQuote}&rdquo; — <span className="not-italic font-bold text-[var(--app-muted)]">{praiseAuthor}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>

                <div className="bg-[var(--app-card)] p-6 md:p-7 rounded-3xl border border-rose-900/40 space-y-4">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-rose-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <ThumbsDown size={16} /> Critical User Pain Points &amp; Friction (Cons)
                        </h3>
                        <span className="px-2.5 py-0.5 rounded-full bg-rose-50 border border-rose-700/50 text-rose-700 text-[10px] font-bold">
                            User Review Drivers
                        </span>
                    </div>
                    <div className="space-y-3">
                        {(rich.topPainPoints || []).map((item: any, idx: number) => {
                            const painScore = item.score ?? item.userAvgScore ?? item.criticAvgScore;
                            const painQuote = item.quote || item.sampleQuotes?.[0]?.quote || item.sampleQuotes?.[0]?.text;
                            const painAuthor = item.author || item.sampleQuotes?.[0]?.author || 'Verified Reviewer';
                            return (
                                <div key={idx} className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] space-y-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <span className="text-sm font-bold text-rose-700">{item.title || item.theme}</span>
                                        {painScore !== undefined && (
                                            <span className="px-2 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-700/50 text-[10px] font-black shrink-0">
                                                Score: {painScore}
                                            </span>
                                        )}
                                    </div>
                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed">{item.detail || item.description}</p>
                                    {painQuote && (
                                        <div className="pl-3 border-l-2 border-rose-500/50 text-[11px] italic text-[var(--app-muted)]">
                                            &ldquo;{painQuote}&rdquo; — <span className="not-italic font-bold text-[var(--app-muted)]">{painAuthor}</span>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>

            <div className="bg-[var(--app-card)] p-6 md:p-8 rounded-3xl border border-[var(--app-border)] space-y-5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div>
                        <h3 className="flex items-center gap-2 text-amber-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <Layers size={16} /> Deep Metacritic Topic &amp; Theme Intelligence Matrix
                        </h3>
                        <p className="text-xs text-[var(--app-muted)] mt-1">
                            Granular breakdown of critic vs. community consensus, mention volume, and action items across {rich.keyThemes?.length || 6} core themes.
                        </p>
                    </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {(rich.keyThemes || []).map((t: any, idx: number) => {
                        const isPos = t.sentiment === 'positive';
                        const isNeg = t.sentiment === 'negative';
                        return (
                            <div key={idx} className="p-5 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] flex flex-col justify-between gap-3">
                                <div className="space-y-2">
                                    <div className="flex items-center justify-between gap-2 flex-wrap">
                                        <span className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)]">
                                            {t.category || 'Core Experience'}
                                        </span>
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs font-bold text-[var(--app-muted)]">{t.mentions ?? t.mentionCount ?? 0} Mentions</span>
                                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase ${isPos ? 'bg-emerald-50 text-emerald-700 border border-emerald-700/50' : isNeg ? 'bg-rose-50 text-rose-700 border border-rose-700/50' : 'bg-amber-50 text-amber-700 border border-amber-700/50'}`}>
                                                {t.sentiment === 'positive' ? 'Working Well' : t.sentiment === 'negative' ? 'Needs Attention' : 'Neutral'} • {t.avgScore ?? t.criticAvgScore ?? t.userAvgScore ?? 65}/100
                                            </span>
                                        </div>
                                    </div>
                                    <h4 className="text-base font-black text-[var(--app-text)]">{t.theme || t.title}</h4>
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                                        <div className="p-2.5 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)]">
                                            <div className="text-[9px] font-black uppercase tracking-wider text-emerald-600 mb-0.5">Critic Consensus</div>
                                            <p className="text-[11px] text-[var(--app-muted)] leading-snug">{t.criticConsensus || t.description}</p>
                                        </div>
                                        <div className="p-2.5 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)]">
                                            <div className="text-[9px] font-black uppercase tracking-wider text-sky-600 mb-0.5">Community Consensus</div>
                                            <p className="text-[11px] text-[var(--app-muted)] leading-snug">{t.playerConsensus || t.description}</p>
                                        </div>
                                    </div>
                                </div>

                                {Array.isArray(t.sampleQuotes) && t.sampleQuotes.length > 0 && (
                                    <div className="space-y-1.5 pt-1">
                                        {t.sampleQuotes.slice(0, 2).map((sq: any, qIdx: number) => (
                                            <div key={qIdx} className="text-[11px] text-[var(--app-muted)] italic bg-[var(--app-card)]/60 px-3 py-2 rounded-xl border border-[var(--app-border)]">
                                                &ldquo;{typeof sq === 'string' ? sq : (sq.quote || sq.text)}&rdquo;
                                                {typeof sq === 'object' && sq.author && (
                                                    <span className="not-italic font-bold text-[var(--app-muted)]"> — {sq.author} ({sq.score})</span>
                                                )}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {t.recommendation && (
                                    <div className="pt-2 border-t border-[var(--app-border)] flex items-start gap-2 text-xs text-amber-800/90">
                                        <Target size={13} className="text-amber-600 shrink-0 mt-0.5" />
                                        <span><strong className="text-amber-700">Action:</strong> {t.recommendation}</span>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </>
    );
};
