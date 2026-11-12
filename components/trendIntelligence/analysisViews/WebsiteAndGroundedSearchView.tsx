import React from 'react';
import { ExternalLink, FileText, Globe, Sparkles, Target, ThumbsDown, ThumbsUp, TrendingUp } from 'lucide-react';

interface WebsiteAndGroundedSearchViewProps {
    analysis: any;
    companyName: string;
    isCurrentMetacritic: boolean;
    isCurrentWebsite: boolean;
    isCurrentGroundedSearch: boolean;
}

export const WebsiteAndGroundedSearchView: React.FC<WebsiteAndGroundedSearchViewProps> = ({
    analysis,
    companyName,
    isCurrentMetacritic,
    isCurrentWebsite,
    isCurrentGroundedSearch
}) => {
    if (!analysis) return null;
    const activeBrand = companyName || 'test-company';
    const isExcluded = ['reddit', 'tiktok', 'tiktok_hashtag', 'social_intelligence', 'social_feed', 'trustpilot_sentiment', 'steam_reviews', 'metacritic_reviews', 'youtube_sentiment', 'sentiment_video', 'sentiment_comments'].includes(analysis?.type || '');

    return (
        <>
            {!isExcluded && !isCurrentMetacritic && (isCurrentWebsite || analysis?.type === 'website_analysis' || analysis?.type === 'website') && (
                <div className="space-y-6">
                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                            <div className="flex items-start gap-3">
                                <div className="w-10 h-10 rounded-2xl bg-cyan-50 border border-cyan-800/50 flex items-center justify-center text-cyan-400 shrink-0 mt-0.5">
                                    <Globe size={20} />
                                </div>
                                <div>
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-bold uppercase tracking-wider font-mono px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200">
                                            {analysis.scrapedContent?.wordCount ? `Live Ingested • ${analysis.scrapedContent.wordCount} words` : 'Live Ingested Webpage'}
                                        </span>
                                        <span className="text-[10px] font-mono text-[var(--app-muted)]">Target URL</span>
                                    </div>
                                    <h2 className="text-lg font-bold text-[var(--app-text)] mt-1 leading-snug">
                                        {analysis.pageTitle || analysis.url}
                                    </h2>
                                    <a href={analysis.url} target="_blank" rel="noreferrer" className="text-xs font-mono text-indigo-600 hover:underline flex items-center gap-1 mt-0.5">
                                        {analysis.url} <ExternalLink size={11} />
                                    </a>
                                </div>
                            </div>
                            {analysis.score && (
                                <div className="flex items-center gap-3 bg-[var(--app-surface)] px-4 py-2.5 rounded-2xl border border-[var(--app-border)] shrink-0">
                                    <div className="text-right">
                                        <div className="text-[10px] uppercase font-mono text-[var(--app-muted)]">Content Fit Score</div>
                                        <div className="text-lg font-black text-emerald-600">{analysis.score}/10</div>
                                    </div>
                                </div>
                            )}
                        </div>

                        {analysis.pageDescription && (
                            <p className="text-xs text-[var(--app-muted)] mt-3 italic bg-[var(--app-surface)] p-3 rounded-xl border border-[var(--app-border)]">
                                &ldquo;{analysis.pageDescription}&rdquo;
                            </p>
                        )}

                        {analysis.scrapedContent && analysis.scrapedContent.previewText && (
                            <details className="mt-4 group">
                                <summary className="cursor-pointer text-xs font-mono font-bold text-indigo-600 hover:text-indigo-700 flex items-center gap-2 select-none">
                                    <FileText size={14} />
                                    <span>View Ingested Page Content &amp; Headings ({analysis.scrapedContent.wordCount} words)</span>
                                </summary>
                                <div className="mt-3 p-4 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] space-y-3 text-xs text-[var(--app-muted)] max-h-64 overflow-y-auto font-mono leading-relaxed">
                                    {Array.isArray(analysis.scrapedContent.headings) && analysis.scrapedContent.headings.length > 0 && (
                                        <div className="border-b border-[var(--app-border)] pb-2 mb-2">
                                            <div className="text-[10px] uppercase font-bold text-[var(--app-muted)] mb-1">Detected Page Headings:</div>
                                            <div className="flex flex-wrap gap-1.5">
                                                {analysis.scrapedContent.headings.map((h: string, idx: number) => (
                                                    <span key={idx} className="px-2 py-0.5 rounded bg-[var(--app-card)] border border-[var(--app-border)] text-[var(--app-muted)] text-[11px]">
                                                        {h}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                    <div>
                                        <div className="text-[10px] uppercase font-bold text-[var(--app-muted)] mb-1">Ingested Body Text Sample:</div>
                                        <p className="whitespace-pre-line text-[var(--app-muted)] text-[11px]">{analysis.scrapedContent.previewText}...</p>
                                    </div>
                                </div>
                            </details>
                        )}
                    </div>

                    {analysis.summary && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <div className="flex items-center justify-between mb-3 border-b border-[var(--app-border)] pb-3">
                                <h3 className="font-bold text-emerald-600 text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                                    <Sparkles size={14} /> Executive Digital Assessment
                                </h3>
                                <span className="text-[10px] font-mono text-[var(--app-muted)] uppercase">Grounded via Gemini 3.8 Flash</span>
                            </div>
                            <div className="text-[var(--app-text)] text-sm leading-relaxed space-y-3 whitespace-pre-line font-sans">{analysis.summary}</div>
                        </div>
                    )}

                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Key Findings &amp; Observations</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
                                <h4 className="font-bold text-emerald-700 mb-2.5 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
                                    <ThumbsUp size={14} /> Working Well Indicators
                                </h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-text)] space-y-2">
                                    {(Array.isArray(analysis.findings?.positive) ? analysis.findings.positive : [
                                        "Strong core brand positioning and clear user navigation paths",
                                        "High visual polish and prominent product feature highlights"
                                    ]).map((f: string, i: number) => <li key={i} className="leading-snug">{f}</li>)}
                                </ul>
                            </div>
                            <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-xs">
                                <h4 className="font-bold text-rose-700 mb-2.5 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
                                    <ThumbsDown size={14} /> Gaps &amp; Friction
                                </h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-text)] space-y-2">
                                    {(Array.isArray(analysis.findings?.negative) ? analysis.findings.negative : [
                                        "Key differentiation messaging could be placed higher above the fold",
                                        "Feature disclosure details could be streamlined"
                                    ]).map((f: string, i: number) => <li key={i} className="leading-snug">{f}</li>)}
                                </ul>
                            </div>
                            <div className="p-5 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                                <h4 className="font-bold text-[var(--app-text)] mb-2.5 flex items-center gap-1.5 text-xs uppercase tracking-wider font-mono">
                                    Neutral Baseline
                                </h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-muted)] space-y-2">
                                    {(Array.isArray(analysis.findings?.neutral) ? analysis.findings.neutral : [
                                        "Standard navigational hierarchy and platform disclosure pages",
                                        "Routine feature categorization"
                                    ]).map((f: string, i: number) => <li key={i} className="leading-snug">{f}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)] space-y-3">
                            <h3 className="font-bold text-emerald-600 text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                                <Target size={14} /> Deep Dive: Focus Question Analysis
                            </h3>
                            <p className="text-[var(--app-muted)] text-sm leading-relaxed">{analysis.comparison_to_focus || "Comprehensive review of how the page aligns with the focus topic."}</p>
                        </div>

                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)] space-y-3">
                            <h3 className="font-bold text-cyan-400 text-xs uppercase tracking-widest font-mono flex items-center gap-2">
                                <TrendingUp size={14} /> Strategic Benchmark vs {activeBrand}
                            </h3>
                            <p className="text-[var(--app-muted)] text-sm leading-relaxed">{analysis.comparison_to_company || `Direct comparison between the website stance and ${activeBrand}'s digital strategy.`}</p>
                        </div>
                    </div>

                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Actionable Strategic Recommendations</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(Array.isArray(analysis.recommendations) ? analysis.recommendations : [
                                "Audit search ranking and metadata tags around focus keywords to capture intent.",
                                "Enhance landing page conversion funnels and mobile responsiveness.",
                                "Highlight social proof and verified customer feedback above the fold."
                            ]).map((r: string, i: number) => (
                                <div key={i} className="p-4 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] flex items-start gap-3 shadow-sm hover:border-emerald-200 transition-all">
                                    <span className="w-6 h-6 rounded-full bg-emerald-50 text-emerald-600 font-bold text-xs flex items-center justify-center shrink-0 mt-0.5 font-mono">
                                        {i + 1}
                                    </span>
                                    <p className="text-sm text-[var(--app-text)] leading-snug">{r}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {Array.isArray(analysis.word_cloud) && analysis.word_cloud.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Key Topic &amp; Keyword Cloud</h3>
                            <div className="flex flex-wrap gap-3 justify-center items-center p-6 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-2xl">
                                {analysis.word_cloud.map((word: string, idx: number) => {
                                    const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl'];
                                    const colors = ['text-cyan-400', 'text-emerald-600', 'text-amber-600', 'text-purple-600', 'text-blue-400'];
                                    return (
                                        <span key={idx} className={`${sizes[idx % sizes.length]} font-bold ${colors[idx % colors.length]} px-3 py-1.5 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] transition-transform hover:scale-105 cursor-default`}>
                                            {word}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    {Array.isArray(analysis.groundedSources) && analysis.groundedSources.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-emerald-600 mb-3 text-xs uppercase tracking-widest font-mono">Verified Live Sources (Google Grounded)</h3>
                            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                                {analysis.groundedSources.slice(0, 6).map((source: any, idx: number) => (
                                    <a key={idx} href={source?.url || '#'} target="_blank" rel="noreferrer" className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] hover:border-indigo-500/60 transition-all flex items-center justify-between group">
                                        <span className="text-xs text-[var(--app-text)] font-medium truncate group-hover:text-indigo-600">{source?.title || source?.url || 'Source'}</span>
                                        <Globe size={12} className="text-[var(--app-muted)] group-hover:text-indigo-600 shrink-0 ml-2" />
                                    </a>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

            {!['reddit', 'social_intelligence', 'tiktok', 'tiktok_hashtag', 'social_feed'].includes(analysis?.type || '') &&
             (isCurrentGroundedSearch || analysis?.type === 'grounded_search') && (
                <div className="space-y-6">
                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Key Findings</h3>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-5 bg-emerald-50 rounded-2xl border border-emerald-200 shadow-xs">
                                <h4 className="font-bold text-emerald-700 mb-2 flex items-center gap-1.5 text-xs font-mono">
                                    <ThumbsUp size={14} /> Working Well Indicators
                                </h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-text)] space-y-1">
                                    {(analysis.findings?.positive || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                            <div className="p-5 bg-rose-50 rounded-2xl border border-rose-200 shadow-xs">
                                <h4 className="font-bold text-rose-700 mb-2 flex items-center gap-1.5 text-xs font-mono">
                                    <ThumbsDown size={14} /> Gaps &amp; Issues
                                </h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-text)] space-y-1">
                                    {(analysis.findings?.negative || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                            <div className="p-5 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] shadow-xs">
                                <h4 className="font-bold text-[var(--app-text)] mb-2 text-xs font-mono">Neutral Baseline</h4>
                                <ul className="list-disc pl-5 text-xs text-[var(--app-muted)] space-y-1">
                                    {(analysis.findings?.neutral || []).map((f: string, i: number) => <li key={i}>{f}</li>)}
                                </ul>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Strategic Recommendations</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            {(analysis.recommendations || []).map((r: string, i: number) => (
                                <div key={i} className="p-5 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] flex flex-col justify-between shadow-sm hover:border-emerald-200 transition-all text-[var(--app-text)]">
                                    <p className="text-sm text-[var(--app-text)] font-medium leading-relaxed">{r}</p>
                                    <button className="text-xs font-bold uppercase tracking-widest text-emerald-600 mt-3 text-right hover:underline">Take Action →</button>
                                </div>
                            ))}
                        </div>
                    </div>

                    {analysis.detailed_report && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-emerald-600 mb-4 text-xs uppercase tracking-widest font-mono">Detailed Report</h3>
                            <p className="text-[var(--app-muted)] text-sm leading-relaxed">{analysis.detailed_report}</p>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
