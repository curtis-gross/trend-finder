import React from 'react';
import { AlertTriangle, Award, Loader2, Plus } from 'lucide-react';

interface MetacriticModalTabProps {
    companyName: string;
    metacriticUrl: string;
    setMetacriticUrl: (val: string) => void;
    metacriticLoading: boolean;
    metacriticError: string | null;
    metacriticScans: any[];
    showRawJsonLd: Record<string, boolean>;
    setShowRawJsonLd: React.Dispatch<React.SetStateAction<Record<string, boolean>>>;
    handleAddAndScanMetacritic: (overrideUrl?: string) => void;
}

export const MetacriticModalTab: React.FC<MetacriticModalTabProps> = ({
    companyName,
    metacriticUrl,
    setMetacriticUrl,
    metacriticLoading,
    metacriticError,
    metacriticScans,
    showRawJsonLd,
    setShowRawJsonLd,
    handleAddAndScanMetacritic
}) => {
    const activeBrand = companyName || 'test-company';
    const brandSlug = activeBrand.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'test-company';

    return (
        <div className="space-y-4 animate-fadeIn">
            <div className="bg-[var(--app-card)] p-4 rounded-2xl border border-[var(--app-border)] space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <h4 className="text-xs font-bold text-[var(--app-text)] flex items-center gap-2">
                        <Award size={14} className="text-amber-600" />
                        Metacritic Reviews
                    </h4>
                </div>

                <div className="flex flex-col sm:flex-row gap-2">
                    <input
                        type="text"
                        value={metacriticUrl}
                        onChange={(e) => setMetacriticUrl(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddAndScanMetacritic();
                            }
                        }}
                        placeholder="https://www.metacritic.com/product/... or general product/media review URL"
                        className="flex-1 px-3.5 py-2.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-hidden focus:border-amber-400"
                    />
                    <button
                        type="button"
                        onClick={() => handleAddAndScanMetacritic()}
                        disabled={metacriticLoading || !metacriticUrl.trim()}
                        className="px-5 py-2.5 bg-[#041E3A] hover:bg-[#072B54] disabled:opacity-50 text-white keep-white-text font-bold rounded-xl text-xs transition flex items-center justify-center gap-1.5 shrink-0 shadow-sm cursor-pointer"
                    >
                        {metacriticLoading ? (
                            <>
                                <Loader2 size={13} className="animate-spin" />
                                Scanning Reviews...
                            </>
                        ) : (
                            <>
                                <Plus size={14} />
                                Add
                            </>
                        )}
                    </button>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap pt-1">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] mr-1">Quick Presets:</span>
                    {[
                        { label: `${activeBrand} (Product Overview)`, url: `https://www.metacritic.com/product/${brandSlug}/` },
                        { label: `${activeBrand} /critic-reviews/`, url: `https://www.metacritic.com/product/${brandSlug}/critic-reviews/` },
                        { label: `${activeBrand} /user-reviews/`, url: `https://www.metacritic.com/product/${brandSlug}/user-reviews/` },
                        { label: `${activeBrand} (Movie / Media)`, url: `https://www.metacritic.com/movie/${brandSlug}/` }
                    ].map(preset => (
                        <button
                            key={preset.url}
                            type="button"
                            onClick={() => handleAddAndScanMetacritic(preset.url)}
                            className="px-2.5 py-1 rounded-lg bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-[11px] font-semibold text-[var(--app-muted)] transition cursor-pointer"
                        >
                            {preset.label}
                        </button>
                    ))}
                </div>
            </div>

            {metacriticError && (
                <div className="p-3.5 bg-rose-50 border border-rose-200 rounded-xl text-rose-800 text-xs flex items-start gap-2.5">
                    <AlertTriangle size={15} className="text-rose-600 shrink-0 mt-0.5" />
                    <div>
                        <div className="font-bold text-rose-700">Metacritic Extraction Error</div>
                        <div className="mt-0.5 text-rose-800/90">{metacriticError}</div>
                    </div>
                </div>
            )}

            {metacriticScans.length > 0 ? (
                <div className="space-y-4">
                    {metacriticScans.map((scan: any, idx: number) => {
                        const meta = scan.jsonLdMetadata || {};
                        const reviewsList = Array.isArray(scan.reviews) ? scan.reviews : [];
                        const criticList = reviewsList.filter((r: any) => r.type === 'critic');
                        const userList = reviewsList.filter((r: any) => r.type !== 'critic');
                        const metascore = meta.metascore ?? scan.metascore ?? meta.aggregateRating?.ratingValue ?? 'TBD';
                        const userScore = meta.userScore ?? scan.userScore ?? 'TBD';
                        const isRawOpen = !!showRawJsonLd[scan.url || idx];
                        const rawPlatforms = meta.platforms ?? meta.gamePlatform ?? meta.operatingSystem;
                        const platforms = Array.isArray(rawPlatforms)
                            ? rawPlatforms
                            : typeof rawPlatforms === 'string' && rawPlatforms.trim()
                            ? [rawPlatforms]
                            : [];

                        return (
                            <div key={scan.url || idx} className="bg-[var(--app-card)] rounded-2xl border border-[var(--app-border)] overflow-hidden space-y-4 p-4">
                                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                                    <div className="space-y-1">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <span className="px-2 py-0.5 rounded-md bg-amber-500/20 border border-amber-500/40 text-amber-700 text-[10px] font-black uppercase tracking-wider">
                                                Schema.org {meta['@type'] || 'Product'} (ld+json)
                                            </span>
                                            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-700/50 text-emerald-700 text-[10px] font-bold">
                                                Added to Listen Pipeline ({reviewsList.length} Reviews: {criticList.length} Critic + {userList.length} User)
                                            </span>
                                        </div>
                                        <h3 className="text-base font-black text-[var(--app-text)]">{meta.name || scan.title}</h3>
                                        <p className="text-xs text-[var(--app-muted)] line-clamp-2">{meta.description || 'Structured JSON-LD metadata and review corpus extracted from Metacritic.'}</p>
                                        <div className="flex items-center gap-3 flex-wrap text-[11px] text-[var(--app-muted)] pt-1">
                                            {meta.datePublished && <span><strong className="text-[var(--app-text)]">Release:</strong> {meta.datePublished}</span>}
                                            {meta.publisher?.name && <span><strong className="text-[var(--app-text)]">Publisher:</strong> {meta.publisher.name}</span>}
                                            {platforms.length > 0 && <span><strong className="text-[var(--app-text)]">Platforms:</strong> {platforms.slice(0, 4).join(', ')}</span>}
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-3 shrink-0">
                                        <div className="px-3.5 py-2 rounded-xl bg-amber-500/15 border border-amber-500/40 text-center min-w-[78px]">
                                            <div className="text-lg font-black text-amber-700">{metascore}</div>
                                            <div className="text-[9px] uppercase font-bold tracking-wider text-amber-800/80">Metascore</div>
                                        </div>
                                        <div className="px-3.5 py-2 rounded-xl bg-[#FAF8F5] dark:bg-[#061C36] border border-[#D8CFC2] dark:border-[#041E3A] text-center min-w-[78px]">
                                            <div className="text-lg font-black text-[#2A2421] dark:text-white">{userScore}</div>
                                            <div className="text-[9px] uppercase font-bold tracking-wider text-[#6E655E] dark:text-[#94A3B8]">User Score</div>
                                        </div>
                                        <button
                                            type="button"
                                            onClick={() => setShowRawJsonLd(prev => ({ ...prev, [scan.url || idx]: !prev[scan.url || idx] }))}
                                            className="px-3 py-2 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-[11px] font-bold text-[var(--app-text)] transition cursor-pointer"
                                        >
                                            {isRawOpen ? 'Hide ld+json' : 'View ld+json'}
                                        </button>
                                    </div>
                                </div>

                                {isRawOpen && (
                                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl p-3">
                                        <div className="text-[10px] font-mono text-amber-700 mb-1.5">&lt;script type=&quot;application/ld+json&quot;&gt;</div>
                                        <pre className="text-[11px] font-mono text-[var(--app-muted)] overflow-x-auto max-h-56 overflow-y-auto">
                                            {JSON.stringify(scan.rawJsonLd || meta, null, 2)}
                                        </pre>
                                    </div>
                                )}

                                <div className="space-y-2">
                                    <div className="flex items-center justify-between flex-wrap gap-2">
                                        <h5 className="text-xs font-bold uppercase tracking-wider text-[var(--app-muted)]">
                                            Extracted Critic ({criticList.length}) &amp; User ({userList.length}) Reviews — {reviewsList.length} Total
                                        </h5>
                                        <span className="text-[11px] text-[var(--app-muted)]">
                                            Crawled from /critic-reviews/ &amp; /user-reviews/ • Blended into Deep Media Listening Stage 1–3
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-96 overflow-y-auto pr-1">
                                        {reviewsList.map((rev: any, rIdx: number) => {
                                            const sent = rev.sentiment || (typeof rev.score === 'number' ? (rev.score >= 70 ? 'positive' : rev.score < 50 ? 'negative' : 'neutral') : 'neutral');
                                            return (
                                                <div key={rev.id || rIdx} className="p-3 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] flex flex-col justify-between gap-2">
                                                    <div className="flex items-center justify-between gap-2">
                                                        <div className="flex items-center gap-1.5 min-w-0">
                                                            <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${rev.type === 'critic' ? 'bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-500/30' : 'bg-[#FAF8F5] dark:bg-[#061C36] text-[#2A2421] dark:text-[#D8E1EB] border border-[#D8CFC2] dark:border-[#041E3A]'}`}>
                                                                {rev.type === 'critic' ? 'Critic' : 'User'}
                                                            </span>
                                                            <span className="text-xs font-bold text-[var(--app-text)] truncate">{rev.author || rev.publication || 'Reviewer'}</span>
                                                        </div>
                                                        <div className="flex items-center gap-1.5 shrink-0">
                                                            {rev.score !== undefined && (
                                                                <span className={`px-1.5 py-0.5 rounded text-[10px] font-black ${sent === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-700/50' : sent === 'negative' ? 'bg-rose-50 text-rose-700 border border-rose-700/50' : 'bg-[var(--app-surface)] text-[var(--app-muted)]'}`}>
                                                                    {rev.type === 'critic' ? `${rev.score}/100` : `${rev.score}/10`}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                                                        &ldquo;{rev.quote || rev.body || rev.text}&rdquo;
                                                    </p>
                                                    <div className="flex items-center justify-between text-[10px] text-[var(--app-muted)]">
                                                        <span>{rev.platform || 'Multi-Platform'} • <code className="font-mono text-[var(--app-muted)]">{rev.type === 'critic' ? '/critic-reviews/' : '/user-reviews/'}</code></span>
                                                        <span>{rev.date || meta.datePublished || ''}</span>
                                                    </div>
                                                </div>
                                            );
                                        })}
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            ) : !metacriticLoading && (
                <div className="text-center py-10 bg-[var(--app-card)] rounded-2xl border border-[var(--app-border)] text-[var(--app-muted)] text-xs">
                    Enter a Metacritic URL above and click <strong className="text-[#041E3A]">Add</strong> to crawl Schema.org JSON-LD metadata plus <span className="text-amber-700 font-mono">/critic-reviews/</span> and <span className="text-[#2A2421] font-mono">/user-reviews/</span> subpages.
                </div>
            )}
        </div>
    );
};
