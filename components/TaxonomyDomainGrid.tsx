import React, { useMemo } from 'react';
import { Layers, ChevronRight, ExternalLink } from 'lucide-react';
import { collectTopicSourceRefs } from '../services/noiseFilter/stage3ClusterAggregator';
import type { TopicSourceRef } from '../services/noiseFilter/noiseTypes';
import { useTaxonomyMetrics, DEFAULT_FEATURE_CLUSTERS } from '../hooks/useTaxonomyMetrics';
import { SentimentGradientBar } from './SentimentGradientBar';

const EMPTY_COMMENTS: any[] = [];

export interface TaxonomyDomainGridProps {
  clusters: any[];
  enrichedComments?: any[];
  selectedTopic?: string | null;
  onSelectTopic?: (topicTitle: string) => void;
  onNavigateToTab?: (tabName: 'listen' | 'filter' | 'topic_graph' | 'topic_trajectory' | 'ad_opportunities' | 'summarize') => void;
  showGlobalBar?: boolean;
  testIdPrefix?: string;
  className?: string;
}

export const TaxonomyDomainGrid: React.FC<TaxonomyDomainGridProps> = ({
  clusters,
  enrichedComments = EMPTY_COMMENTS,
  selectedTopic,
  onSelectTopic,
  onNavigateToTab,
  showGlobalBar = true,
  testIdPrefix,
  className = ''
}) => {
  const {
    globalTotals,
    globalSplit,
    getDomainSplit,
    getTopicSplit,
    resolveKeywords
  } = useTaxonomyMetrics(clusters, enrichedComments);

  const displayClusters = useMemo(() => {
    if (Array.isArray(clusters) && clusters.length > 0) {
      return clusters.filter(c => c && typeof c === 'object' && Boolean(c.category || (c as any).name || (c as any).title));
    }
    return (clusters === undefined || clusters === null) ? DEFAULT_FEATURE_CLUSTERS : [];
  }, [clusters]);

  const hasClusters = displayClusters.length > 0;

  // Top real source URLs (video/thread/review page) behind each domain; empty when comments carry no URLs.
  const sourceRefsByCategory = useMemo(() => {
    const groups = new Map<string, any[]>();
    (Array.isArray(enrichedComments) ? enrichedComments : []).forEach(c => {
      const key = String(c?.featureCategory || '').toLowerCase().trim();
      if (!key) return;
      if (!groups.has(key)) groups.set(key, []);
      groups.get(key)!.push(c);
    });
    const out = new Map<string, TopicSourceRef[]>();
    groups.forEach((list, key) => {
      const refs = collectTopicSourceRefs(list, 2);
      if (refs.length > 0) out.set(key, refs);
    });
    return out;
  }, [enrichedComments]);

  const handleTopicClick = (title: string) => {
    onSelectTopic?.(title);
  };

  const globalBarTestId = testIdPrefix
    ? `${testIdPrefix}-global-sentiment-split-bar`
    : 'global-sentiment-split-bar';

  return (
    <div className={`bg-[var(--app-surface)] dark:bg-[#041527] rounded-3xl border border-[var(--app-border)] dark:border-[#041E3A] p-6 shadow-xs space-y-5 hover:border-slate-300 dark:hover:border-[#0A2B52] transition-all text-[var(--app-text)] dark:text-slate-100 ${className}`.trim()}>
      {onNavigateToTab && (
        <div className="flex flex-wrap items-center justify-end gap-4 pb-3 border-b border-[var(--app-border)] dark:border-[#041E3A]">
          <button
            type="button"
            onClick={() => onNavigateToTab('filter')}
            className="text-xs font-bold text-[#0077C8] dark:text-[#38BDF8] hover:underline flex items-center gap-1 font-mono cursor-pointer"
          >
            Open Filter Pipeline Stage 3 <ChevronRight size={13} />
          </button>
        </div>
      )}

      {showGlobalBar && (
        <div className="rounded-2xl bg-slate-50 dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] p-4 space-y-2.5" data-testid={globalBarTestId}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-slate-900 dark:text-slate-100">
                Overall Sentiment Split
              </span>
              <span className="text-[11px] font-mono text-slate-500 dark:text-slate-400">
                ({hasClusters ? globalSplit.total.toLocaleString() : 0} domain quotes)
              </span>
            </div>
          </div>
          <SentimentGradientBar
            posPct={hasClusters ? globalSplit.posPct : 0}
            neuPct={hasClusters ? globalSplit.neuPct : 0}
            negPct={hasClusters ? globalSplit.negPct : 0}
            posCount={hasClusters ? globalTotals.pos : undefined}
            neuCount={hasClusters ? globalTotals.neu : undefined}
            negCount={hasClusters ? globalTotals.neg : undefined}
            showInlineNumbers={true}
            heightClassName="h-8"
            className="[&>span:nth-child(2)]:text-sky-700 dark:[&>span:nth-child(2)]:text-sky-300 [&>span:nth-child(2)]:border-sky-200 dark:[&>span:nth-child(2)]:border-sky-800/60 [&>span:nth-child(3)]:text-amber-700 dark:[&>span:nth-child(3)]:text-amber-300 [&>span:nth-child(3)]:border-amber-200 dark:[&>span:nth-child(3)]:border-amber-800/60"
            style={{
              background: hasClusters && (globalSplit.posPct + globalSplit.neuPct + globalSplit.negPct) > 0
                ? 'linear-gradient(to right, #10B981 0% var(--pos-end), #38bdf8 var(--pos-end) var(--neu-end), #FACC15 var(--neu-end) 100%)'
                : 'transparent'
            }}
            title={hasClusters
              ? `Overall Split: ${globalSplit.posPct}% Working Well, ${globalSplit.neuPct}% Neutral, ${globalSplit.negPct}% Needs Attention`
              : 'No domain quotes in current view'}
          />
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {!hasClusters ? (
          <div className="col-span-full py-12 text-center bg-slate-50 dark:bg-[#061C36] rounded-2xl border border-dashed border-[var(--app-border)] dark:border-[#041E3A] p-6 space-y-2">
            <Layers size={32} className="mx-auto text-slate-600 dark:text-slate-400" />
            <h4 className="text-sm font-bold text-slate-800 dark:text-slate-100">No Feature Domains Available</h4>
            <p className="text-xs text-slate-500 dark:text-slate-400">No taxonomy pillars match the current selection.</p>
          </div>
        ) : (
          displayClusters.map((cluster, idx) => {
            const categoryName = String(cluster?.category || (cluster as any)?.name || (cluster as any)?.title || '').trim();
            const cleanSelected = String(selectedTopic || '').replace(/^#/, '').toLowerCase().trim();
            const isCatSelected = Boolean(cleanSelected) && cleanSelected === categoryName.toLowerCase();
            const domainSplit = getDomainSplit(categoryName);
            const totalQuotes = domainSplit.total;
            const clusterKeywords = resolveKeywords(cluster);
            const keywordCount = Math.max(0, Number(cluster?.keywordCount) || clusterKeywords.length);
            const domainRefs = sourceRefsByCategory.get(categoryName.toLowerCase()) || [];

            return (
              <div
                key={idx}
                className={`rounded-2xl border p-5 shadow-sm space-y-3.5 transition-all duration-200 flex flex-col ${
                  isCatSelected
                    ? 'bg-blue-50/70 dark:bg-[#061C36] border-[#0077C8] dark:border-[#38BDF8] ring-1 ring-[#0077C8]/20 dark:ring-[#38BDF8]/30 shadow-md'
                    : 'bg-slate-50 dark:bg-[#061C36]/70 hover:bg-slate-100/80 dark:hover:bg-[#1A222E] border-[var(--app-border)] dark:border-[#041E3A] hover:border-[#0077C8]/40 dark:hover:border-[#0A2B52]'
                }`}
              >
                <div className="pb-2 border-b border-[var(--app-border)] dark:border-[#041E3A] space-y-1.5">
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => handleTopicClick(categoryName)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleTopicClick(categoryName);
                      }
                    }}
                    className="cursor-pointer group"
                    title={`Click to view all ${totalQuotes || keywordCount} quotes for ${categoryName}`}
                  >
                    <h4 className="text-sm font-bold text-slate-900 dark:text-slate-100 group-hover:text-[#0077C8] dark:group-hover:text-[#38BDF8] transition leading-snug break-words">
                      {categoryName}
                    </h4>
                  </div>
                  <div className="flex items-center justify-between gap-1.5 pt-0.5">
                    <span className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded shrink-0 transition ${
                      isCatSelected
                        ? 'bg-[#0077C8] text-white'
                        : 'text-[#0077C8] dark:text-[#38BDF8] bg-blue-50 dark:bg-[#041527] border border-blue-200 dark:border-[#041E3A]'
                    }`}>
                      {keywordCount} Topics
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleTopicClick(categoryName);
                      }}
                      className={`text-[10px] font-mono px-1.5 py-0.5 rounded transition cursor-pointer ${
                        isCatSelected
                          ? 'bg-[#0077C8] text-white font-bold'
                          : 'text-[#0077C8] dark:text-[#38BDF8] bg-blue-50 dark:bg-[#041527] border border-blue-200 dark:border-[#041E3A] hover:bg-blue-100 dark:hover:bg-[#1A222E] font-bold'
                      }`}
                      title={`View all ${totalQuotes} comments in ${categoryName}`}
                    >
                      All ({totalQuotes})
                    </button>
                  </div>
                  {domainRefs.length > 0 && (
                    <div className="flex flex-wrap gap-1" data-testid="domain-source-links">
                      {domainRefs.map(ref => (
                        <a
                          key={ref.url}
                          href={ref.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          title={`${ref.source}: ${ref.title || ref.url} (${ref.commentCount} comments)`}
                          className="inline-flex items-center gap-1 max-w-full text-[10px] font-mono text-[#0077C8] dark:text-[#38BDF8] hover:underline"
                        >
                          <ExternalLink size={9} className="shrink-0" />
                          <span className="truncate">{ref.title || ref.source}</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>

                <div
                  onClick={() => handleTopicClick(categoryName)}
                  className="bg-white dark:bg-[#041527] rounded-xl p-2.5 border border-[var(--app-border)] dark:border-[#041E3A] hover:border-[#0077C8]/50 dark:hover:border-[#0A2B52] shadow-2xs cursor-pointer transition-all"
                >
                  <SentimentGradientBar
                    posPct={domainSplit.posPct}
                    neuPct={domainSplit.neuPct}
                    negPct={domainSplit.negPct}
                    heightClassName="h-2"
                    style={{
                      background: (domainSplit.posPct + domainSplit.neuPct + domainSplit.negPct) > 0
                        ? 'linear-gradient(to right, #10B981 0% var(--pos-end), #38bdf8 var(--pos-end) var(--neu-end), #FACC15 var(--neu-end) 100%)'
                        : 'transparent'
                    }}
                    title={`${categoryName}: ${domainSplit.posPct}% Working Well • ${domainSplit.neuPct}% Neutral • ${domainSplit.negPct}% Needs Attention`}
                  />
                </div>

                <div className="space-y-2 pt-0.5">
                  {clusterKeywords.length === 0 ? (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 italic py-2 text-center font-mono">No subtopics available</p>
                  ) : (
                    clusterKeywords.map((cleanK, kIdx) => {
                      const isPillSelected = Boolean(cleanSelected) && cleanSelected === cleanK.toLowerCase();
                      const tSplit = getTopicSplit(cleanK, cluster?.sentimentBreakdown);

                      return (
                        <button
                          key={kIdx}
                          type="button"
                          onClick={() => handleTopicClick(cleanK)}
                          className={`group w-full rounded-xl p-2.5 transition text-left shadow-2xs border space-y-2 block cursor-pointer ${
                            isPillSelected
                              ? 'bg-blue-50/70 dark:bg-[#041E3A] border-[#0077C8] dark:border-[#38BDF8] ring-1 ring-[#0077C8]/20 dark:ring-[#38BDF8]/30 shadow-sm text-[#0077C8] dark:text-[#38BDF8]'
                              : 'bg-white dark:bg-[#041527] hover:bg-blue-50/50 dark:hover:bg-[#1A222E] border-[var(--app-border)] dark:border-[#041E3A] hover:border-[#0077C8]/40 dark:hover:border-[#0A2B52] text-slate-800 dark:text-slate-200'
                          }`}
                          title={`Inspect "${cleanK}" (${tSplit.posPct}% Working Well • ${tSplit.neuPct}% Neutral • ${tSplit.negPct}% Needs Attention)`}
                        >
                          <div className="flex items-center justify-between gap-1.5">
                            <span className={`text-[11px] font-mono font-bold truncate ${
                              isPillSelected ? 'text-[#0077C8] dark:text-[#38BDF8] font-black' : 'text-slate-800 dark:text-slate-200 group-hover:text-[#0077C8] dark:group-hover:text-[#38BDF8]'
                            }`}>
                              #{cleanK}
                            </span>
                          </div>
                          <SentimentGradientBar
                            posPct={tSplit.posPct}
                            neuPct={tSplit.neuPct}
                            negPct={tSplit.negPct}
                            heightClassName="h-1.5"
                            style={{
                              background: (tSplit.posPct + tSplit.neuPct + tSplit.negPct) > 0
                                ? 'linear-gradient(to right, #10B981 0% var(--pos-end), #38bdf8 var(--pos-end) var(--neu-end), #FACC15 var(--neu-end) 100%)'
                                : 'transparent'
                            }}
                          />
                        </button>
                      );
                    })
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};

export default TaxonomyDomainGrid;
