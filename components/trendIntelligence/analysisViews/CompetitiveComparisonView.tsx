import React from 'react';
import { Eye, Loader2, Sparkles } from 'lucide-react';
import { MetacriticAnalysisDashboard } from '../metacritic/MetacriticReviewsExplorer';
import { getVideoId } from '../typesAndConstants';
import { SocialAndRedditPulseView } from './SocialAndRedditPulseView';
import { TrustpilotAndAbcdView } from './TrustpilotAndAbcdView';
import { WebsiteAndGroundedSearchView } from './WebsiteAndGroundedSearchView';
import { YouTubeAndCreatorAnalysisView } from './YouTubeAndCreatorAnalysisView';

interface CompetitiveComparisonViewProps {
    companyName: string;
    compAnalysis: any;
    activeVideos: string[];
    videoTitles: Record<string, any>;
}

export const CompetitiveComparisonView: React.FC<CompetitiveComparisonViewProps> = ({
    companyName,
    compAnalysis,
    activeVideos,
    videoTitles
}) => {
    const activeBrand = companyName || 'test-company';

    const renderAdColumn = (adIdx: number, adData: any, swData: any) => {
        const rawVid = activeVideos[adIdx];
        const vidId = rawVid ? getVideoId(rawVid) : '';
        const titleEntry = vidId ? videoTitles[vidId] : null;
        const adTitle = typeof titleEntry === 'object' && titleEntry !== null
            ? titleEntry.title
            : (titleEntry || `Ad ${adIdx + 1}`);

        return (
            <div className="p-6 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                <h4 className="font-bold text-emerald-600 mb-2">{adTitle}</h4>

                {vidId && (
                    <div className="aspect-video rounded-xl overflow-hidden mb-4 border border-[var(--app-border)]">
                        <iframe
                            width="100%"
                            height="100%"
                            src={`https://www.youtube.com/embed/${vidId}`}
                            title={`Ad ${adIdx + 1} Preview`}
                            frameBorder="0"
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                        />
                    </div>
                )}

                {adData?.abcd_scores && typeof adData.abcd_scores === 'object' && (
                    <div className="mb-4 p-4 bg-[var(--app-card)] rounded-xl border border-[var(--app-border)] shadow-xs">
                        <h5 className="text-xs font-bold text-[var(--app-muted)] uppercase tracking-wider mb-2">ABCD Scores:</h5>
                        <div className="space-y-1.5">
                            {Object.entries(adData.abcd_scores || {}).map(([key, data]: [string, any]) => {
                                const scoreVal = typeof data === 'object' && data !== null ? (data.score ?? 0) : (typeof data === 'number' ? data : 0);
                                return (
                                    <div key={key} className="flex justify-between items-center text-xs">
                                        <span className="uppercase font-medium text-[var(--app-muted)]">{key}</span>
                                        <span className="font-bold text-emerald-600">{scoreVal}/10</span>
                                    </div>
                                );
                            })}
                        </div>
                    </div>
                )}

                <h5 className="text-sm font-bold text-emerald-600">Strengths:</h5>
                <ul className="list-disc pl-5 text-sm text-[var(--app-text)] mb-3 space-y-1">
                    {(Array.isArray(swData?.strengths) ? swData.strengths : []).map((s: string, i: number) => <li key={i}>{s}</li>)}
                </ul>
                <h5 className="text-sm font-bold text-rose-600">Weaknesses:</h5>
                <ul className="list-disc pl-5 text-sm text-[var(--app-text)] space-y-1">
                    {(Array.isArray(swData?.weaknesses) ? swData.weaknesses : []).map((w: string, i: number) => <li key={i}>{w}</li>)}
                </ul>
            </div>
        );
    };

    return (
        <div className="bg-[var(--app-card)] p-8 rounded-3xl shadow-xs border border-[var(--app-border)] text-[var(--app-text)]">
            <div className="flex justify-between items-center mb-6">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-emerald-50 dark:bg-[#061C36] border border-emerald-200 dark:border-[#041E3A] rounded-xl">
                        <Sparkles size={20} className="text-emerald-600 dark:text-emerald-400" />
                    </div>
                    <label className="text-xl font-bold text-[var(--app-text)] tracking-wider uppercase">Competitive Analysis</label>
                </div>
            </div>

            {compAnalysis && (
                <div className="space-y-8 mt-8 border-t border-[var(--app-border)] pt-8">
                    <div>
                        <h3 className="text-lg font-bold text-[var(--app-text)] mb-2">Winner: {compAnalysis.winner}</h3>
                        <p className="text-[var(--app-muted)]">{compAnalysis.winner_reason}</p>
                    </div>

                    <div>
                        <h3 className="font-bold text-[var(--app-text)] mb-2">Scoring Comparison</h3>
                        <p className="text-[var(--app-muted)]">{compAnalysis.scoring_comparison}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {renderAdColumn(0, compAnalysis.ad1, compAnalysis.strengths_weaknesses?.ad1)}
                        {renderAdColumn(1, compAnalysis.ad2, compAnalysis.strengths_weaknesses?.ad2)}
                    </div>

                    <div>
                        <h3 className="font-bold text-[var(--app-text)] mb-2">Combined Analysis</h3>
                        <p className="text-[var(--app-muted)] leading-relaxed">{compAnalysis.combined_analysis}</p>
                    </div>

                    <div>
                        <h3 className="font-bold text-[var(--app-text)] mb-2">Tips &amp; Tricks for {activeBrand}</h3>
                        <ul className="list-disc pl-5 text-[var(--app-muted)] space-y-1.5 leading-relaxed">
                            {(Array.isArray(compAnalysis.tips) ? compAnalysis.tips : []).map((tip: string, i: number) => <li key={i}>{tip}</li>)}
                        </ul>
                    </div>
                </div>
            )}
        </div>
    );
};

export const SingleAndCompetitiveReportView: React.FC<{
    companyName: string;
    isDark: boolean;
    themeColors: any;
    singleCtrl: any;
    videoTitles: Record<string, any>;
    unembeddableVideos: Record<string, boolean>;
}> = ({ companyName, isDark, themeColors, singleCtrl, videoTitles, unembeddableVideos }) => {
    const {
        selectedVideoId, analysis, activeTab, setActiveAnalysisId,
        analysisError, activeVideos, isLoadingAnalysis, compAnalysis,
        isCurrentSocial, isCurrentReddit, isCurrentSteam, isCurrentTrustpilot,
        isCurrentMetacritic, isCurrentWebsite, isCurrentGroundedSearch,
        selectedVideo
    } = singleCtrl;

    const isSocialOrReddit = isCurrentReddit || isCurrentSocial ||
        ['reddit', 'social_intelligence', 'tiktok', 'tiktok_hashtag', 'social_feed'].includes(analysis?.type || '');

    if (isLoadingAnalysis) {
        return (
            <div className="max-w-7xl mx-auto w-full px-6 py-12 bg-[#F7F8FA] dark:bg-[#020F1D]">
                <div className="flex justify-end mb-4">
                    <button onClick={() => setActiveAnalysisId(null)} className="px-4 py-2 font-bold rounded-lg transition-all bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs">
                        Back to Table
                    </button>
                </div>
                <div className="p-12 bg-[var(--app-card)] rounded-3xl border border-[var(--app-border)] shadow-xs flex items-center justify-center gap-3 text-sm font-mono text-[var(--app-muted)] animate-pulse">
                    <Loader2 className="animate-spin text-[#38bdf8]" size={18} />
                    <span>Loading...</span>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className="page-header bg-[#F7F8FA] dark:bg-[#020F1D]">
                <div className="max-w-7xl mx-auto px-6 w-full">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <Eye className="text-[#339DD4]" size={24} />
                            <h1 className="page-title text-[var(--app-text)] dark:text-white">
                                {isCurrentReddit || analysis?.type === 'reddit' ? 'Reddit Community Sentiment Analysis'
                                    : isSocialOrReddit ? 'Social Pulse'
                                    : isCurrentSteam || analysis?.type === 'steam_reviews' ? 'Steam Community Review Analysis'
                                    : isCurrentMetacritic || analysis?.type === 'metacritic_reviews' ? 'Metacritic Critic & User Intelligence'
                                    : isCurrentTrustpilot || analysis?.type === 'trustpilot_sentiment' ? 'Trustpilot Retail Review Analysis'
                                    : analysis?.type === 'website_analysis' ? 'Website Analysis'
                                    : analysis?.type === 'grounded_search' ? 'Grounded Search'
                                    : 'Creative Video Analysis'}
                            </h1>
                        </div>
                        <div className="flex gap-4">
                            <button onClick={() => setActiveAnalysisId(null)} className="px-4 py-2 font-bold rounded-lg transition-all bg-[var(--app-surface)] dark:bg-[#041527] text-[var(--app-text)] dark:text-[#D8E1EB] border border-[var(--app-border)] dark:border-[#041E3A] shadow-xs">
                                Back to Table
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto w-full px-6 py-8 bg-[#F7F8FA] dark:bg-[#020F1D]">
                {analysisError && <div className="p-6 bg-rose-50 text-rose-700 rounded-lg border border-rose-200 mb-6">{analysisError}</div>}
                <div className="grid grid-cols-1 gap-8">
                    <div className="space-y-6">
                        {activeTab === 'analysis' && (
                            <div className={isSocialOrReddit ? 'w-full' : 'bg-[var(--app-card)] p-8 rounded-3xl shadow-xs border border-[var(--app-border)] text-[var(--app-text)]'}>
                                <SocialAndRedditPulseView
                                    companyName={companyName} analysis={analysis}
                                    selectedVideoId={selectedVideoId} videoTitles={videoTitles}
                                    unembeddableVideos={unembeddableVideos} selectedVideo={selectedVideo}
                                    isCurrentSocial={isCurrentSocial} isCurrentReddit={isCurrentReddit} isCurrentSteam={isCurrentSteam}
                                    isCurrentTrustpilot={isCurrentTrustpilot} isCurrentMetacritic={isCurrentMetacritic}
                                    isCurrentWebsite={isCurrentWebsite} isCurrentGroundedSearch={isCurrentGroundedSearch}
                                />
                                {analysis && (
                                    <div className={`${(isSocialOrReddit || analysis.type === 'steam_reviews' || analysis.type === 'metacritic_reviews' || isCurrentMetacritic) ? 'mt-0 pt-0' : 'mt-12 pt-12 border-t border-[var(--app-border)]'} space-y-12`}>
                                        <WebsiteAndGroundedSearchView analysis={analysis} companyName={companyName} isCurrentMetacritic={isCurrentMetacritic} isCurrentWebsite={isCurrentWebsite} isCurrentGroundedSearch={isCurrentGroundedSearch} />
                                        <YouTubeAndCreatorAnalysisView analysis={analysis} companyName={companyName} selectedVideoId={selectedVideoId} isDark={isDark} />
                                        {(isCurrentMetacritic || analysis.type === 'metacritic_reviews') && (
                                            <MetacriticAnalysisDashboard analysis={analysis} selectedVideoId={selectedVideoId} companyName={companyName} />
                                        )}
                                        <TrustpilotAndAbcdView analysis={analysis} isDark={isDark} themeColors={themeColors} />
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'competitive' && (
                            <CompetitiveComparisonView companyName={companyName} compAnalysis={compAnalysis} activeVideos={activeVideos} videoTitles={videoTitles} />
                        )}
                    </div>
                </div>
            </div>
        </>
    );
};
