import React from 'react';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Cell } from 'recharts';
import { Activity, ArrowRight, ChevronLeft, ChevronRight, Clock, ExternalLink, Filter, Layers, Search, Tag, X } from 'lucide-react';
import { Stage3KeywordResult, EnrichedComment, formatCommentTimestamp, getCommentYear } from '../../../services/noiseFilterService';
import { TaxonomyDomainGrid } from '../../TaxonomyDomainGrid';
import { getCountryFlag } from '../languageAndGraphHelpers';
import { STAGE3_PAGE_SIZE } from '../useStageChartMemos';

export interface Stage3TopicExtractionViewProps {
    isDark: boolean;
    stage3Data: Stage3KeywordResult | null;
    stage3Analytics: any;
    stage3SearchQuery: string;
    setStage3SearchQuery: (q: string) => void;
    selectedTopic: string | null;
    setSelectedTopic: (topic: string | null) => void;
    onTopicClick: (topic: string) => void;
    hoveredKeywordIndex: number | null;
    setHoveredKeywordIndex: (idx: number | null) => void;
    displayedStage3Comments: EnrichedComment[];
    totalStage3Count: number;
    totalStage3Pages: number;
    currentStage3Page: number;
    setStage3Page: React.Dispatch<React.SetStateAction<number>>;
    stage3ViewAll: boolean;
    setStage3ViewAll: React.Dispatch<React.SetStateAction<boolean>>;
    onProceedToStage4: () => void;
}

