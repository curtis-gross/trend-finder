import React from 'react';
import {
    AlertCircle, Award, BarChart2, Check, ChevronDown, ChevronUp, Compass, Eye, FileText,
    Globe, Layers, Loader2, MessageSquare, Music, PieChart as PieChartIcon, Play, RotateCw,
    Search, Settings, Sparkles, Star, Trash2, TrendingUp, X
} from 'lucide-react';
import { getRedditDisplayTitle } from '../../../services/geminiService';
import { SUPPORTED_INSIGHT_TYPES } from '../typesAndConstants';
import { extractCommentsFromAnalysisPayload } from './rowAnalysisExecutor';
import { RowCommentsPreviewColumn } from './RowCommentsPreviewColumn';
import { RowContentPreviewColumn } from './RowContentPreviewColumn';

const ROW_BTN = 'h-7 px-2 rounded-lg text-[11px] font-semibold inline-flex items-center gap-1 whitespace-nowrap shrink-0 border transition-all cursor-pointer active:scale-[0.98] disabled:opacity-40 disabled:cursor-not-allowed';
const TONE_NEUTRAL = 'bg-[var(--app-surface)] hover:bg-slate-100 text-[var(--app-text)] border-[var(--app-border)] dark:bg-[#061C36] dark:hover:bg-[#0C2647] dark:text-[#D8E1EB] dark:border-[#1E3A5F]';
const TONE_ROSE = 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-300 border-rose-500/25';
const TONE_AMBER = 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-700 dark:text-amber-300 border-amber-500/30';
const TONE_VIOLET = 'bg-violet-500/10 hover:bg-violet-500/20 text-violet-700 dark:text-violet-300 border-violet-500/30';
const TONE_EMERALD = 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-emerald-500/30';

interface InsightsTableRowPreviewProps {
    row: any;
    rows: any[];
    companyName: string;
    videoTitles: Record<string, any>;
    unembeddableVideos: Record<string, boolean>;
    getVideoId: (url: string) => string;
    expandedPreviewRowIds: Set<string>;
    previewDataByRowId: Record<string, any>;
    commentSearchByRowId: Record<string, string>;
    setCommentSearchByRowId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    analyzingRowIds: Set<string>;
    isAnalyzingAll: boolean;
    onViewAnalysis: (analysisId: string, videos: string[]) => void;
    handleToggleRowPreview: (row: any) => void;
    handleUpdateRow: (id: string, field: string, value: any) => void;
    handleAnalyze: (id: string) => void;
    handleDeleteRow: (id: string) => void;
    handleRunAbcdOnRow: (row: any) => void;
    handleRemoveAbcdFromRow: (row: any) => void;
    handleRunSentimentOnRow: (row: any) => void;
}

