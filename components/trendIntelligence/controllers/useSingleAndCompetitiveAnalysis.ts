import { useEffect, useState } from 'react';
import { getRedditDisplayTitle } from '../../../services/geminiService';
import { buildRichMetacriticAnalysis } from '../metacritic/metacriticNormalizer';
import { AnalysisResult } from '../typesAndConstants';

export function useSingleAndCompetitiveAnalysis({
    companyName,
    rows,
    videoTitles
}: {
    companyName: string;
    rows: any[];
    videoTitles: Record<string, any>;
}) {
    const activeBrand = companyName || 'test-company';

    const [selectedVideoId, setSelectedVideoId] = useState('');
    const [analysis, setAnalysis] = useState<AnalysisResult | null>(null);
    const [activeTab, setActiveTab] = useState<'analysis' | 'competitive'>('analysis');
    const [activeAnalysisId, setActiveAnalysisId] = useState<string | null>(null);
    const [analysisError, setAnalysisError] = useState<string | null>(null);
    const [activeVideos, setActiveVideos] = useState<string[]>([]);
    const [isLoadingAnalysis, setIsLoadingAnalysis] = useState(false);
    const [compAnalysis, setCompAnalysis] = useState<any>(null);

    useEffect(() => {
        if (!activeAnalysisId) {
            setIsLoadingAnalysis(false);
            return;
        }
        setAnalysis(null);
        setAnalysisError(null);
        setIsLoadingAnalysis(true);
        const loadAnalysis = async () => {
            try {
                const matchingRow = (rows || []).find(
                    (r: any) => r.analysisId === activeAnalysisId || r.id === activeAnalysisId || `analysis_${String(r.id).replace(/[^a-zA-Z0-9_\-]/g, '_')}` === activeAnalysisId
                );
                const isMc = Boolean(
                    matchingRow?.type === 'metacritic_reviews' ||
                    activeAnalysisId.includes('metacritic') ||
                    selectedVideoId?.includes('metacritic.com')
                );

                const res = await fetch(`/api/insights/analysis?companyName=${encodeURIComponent(activeBrand)}&analysisId=${encodeURIComponent(activeAnalysisId)}`);
                let data = res.ok ? await res.json().catch(() => null) : null;
                if (res.ok && data) {
                    if (isMc || data?.type === 'metacritic_reviews') {
                        const targetUrl = data?.url || matchingRow?.url || matchingRow?.videos?.[0] || (selectedVideoId?.includes('metacritic.com') ? selectedVideoId : 'https://www.metacritic.com/');
                        const existingCount = Array.isArray(data?.reviews) ? data.reviews.length : (Array.isArray(data?.result?.reviews) ? data.result.reviews.length : 0);
                        if (existingCount < 100) {
                            try {
                                const mcRes = await fetch('/api/metacritic/scan', {
                                    method: 'POST',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ url: targetUrl })
                                });
                                if (mcRes.ok) {
                                    const mcData = await mcRes.json().catch(() => null);
                                    if (mcData) data = { ...data, ...mcData };
                                }
                            } catch {}
                        }
                        data = buildRichMetacriticAnalysis(data, targetUrl, activeBrand);
                    }
                    setAnalysis(data);
                    if (data?.type === 'comparative') {
                        setCompAnalysis(data);
                        setActiveTab('competitive');
                    }
                } else if (matchingRow?.preloadedResult) {
                    const targetUrl = matchingRow.url || matchingRow.videos?.[0] || selectedVideoId || 'https://www.metacritic.com/';
                    const recovered = isMc
                        ? buildRichMetacriticAnalysis(matchingRow.preloadedResult, targetUrl, activeBrand)
                        : matchingRow.preloadedResult;
                    setAnalysis(recovered);
                    fetch('/api/insights/analysis', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ companyName: activeBrand, analysisId: activeAnalysisId, result: recovered, data: recovered })
                    }).catch(() => {});
                } else if (isMc) {
                    const targetUrl = matchingRow?.url || matchingRow?.videos?.[0] || (selectedVideoId?.includes('metacritic.com') ? selectedVideoId : 'https://www.metacritic.com/');
                    const mcRes = await fetch('/api/metacritic/scan', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ url: targetUrl })
                    });
                    const mcData = await mcRes.json().catch(() => ({}));
                    if (mcRes.ok) {
                        const richMc = buildRichMetacriticAnalysis(mcData, targetUrl, activeBrand);
                        setAnalysis(richMc);
                        fetch('/api/insights/analysis', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ companyName: activeBrand, analysisId: activeAnalysisId, result: richMc, data: richMc })
                        }).catch(() => {});
                    } else {
                        setAnalysisError(mcData.error || "Failed to scan Metacritic reviews.");
                    }
                } else {
                    setAnalysisError("Failed to load analysis results from GCS.");
                }
            } catch (error) {
                console.error("Failed to load analysis from GCS:", error);
                setAnalysisError("Error connecting to GCS to load analysis.");
            } finally {
                setIsLoadingAnalysis(false);
            }
        };
        loadAnalysis();
    }, [activeAnalysisId, activeBrand]);

    const rowMatchesType = (types: string[]) => rows.some(
        r => (r.analysisId === activeAnalysisId || (Array.isArray(r.videos) && r.videos.includes(selectedVideoId))) && types.includes(r.type)
    );

    const isCurrentSocial = Boolean(
        ['social_intelligence', 'social_feed', 'reddit', 'tiktok', 'tiktok_hashtag', 'social_pulse'].includes(analysis?.type || '') ||
        selectedVideoId?.startsWith('#') || selectedVideoId?.startsWith('social_') ||
        selectedVideoId?.includes('r/') || selectedVideoId?.includes('reddit') ||
        rowMatchesType(['social_intelligence', 'social_feed', 'reddit', 'tiktok', 'tiktok_hashtag'])
    );
    const isCurrentReddit = Boolean(
        analysis?.type === 'reddit' || selectedVideoId?.startsWith('reddit_') ||
        selectedVideoId?.includes('reddit.com') || selectedVideoId?.includes('r/') || rowMatchesType(['reddit'])
    );
    const isCurrentSteam = Boolean(
        analysis?.type === 'steam_reviews' || analysis?.type === 'steam' || selectedVideoId?.startsWith('steam_') ||
        (/^\d+$/.test(selectedVideoId || '') && (selectedVideoId || '').length >= 4) || rowMatchesType(['steam_reviews', 'steam'])
    );
    const isCurrentTrustpilot = Boolean(
        analysis?.type === 'trustpilot_sentiment' || selectedVideoId?.startsWith('trustpilot_') ||
        selectedVideoId?.includes('trustpilot.com') || rowMatchesType(['trustpilot_sentiment'])
    );
    const isCurrentMetacritic = Boolean(
        analysis?.type === 'metacritic_reviews' || activeAnalysisId?.includes('metacritic') ||
        selectedVideoId?.includes('metacritic.com') ||
        rows.some(r => (r.analysisId === activeAnalysisId || r.id === activeAnalysisId || (Array.isArray(r.videos) && r.videos.includes(selectedVideoId))) && r.type === 'metacritic_reviews')
    );
    const isNonWebType = ['reddit', 'tiktok', 'tiktok_hashtag', 'social_intelligence', 'social_feed', 'trustpilot_sentiment', 'steam_reviews', 'metacritic_reviews', 'youtube_sentiment', 'sentiment_video', 'sentiment_comments', 'grounded_search'].includes(analysis?.type || '');
    const isCurrentWebsite = Boolean(
        !isCurrentReddit && !isCurrentSocial && !isCurrentTrustpilot && !isCurrentSteam && !isCurrentMetacritic && !isNonWebType &&
        (analysis?.type === 'website_analysis' || analysis?.type === 'website' || rowMatchesType(['website_analysis', 'website']) ||
         ((selectedVideoId?.startsWith('http') || selectedVideoId?.startsWith('www.')) &&
          !['reddit.com', '/r/', 'youtube.com', 'youtu.be', 'tiktok.com', 'trustpilot.com', 'metacritic.com', 'steampowered.com', 'steamcommunity.com'].some(d => selectedVideoId.includes(d))))
    );
    const isCurrentGroundedSearch = Boolean(
        !isCurrentReddit && !isCurrentSocial && !isCurrentTrustpilot && !isCurrentSteam && !isCurrentMetacritic &&
        (analysis?.type === 'grounded_search' || rowMatchesType(['grounded_search']))
    );

    const selectedVideo = {
        id: selectedVideoId,
        title: typeof videoTitles[selectedVideoId] === 'object' ? (videoTitles[selectedVideoId] as any).title : (videoTitles[selectedVideoId] || (isCurrentReddit ? getRedditDisplayTitle(selectedVideoId) : isCurrentSocial ? `Social Pulse: ${selectedVideoId}` : isCurrentSteam ? `Steam App ${selectedVideoId}` : isCurrentMetacritic ? `${activeBrand} (Metacritic)` : 'Analysis')),
        description: isCurrentReddit ? 'Reddit community sentiment & discussions.' : isCurrentSocial ? 'Multi-channel social listening and sentiment analysis.' : isCurrentSteam ? 'Steam Store player reviews & sentiment intelligence.' : isCurrentMetacritic ? 'Metacritic Schema.org JSON-LD metadata, critic consensus & user sentiment analysis.' : ''
    };

    return {
        selectedVideoId, setSelectedVideoId, analysis,
        activeTab, setActiveTab, activeAnalysisId, setActiveAnalysisId,
        analysisError, activeVideos, setActiveVideos, isLoadingAnalysis,
        compAnalysis,
        isCurrentSocial, isCurrentReddit, isCurrentSteam, isCurrentTrustpilot, isCurrentMetacritic,
        isCurrentWebsite, isCurrentGroundedSearch, selectedVideo
    };
}
