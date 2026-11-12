import React, { useMemo, useRef, useState } from 'react';
import { Award, ExternalLink, MessageSquare, Search } from 'lucide-react';
import { buildRichMetacriticAnalysis } from './metacriticNormalizer';
import { MetacriticScoreHeader } from './MetacriticScoreHeader';
import { MetacriticThemesAndDivergence } from './MetacriticThemesAndDivergence';

export const MetacriticAnalysisDashboard: React.FC<{ analysis: any; selectedVideoId: string; companyName: string }> = ({
    analysis,
    selectedVideoId,
    companyName
}) => {
    const rich = useMemo(
        () => buildRichMetacriticAnalysis(analysis, analysis?.url || selectedVideoId, companyName || 'test-company'),
        [analysis, selectedVideoId, companyName]
    );
    const [showRawJsonLd, setShowRawJsonLd] = useState(false);
    const [reviewTypeTab, setReviewTypeTab] = useState<'side_by_side' | 'all' | 'critic' | 'user'>('side_by_side');
    const [sentimentFilter, setSentimentFilter] = useState<'all' | 'positive' | 'mixed' | 'negative'>('all');
    const [topicFilter, setTopicFilter] = useState<string>('all');
    const [searchQuery, setSearchQuery] = useState('');
    const [showAllReviews, setShowAllReviews] = useState(true);
    const explorerRef = useRef<HTMLDivElement | null>(null);

    const meta = rich.jsonLdMetadata || {};
    const reviewsList: any[] = Array.isArray(rich.reviews) ? rich.reviews : [];
    const criticReviews = useMemo(() => reviewsList.filter(r => r.type === 'critic'), [reviewsList]);
    const userReviews = useMemo(() => reviewsList.filter(r => r.type !== 'critic'), [reviewsList]);

    const matchesFilters = (r: any) => {
        if (sentimentFilter === 'positive' && r.sentiment !== 'positive') return false;
        if (sentimentFilter === 'negative' && r.sentiment !== 'negative') return false;
        if (sentimentFilter === 'mixed' && r.sentiment !== 'neutral') return false;
        if (topicFilter !== 'all') {
            const text = `${r.quote || ''} ${r.author || ''} ${r.publication || ''}`.toLowerCase();
            if (topicFilter === 'quality' && !/quality|design|craft|finish|visual|polish|build|material/i.test(text)) return false;
            if (topicFilter === 'pricing' && !/price|value|cost|worth|tier|subscription|bundle/i.test(text)) return false;
            if (topicFilter === 'features' && !/feature|mode|content|system|depth|option|update/i.test(text)) return false;
            if (topicFilter === 'performance' && !/performance|speed|reliab|smooth|latenc|lag|server|stability/i.test(text)) return false;
            if (topicFilter === 'experience' && !/experience|interface|onboarding|support|service|usability/i.test(text)) return false;
        }
        if (searchQuery.trim()) {
            const q = searchQuery.toLowerCase();
            const hay = `${r.quote || ''} ${r.author || ''} ${r.publication || ''} ${r.platform || ''} ${r.subpageSource || ''}`.toLowerCase();
            if (!hay.includes(q)) return false;
        }
        return true;
    };

    const filteredAllReviews = useMemo(() => {
        return reviewsList.filter(r => {
            if (reviewTypeTab === 'critic' && r.type !== 'critic') return false;
            if (reviewTypeTab === 'user' && r.type === 'critic') return false;
            return matchesFilters(r);
        });
    }, [reviewsList, reviewTypeTab, sentimentFilter, topicFilter, searchQuery]);

    const filteredCriticReviews = useMemo(() => criticReviews.filter(matchesFilters), [criticReviews, sentimentFilter, topicFilter, searchQuery]);
    const filteredUserReviews = useMemo(() => userReviews.filter(matchesFilters), [userReviews, sentimentFilter, topicFilter, searchQuery]);

    const jumpToSubpageFilter = (target: 'all' | 'critic' | 'user') => {
        setReviewTypeTab(target);
        setShowAllReviews(true);
        explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    };

    const platforms = Array.isArray(meta.gamePlatform)
        ? meta.gamePlatform
        : typeof meta.gamePlatform === 'string'
        ? [meta.gamePlatform]
        : ['Web', 'Mobile', 'Desktop'];

    const genres = Array.isArray(meta.genre)
        ? meta.genre
        : typeof meta.genre === 'string'
        ? [meta.genre]
        : ['Digital Experience', 'Consumer Platform'];

    const renderReviewCard = (rev: any, idx: number) => {
        const isCritic = rev.type === 'critic';
        const isPos = rev.sentiment === 'positive';
        const isNeg = rev.sentiment === 'negative';
        return (
            <div key={rev.id || idx} className="p-4 rounded-2xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[var(--app-border)] transition flex flex-col justify-between gap-3">
                <div className="space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-black uppercase shrink-0 ${isCritic ? 'bg-amber-500/20 text-amber-700 border border-amber-500/40' : 'bg-sky-500/20 text-sky-700 border border-sky-500/40'}`}>
                                {isCritic ? `Critic #${idx + 1}` : `User #${idx + 1}`}
                            </span>
                            <span className="text-sm font-bold text-[var(--app-text)] truncate" title={rev.author}>{rev.author}</span>
                        </div>
                        <span className={`px-2.5 py-1 rounded-lg text-xs font-black shrink-0 ${isPos ? 'bg-emerald-50 text-emerald-700 border border-emerald-700/50' : isNeg ? 'bg-rose-50 text-rose-700 border border-rose-700/50' : 'bg-amber-50 text-amber-700 border border-amber-700/50'}`}>
                            {isCritic ? `${rev.score} / 100` : `${rev.score} / 10`}
                        </span>
                    </div>
                    <p className="text-xs md:text-sm text-[var(--app-text)] leading-relaxed">
                        &ldquo;{rev.quote}&rdquo;
                    </p>
                </div>
                <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] pt-2 border-t border-[var(--app-border)] flex-wrap gap-2">
                    <div className="flex items-center gap-2 flex-wrap">
                        <span className="px-2 py-0.5 rounded bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-muted)] font-semibold">
                            {rev.platform || 'Web'}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-muted)] font-mono text-[10px]">
                            {isCritic ? '/critic-reviews/' : '/user-reviews/'}
                        </span>
                        <span className={`font-bold uppercase text-[10px] ${isPos ? 'text-emerald-600' : isNeg ? 'text-rose-600' : 'text-amber-600'}`}>
                            {rev.sentiment === 'positive' ? 'Working Well' : rev.sentiment === 'negative' ? 'Needs Attention' : (rev.sentiment || 'Neutral')}
                        </span>
                    </div>
                    <span>{rev.date}</span>
                </div>
            </div>
        );
    };

    return (
        <div className="space-y-8 text-[var(--app-text)] animate-fadeIn">
            <MetacriticScoreHeader
                rich={rich}
                meta={meta}
                reviewsList={reviewsList}
                criticReviews={criticReviews}
                userReviews={userReviews}
                platforms={platforms}
                genres={genres}
                showRawJsonLd={showRawJsonLd}
                setShowRawJsonLd={setShowRawJsonLd}
                jumpToSubpageFilter={jumpToSubpageFilter}
            />

            <MetacriticThemesAndDivergence
                rich={rich}
                criticReviews={criticReviews}
                userReviews={userReviews}
            />

            <div ref={explorerRef} className="bg-[var(--app-card)] p-6 md:p-8 rounded-3xl border border-[var(--app-border)] space-y-5">
                <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div>
                        <h3 className="flex items-center gap-2 text-sky-600 font-bold text-xs uppercase tracking-[0.12em]">
                            <MessageSquare size={16} /> Full Critic ({criticReviews.length}) &amp; User ({userReviews.length}) Reviews Explorer ({filteredAllReviews.length} Matching)
                        </h3>
                        <p className="text-xs text-[var(--app-muted)] mt-1">
                            Crawled from <code className="text-amber-700 font-mono">/critic-reviews/</code> ({criticReviews.length} publications) and <code className="text-sky-700 font-mono">/user-reviews/</code> ({userReviews.length} user reviews) and blended into Deep Media Listening.
                        </p>
                    </div>

                    <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                        <div className="relative w-full sm:w-72">
                            <Search size={14} className="text-[var(--app-muted)] absolute left-3 top-1/2 -translate-y-1/2" />
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                placeholder="Search reviews by keyword, author, or publication..."
                                className="w-full pl-9 pr-3 py-2 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-hidden focus:border-amber-400"
                            />
                        </div>
                        <button
                            type="button"
                            onClick={() => setShowAllReviews(prev => !prev)}
                            className="px-3.5 py-2 rounded-xl bg-[var(--app-surface)] hover:bg-[var(--app-surface)] border border-[var(--app-border)] text-xs font-bold text-amber-700 transition cursor-pointer shrink-0"
                        >
                            {showAllReviews
                                ? `Collapse List (Showing All ${filteredAllReviews.length})`
                                : `Show All ${filteredAllReviews.length} Reviews (${filteredCriticReviews.length} Critic + ${filteredUserReviews.length} User)`}
                        </button>
                    </div>
                </div>

                <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-1 border-t border-[var(--app-border)]">
                    <div className="flex items-center gap-1.5 flex-wrap">
                        {[
                            { id: 'side_by_side', label: `Side-by-Side (${filteredCriticReviews.length} Critic vs. ${filteredUserReviews.length} User)` },
                            { id: 'all', label: `All Reviews (${reviewsList.length})` },
                            { id: 'critic', label: `Critic Reviews (${criticReviews.length})` },
                            { id: 'user', label: `User Reviews (${userReviews.length})` }
                        ].map(tab => (
                            <button
                                key={tab.id}
                                type="button"
                                onClick={() => setReviewTypeTab(tab.id as any)}
                                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition cursor-pointer ${
                                    reviewTypeTab === tab.id
                                        ? 'bg-amber-500 text-zinc-950 shadow-xs'
                                        : 'bg-[var(--app-surface)] text-[var(--app-muted)] hover:bg-[var(--app-surface)] border border-[var(--app-border)]'
                                }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] mr-1">Sentiment:</span>
                        {[
                            { id: 'all', label: `All (${reviewsList.length})` },
                            { id: 'positive', label: `Working Well (${rich.counts?.positive || 0})` },
                            { id: 'mixed', label: `Mixed (${rich.counts?.neutral || 0})` },
                            { id: 'negative', label: `Needs Attention (${rich.counts?.negative || 0})` }
                        ].map(sent => (
                            <button
                                key={sent.id}
                                type="button"
                                onClick={() => setSentimentFilter(sent.id as any)}
                                className={`px-2.5 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                                    sentimentFilter === sent.id
                                        ? 'bg-sky-500 text-zinc-950'
                                        : 'bg-[var(--app-surface)] text-[var(--app-muted)] hover:text-[var(--app-text)] border border-[var(--app-border)]'
                                }`}
                            >
                                {sent.label}
                            </button>
                        ))}
                    </div>
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--app-muted)] mr-1">Topic Filter:</span>
                    {[
                        { id: 'all', label: 'All Topics' },
                        { id: 'quality', label: 'Quality & Design' },
                        { id: 'pricing', label: 'Value & Pricing' },
                        { id: 'features', label: 'Core Features' },
                        { id: 'performance', label: 'Performance & Reliability' },
                        { id: 'experience', label: 'User Experience' }
                    ].map(topic => (
                        <button
                            key={topic.id}
                            type="button"
                            onClick={() => setTopicFilter(topic.id)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer ${
                                topicFilter === topic.id
                                    ? 'bg-zinc-200 text-zinc-950 font-bold'
                                    : 'bg-[var(--app-surface)] text-[var(--app-muted)] hover:text-[var(--app-text)] border border-[var(--app-border)]'
                            }`}
                        >
                            {topic.label}
                        </button>
                    ))}
                </div>

                {reviewTypeTab === 'side_by_side' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="space-y-3">
                            <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-wider text-amber-700 flex items-center gap-1.5">
                                        <Award size={14} /> Critic Reviews (/critic-reviews/)
                                    </div>
                                    <div className="text-[11px] text-[var(--app-muted)]">
                                        Showing {showAllReviews ? filteredCriticReviews.length : Math.min(20, filteredCriticReviews.length)} of {filteredCriticReviews.length} Critic Reviews • Metascore {rich.metascore}/100
                                    </div>
                                </div>
                                <a
                                    href={rich.criticReviewsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-amber-700 hover:text-amber-800 flex items-center gap-1"
                                >
                                    Subpage <ExternalLink size={11} />
                                </a>
                            </div>
                            <div className="space-y-3">
                                {(showAllReviews ? filteredCriticReviews : filteredCriticReviews.slice(0, 20)).map((rev, idx) =>
                                    renderReviewCard(rev, idx)
                                )}
                            </div>
                        </div>

                        <div className="space-y-3">
                            <div className="p-3.5 rounded-2xl bg-sky-500/10 border border-sky-500/30 flex items-center justify-between">
                                <div>
                                    <div className="text-xs font-black uppercase tracking-wider text-sky-700 flex items-center gap-1.5">
                                        <MessageSquare size={14} /> User Reviews (/user-reviews/)
                                    </div>
                                    <div className="text-[11px] text-[var(--app-muted)]">
                                        Showing {showAllReviews ? filteredUserReviews.length : Math.min(20, filteredUserReviews.length)} of {filteredUserReviews.length} User Reviews • User Score {rich.userScore}/10
                                    </div>
                                </div>
                                <a
                                    href={rich.userReviewsUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="text-[11px] font-bold text-sky-700 hover:text-sky-800 flex items-center gap-1"
                                >
                                    Subpage <ExternalLink size={11} />
                                </a>
                            </div>
                            <div className="space-y-3">
                                {(showAllReviews ? filteredUserReviews : filteredUserReviews.slice(0, 20)).map((rev, idx) =>
                                    renderReviewCard(rev, idx)
                                )}
                            </div>
                        </div>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {(showAllReviews ? filteredAllReviews : filteredAllReviews.slice(0, 36)).map((rev: any, idx: number) =>
                            renderReviewCard(rev, idx)
                        )}
                    </div>
                )}

                {!showAllReviews && filteredAllReviews.length > 36 && (
                    <div className="pt-2 text-center">
                        <button
                            type="button"
                            onClick={() => setShowAllReviews(true)}
                            className="px-5 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-400 text-zinc-950 font-black text-xs transition cursor-pointer shadow-sm"
                        >
                            Show All {filteredAllReviews.length} Reviews ({filteredCriticReviews.length} Critic + {filteredUserReviews.length} User)
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export { MetacriticAnalysisDashboard as MetacriticReviewsExplorer };