export const InsightsTableRowPreview: React.FC<InsightsTableRowPreviewProps> = ({
    row, rows, companyName, videoTitles, unembeddableVideos, getVideoId,
    expandedPreviewRowIds, previewDataByRowId, commentSearchByRowId, setCommentSearchByRowId,
    analyzingRowIds, isAnalyzingAll, onViewAnalysis, handleToggleRowPreview, handleUpdateRow,
    handleAnalyze, handleDeleteRow, handleRunAbcdOnRow, handleRemoveAbcdFromRow, handleRunSentimentOnRow
}) => {
    const [failedThumbKeys, setFailedThumbKeys] = React.useState<Record<string, boolean>>({});
    const activeBrand = companyName || 'test-company';
    const companySlug = activeBrand.toLowerCase().replace(/[^a-z0-9]/g, '') || 'testcompany';
    const firstVidRaw = Array.isArray(row?.videos) && row.videos.length > 0 ? String(row.videos[0] || '') : String(row?.url || '');
    const videoId = getVideoId(firstVidRaw);
    const isValidYtId = /^[a-zA-Z0-9_-]{11}$/.test(String(videoId));
    const isPreviewExpanded = expandedPreviewRowIds.has(row.id);
    const previewState = previewDataByRowId[row.id];
    const previewAnalysis = previewState?.analysis || row.result || row.preloadedResult || null;
    const summaryObj = previewAnalysis || row;
    const previewAbcd = previewState?.abcdAnalysis || (row.type === 'abcd' ? previewAnalysis : null);
    const rawPreviewComments = previewState?.comments || extractCommentsFromAnalysisPayload(previewAnalysis, row);
    const commentQuery = (commentSearchByRowId[row.id] || '').toLowerCase().trim();
    const filteredPreviewComments = commentQuery
        ? rawPreviewComments.filter((c: any) =>
              String(c.text || '').toLowerCase().includes(commentQuery) ||
              String(c.author || '').toLowerCase().includes(commentQuery)
          )
        : rawPreviewComments;

    const getRowPlaceholder = (type: string) => {
        if (type === 'reddit') return `Subreddit or URL (e.g. https://www.reddit.com/r/${companySlug}/)`;
        if (type === 'tiktok' || type === 'tiktok_hashtag') return `TikTok Hashtag (e.g. #${companySlug})`;
        if (type === 'social_intelligence') return `Social Query (e.g. ${activeBrand})`;
        if (type === 'metacritic_reviews') return 'Metacritic URL';
        if (type === 'trustpilot_sentiment') return `Trustpilot URL (e.g. https://www.trustpilot.com/review/${companySlug}.com)`;
        if (type === 'website_analysis') return `Website URL (e.g. https://www.${companySlug}.com)`;
        if (type === 'grounded_search') return 'Enter your question here';
        return 'YouTube Video ID or URL';
    };

    const isYtRow = ['youtube', 'youtube_sentiment', 'sentiment_video', 'sentiment_comments', 'abcd', 'youtube_abcd', 'creator_partner', 'fashion_analysis', 'trend_analysis'].includes(row.type) ||
        firstVidRaw.includes('youtube.com') || firstVidRaw.includes('youtu.be') || isValidYtId;
    const linkedAbcdRow = isYtRow && videoId ? (rows || []).find(r => (r.type === 'abcd' || r.type === 'youtube_abcd') && (getVideoId(r.videos?.[0] || r.url || '') === videoId)) : null;
    const abcdId = row.abcdAnalysisId || linkedAbcdRow?.analysisId || (row.type === 'abcd' ? row.analysisId : null);
    const abcdScore = row.abcdScore ?? linkedAbcdRow?.abcdScore ?? 85;
    const isRunningAbcd = analyzingRowIds.has(`abcd_${row.id}`);
    const linkedSentRow = isYtRow && videoId ? (rows || []).find(r => (r.type === 'youtube_sentiment' || r.type === 'sentiment_video' || r.type === 'sentiment_comments') && (getVideoId(r.videos?.[0] || r.url || '') === videoId)) : null;
    const sentId = row.sentimentAnalysisId || linkedSentRow?.analysisId || (row.type === 'youtube_sentiment' ? row.analysisId : null);
    const isRunningSent = analyzingRowIds.has(`sent_${row.id}`);

    const renderTypeIcon = (t: string) => {
        if (t === 'reddit') return <MessageSquare size={15} className="text-orange-500 shrink-0" />;
        if (t === 'tiktok' || t === 'tiktok_hashtag') return <Music size={15} className="text-pink-500 shrink-0" />;
        if (t === 'abcd') return <Layers size={15} className="text-violet-600 shrink-0" />;
        if (t === 'youtube_sentiment' || t === 'sentiment_video' || t === 'sentiment_comments') return <TrendingUp size={15} className="text-emerald-600 shrink-0" />;
        if (t === 'competitive') return <Eye size={15} className="text-amber-600 shrink-0" />;
        if (t === 'comparative') return <BarChart2 size={15} className="text-rose-600 shrink-0" />;
        if (t === 'steam_reviews') return <FileText size={15} className="text-orange-500 shrink-0" />;
        if (t === 'metacritic_reviews') return <Award size={15} className="text-amber-600 shrink-0" />;
        if (t === 'trustpilot_sentiment') return <Star size={15} className="text-[#00b67a] fill-[#00b67a] shrink-0" />;
        if (t === 'social_intelligence') return <Compass size={15} className="text-[#041E3A] shrink-0" />;
        if (t === 'competitor_abcd') return <Layers size={15} className="text-rose-500 shrink-0" />;
        if (t === 'competitor_sentiment_video') return <TrendingUp size={15} className="text-rose-500 shrink-0" />;
        if (t === 'competitor_sentiment_comments') return <PieChartIcon size={15} className="text-rose-500 shrink-0" />;
        if (t === 'trend_analysis') return <Globe size={15} className="text-violet-500 shrink-0" />;
        return null;
    };

    return (
        <React.Fragment>
            <tr className={`border-b border-[var(--app-border)] transition-colors ${isPreviewExpanded ? 'bg-[#F8F6F1]/60 dark:bg-[#061C36]/60' : 'hover:bg-[var(--app-surface)]'}`}>
                <td className="p-2.5 text-center w-[14%] align-middle">
                    <div className="flex flex-col gap-1.5 items-center mx-auto max-w-full">
                        {(Array.isArray(row?.videos) ? row.videos : ['']).map((vid: string, idx: number) => {
                            const isSocial = row.type === 'social_intelligence' || row.type === 'tiktok_hashtag' || row.type === 'social_feed';
                            const isReddit = row.type === 'reddit';
                            const id = isSocial || isReddit ? vid : (getVideoId(vid) || vid);
                            const titleObj: any = id ? videoTitles[id] : null;
                            const redditDefaultTitle = vid ? getRedditDisplayTitle(vid) : 'Reddit Thread';
                            const itemTitle = (isReddit && row.title) ? row.title
                                : (typeof titleObj === 'object' && titleObj !== null ? titleObj.title : (titleObj || row.title || (isSocial ? `Social: ${id || 'Query'}` : isReddit ? redditDefaultTitle : id ? `Video (${id})` : 'New Item')));

                            const isMcItem = row.type === 'metacritic_reviews' || String(id).includes('metacritic.com') || String(vid).includes('metacritic.com');
                            const isNonYtHttp = String(id).startsWith('http') && !String(id).includes('youtube.com') && !String(id).includes('youtu.be');
                            const validYt = /^[a-zA-Z0-9_-]{11}$/.test(String(id));
                            const rawTitleImage = typeof titleObj === 'object' && titleObj?.image ? String(titleObj.image) : '';
                            const safeTitleImage = rawTitleImage && !rawTitleImage.includes('unsplash.com') && rawTitleImage !== '/images/website_placeholder.png' ? rawTitleImage : '';
                            const imageUrl = safeTitleImage
                                ? safeTitleImage
                                : isMcItem ? 'https://www.metacritic.com/favicon.ico'
                                : row.type === 'trustpilot_sentiment' ? 'https://cdn.trustpilot.net/brand-assets/4.3.0/favicons/apple-touch-icon.png'
                                : row.type === 'steam_reviews' && id ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${id}/header.jpg`
                                : validYt ? `https://img.youtube.com/vi/${id}/mqdefault.jpg`
                                : '';
                            const thumbKey = `${row.id}-${idx}-${imageUrl}`;
                            const showFallbackIcon = !imageUrl || Boolean(failedThumbKeys[thumbKey]);

                            return (
                                <div key={idx} className="flex flex-col items-center gap-1 max-w-full min-w-0">
                                    <button
                                        type="button"
                                        onClick={() => handleToggleRowPreview(row)}
                                        className="w-[112px] h-[64px] sm:w-[128px] sm:h-[72px] overflow-hidden rounded-xl border border-[var(--app-border)] flex items-center justify-center bg-[var(--app-surface)] relative group cursor-pointer shadow-2xs hover:border-[#041E3A] transition-all shrink-0"
                                        title="Click to preview content & comments inside this item"
                                    >
                                        {row.type === 'grounded_search' ? (
                                            <Search size={24} className="text-[var(--app-muted)]" />
                                        ) : isMcItem ? (
                                            <div className="flex flex-col items-center justify-center text-amber-600">
                                                <Award size={22} />
                                                <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Metacritic</span>
                                            </div>
                                        ) : showFallbackIcon ? (
                                            isReddit ? (
                                                <div className="flex flex-col items-center justify-center text-orange-500">
                                                    <MessageSquare size={22} />
                                                    <span className="text-[9px] font-black uppercase tracking-wider mt-0.5">Reddit</span>
                                                </div>
                                            ) : (row.type === 'website_analysis' || isNonYtHttp) ? (
                                                <Globe size={24} className="text-[var(--app-muted)]" />
                                            ) : isSocial ? (
                                                <Compass size={24} className="text-[var(--app-muted)]" />
                                            ) : (
                                                <Play size={22} className="text-[var(--app-muted)]" />
                                            )
                                        ) : (
                                            <img
                                                src={imageUrl}
                                                alt="Thumbnail"
                                                onError={() => setFailedThumbKeys(prev => ({ ...prev, [thumbKey]: true }))}
                                                className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                                            />
                                        )}
                                        {isReddit && <span className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded bg-orange-600 text-white keep-white-text text-[8px] font-black uppercase tracking-wider shadow-xs max-w-[72px] truncate">{row.subreddit || 'Reddit'}</span>}
                                        {row.type === 'abcd' && <span className="absolute top-1 left-1 px-1.5 py-0.5 rounded bg-violet-600 text-white keep-white-text text-[8px] font-black uppercase tracking-wider shadow-xs">ABCD</span>}
                                        <span style={{ backgroundColor: 'rgba(24, 20, 18, 0.84)' }} className="absolute bottom-1 right-1 px-1.5 py-0.5 rounded text-white keep-white-text text-[9px] font-bold flex items-center gap-0.5 shadow-xs">
                                            <Eye size={10} className="text-white keep-white-text" />
                                            <span>{isPreviewExpanded ? 'Hide' : 'Preview'}</span>
                                        </span>
                                    </button>
                                    <div className="text-[10px] text-[var(--app-muted)] font-bold line-clamp-2 whitespace-normal break-words max-w-[140px] text-center leading-tight" title={itemTitle}>
                                        {itemTitle}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </td>
                <td className="p-2.5 text-center w-[17%] align-middle">
                    <div className="flex flex-col items-center gap-1.5 max-w-full min-w-0">
                        <div className="flex flex-row items-center gap-2 justify-center max-w-full min-w-0">
                            {renderTypeIcon(row.type)}
                            <select
                                value={row.type}
                                onChange={(e) => handleUpdateRow(row.id, 'type', e.target.value)}
                                className="p-2 bg-[var(--app-surface)] text-[var(--app-text)] border border-[var(--app-border)] rounded-xl mx-auto text-xs font-bold w-full max-w-[164px] min-w-0 truncate focus:outline-hidden focus:border-[#041E3A] focus:ring-1 focus:ring-[#041E3A]"
                            >
                                {SUPPORTED_INSIGHT_TYPES.map(type => (
                                    <option key={type.id} value={type.id} className="text-[var(--app-text)] bg-[var(--app-surface)]">{type.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>
                </td>
                <td className="p-2.5 text-center w-[29%] min-w-[180px] align-middle">
                    <div className="w-full max-w-full min-w-0 overflow-hidden space-y-1.5">
                        {row.type === 'reddit' && (row.title || row.overallSummary || row.sourceStage) && (
                            <div className="px-2.5 py-2 rounded-xl bg-orange-50 border border-orange-200 text-left flex flex-col gap-1 w-full max-w-full min-w-0 overflow-hidden">
                                <div className="flex items-start justify-between gap-1.5 w-full min-w-0">
                                    <span className="text-xs font-bold text-[var(--app-text)] whitespace-normal break-words line-clamp-2 min-w-0 flex-1 leading-snug" title={row.title || 'Reddit Community Thread'}>
                                        {row.title || 'Reddit Community Thread'}
                                    </span>
                                    <span className="px-1.5 py-0.5 rounded-full text-[9px] font-mono font-bold uppercase tracking-wider bg-orange-100 text-orange-800 border border-orange-300 shrink-0 max-w-[110px] truncate">
                                        {row.sourceStage || 'Reddit'}
                                    </span>
                                </div>
                                {row.overallSummary && <p className="text-[11px] text-[var(--app-muted)] leading-snug whitespace-normal break-words line-clamp-2 w-full min-w-0">{row.overallSummary}</p>}
                                {summaryObj?.why_it_matters && <p className="text-[11px] text-[var(--app-muted)] leading-snug whitespace-normal break-words">{summaryObj.why_it_matters}</p>}
                            </div>
                        )}
                        {(Array.isArray(row?.videos) ? row.videos : ['']).map((vid: string, idx: number) => (
                            row.type === 'grounded_search' ? (
                                <textarea
                                    key={idx} value={vid} rows={2} placeholder="Enter your question here"
                                    onChange={(e) => { const newVids = [...(Array.isArray(row?.videos) ? row.videos : [])]; newVids[idx] = e.target.value; handleUpdateRow(row.id, 'videos', newVids); }}
                                    className="p-2 bg-[var(--app-surface)] text-[var(--app-text)] border border-[var(--app-border)] rounded-xl w-full max-w-full min-w-0 mb-1 min-h-[60px] resize-y text-xs placeholder-slate-400 focus:outline-hidden focus:border-[#041E3A] focus:ring-1 focus:ring-[#041E3A]"
                                />
                            ) : (
                                <div key={idx} className="w-full max-w-full min-w-0 space-y-0.5">
                                    <input
                                        value={vid} title={vid} placeholder={getRowPlaceholder(row.type)}
                                        onChange={(e) => { const newVids = [...(Array.isArray(row.videos) ? row.videos : [''])]; newVids[idx] = e.target.value; handleUpdateRow(row.id, 'videos', newVids); }}
                                        className="p-2 bg-[var(--app-surface)] text-[var(--app-text)] border border-[var(--app-border)] rounded-xl w-full max-w-full min-w-0 truncate text-xs placeholder-slate-400 focus:outline-hidden focus:border-[#041E3A] focus:ring-1 focus:ring-[#041E3A]"
                                    />
                                    {String(vid || '').startsWith('http') && (
                                        <a href={vid} target="_blank" rel="noopener noreferrer" title={vid} className="block w-full max-w-full truncate break-all text-[10px] font-mono text-[#041E3A] hover:text-[#9C7A3C] hover:underline text-left px-1">
                                            {vid.replace(/^https?:\/\/(www\.)?/, '')}
                                        </a>
                                    )}
                                </div>
                            )
                        ))}
                        {row.type === 'comparative' && (row.videos || []).length < 2 && (
                            <button onClick={() => handleUpdateRow(row.id, 'videos', [...(row.videos || []), ''])} className="text-[#041E3A] hover:text-[#9C7A3C] text-xs font-bold">+ Add Video</button>
                        )}
                        {row.type === 'website_analysis' && (
                            <div className="flex items-center gap-1 mt-1 w-full max-w-full min-w-0">
                                <Settings size={16} className="text-[var(--app-muted)] shrink-0" />
                                <input
                                    value={row.focus || ''}
                                    onChange={(e) => handleUpdateRow(row.id, 'focus', e.target.value)}
                                    placeholder="Focus area (e.g. Customer sentiment & product experience)"
                                    className="p-2 bg-[var(--app-surface)] text-[var(--app-text)] border border-[var(--app-border)] rounded-xl w-full max-w-full min-w-0 text-xs placeholder-slate-400 focus:outline-hidden focus:border-[#041E3A] focus:ring-1 focus:ring-[#041E3A]"
                                />
                            </div>
                        )}
                    </div>
                </td>
                <td className="p-2.5 text-center w-[10%] align-middle whitespace-nowrap">
                    {(row.status === 'completed' || row.status === 'complete') ? (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-mono inline-flex items-center gap-1 whitespace-nowrap">
                            <Check size={11} /> completed
                        </span>
                    ) : row.status === 'error' ? (
                        <span title={row.error || "Analysis failed. Click retry to run again."} className="px-2 py-0.5 text-xs font-bold rounded-full bg-rose-500/10 text-rose-700 dark:text-rose-300 border border-rose-500/30 font-mono inline-flex items-center gap-1 whitespace-nowrap cursor-help">
                            <AlertCircle size={11} /> failed
                        </span>
                    ) : (
                        <span className="px-2 py-0.5 text-xs font-bold rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-mono inline-flex items-center gap-1 whitespace-nowrap">
                            pending
                        </span>
                    )}
                </td>
                <td className="p-2.5 text-center w-[30%] align-middle">
                    <div className="flex flex-row items-center gap-1 mx-auto w-fit flex-nowrap justify-center">
                        <button
                            type="button"
                            onClick={() => handleToggleRowPreview(row)}
                            className={`${ROW_BTN} ${isPreviewExpanded ? 'bg-[#0072BC] hover:bg-[#005a96] text-white keep-white-text border-[#0072BC]' : TONE_NEUTRAL}`}
                            title="Preview content & comments inside this row"
                        >
                            <MessageSquare size={12} />
                            <span>{isPreviewExpanded ? 'Hide Preview' : 'Preview & Comments'}</span>
                            {isPreviewExpanded ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                        </button>

                        {(row.status === 'pending' || !row.status) && (
                            <button type="button" onClick={() => handleAnalyze(row.id)} disabled={analyzingRowIds.has(row.id) || isAnalyzingAll} className={`${ROW_BTN} bg-[#041E3A] hover:bg-[#072B54] text-white keep-white-text border-[#1E3A5F]`} title="Run Analysis">
                                {analyzingRowIds.has(row.id) ? <Loader2 className="animate-spin" size={12} /> : <Play size={12} />}
                                <span>Analyze</span>
                            </button>
                        )}

                        {row.status === 'error' && (
                            <button type="button" onClick={() => handleAnalyze(row.id)} disabled={analyzingRowIds.has(row.id) || isAnalyzingAll} className={`${ROW_BTN} ${TONE_ROSE}`} title={`Retry Analysis: ${row.error || 'Failed'}`}>
                                {analyzingRowIds.has(row.id) ? <Loader2 className="animate-spin" size={12} /> : <RotateCw size={12} />}
                                <span>Retry</span>
                            </button>
                        )}

                        {(row.status === 'completed' || row.status === 'complete') && (
                            <>
                                <button type="button" onClick={() => handleAnalyze(row.id)} disabled={analyzingRowIds.has(row.id) || isAnalyzingAll} className={`${ROW_BTN} w-7 px-0 justify-center ${TONE_NEUTRAL}`} title="Re-analyze item">
                                    {analyzingRowIds.has(row.id) ? <Loader2 className="animate-spin" size={12} /> : <RotateCw size={12} />}
                                </button>
                                {row.analysisId && (
                                    <button type="button" onClick={() => onViewAnalysis(row.analysisId, row.videos)} className={`${ROW_BTN} ${TONE_AMBER}`} title="Open Full Report View">
                                        <Eye size={12} />
                                        <span>Report</span>
                                    </button>
                                )}
                            </>
                        )}

                        {isYtRow && videoId && row.type !== 'abcd' && (
                            abcdId ? (
                                <div className="inline-flex items-stretch h-7 rounded-lg bg-violet-500/10 border border-violet-500/30 overflow-hidden shrink-0">
                                    <button type="button" onClick={() => onViewAnalysis(abcdId, [videoId])} className="px-2 text-[11px] font-semibold text-violet-700 dark:text-violet-300 hover:bg-violet-500/20 transition-all inline-flex items-center gap-1 whitespace-nowrap cursor-pointer" title="View ABCD Framework Scorecard for this video">
                                        <Sparkles size={12} />
                                        <span>ABCD ({abcdScore}%)</span>
                                    </button>
                                    <button type="button" onClick={() => handleRemoveAbcdFromRow(row)} className="px-1.5 text-rose-600 dark:text-rose-300 hover:bg-rose-500/20 border-l border-violet-500/30 transition-all inline-flex items-center cursor-pointer" title="Remove ABCD analysis for this video">
                                        <X size={12} />
                                    </button>
                                </div>
                            ) : (
                                <button type="button" onClick={() => handleRunAbcdOnRow(row)} disabled={isRunningAbcd || isAnalyzingAll} className={`${ROW_BTN} ${TONE_VIOLET}`} title="Run Google ABCD Creative Evaluation on this YouTube video">
                                    {isRunningAbcd ? <Loader2 size={12} className="animate-spin" /> : <Sparkles size={12} />}
                                    <span>{isRunningAbcd ? 'ABCD...' : 'Run ABCD'}</span>
                                </button>
                            )
                        )}

                        {isYtRow && videoId && row.type === 'abcd' && (
                            sentId ? (
                                <button type="button" onClick={() => onViewAnalysis(sentId, [videoId])} className={`${ROW_BTN} ${TONE_EMERALD}`} title="View YouTube Sentiment & Comments for this video">
                                    <TrendingUp size={12} />
                                    <span>Sentiment</span>
                                </button>
                            ) : (
                                <button type="button" onClick={() => handleRunSentimentOnRow(row)} disabled={isRunningSent || isAnalyzingAll} className={`${ROW_BTN} ${TONE_EMERALD}`} title="Run YouTube Sentiment & Comment Analysis on this video">
                                    {isRunningSent ? <Loader2 size={12} className="animate-spin" /> : <TrendingUp size={12} />}
                                    <span>{isRunningSent ? 'Running...' : 'Run Sentiment'}</span>
                                </button>
                            )
                        )}

                        <button type="button" onClick={() => handleDeleteRow(row.id)} disabled={isAnalyzingAll || analyzingRowIds.has(row.id)} className={`${ROW_BTN} ${TONE_ROSE}`} title="Delete this item from the Listen table">
                            <Trash2 size={12} />
                            <span>Delete</span>
                        </button>
                    </div>
                </td>
            </tr>

            {isPreviewExpanded && (
                <tr className="bg-[var(--app-surface)]/90 border-b border-[var(--app-border)] animate-fadeIn">
                    <td colSpan={5} className="p-5">
                        <div className="bg-[var(--app-card)] rounded-2xl border border-[var(--app-border)] p-5 shadow-xs space-y-4">
                            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)]">
                                <div className="flex items-center gap-2.5 flex-wrap">
                                    <span className="px-2.5 py-1 rounded-lg text-[11px] font-mono font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200">
                                        {row.type === 'reddit' ? 'Reddit Community Thread Preview'
                                            : row.type === 'abcd' || row.type === 'competitor_abcd' ? 'Google ABCD Creative Analysis & Video Preview'
                                            : isValidYtId ? 'YouTube Video & Sentiment Preview'
                                            : 'Source Content & Comments Preview'}
                                    </span>
                                    <h4 className="text-sm font-black text-[var(--app-text)]">
                                        {row.title || (typeof videoTitles[videoId] === 'object' ? (videoTitles[videoId] as any)?.title : videoTitles[videoId]) || firstVidRaw || 'Channel Item'}
                                    </h4>
                                </div>
                                <div className="flex flex-row items-center gap-2 flex-nowrap shrink-0">
                                    <button type="button" onClick={() => handleDeleteRow(row.id)} className={`${ROW_BTN} h-8 px-2.5 sm:px-3 text-xs ${TONE_ROSE}`}>
                                        <Trash2 size={13} />
                                        <span>Delete This Item</span>
                                    </button>
                                    <button type="button" onClick={() => handleToggleRowPreview(row)} className={`${ROW_BTN} h-8 px-2.5 sm:px-3 text-xs ${TONE_NEUTRAL}`}>
                                        <X size={13} />
                                        <span>Close Preview</span>
                                    </button>
                                </div>
                            </div>

                            {previewState?.loading && !previewAnalysis && rawPreviewComments.length === 0 ? (
                                <div className="py-8 flex items-center justify-center gap-2 text-xs font-mono text-[var(--app-muted)]">
                                    <Loader2 size={16} className="animate-spin text-indigo-600" />
                                    <span>Loading content preview &amp; harvested comments...</span>
                                </div>
                            ) : (
                                <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                                    <RowContentPreviewColumn
                                        row={row} firstVidRaw={firstVidRaw} videoId={videoId} isValidYtId={isValidYtId}
                                        unembeddableVideos={unembeddableVideos} previewAnalysis={previewAnalysis} previewAbcd={previewAbcd}
                                        handleAnalyze={handleAnalyze} handleDeleteRow={handleDeleteRow} handleRemoveAbcdFromRow={handleRemoveAbcdFromRow}
                                    />
                                    <RowCommentsPreviewColumn
                                        row={row} previewState={previewState} rawPreviewComments={rawPreviewComments}
                                        filteredPreviewComments={filteredPreviewComments} commentSearchByRowId={commentSearchByRowId}
                                        setCommentSearchByRowId={setCommentSearchByRowId} analyzingRowIds={analyzingRowIds} handleAnalyze={handleAnalyze}
                                    />
                                </div>
                            )}
                        </div>
                    </td>
                </tr>
            )}
        </React.Fragment>
    );
};
