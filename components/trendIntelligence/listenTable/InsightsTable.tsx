import React from 'react';
import {
    CheckCircle2, Compass, Layers, Loader2, MessageSquare,
    Save, Search, Sparkles, Trash2, TrendingUp, X
} from 'lucide-react';
import { FindInsightsModal } from '../findInsights/FindInsightsModal';
import { findInsightsModalState, handleRunFindInsights, triggerModalUpdate } from '../findInsightsStore';
import { InsightsTableRowPreview } from './InsightsTableRowPreview';
import { useInsightsTableActions } from './useInsightsTableActions';

const TOOLBAR_BTN = 'h-8 sm:h-9 px-2.5 sm:px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 transition-all cursor-pointer active:scale-[0.98] disabled:opacity-50';
const REMOVE_BTN = 'h-8 px-2.5 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border border-rose-500/25 transition-all cursor-pointer';

const openFindInsights = () => { findInsightsModalState.isOpen = true; triggerModalUpdate(); };

export interface InsightsTableProps {
    companyName: string;
    onViewAnalysis: (analysisId: string, videos: string[]) => void;
    videoTitles: { [key: string]: any };
    unembeddableVideos?: Record<string, boolean>;
    getVideoId: (url: string) => string;
    fetchVideoTitle: (videoId: string, type?: string) => Promise<void>;
    rows: any[];
    setRows: React.Dispatch<React.SetStateAction<any[]>>;
    isLoadingTable: boolean;
}

