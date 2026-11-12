import React from 'react';
import { ExternalLink, PieChart as PieChartIcon, Play, Sparkles } from 'lucide-react';
import { extractYouTubeId, getVideoId } from '../typesAndConstants';

interface SocialAndRedditPulseViewProps {
    companyName: string;
    analysis: any;
    selectedVideoId: string;
    videoTitles: Record<string, any>;
    unembeddableVideos: Record<string, boolean>;
    selectedVideo: any;
    isCurrentSocial: boolean;
    isCurrentReddit: boolean;
    isCurrentSteam: boolean;
    isCurrentTrustpilot: boolean;
    isCurrentMetacritic: boolean;
    isCurrentWebsite: boolean;
    isCurrentGroundedSearch: boolean;
}

export const SocialAndRedditPulseView: React.FC<SocialAndRedditPulseViewProps> = ({
    companyName, analysis, selectedVideoId, videoTitles, unembeddableVideos, selectedVideo,
    isCurrentSocial, isCurrentReddit, isCurrentSteam, isCurrentTrustpilot,
    isCurrentMetacritic, isCurrentWebsite, isCurrentGroundedSearch
}) => {
    const activeBrand = companyName || 'test-company';
    const isSocialOrReddit = isCurrentSocial || isCurrentReddit ||
        ['social_intelligence', 'reddit', 'tiktok', 'tiktok_hashtag', 'social_feed'].includes(analysis?.type || '');
    const modalYtId = extractYouTubeId(selectedVideoId) ||
        (getVideoId(selectedVideoId) !== selectedVideoId ? getVideoId(selectedVideoId) : (/^[a-zA-Z0-9_-]{11}$/.test(selectedVideoId) ? selectedVideoId : ''));

    return (
        <>
            {!isSocialOrReddit && (
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-emerald-50 dark:bg-[#061C36] border border-emerald-200 dark:border-[#041E3A] rounded-xl">
                            <Play size={20} className="text-emerald-600 dark:text-emerald-400" />
                        </div>
                        <label className="text-xl font-bold text-[var(--app-text)] tracking-wider uppercase">
                            {isCurrentSteam || analysis?.type === 'steam_reviews' ? 'Game Review Analysis'
                                : isCurrentMetacritic || analysis?.type === 'metacritic_reviews' ? 'Metacritic Critic & User Review Intelligence'
                                : isCurrentTrustpilot || analysis?.type === 'trustpilot_sentiment' ? 'Trustpilot Retail Review Analysis'
                                : analysis?.type === 'website_analysis' ? 'Website Analysis'
                                : analysis?.type === 'grounded_search' ? 'Grounded Search'
                                : 'Video Analysis'}
                        </label>
                    </div>
                    <div className="text-lg font-bold text-[#0077C8]">
                        {typeof videoTitles[selectedVideoId] === 'object'
                            ? (videoTitles[selectedVideoId] as any).title
                            : (videoTitles[selectedVideoId] || (analysis?.type === 'trustpilot_sentiment' ? 'Trustpilot Review' : analysis?.type === 'steam_reviews' ? 'Steam Review' : analysis?.type === 'metacritic_reviews' || isCurrentMetacritic ? (analysis?.title ? `${analysis.title} (Metacritic)` : 'Metacritic Intelligence') : 'Video Analysis'))}
                    </div>
                </div>
            )}

            {!isCurrentSocial && !isCurrentReddit && !isCurrentSteam && !isCurrentMetacritic && !isCurrentTrustpilot && !isCurrentWebsite && !isCurrentGroundedSearch &&
             !['website_analysis', 'website', 'grounded_search', 'social_intelligence', 'social_feed', 'reddit', 'tiktok', 'tiktok_hashtag', 'trustpilot_sentiment', 'steam_reviews', 'metacritic_reviews'].includes(analysis?.type || '') && (
                <div className="rounded-xl overflow-hidden border border-[var(--app-border)] bg-[var(--app-surface)]">
                    <div className="aspect-video">
                        {modalYtId && unembeddableVideos[modalYtId] ? (
                            <div className="relative aspect-video w-full rounded-2xl overflow-hidden border border-[var(--app-border)] bg-slate-950 flex flex-col justify-between p-6 shadow-xs group">
                                <img src={`https://i.ytimg.com/vi/${modalYtId}/hqdefault.jpg`} alt="Video Thumbnail" className="absolute inset-0 w-full h-full object-cover opacity-35 filter blur-[1px] group-hover:scale-105 transition-transform duration-500" />
                                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/70 to-slate-950/40" />
                                <div className="relative z-10 flex items-center justify-between">
                                    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-amber-500/20 text-amber-300 border border-amber-500/30 backdrop-blur-md">
                                        <span className="w-2 h-2 rounded-full bg-amber-400 animate-pulse" />
                                        Creator disabled external iframe embedding
                                    </span>
                                </div>
                                <div className="relative z-10 space-y-3">
                                    <p className="text-xs text-slate-300 font-medium">Full comments &amp; sentiment analysis are available below.</p>
                                    <div>
                                        <a href={`https://www.youtube.com/watch?v=${modalYtId}`} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold bg-[#041E3A] hover:bg-[#072B54] text-white keep-white-text border border-white/20 shadow-md transition-all hover:scale-105 cursor-pointer">
                                            <span>Watch on YouTube</span>
                                            <ExternalLink size={13} />
                                        </a>
                                    </div>
                                </div>
                            </div>
                        ) : !modalYtId ? (
                            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[var(--app-border)] bg-slate-900 flex items-center justify-center p-6 text-slate-400 text-xs">
                                <span>No video preview available for this item.</span>
                            </div>
                        ) : (
                            <iframe width="100%" height="100%" src={`https://www.youtube.com/embed/${modalYtId}`} title="Ad Preview" frameBorder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
                        )}
                    </div>
                </div>
            )}

            {!isSocialOrReddit && !isCurrentSteam && !isCurrentMetacritic &&
             !['steam_reviews', 'metacritic_reviews'].includes(analysis?.type || '') && (
                <div className="flex justify-between items-start mt-8">
                    <div className="max-w-xl">
                        {analysis?.type !== 'website_analysis' && analysis?.type !== 'grounded_search' && (
                            <>
                                <h3 className="text-lg font-bold text-[var(--app-text)]">
                                    {analysis?.type === 'trustpilot_sentiment'
                                        ? (typeof videoTitles[selectedVideoId] === 'object' ? (videoTitles[selectedVideoId] as any).title : (videoTitles[selectedVideoId] || 'Trustpilot Review Analysis'))
                                        : selectedVideo.title}
                                </h3>
                                <p className="text-sm text-[var(--app-muted)]">
                                    {analysis?.type === 'trustpilot_sentiment'
                                        ? 'Deep retail sentiment breakdown analyzing up to 500 verified customer reviews from Trustpilot.'
                                        : selectedVideo.description}
                                </p>
                            </>
                        )}
                    </div>
                </div>
            )}

            {analysis && !isSocialOrReddit &&
             !['steam_reviews', 'metacritic_reviews', 'website_analysis', 'website', 'grounded_search'].includes(analysis.type || '') &&
             !isCurrentMetacritic && !isCurrentWebsite && !isCurrentGroundedSearch && (
                <div className="space-y-6 mt-12 pt-12 border-t border-[var(--app-border)]">
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                        <PieChartIcon size={16} /> Executive Summary
                    </h3>
                    <div className="bg-[var(--app-card)] p-8 rounded-3xl border border-[var(--app-border)] shadow-xl relative overflow-hidden group text-[var(--app-text)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-[#0077C8] rounded-full blur-[60px] -mr-16 -mt-16 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity" />
                        <p className="text-[var(--app-text)] text-base leading-relaxed relative z-10 font-normal">{analysis.summary}</p>
                        <div className="mt-8 flex items-center gap-3 text-[10px] font-bold text-[var(--app-muted)] uppercase tracking-widest border-t border-[var(--app-border)] pt-4">
                            <Sparkles size={12} className="text-emerald-600" /> ANALYSIS BY GEMINI 3.8 FLASH ({activeBrand.toUpperCase()})
                        </div>
                    </div>
                </div>
            )}
        </>
    );
};