export const Stage3TopicExtractionView: React.FC<Stage3TopicExtractionViewProps> = ({
    isDark, stage3Data, stage3Analytics, stage3SearchQuery, setStage3SearchQuery,
    selectedTopic, setSelectedTopic, onTopicClick, hoveredKeywordIndex, setHoveredKeywordIndex,
    displayedStage3Comments, totalStage3Count, totalStage3Pages, currentStage3Page,
    setStage3Page, stage3ViewAll, setStage3ViewAll, onProceedToStage4
}) => {
    return (
        <div className="space-y-6 animate-fadeIn">
            {stage3Data && stage3Analytics && (
                <div className="bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] p-6 shadow-xs space-y-6">
                    <div className="flex flex-row flex-wrap items-center justify-between gap-3 pb-4 border-b border-[var(--app-border)]">
                        <h3 className="text-lg font-black text-[var(--app-text)] tracking-tight">
                            Topic Frequency &amp; Sentiment
                        </h3>

                        <div className="flex flex-wrap items-center gap-3">
                            <div className="relative">
                                <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" />
                                <input
                                    type="text"
                                    placeholder="Search topics..."
                                    value={stage3SearchQuery}
                                    onChange={(e) => {
                                        setStage3SearchQuery(e.target.value);
                                        if (e.target.value) setSelectedTopic(e.target.value);
                                    }}
                                    className="pl-8 pr-3 py-1.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:border-[#0077C8] w-48"
                                />
                                {stage3SearchQuery && (
                                    <button
                                        onClick={() => {
                                            setStage3SearchQuery('');
                                            setSelectedTopic(null);
                                        }}
                                        className="absolute right-2 top-2 text-[var(--app-muted)] hover:text-[var(--app-text)]"
                                    >
                                        <X size={12} />
                                    </button>
                                )}
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
                        <div className="lg:col-span-7 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] flex flex-col justify-between space-y-4 shadow-xs">
                            <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                                <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] flex items-center gap-1.5">
                                    <Activity size={14} className="text-[#0077C8]" /> Most Mentioned Topics (Top 8)
                                </span>
                            </div>

                            <div className="h-64 w-full min-w-0">
                                <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={200} initialDimension={{ width: 520, height: 220 }}>
                                    <BarChart
                                        data={stage3Analytics.topKeywordsList}
                                        layout="vertical"
                                        margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
                                        onMouseLeave={() => setHoveredKeywordIndex(null)}
                                    >
                                        <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} horizontal={false} />
                                        <XAxis type="number" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={10} tickLine={false} axisLine={false} />
                                        <YAxis type="category" dataKey="shortKeyword" stroke={isDark ? '#94A3B8' : '#64748B'} fontSize={10} tickLine={false} width={135} />
                                        <Tooltip
                                            wrapperStyle={{ zIndex: 1000, pointerEvents: 'none' }}
                                            content={({ active, payload }: any) => {
                                                if (!active || !payload?.length) return null;
                                                const data = payload[0].payload;
                                                const badgeCls = data.dominantSentiment === 'positive'
                                                    ? 'bg-[#00FF88]/20 text-emerald-600 border border-[#00FF88]/40'
                                                    : data.dominantSentiment === 'negative'
                                                    ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30'
                                                    : 'bg-sky-500/15 text-sky-700 border border-sky-400/30';
                                                return (
                                                    <div className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl px-4 py-3 shadow-2xl text-[var(--app-text)] font-mono text-xs z-50 pointer-events-none min-w-[250px] space-y-2">
                                                        <div className="flex items-center justify-between gap-2 pb-1.5 border-b border-[var(--app-border)]">
                                                            <div className="flex items-center gap-1.5">
                                                                <span className="w-2.5 h-2.5 rounded-full shrink-0 bg-[#0077C8]" />
                                                                <span className="font-black text-[var(--app-text)] text-xs font-mono">{data.fullName}</span>
                                                            </div>
                                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded capitalize ${badgeCls}`}>{data.dominantSentiment}</span>
                                                        </div>
                                                        <div className="space-y-1.5 font-sans">
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-[var(--app-muted)] font-medium">Total Mentions:</span>
                                                                <span className="font-bold text-[var(--app-text)] font-mono">{data.count} occurrences</span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs">
                                                                <span className="text-[var(--app-muted)] font-medium">Sentiment Split:</span>
                                                                <span className="font-mono text-[11px]">
                                                                    <span className="text-emerald-600 font-bold">{data.positive} Working Well</span> / <span className="text-sky-600 font-bold">{data.neutral} Neu</span> / <span className="text-yellow-400 font-bold">{data.negative} Needs Attention</span>
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between text-xs pt-1 border-t border-[var(--app-border)]">
                                                                <span className="text-[var(--app-muted)] font-medium">Feature Pillar:</span>
                                                                <span className="text-[var(--app-muted)] font-semibold text-[11px] truncate max-w-[130px]">{data.category}</span>
                                                            </div>
                                                        </div>
                                                    </div>
                                                );
                                            }}
                                        />
                                        <Bar dataKey="count" radius={[0, 8, 8, 0]} cursor="pointer" onClick={(entry: any) => { if (entry?.fullName) onTopicClick(entry.fullName); }}>
                                            {(stage3Analytics?.topKeywordsList || []).map((entry: any, index: number) => (
                                                <Cell key={`cell-${index}`} fill={entry.color || '#0077C8'} fillOpacity={hoveredKeywordIndex === null || hoveredKeywordIndex === index ? 1 : 0.6} onMouseEnter={() => setHoveredKeywordIndex(index)} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>

                            <div className="flex items-center justify-between text-[11px] text-[var(--app-muted)] font-mono font-medium pt-2 border-t border-[var(--app-border)]">
                                <span>Ranked by signal comment occurrences</span>
                                <span className="text-[#0077C8] font-bold">Click bar to filter</span>
                            </div>
                        </div>

                        <div className="lg:col-span-5 bg-[var(--app-card)] rounded-2xl p-5 border border-[var(--app-border)] flex flex-col justify-between space-y-4 shadow-xs">
                            <div className="flex items-center justify-between pb-2 border-b border-[var(--app-border)]">
                                <span className="text-xs font-bold uppercase tracking-wider font-mono text-[var(--app-text)] flex items-center gap-1.5">
                                    <Layers size={14} className="text-[#0077C8]" /> Domain Sentiment Distribution
                                </span>
                                <span className="text-[10px] font-mono font-bold text-[var(--app-muted)] bg-[var(--app-surface)] px-2 py-0.5 rounded-full border border-[var(--app-border)]">
                                    {(stage3Analytics?.categoryStats || []).length} Pillars
                                </span>
                            </div>

                            <div className="space-y-3 max-h-56 overflow-y-auto pr-1">
                                {(stage3Analytics?.categoryStats || []).map((cat: any, idx: number) => {
                                    const posPct = Math.max(0, Math.min(100, Math.round(Number(cat.posPct) || 0)));
                                    const negPct = Math.max(0, Math.min(100, Math.round(Number(cat.negPct) || 0)));
                                    const neuPct = Math.max(0, 100 - posPct - negPct);
                                    const isCatActive = String(selectedTopic || '').toLowerCase().replace(/^#/, '').trim() === String(cat.name || '').toLowerCase().trim();
                                    return (
                                        <div
                                            key={idx}
                                            onClick={() => onTopicClick(cat.name)}
                                            className={`p-2.5 rounded-xl text-[var(--app-text)] border space-y-1.5 shadow-xs cursor-pointer transition-all ${
                                                isCatActive
                                                    ? 'bg-blue-50 border-[#38bdf8] ring-1 ring-[#38bdf8]/50'
                                                    : 'bg-[var(--app-surface)] border-[var(--app-border)] hover:border-[#349DD4]/60 hover:bg-[var(--app-surface)]'
                                            }`}
                                        >
                                            <div className="flex items-center justify-between text-xs">
                                                <span className="font-bold text-[var(--app-text)] text-[11px] truncate pr-2">{cat.name}</span>
                                            </div>
                                            <div className="w-full h-2 bg-[var(--app-surface)] rounded-full overflow-hidden flex">
                                                <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${posPct}%` }} />
                                                <div className="bg-sky-400 h-full transition-all duration-300" style={{ width: `${neuPct}%` }} />
                                                <div className="bg-yellow-400 h-full transition-all duration-300" style={{ width: `${negPct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>

                            <div className="pt-2 border-t border-[var(--app-border)] space-y-1.5">
                                <span className="text-[10px] font-mono text-[var(--app-muted)] font-bold uppercase tracking-wider block">
                                    Trending Taxonomy Capsules
                                </span>
                                <div className="flex flex-wrap gap-1.5">
                                    {(stage3Analytics?.topKeywordsList || []).slice(0, 6).map((kw: any, i: number) => {
                                        const cleanKw = String(kw?.fullName || kw?.keyword || '').replace(/^#/, '');
                                        const isKwSelected = String(selectedTopic || '').toLowerCase().replace(/^#/, '').trim() === cleanKw.toLowerCase().trim();
                                        return (
                                            <button
                                                key={i}
                                                type="button"
                                                onClick={() => onTopicClick(cleanKw)}
                                                className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-lg border inline-flex items-center gap-1 whitespace-nowrap shadow-xs transition cursor-pointer ${
                                                    isKwSelected
                                                        ? 'bg-[#0077C8] text-white keep-white-text border-[#349DD4] shadow-[0_0_10px_rgba(52,157,212,0.4)]'
                                                        : 'hover:border-[#349DD4]/40 hover:bg-[#0077C8]/15'
                                                }`}
                                                style={!isKwSelected ? { backgroundColor: `${kw.color}15`, borderColor: `${kw.color}40`, color: kw.color } : {}}
                                            >
                                                {kw.fullName} <span className="text-[9px] opacity-70">({kw.count})</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {stage3Data ? (
                <TaxonomyDomainGrid
                    clusters={stage3Data.featureClusters || []}
                    enrichedComments={stage3Data.enrichedComments || []}
                    selectedTopic={selectedTopic}
                    onSelectTopic={onTopicClick}
                    testIdPrefix="stage3"
                />
            ) : (
                <div className="text-center py-16 bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] space-y-2">
                    <Tag size={36} className="mx-auto text-[var(--app-muted)]" />
                    <h4 className="text-base font-bold text-[var(--app-text)]">Stage 3 Not Run Yet</h4>
                    <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">
                        Click 'Extract Topics' above to enrich the filtered signal comments with multi-tier topic taxonomies.
                    </p>
                </div>
            )}

            {stage3Data && (
                <div className="bg-[var(--app-card)] border border-dashed border-[var(--app-border)] rounded-2xl p-4 text-center text-xs text-[var(--app-muted)] font-mono flex items-center justify-center gap-2">
                    <Filter size={13} className="text-[#0077C8]" />
                    <span>Click any topic bar, domain bar, or tag in <strong>Topics Overview by Feature Domain</strong> to open the full-screen breakdown modal.</span>
                </div>
            )}

            {stage3Data && (
                <div className="bg-[var(--app-surface)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] p-6 shadow-xs space-y-4">
                    <div className="flex items-center justify-between">
                        <h4 className="text-base font-bold text-[var(--app-text)]">
                            Enriched Feedback Corpus ({stage3Data.totalEnriched ?? (stage3Data.enrichedComments || []).length})
                            {stage3SearchQuery && (
                                <span className="text-xs font-mono text-[#0077C8] ml-2">
                                    Filtering by "{stage3SearchQuery}"
                                </span>
                            )}
                        </h4>
                        {stage3SearchQuery && (
                            <button
                                onClick={() => {
                                    setStage3SearchQuery('');
                                    setSelectedTopic(null);
                                }}
                                className="text-xs font-bold text-[var(--app-muted)] hover:text-[var(--app-text)] underline font-mono"
                            >
                                Clear Filter
                            </button>
                        )}
                    </div>
                    <div className="space-y-3">
                        <div className="max-h-[460px] overflow-y-auto space-y-2.5 pr-1">
                            {displayedStage3Comments.map((c, i) => {
                                const rType = String((c as any).reviewType || '').toLowerCase();
                                const isMcCritic = rType === 'critic' || String(c.source || '').toLowerCase().includes('metacritic critic');
                                const isMcUser = rType === 'user' || String(c.source || '').toLowerCase().includes('metacritic user');
                                const mcScore = (c as any).score;
                                const srcUrl = [c.videoUrl, c.sourceUrl, c.subpageUrl].find(u => typeof u === 'string' && /^https?:\/\//i.test(u));
                                return (
                                    <div key={i} className="p-3.5 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-xs space-y-2">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="font-bold text-[var(--app-text)]">{c.author}</span>
                                                {srcUrl && (
                                                    <a href={srcUrl} target="_blank" rel="noopener noreferrer" data-testid="stage3-comment-source-link" title={srcUrl} className="text-[10px] font-mono font-bold text-[#0077C8] hover:underline inline-flex items-center gap-1 max-w-[220px]">
                                                        <ExternalLink size={10} className="shrink-0" /><span className="truncate">{c.videoUrl ? 'Watch Video' : 'View Source'}{c.videoTitle ? ` · ${c.videoTitle}` : ''}</span>
                                                    </a>
                                                )}
                                                {isMcCritic && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700 border border-amber-700/60">
                                                        🏅 Critic{typeof mcScore === 'number' ? ` · ${mcScore}/100` : ''}
                                                    </span>
                                                )}
                                                {isMcUser && (
                                                    <span className="text-[10px] font-mono font-bold px-1.5 py-0.5 rounded bg-cyan-50 text-cyan-300 border border-cyan-700/60">
                                                        👤 User{typeof mcScore === 'number' ? ` · ${mcScore}/10` : ''}
                                                    </span>
                                                )}
                                                {c.country && (
                                                    <span className="text-[10px] font-mono text-[var(--app-muted)] bg-[var(--app-card)] border border-[var(--app-border)] px-1.5 py-0.5 rounded flex items-center gap-1">
                                                        {getCountryFlag(c.country, c.rawText || (c as any).text || '').flag} {getCountryFlag(c.country, c.rawText || (c as any).text || '').label}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className="text-[10px] text-[var(--app-muted)] font-mono flex items-center gap-1">
                                                    <Clock size={11} className="text-[var(--app-muted)]" />
                                                    {c.timestamp || formatCommentTimestamp(null, getCommentYear(c))}
                                                </span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${
                                                    c.sentiment === 'positive' ? 'bg-[#00FF88]/20 text-emerald-600' : c.sentiment === 'negative' ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30' : 'bg-sky-500/15 text-sky-700 border border-sky-400/30'
                                                }`}>
                                                    {c.sentiment === 'positive' ? 'Working Well' : c.sentiment === 'negative' ? 'Needs Attention' : 'Neutral'}
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)]">
                                                    {getCommentYear(c)} • {c.featureCategory}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[var(--app-muted)] font-medium italic leading-relaxed">"{c.rawText}"</p>
                                        <div className="flex flex-wrap gap-1.5 pt-1">
                                            {(Array.isArray(c?.keywords) ? c.keywords : []).map((kw, kwIdx) => {
                                                const cleanKw = String(typeof kw === 'string' ? kw : (kw as any)?.keyword || (kw as any)?.name || '').replace(/^#/, '').trim();
                                                const isKwActive = String(selectedTopic || '').toLowerCase().replace(/^#/, '').trim() === cleanKw.toLowerCase();
                                                return (
                                                    <button
                                                        key={kwIdx}
                                                        onClick={() => onTopicClick(cleanKw)}
                                                        className={`text-[10px] font-bold font-mono px-2 py-0.5 rounded transition border ${
                                                            isKwActive
                                                                ? 'bg-[#0077C8] text-white border-[#349DD4] shadow-[0_0_10px_rgba(52,157,212,0.4)]'
                                                                : 'bg-[#0077C8]/15 hover:bg-[#0077C8]/30 text-[#0077C8] border-[#349DD4]/30'
                                                        }`}
                                                    >
                                                        #{cleanKw}
                                                    </button>
                                                );
                                            })}
                                        </div>
                                    </div>
                                );
                            })}
                            {displayedStage3Comments.length === 0 && (
                                <div className="text-center py-8 text-[var(--app-muted)] text-xs font-mono">
                                    No enriched comments match "{stage3SearchQuery}".
                                </div>
                            )}
                        </div>

                        {totalStage3Count > STAGE3_PAGE_SIZE && (
                            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-[var(--app-border)] text-xs">
                                <div className="flex items-center gap-2 text-[var(--app-muted)] font-mono text-[11px]">
                                    <span>
                                        {stage3ViewAll
                                            ? `Showing all ${totalStage3Count} comments`
                                            : `Showing ${(currentStage3Page - 1) * STAGE3_PAGE_SIZE + 1}–${Math.min(currentStage3Page * STAGE3_PAGE_SIZE, totalStage3Count)} of ${totalStage3Count} comments`}
                                    </span>
                                    <button
                                        type="button"
                                        onClick={() => setStage3ViewAll(prev => !prev)}
                                        className="text-[#0077C8] hover:underline font-bold ml-1 whitespace-nowrap cursor-pointer"
                                    >
                                        {stage3ViewAll ? 'Paginate (50/page)' : 'View All'}
                                    </button>
                                </div>
                                {!stage3ViewAll && (
                                    <div className="flex flex-row items-center gap-1.5 font-mono text-[11px] flex-nowrap shrink-0">
                                        <button type="button" onClick={() => setStage3Page(p => Math.max(1, p - 1))} disabled={currentStage3Page <= 1} className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap transition cursor-pointer">
                                            <ChevronLeft size={13} /> Prev
                                        </button>
                                        <span className="px-2 font-bold text-[var(--app-muted)] whitespace-nowrap">Page {currentStage3Page} of {totalStage3Pages}</span>
                                        <button type="button" onClick={() => setStage3Page(p => Math.min(totalStage3Pages, p + 1))} disabled={currentStage3Page >= totalStage3Pages} className="px-2.5 py-1 rounded-lg border border-[var(--app-border)] bg-[var(--app-surface)] text-[var(--app-muted)] disabled:opacity-40 disabled:cursor-not-allowed inline-flex items-center gap-1 whitespace-nowrap transition cursor-pointer">
                                            Next <ChevronRight size={13} />
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {stage3Data && (
                <div className="p-4 rounded-2xl bg-emerald-50 text-[var(--app-text)] border border-emerald-200 flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                        <span className="text-xs font-bold text-emerald-700">
                            ✓ {stage3Data.totalEnriched ?? (stage3Data.enrichedComments || []).length} Comments Enriched with Topics
                        </span>
                        <p className="text-[11px] text-[var(--app-muted)] font-medium">
                            Proceed to Stage 4 to build the interactive 60+ node Relationship Graph and cross-release trajectories.
                        </p>
                    </div>
                    <button
                        type="button"
                        onClick={onProceedToStage4}
                        className="btn-primary inline-flex items-center gap-1.5 whitespace-nowrap px-2.5 sm:px-3.5 py-1.5 rounded-xl text-xs font-black text-white keep-white-text shrink-0 shadow-md cursor-pointer"
                    >
                        <span>Proceed to Stage 4: Build Relationship Graph</span> <ArrowRight size={14} className="shrink-0" />
                    </button>
                </div>
            )}
        </div>
    );
};