export function InsightsTable({
    companyName, onViewAnalysis, videoTitles, unembeddableVideos = {},
    getVideoId, fetchVideoTitle, rows, setRows, isLoadingTable
}: InsightsTableProps) {
    const activeBrand = companyName || 'test-company';
    const companySlug = activeBrand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'testcompany';

    const {
        isSaving, notification, setNotification, analyzingRowIds, isAnalyzingAll, analyzeAllProgress,
        activeCategoryFilter, setActiveCategoryFilter, expandedPreviewRowIds, previewDataByRowId,
        commentSearchByRowId, setCommentSearchByRowId,
        handleSaveTable, handleDeleteRow, handleRemoveAbcdFromRow,
        handleDeleteCategoryRows, handleToggleRowPreview, handleUpdateRow,
        handleAnalyze, handleRunAbcdOnRow, handleRunSentimentOnRow, handleAnalyzeAll
    } = useInsightsTableActions({
        companyName: activeBrand, videoTitles, getVideoId, fetchVideoTitle, rows, setRows
    });

    if (isLoadingTable) {
        return (
            <div className="w-full p-10 bg-[var(--app-card)] dark:bg-[#041527] rounded-2xl border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs flex items-center justify-center gap-3 text-sm font-mono text-[var(--app-muted)] animate-pulse">
                <Loader2 className="animate-spin text-[#38bdf8]" size={18} />
                <span>Loading...</span>
            </div>
        );
    }

    const redditCommunityRows = rows.filter(r => r.type === 'reddit');
    const socialIntelligenceRows = rows.filter(r => ['social_intelligence', 'tiktok_hashtag', 'tiktok'].includes(r.type));
    const abcdRows = rows.filter(r => r.type === 'abcd' || r.type === 'competitor_abcd');
    const sentimentRows = rows.filter(r => ['sentiment_video', 'sentiment_comments', 'steam_reviews', 'trustpilot_sentiment', 'youtube_sentiment', 'youtube', 'metacritic_reviews'].includes(r.type));
    const competitiveRows = rows.filter(r => ['competitive', 'comparative', 'competitor_sentiment_video', 'competitor_sentiment_comments', 'abcd_comparative'].includes(r.type));
    const trendFashionRows = rows.filter(r => ['trend_analysis', 'fashion_analysis'].includes(r.type));
    const searchWebsiteRows = rows.filter(r => ['grounded_search', 'website_analysis'].includes(r.type));
    const metadataRows = rows.filter(r => r.type === 'video_metadata');
    const otherRows = rows.filter(r => !['reddit', 'social_intelligence', 'tiktok_hashtag', 'tiktok', 'abcd', 'competitor_abcd', 'sentiment_video', 'sentiment_comments', 'steam_reviews', 'trustpilot_sentiment', 'youtube_sentiment', 'youtube', 'metacritic_reviews', 'competitive', 'comparative', 'competitor_sentiment_video', 'competitor_sentiment_comments', 'abcd_comparative', 'trend_analysis', 'fashion_analysis', 'grounded_search', 'website_analysis', 'video_metadata'].includes(r.type));
    const otherCombinedCount = socialIntelligenceRows.length + competitiveRows.length + trendFashionRows.length + searchWebsiteRows.length + metadataRows.length + otherRows.length;

    const renderRow = (row: any) => (
        <InsightsTableRowPreview
            key={row.id} row={row} rows={rows} companyName={activeBrand}
            videoTitles={videoTitles} unembeddableVideos={unembeddableVideos} getVideoId={getVideoId}
            expandedPreviewRowIds={expandedPreviewRowIds} previewDataByRowId={previewDataByRowId}
            commentSearchByRowId={commentSearchByRowId} setCommentSearchByRowId={setCommentSearchByRowId}
            analyzingRowIds={analyzingRowIds} isAnalyzingAll={isAnalyzingAll} onViewAnalysis={onViewAnalysis}
            handleToggleRowPreview={handleToggleRowPreview} handleUpdateRow={handleUpdateRow}
            handleAnalyze={handleAnalyze} handleDeleteRow={handleDeleteRow}
            handleRunAbcdOnRow={handleRunAbcdOnRow} handleRemoveAbcdFromRow={handleRemoveAbcdFromRow}
            handleRunSentimentOnRow={handleRunSentimentOnRow}
        />
    );

    const renderSimpleSection = (sectionRows: any[], label: string, colorCls: string) => sectionRows.length > 0 && (
        <>
            <tr className="bg-[var(--app-surface)] border-y border-[var(--app-border)]">
                <td colSpan={5} className={`p-3 font-bold uppercase text-xs tracking-wider ${colorCls}`}>
                    {label} ({sectionRows.length})
                </td>
            </tr>
            {sectionRows.map(row => renderRow(row))}
        </>
    );

    const pendingCount = rows.filter(r => r.status !== 'completed' && r.status !== 'complete').length;
    const showReddit = activeCategoryFilter === 'all' || activeCategoryFilter === 'reddit';
    const showAbcd = activeCategoryFilter === 'all' || activeCategoryFilter === 'abcd';
    const showSentiment = activeCategoryFilter === 'all' || activeCategoryFilter === 'sentiment';
    const showOther = activeCategoryFilter === 'all' || activeCategoryFilter === 'other';

    return (
        <div className="w-full space-y-4 text-[var(--app-text)] dark:text-slate-100">
            {notification && (
                <div className="px-4 py-2.5 rounded-xl bg-emerald-50 dark:bg-emerald-500/10 border border-emerald-200 dark:border-emerald-500/30 text-emerald-800 dark:text-emerald-200 text-xs font-bold flex items-center justify-between">
                    <span>{notification}</span>
                    <button type="button" onClick={() => setNotification(null)} className="text-emerald-700 hover:text-emerald-950 dark:text-emerald-300 dark:hover:text-white"><X size={14} /></button>
                </div>
            )}

            <div className="flex flex-col lg:flex-row justify-between lg:items-center gap-3">
                <div className="space-y-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                        <h2 className="text-xl sm:text-2xl font-bold text-[var(--app-text)]">{activeBrand} Unified Listen &amp; Insights Table</h2>
                        <span className="px-2.5 py-1 rounded-full text-xs font-mono font-bold bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)] whitespace-nowrap">
                            {rows.length} Total Items
                        </span>
                    </div>
                    <p className="text-xs text-[var(--app-muted)]">
                        All videos, community comments, Reddit threads, and ABCD creative evaluations organized in one table. Click <strong>Preview &amp; Comments</strong> on any row to inspect content and comments, or <strong>Delete</strong> to remove items.
                    </p>
                </div>

                <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar shrink-0">
                    <button type="button" onClick={openFindInsights} className={`${TOOLBAR_BTN} bg-[#0072BC] hover:bg-[#0284C7] text-white keep-white-text border border-[#0072BC]/60 shadow-xs`}>
                        <Search size={14} className="shrink-0" /><span>Find Insights</span>
                    </button>

                    <button
                        type="button"
                        onClick={handleAnalyzeAll}
                        disabled={isAnalyzingAll || pendingCount === 0}
                        title={pendingCount === 0 ? "All items analyzed" : `Analyze ${pendingCount} pending item${pendingCount > 1 ? 's' : ''}`}
                        className={`${TOOLBAR_BTN} bg-[#041E3A] hover:bg-[#072B54] text-white keep-white-text border border-[#1E3A5F] shadow-xs ${isAnalyzingAll ? 'cursor-wait' : pendingCount === 0 ? 'cursor-not-allowed' : ''}`}
                    >
                        {isAnalyzingAll ? (
                            <><Loader2 size={14} className="animate-spin shrink-0" /><span>Analyzing ({analyzeAllProgress?.current || 0}/{analyzeAllProgress?.total || pendingCount})...</span></>
                        ) : pendingCount > 0 ? (
                            <><Sparkles size={14} className="shrink-0" /><span>Analyze All ({pendingCount})</span></>
                        ) : (
                            <><CheckCircle2 size={14} className="shrink-0" /><span>Analyze All</span></>
                        )}
                    </button>

                    <button type="button" onClick={() => handleSaveTable()} disabled={isSaving} className={`${TOOLBAR_BTN} bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-100 dark:hover:bg-[#0C2647] text-[var(--app-text)] dark:text-[#F8F6F0] border border-[var(--app-border)] dark:border-[#1E3A5F] shadow-2xs`}>
                        {isSaving ? <Loader2 size={14} className="animate-spin shrink-0" /> : <Save size={14} className="shrink-0" />}<span>Save Table</span>
                    </button>
                </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[var(--app-border)]">
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar max-w-full">
                    {[
                        { id: 'all', label: `All Items (${rows.length})` },
                        { id: 'sentiment', label: `Videos & Sentiment (${sentimentRows.length})` },
                        { id: 'reddit', label: `Reddit Threads (${redditCommunityRows.length})` },
                        { id: 'abcd', label: `ABCD Analysis (${abcdRows.length})` },
                        ...(otherCombinedCount > 0 ? [{ id: 'other', label: `Other Sources (${otherCombinedCount})` }] : [])
                    ].map(tab => (
                        <button
                            key={tab.id}
                            type="button"
                            onClick={() => setActiveCategoryFilter(tab.id as any)}
                            className={`h-8 px-2.5 sm:px-3 rounded-lg text-xs font-medium inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 border transition-all cursor-pointer ${
                                activeCategoryFilter === tab.id
                                    ? 'bg-[#0072BC]/10 text-[#005a96] border-[#0072BC]/40 dark:bg-[#0072BC]/20 dark:text-sky-300 dark:border-sky-500/40'
                                    : 'bg-[var(--app-surface)] hover:bg-slate-100 text-[var(--app-muted)] border-[var(--app-border)] dark:bg-[#061C36] dark:hover:bg-[#0C2647] dark:text-[#D8E1EB] dark:border-[#041E3A]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>

                <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar">
                    {redditCommunityRows.length > 0 && (
                        <button type="button" onClick={() => handleDeleteCategoryRows(redditCommunityRows, 'Reddit Thread', '__all_reddit__')} className={REMOVE_BTN}>
                            <Trash2 size={13} className="shrink-0" /><span>Remove All Reddit Threads ({redditCommunityRows.length})</span>
                        </button>
                    )}
                    {abcdRows.length > 0 && (
                        <button type="button" onClick={() => handleDeleteCategoryRows(abcdRows, 'ABCD Analysis', '__all_abcd__')} className={REMOVE_BTN}>
                            <Trash2 size={13} className="shrink-0" /><span>Remove All ABCD Analysis ({abcdRows.length})</span>
                        </button>
                    )}
                </div>
            </div>

            <div className="w-full bg-[var(--app-card)] dark:bg-[#041527] border border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl">
                <table className="w-full border-collapse">
                    <thead>
                        <tr className="border-b border-[var(--app-border)] bg-[var(--app-surface)]/80">
                            <th className="p-2.5 sm:p-3 font-bold text-xs text-[var(--app-muted)] text-center w-[14%] rounded-tl-2xl">Content Preview</th>
                            <th className="p-2.5 sm:p-3 font-bold text-xs text-[var(--app-muted)] text-center w-[17%]">Category / Type</th>
                            <th className="p-2.5 sm:p-3 font-bold text-xs text-[var(--app-muted)] text-center w-[29%]">Source URL / Target</th>
                            <th className="p-2.5 sm:p-3 font-bold text-xs text-[var(--app-muted)] text-center w-[10%]">Status</th>
                            <th className="p-2.5 sm:p-3 font-bold text-xs text-[var(--app-muted)] text-center w-[30%] rounded-tr-2xl">Preview, ABCD &amp; Delete Actions</th>
                        </tr>
                    </thead>
                    <tbody>
                            {showSentiment && sentimentRows.length > 0 && (
                                <>
                                    <tr className="bg-[var(--app-surface)] border-y border-[var(--app-border)]">
                                        <td colSpan={5} className="p-3 font-bold text-teal-800 dark:text-teal-300 uppercase text-xs tracking-wider">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <TrendingUp size={14} className="text-teal-600 dark:text-teal-300" />
                                                    <span>Video &amp; Comment Sentiment Analysis ({sentimentRows.length})</span>
                                                </div>
                                                <span className="text-[11px] font-mono font-normal text-[var(--app-muted)]">
                                                    Click &ldquo;Preview &amp; Comments&rdquo; on any row to watch video and inspect viewer comments
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {sentimentRows.map(row => renderRow(row))}
                                </>
                            )}

                            {showReddit && redditCommunityRows.length > 0 && (
                                <>
                                    <tr className="bg-orange-50/60 dark:bg-orange-500/10 border-y border-orange-200 dark:border-orange-500/25">
                                        <td colSpan={5} className="p-3 font-bold text-orange-900 dark:text-orange-200 uppercase text-xs tracking-wider">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <MessageSquare size={14} className="text-orange-600 dark:text-orange-300" />
                                                <span>Reddit Community Threads ({redditCommunityRows.length})</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-orange-100 text-orange-800 border border-orange-300 dark:bg-orange-500/15 dark:text-orange-200 dark:border-orange-500/30">
                                                    {`r/${companySlug} • Community Discussions`}
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {redditCommunityRows.map(row => renderRow(row))}
                                </>
                            )}

                            {showAbcd && abcdRows.length > 0 && (
                                <>
                                    <tr className="bg-violet-50/60 dark:bg-violet-500/10 border-y border-violet-200 dark:border-violet-500/25">
                                        <td colSpan={5} className="p-3 font-bold text-violet-900 dark:text-violet-200 uppercase text-xs tracking-wider">
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <Layers size={14} className="text-violet-600 dark:text-violet-300" />
                                                <span>ABCD Creative Analysis ({abcdRows.length})</span>
                                                <span className="px-2 py-0.5 rounded-full text-[10px] font-mono bg-violet-100 text-violet-800 border border-violet-300 dark:bg-violet-500/15 dark:text-violet-200 dark:border-violet-500/30">
                                                    Attract • Brand • Connect • Direct
                                                </span>
                                            </div>
                                        </td>
                                    </tr>
                                    {abcdRows.map(row => renderRow(row))}
                                </>
                            )}

                            {showOther && socialIntelligenceRows.length > 0 && (
                                <>
                                    <tr className="bg-[var(--app-surface)] border-y border-[var(--app-border)]">
                                        <td colSpan={5} className="p-3 font-bold text-indigo-700 dark:text-indigo-300 uppercase text-xs tracking-wider">
                                            <div className="flex items-center justify-between flex-wrap gap-2">
                                                <div className="flex items-center gap-2">
                                                    <Compass size={14} className="text-indigo-600 dark:text-indigo-300" />
                                                    <span>Social &amp; Community Intelligence ({socialIntelligenceRows.length})</span>
                                                </div>
                                                <button type="button" onClick={() => handleDeleteCategoryRows(socialIntelligenceRows, 'Social Intelligence')} className={`${REMOVE_BTN} normal-case tracking-normal`}>
                                                    <Trash2 size={13} /><span>Remove Section</span>
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    {socialIntelligenceRows.map(row => renderRow(row))}
                                </>
                            )}

                            {showOther && renderSimpleSection(competitiveRows, 'Competitive Benchmarking', 'text-amber-700')}
                            {showOther && renderSimpleSection(trendFashionRows, 'Trend & Visual Analysis', 'text-violet-700')}
                            {showOther && renderSimpleSection(searchWebsiteRows, 'Search & Website Analysis', 'text-blue-700')}
                            {showOther && renderSimpleSection(metadataRows, 'Video Metadata Extraction', 'text-pink-700')}
                            {showOther && renderSimpleSection(otherRows, 'Other Analysis', 'text-[var(--app-muted)]')}

                            {rows.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="p-8 sm:p-10 text-center text-sm text-[var(--app-muted)]">
                                        <div className="flex flex-col items-center gap-3 max-w-lg mx-auto">
                                            <p className="text-sm font-bold text-[var(--app-text)]">No items in the Filter Pipeline yet</p>
                                            <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                                                Add YouTube, Steam, Reddit, Metacritic, or Web URLs to start listening and running the Filter Pipeline.
                                            </p>
                                            <button type="button" onClick={openFindInsights} className="px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#0072BC] hover:bg-[#0284C7] text-white keep-white-text inline-flex items-center gap-1.5 whitespace-nowrap transition-all cursor-pointer active:scale-[0.98] shadow-xs">
                                                <Search size={14} className="shrink-0" /><span>Find Insights &amp; Add Sources</span>
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
            </div>

            <FindInsightsModal
                isOpen={findInsightsModalState.isOpen}
                prompt={findInsightsModalState.prompt}
                setPrompt={(val) => { findInsightsModalState.prompt = val; triggerModalUpdate(); }}
                enableGroundedSearch={findInsightsModalState.enableGroundedSearch}
                setEnableGroundedSearch={(val) => { findInsightsModalState.enableGroundedSearch = val; triggerModalUpdate(); }}
                selectedContentTypes={findInsightsModalState.selectedContentTypes}
                setSelectedContentTypes={(val) => { findInsightsModalState.selectedContentTypes = val; triggerModalUpdate(); }}
                setIsOpen={(val) => { findInsightsModalState.isOpen = val; triggerModalUpdate(); }}
                foundInsights={findInsightsModalState.foundInsights}
                isFindingInsights={findInsightsModalState.isFindingInsights}
                onRunSearch={() => handleRunFindInsights(activeBrand)}
                companyName={activeBrand}
                existingRows={rows}
            />
        </div>
    );
}
