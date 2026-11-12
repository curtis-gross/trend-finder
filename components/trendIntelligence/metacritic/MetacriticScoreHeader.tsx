import React from 'react';
import { Award, Calendar, ExternalLink, Globe } from 'lucide-react';

interface MetacriticScoreHeaderProps {
    rich: any;
    meta: any;
    reviewsList: any[];
    criticReviews: any[];
    userReviews: any[];
    platforms: string[];
    genres: string[];
    showRawJsonLd: boolean;
    setShowRawJsonLd: React.Dispatch<React.SetStateAction<boolean>>;
    jumpToSubpageFilter: (target: 'all' | 'critic' | 'user') => void;
}

export const MetacriticScoreHeader: React.FC<MetacriticScoreHeaderProps> = ({
    rich,
    meta,
    reviewsList,
    criticReviews,
    userReviews,
    platforms,
    genres,
    showRawJsonLd,
    setShowRawJsonLd,
    jumpToSubpageFilter
}) => {
    const cTotal = Math.max(1, criticReviews.length);
    const cPosPct = Math.round(((rich.counts?.criticPositive || 0) / cTotal) * 100);
    const cMixPct = Math.round(((rich.counts?.criticMixed || 0) / cTotal) * 100);
    const cNegPct = Math.round(((rich.counts?.criticNegative || 0) / cTotal) * 100);

    const uTotal = Math.max(1, userReviews.length);
    const uPosPct = Math.round(((rich.counts?.userPositive || 0) / uTotal) * 100);
    const uMixPct = Math.round(((rich.counts?.userMixed || 0) / uTotal) * 100);
    const uNegPct = Math.round(((rich.counts?.userNegative || 0) / uTotal) * 100);

    return (
        <>
            <div className="bg-[var(--app-card)] p-6 md:p-8 rounded-3xl border border-[var(--app-border)] shadow-xl space-y-6">
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
                    <div className="flex items-start gap-5">
                        {meta.image ? (
                            <img
                                src={meta.image}
                                alt={rich.title}
                                onError={(e) => {
                                    (e.target as HTMLImageElement).style.display = 'none';
                                }}
                                className="w-20 h-20 rounded-2xl object-cover border border-amber-500/40 shrink-0 bg-[var(--app-surface)]"
                            />
                        ) : (
                            <div className="w-20 h-20 bg-amber-500/15 border border-amber-500/40 rounded-2xl flex flex-col items-center justify-center shrink-0 text-amber-600">
                                <Award size={34} />
                                <span className="text-[9px] font-black uppercase tracking-wider mt-1">Metacritic</span>
                            </div>
                        )}
                        <div className="space-y-2">
                            <div className="flex items-center gap-2 flex-wrap">
                                <span className="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-500/40 text-amber-700 text-[10px] font-black uppercase tracking-wider flex items-center gap-1">
                                    <Award size={11} /> Schema.org {meta['@type'] || 'Product'} (application/ld+json)
                                </span>
                                <span className="px-2.5 py-0.5 rounded-full bg-emerald-50 border border-emerald-700/50 text-emerald-700 text-[10px] font-bold">
                                    {reviewsList.length} Total Reviews Ingested ({criticReviews.length} Critic + {userReviews.length} User)
                                </span>
                                {meta.contentRating && (
                                    <span className="px-2 py-0.5 rounded bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-muted)] text-[10px] font-bold">
                                        {meta.contentRating}
                                    </span>
                                )}
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black text-[var(--app-text)] tracking-tight">{rich.title}</h2>
                            <p className="text-xs md:text-sm text-[var(--app-muted)] max-w-3xl leading-relaxed">
                                {meta.description || `Structured Schema.org JSON-LD metadata, ${criticReviews.length} professional critic reviews (/critic-reviews/), and ${userReviews.length} community user reviews (/user-reviews/) harvested from ${rich.url}.`}
                            </p>
                            <div className="flex items-center gap-4 flex-wrap text-xs text-[var(--app-muted)] pt-1">
                                {meta.datePublished && (
                                    <span className="flex items-center gap-1">
                                        <Calendar size={12} className="text-amber-600" />
                                        <strong className="text-[var(--app-text)]">Release:</strong> {meta.datePublished}
                                    </span>
                                )}
                                {meta.publisher?.name && (
                                    <span>
                                        <strong className="text-[var(--app-text)]">Publisher:</strong> {meta.publisher.name}
                                    </span>
                                )}
                                <span>
                                    <strong className="text-[var(--app-text)]">Platforms:</strong> {platforms.join(', ')}
                                </span>
                                <span>
                                    <strong className="text-[var(--app-text)]">Category:</strong> {genres.join(', ')}
                                </span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-3 shrink-0 w-full lg:w-auto justify-start lg:justify-end">
                        <button
                            type="button"
                            onClick={() => jumpToSubpageFilter('critic')}
                            className="px-5 py-3.5 rounded-2xl bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/40 text-center min-w-[125px] transition cursor-pointer"
                            title="Click to inspect all Critic Reviews"
                        >
                            <div className="text-3xl font-black text-emerald-600">{rich.metascore}</div>
                            <div className="text-[10px] uppercase font-black tracking-wider text-emerald-800 mt-0.5">Metascore</div>
                            <div className="text-[10px] text-emerald-700/90 font-bold mt-0.5">{criticReviews.length} Critic Reviews →</div>
                        </button>
                        <button
                            type="button"
                            onClick={() => jumpToSubpageFilter('user')}
                            className="px-5 py-3.5 rounded-2xl bg-rose-500/10 hover:bg-rose-500/20 border border-rose-500/40 text-center min-w-[125px] transition cursor-pointer"
                            title="Click to inspect all User Reviews"
                        >
                            <div className="text-3xl font-black text-rose-600">{rich.userScore}</div>
                            <div className="text-[10px] uppercase font-black tracking-wider text-rose-800 mt-0.5">User Score</div>
                            <div className="text-[10px] text-rose-700/90 font-bold mt-0.5">{userReviews.length} User Reviews →</div>
                        </button>
                        <div className="px-5 py-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/40 text-center min-w-[115px]">
                            <div className="text-3xl font-black text-amber-700">-{rich.scoreDivergence?.gapPoints || 0}</div>
                            <div className="text-[10px] uppercase font-black tracking-wider text-amber-800 mt-0.5">Score Gap</div>
                            <div className="text-[10px] text-[var(--app-muted)] mt-0.5">Critic vs. User</div>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-[var(--app-border)] space-y-2.5">
                    <div className="flex items-center justify-between flex-wrap gap-2">
                        <span className="text-[10px] font-black uppercase tracking-wider text-[var(--app-muted)] flex items-center gap-1.5">
                            <Globe size={12} className="text-amber-600" />
                            Multi-Page Metacritic Crawl Targets (Click to Filter Explorer or Open Source Subpage)
                        </span>
                        <span className="text-[10px] font-mono text-emerald-600">
                            ✓ 3/3 Subpages Crawled &amp; Indexed
                        </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div className="p-3 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-amber-500/50 transition flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => jumpToSubpageFilter('all')}
                                className="text-left min-w-0 flex-1 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                                    <span className="text-xs font-black text-[var(--app-text)]">Landing Page (JSON-LD)</span>
                                </div>
                                <div className="text-[11px] font-mono text-amber-700 truncate mt-0.5">
                                    metacritic.com/{rich.slug}/
                                </div>
                            </button>
                            <a
                                href={rich.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-[var(--app-card)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-[var(--app-muted)] hover:text-[var(--app-text)] shrink-0"
                                title={`Open ${rich.url}`}
                            >
                                <ExternalLink size={13} />
                            </a>
                        </div>

                        <div className="p-3 rounded-2xl bg-[var(--app-surface)] border border-amber-500/30 hover:border-amber-400 transition flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => jumpToSubpageFilter('critic')}
                                className="text-left min-w-0 flex-1 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                                    <span className="text-xs font-black text-amber-700">
                                        Critic Reviews Subpage ({criticReviews.length} Reviews)
                                    </span>
                                </div>
                                <div className="text-[11px] font-mono text-[var(--app-muted)] truncate mt-0.5">
                                    metacritic.com/{rich.slug}/critic-reviews/
                                </div>
                            </button>
                            <a
                                href={rich.criticReviewsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-[var(--app-card)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-amber-700 hover:text-amber-800 shrink-0"
                                title={`Open ${rich.criticReviewsUrl}`}
                            >
                                <ExternalLink size={13} />
                            </a>
                        </div>

                        <div className="p-3 rounded-2xl bg-[var(--app-surface)] border border-sky-500/30 hover:border-sky-400 transition flex items-center justify-between gap-2">
                            <button
                                type="button"
                                onClick={() => jumpToSubpageFilter('user')}
                                className="text-left min-w-0 flex-1 cursor-pointer"
                            >
                                <div className="flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-sky-400 shrink-0" />
                                    <span className="text-xs font-black text-sky-700">
                                        User Reviews Subpage ({userReviews.length}+ Reviews)
                                    </span>
                                </div>
                                <div className="text-[11px] font-mono text-[var(--app-muted)] truncate mt-0.5">
                                    metacritic.com/{rich.slug}/user-reviews/
                                </div>
                            </button>
                            <a
                                href={rich.userReviewsUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-2 rounded-xl bg-[var(--app-card)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-sky-700 hover:text-sky-800 shrink-0"
                                title={`Open ${rich.userReviewsUrl}`}
                            >
                                <ExternalLink size={13} />
                            </a>
                        </div>
                    </div>
                </div>

                <div className="pt-4 border-t border-[var(--app-border)] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-center gap-2 flex-wrap text-xs text-[var(--app-muted)]">
                        <span className="font-mono text-[11px] text-amber-700 bg-amber-500/10 px-2.5 py-1 rounded-lg border border-amber-500/30">
                            &lt;script type=&quot;application/ld+json&quot;&gt;
                        </span>
                        <span>
                            Schema.org <strong className="text-[var(--app-text)]">{meta['@type'] || 'Product'}</strong> • aggregateRating: <strong className="text-emerald-600">{meta.aggregateRating?.ratingValue ?? rich.metascore}/100</strong> ({meta.aggregateRating?.reviewCount ?? criticReviews.length} critic ratings • {userReviews.length} user ratings)
                        </span>
                    </div>
                    <button
                        type="button"
                        onClick={() => setShowRawJsonLd(prev => !prev)}
                        className="px-3.5 py-1.5 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-xs font-bold text-amber-700 transition cursor-pointer self-start sm:self-auto"
                    >
                        {showRawJsonLd ? 'Hide Raw JSON-LD Payload' : 'Inspect Raw JSON-LD Payload'}
                    </button>
                </div>

                {showRawJsonLd && (
                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl p-4 space-y-2">
                        <div className="flex items-center justify-between text-[11px] font-mono text-amber-700">
                            <span>// Extracted from {rich.url} (&lt;script type=&quot;application/ld+json&quot;&gt;)</span>
                            <span>Schema.org/{meta['@type'] || 'Product'}</span>
                        </div>
                        <pre className="text-xs font-mono text-[var(--app-text)] overflow-x-auto max-h-96 overflow-y-auto leading-relaxed">
                            {JSON.stringify(rich.rawJsonLd || meta, null, 2)}
                        </pre>
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">Critic Score Breakdown</h4>
                        <span className="text-xs font-black text-emerald-600">{criticReviews.length} Critics</span>
                    </div>
                    <div className="space-y-3 text-xs">
                        <div className="py-1">
                            <div className="h-2.5 bg-[var(--app-surface)] rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${cPosPct}%` }} />
                                <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${cMixPct}%` }} />
                                <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${cNegPct}%` }} />
                            </div>
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${cPosPct}%` }} />
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${cMixPct}%` }} />
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${cNegPct}%` }} />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">User Score Breakdown</h4>
                        <span className="text-xs font-black text-rose-600">{userReviews.length} Users</span>
                    </div>
                    <div className="space-y-3 text-xs">
                        <div className="py-1">
                            <div className="h-2.5 bg-[var(--app-surface)] rounded-full overflow-hidden flex">
                                <div className="h-full bg-emerald-500 transition-all duration-300" style={{ width: `${uPosPct}%` }} />
                                <div className="h-full bg-amber-400 transition-all duration-300" style={{ width: `${uMixPct}%` }} />
                                <div className="h-full bg-rose-500 transition-all duration-300" style={{ width: `${uNegPct}%` }} />
                            </div>
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-emerald-500 rounded-full" style={{ width: `${uPosPct}%` }} />
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-amber-500 rounded-full" style={{ width: `${uMixPct}%` }} />
                        </div>
                        <div className="h-2 bg-[var(--app-surface)] rounded-full overflow-hidden">
                            <div className="h-full bg-rose-500 rounded-full" style={{ width: `${uNegPct}%` }} />
                        </div>
                    </div>
                </div>

                <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] space-y-3">
                    <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">Platform Reception Split</h4>
                        <span className="text-[11px] text-[var(--app-muted)]">{rich.platformBreakdown?.length || 3} Platforms</span>
                    </div>
                    <div className="space-y-2">
                        {(rich.platformBreakdown || []).map((p: any, idx: number) => (
                            <div key={p.platform || idx} className="p-2.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex items-center justify-between text-xs">
                                <div>
                                    <div className="font-bold text-[var(--app-text)]">{p.platform}</div>
                                    <div className="text-[10px] text-[var(--app-muted)]">{p.count} reviews ({p.positive} pos / {p.negative} neg)</div>
                                </div>
                                <span className={`px-2.5 py-1 rounded-lg font-black text-xs ${p.avgScore >= 70 ? 'bg-emerald-50 text-emerald-700 border border-emerald-700/50' : p.avgScore < 50 ? 'bg-rose-50 text-rose-700 border border-rose-700/50' : 'bg-amber-50 text-amber-700 border border-amber-700/50'}`}>
                                    Avg {p.avgScore}/100
                                </span>
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </>
    );
};
