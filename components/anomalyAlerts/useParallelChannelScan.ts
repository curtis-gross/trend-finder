import {
    generateKeywordGroundedAlerts,
    synthesizeAlertsReportAndTalkTrack,
    analyzeYouTubeSentiment
} from '../../services/geminiService';
import { loadStageDataFromGCS } from '../../services/noiseFilterService';
import { SentimentFilterType, useAlertsPersistence } from './useAlertsPersistence';

type AlertsPersistenceState = ReturnType<typeof useAlertsPersistence>;

const readChannelError = async (res: Response, channel: string): Promise<string> => {
    const raw = await res.text().catch(() => '');
    if (!raw) return `${channel} returned HTTP ${res.status}`;
    try {
        const parsed = JSON.parse(raw);
        const detail = parsed?.detail?.error ?? parsed?.detail ?? parsed?.error ?? parsed?.message ?? parsed;
        const msg = typeof detail === 'string' ? detail : (detail?.message || JSON.stringify(detail));
        return `${channel} (HTTP ${res.status}): ${msg}`;
    } catch {
        return `${channel} (HTTP ${res.status}): ${raw.slice(0, 200)}`;
    }
};

export const useParallelChannelScan = (activeCompany: string, persistence: AlertsPersistenceState) => {
    const resolvedCompany = activeCompany || 'test-company';
    const {
        pipelineSources, setPipelineCommentsCount, setMonitoredKeyword, setIsLoading,
        setApiError, setProgressPercent, setTalkTrackSynced, setThreadStatus,
        setStatusMessage, setImmediateGroundedAlerts, setYoutubeAlertData,
        setSteamAlertData, setAlertData, autoSaveDualRuns, fetchPastRunsHistory
    } = persistence;

    const handleStartLiveMonitor = async () => {
        const keyword = resolvedCompany;
        setMonitoredKeyword(keyword);
        setIsLoading(true);
        setApiError(null);
        setProgressPercent(10);
        setTalkTrackSynced(false);
        setThreadStatus({ pipeline: 'running', grounded: 'running', youtube: 'running', steam: 'idle', synthesis: 'idle' });
        setStatusMessage(`🚀 Ingesting 14-day rolling comments from Filter Pipeline and scanning live feeds for "${keyword}"...`);

        const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString();
        const collectedEvidenceFeed: any[] = [];
        const channelWarnings: string[] = [];
        const progressTimers: ReturnType<typeof setTimeout>[] = [];

        try {
            let pipelineComments: any[] = [];
            let pipelineErrorMsg: string | null = null;
            try {
                const filteredData = await loadStageDataFromGCS('noise_filter_filtered_comments', resolvedCompany);
                if (filteredData && Array.isArray(filteredData.filteredComments) && filteredData.filteredComments.length > 0) {
                    pipelineComments = filteredData.filteredComments;
                } else {
                    const rawData = await loadStageDataFromGCS('noise_filter_raw_comments', resolvedCompany);
                    if (rawData && Array.isArray(rawData.rawComments) && rawData.rawComments.length > 0) {
                        pipelineComments = rawData.rawComments;
                    }
                }

                if (pipelineComments.length > 0) {
                    setPipelineCommentsCount(pipelineComments.length);
                    pipelineComments.slice(0, 150).forEach((c: any) => {
                        const text = c.rawText || c.content || '';
                        const isNeg = c.sentiment === 'negative' || /disappoint|poor|broken|issue|delay|defect|scratch|pill|ruined|horrible|terrible/i.test(text);
                        const isPos = c.sentiment === 'positive' || /love|great|beautiful|perfect|recommend|quality|gorgeous|comfortable|amazing/i.test(text);
                        const sentiment: SentimentFilterType = isNeg ? 'negative' : (isPos ? 'positive' : 'neutral');
                        const srcType = String(c.source || '').toLowerCase();
                        const cleanSource = srcType.includes('reddit') ? 'reddit' : (srcType.includes('youtube') ? 'youtube' : (srcType.includes('steam') ? 'steam' : 'pipeline'));

                        collectedEvidenceFeed.push({
                            id: c.id || `pipeline-${Math.random()}`,
                            source: cleanSource,
                            author: c.author || 'Verified Customer',
                            videoTitle: c.sourceLabel || c.release || `${resolvedCompany} Customer Feedback`,
                            content: text,
                            sentiment,
                            upvotes: c.upvotes || 1,
                            timestamp: c.timestamp || 'Filter Pipeline',
                            url: c.sourceUrl || c.videoUrl || c.url || ''
                        });
                    });
                }
                setThreadStatus(prev => ({ ...prev, pipeline: 'completed' }));
            } catch (e: any) {
                pipelineErrorMsg = e?.message || String(e);
                console.warn('Filter pipeline comment ingestion warning:', e);
                channelWarnings.push(`Filter Pipeline / Reddit: ${pipelineErrorMsg}`);
                setThreadStatus(prev => ({ ...prev, pipeline: 'error' }));
            }

            const googleTarget = `${keyword} product quality customer service reviews feedback`;
            const ytSources = pipelineSources.filter(s => s.type === 'youtube');
            const youtubeTarget = ytSources.length > 0 ? ytSources[0].target : `${keyword} reviews`;
            const hasRedditSources = pipelineSources.some(s => s.type === 'reddit');

            const groundedPromise = (async () => {
                try {
                    const res = await generateKeywordGroundedAlerts(googleTarget, resolvedCompany);
                    const alertsList = Array.isArray(res?.alerts) ? res.alerts : [];
                    alertsList.forEach((alert: any) => {
                        const isPositive = alert.severity === 'favorable' || alert.sentiment === 'positive';
                        const isNegative = alert.severity === 'critical' || alert.sentiment === 'negative';
                        const sentiment: SentimentFilterType = isPositive ? 'positive' : (isNegative ? 'negative' : 'neutral');
                        collectedEvidenceFeed.push({
                            id: `grounded-${alert.id || Math.random()}`,
                            source: 'grounded',
                            author: alert.source || 'Google Search Grounding',
                            videoTitle: alert.title,
                            content: alert.summary || alert.title,
                            sentiment,
                            upvotes: 1,
                            timestamp: 'Past 14 Days (2 Weeks)',
                            url: alert.url || ''
                        });
                    });
                    setThreadStatus(prev => ({ ...prev, grounded: 'completed' }));
                    return res;
                } catch (e: any) {
                    const errMsg = e?.message || String(e);
                    console.warn('Grounded thread warning:', errMsg);
                    channelWarnings.push(hasRedditSources ? `Grounded Search / Reddit: ${errMsg}` : `Grounded Search: ${errMsg}`);
                    setThreadStatus(prev => ({ ...prev, grounded: 'error' }));
                    return { alerts: [], trendingTopics: [], summary: '', error: errMsg };
                }
            })();

            const steamSources = pipelineSources.filter(s => s.type === 'steam');
            const steamPromise = (async () => {
                if (steamSources.length === 0) {
                    setThreadStatus(prev => ({ ...prev, steam: 'completed' }));
                    return { appId: '', appName: keyword, reviews: [], sentimentScore: null };
                }
                const steamTarget = steamSources[0].target;
                try {
                    let appId = /^\d+$/.test(steamTarget.trim()) ? steamTarget.trim() : '';
                    let appName = `${resolvedCompany} ${steamTarget}`;
                    if (!appId) {
                        const searchRes = await fetch(`/api/steam/search?term=${encodeURIComponent(steamTarget)}`);
                        if (!searchRes.ok) {
                            throw new Error(await readChannelError(searchRes, 'Steam search'));
                        }
                        const searchData = await searchRes.json();
                        const searchItems = Array.isArray(searchData) ? searchData : (Array.isArray(searchData?.apps) ? searchData.apps : []);
                        if (searchItems.length > 0 && searchItems[0]?.id) {
                            appId = String(searchItems[0].id);
                            appName = searchItems[0].name || appName;
                        } else {
                            throw new Error(`No Steam app matched "${steamTarget}"`);
                        }
                    }

                    const revRes = await fetch(`/api/steam/reviews?appId=${encodeURIComponent(appId)}&day_range=14`);
                    if (!revRes.ok) {
                        throw new Error(await readChannelError(revRes, 'Steam reviews'));
                    }
                    const steamReviews: any[] = [];
                    const data = await revRes.json();
                    const rawRevs = Array.isArray(data) ? data : (Array.isArray(data?.reviews) ? data.reviews : []);
                    rawRevs.slice(0, 35).forEach((rev: any, idx: number) => {
                        const playtimeHrs = rev.author?.playtime_forever ? Math.round(rev.author.playtime_forever / 60) : 0;
                        const authorLabel = playtimeHrs > 0
                            ? `Steam Verified Reviewer (${playtimeHrs} hrs on record)`
                            : (rev.author?.steamid ? `Steam Reviewer (${rev.author.steamid.slice(-6)})` : 'Steam Verified Reviewer');
                        const revObj = {
                            id: `steam-${rev.id || idx}`,
                            source: 'steam',
                            author: authorLabel,
                            title: rev.voted_up ? 'Steam Review: Recommended' : 'Steam Review: Not Recommended',
                            content: rev.review || '',
                            sentiment: rev.voted_up ? 'positive' : 'negative',
                            upvotes: rev.votes_up || 0,
                            timestamp: rev.timestamp_created ? new Date(rev.timestamp_created * 1000).toLocaleDateString() : 'Recent 14 Days',
                            url: `https://store.steampowered.com/app/${appId}/`
                        };
                        steamReviews.push(revObj);
                        collectedEvidenceFeed.push(revObj);
                    });

                    const posCount = steamReviews.filter(r => r.sentiment === 'positive').length;
                    const steamScore: number | null = steamReviews.length > 0 ? Math.round((posCount / steamReviews.length) * 100) : null;
                    setThreadStatus(prev => ({ ...prev, steam: 'completed' }));
                    return { appId, appName, reviews: steamReviews, sentimentScore: steamScore };
                } catch (e: any) {
                    const errMsg = e?.message || String(e);
                    console.warn('Steam reviews thread error:', errMsg);
                    channelWarnings.push(`Steam: ${errMsg}`);
                    setThreadStatus(prev => ({ ...prev, steam: 'error' }));
                    return { appId: '', appName: keyword, reviews: [], sentimentScore: null, error: errMsg };
                }
            })();

            const youtubePromise = (async () => {
                try {
                    let directVidId = '';
                    if (youtubeTarget.includes('youtube.com/watch?v=')) directVidId = youtubeTarget.split('v=')[1]?.split('&')[0] || '';
                    else if (youtubeTarget.includes('youtu.be/')) directVidId = youtubeTarget.split('youtu.be/')[1]?.split('?')[0] || '';

                    const searchQuery = directVidId ? youtubeTarget : `${youtubeTarget} review`;
                    const searchRes = await fetch(`/api/youtube/search?q=${encodeURIComponent(searchQuery)}&publishedAfter=${encodeURIComponent(fourteenDaysAgo)}&maxResults=10&order=relevance`);

                    let searchVideos: any[] = [];
                    if (searchRes.ok) {
                        const data = await searchRes.json();
                        searchVideos = Array.isArray(data) ? data : (Array.isArray(data?.videos) ? data.videos : (Array.isArray(data?.items) ? data.items : []));
                    } else {
                        const searchErr = await readChannelError(searchRes, 'YouTube search');
                        if (!directVidId) {
                            throw new Error(searchErr);
                        }
                        channelWarnings.push(searchErr);
                    }

                    if (directVidId) searchVideos.unshift({ videoId: directVidId, title: `${resolvedCompany} Product Performance & Brand Review`, videoUrl: youtubeTarget });

                    const seenVideoIds = new Set<string>();
                    const rawTargetedVideos: any[] = [];
                    (Array.isArray(searchVideos) ? searchVideos : []).forEach((v, idx) => {
                        if (v && v.videoId && !seenVideoIds.has(v.videoId)) {
                            seenVideoIds.add(v.videoId);
                            rawTargetedVideos.push({ ...v, searchIntent: idx % 2 === 0 ? 'positive' : 'negative' });
                        }
                    });

                    const targetedThreeVideos = rawTargetedVideos.slice(0, 3);
                    const ytComments: any[] = [];

                    const analyzedVideosList: any[] = await Promise.all(
                        targetedThreeVideos.map(async (vid) => {
                            try {
                                const analysis = await analyzeYouTubeSentiment(vid.videoUrl || `https://www.youtube.com/watch?v=${vid.videoId}`, resolvedCompany);
                                let videoComments: any[] = [];
                                const cRes = await fetch(`/api/youtube/comments?videoId=${encodeURIComponent(vid.videoId)}&publishedAfter=${encodeURIComponent(fourteenDaysAgo)}`);
                                if (cRes.ok) {
                                    const cData = await cRes.json();
                                    videoComments = Array.isArray(cData) ? cData : (Array.isArray(cData?.comments) ? cData.comments : (Array.isArray(cData?.items) ? cData.items : []));
                                } else {
                                    const cErr = await readChannelError(cRes, `YouTube comments (${vid.videoId})`);
                                    channelWarnings.push(cErr);
                                    if (Array.isArray(analysis?.comments)) {
                                        videoComments = analysis.comments;
                                    }
                                }

                                (Array.isArray(videoComments) ? videoComments : []).slice(0, 50).forEach((item: any) => {
                                    const text = item.text || item.content || '';
                                    const isNeg = /disappoint|poor|broken|delay|scratch|pill|ruined|horrible|terrible|bad|fix/i.test(text);
                                    const isPos = /love|great|beautiful|perfect|recommend|quality|gorgeous|comfortable|amazing|clean|smooth|best/i.test(text);
                                    const sentiment: SentimentFilterType = isNeg ? 'negative' : (isPos ? 'positive' : 'neutral');
                                    const commentObj = {
                                        id: `yt-${item.id || Math.random()}`,
                                        source: 'youtube',
                                        author: item.author || 'YouTube Reviewer',
                                        videoTitle: vid.title || `${keyword} Video Review`,
                                        content: text,
                                        sentiment,
                                        upvotes: item.likeCount || 0,
                                        timestamp: item.publishedAt ? new Date(item.publishedAt).toLocaleDateString() : 'Recent 14 Days',
                                        url: vid.videoUrl
                                    };
                                    ytComments.push(commentObj);
                                    collectedEvidenceFeed.push(commentObj);
                                });

                                const safeComments = Array.isArray(videoComments) ? videoComments : [];
                                const posCommentsCount = safeComments.filter(c => /love|great|beautiful|perfect|recommend|quality|gorgeous|comfortable|amazing|clean|smooth|best/i.test(c.text || c.content || '')).length;
                                const exactCommentsScore: number | null = safeComments.length > 0
                                    ? Math.round((posCommentsCount / safeComments.length) * 100)
                                    : (typeof analysis?.commentsScore === 'number' ? analysis.commentsScore : null);

                                const vidPosPoints = analysis?.videoSentiment?.sentiment?.positive?.length || 0;
                                const vidNegPoints = analysis?.videoSentiment?.sentiment?.negative?.length || 0;
                                const exactVideoScore: number | null = (vidPosPoints + vidNegPoints) > 0
                                    ? Math.round((vidPosPoints / (vidPosPoints + vidNegPoints)) * 100)
                                    : (typeof analysis?.videoScore === 'number' ? analysis.videoScore : null);

                                const exactOverallScore: number | null =
                                    exactVideoScore !== null && exactCommentsScore !== null
                                        ? Math.round((exactVideoScore * 0.45) + (exactCommentsScore * 0.55))
                                        : (exactCommentsScore ?? exactVideoScore ?? null);
                                return {
                                    ...vid,
                                    analysis,
                                    videoScore: exactVideoScore,
                                    commentsScore: exactCommentsScore,
                                    overallScore: exactOverallScore,
                                    alignment: analysis?.alignment || null,
                                    commentCount: safeComments.length
                                };
                            } catch (analysisErr: any) {
                                const errMsg = analysisErr?.message || String(analysisErr);
                                console.error(`[NoSilentFallback] Failed sentiment analysis for video ${vid.videoId}:`, analysisErr);
                                channelWarnings.push(`YouTube (${vid.title || vid.videoId}): ${errMsg}`);
                                return { ...vid, error: errMsg, videoScore: null, commentsScore: null, overallScore: null };
                            }
                        })
                    );

                    const validVideos = analyzedVideosList.filter(v => typeof v.overallScore === 'number');
                    const posCount = ytComments.filter(c => c.sentiment === 'positive').length;
                    const ytScore: number | null = ytComments.length > 0
                        ? Math.round((posCount / ytComments.length) * 100)
                        : (validVideos.length > 0 ? Math.round(validVideos.reduce((acc, v) => acc + (v.overallScore || 0), 0) / validVideos.length) : null);

                    const allFailed = analyzedVideosList.length > 0 && validVideos.length === 0;
                    setThreadStatus(prev => ({ ...prev, youtube: allFailed ? 'error' : 'completed' }));
                    return { videos: analyzedVideosList.length > 0 ? analyzedVideosList : targetedThreeVideos, comments: ytComments, sentimentScore: ytScore };
                } catch (e: any) {
                    const errMsg = e?.message || String(e);
                    console.warn('YouTube Targeted Analysis thread error:', errMsg);
                    channelWarnings.push(`YouTube: ${errMsg}`);
                    setThreadStatus(prev => ({ ...prev, youtube: 'error' }));
                    return { videos: [], comments: [], sentimentScore: null, error: errMsg };
                }
            })();

            progressTimers.push(setTimeout(() => setProgressPercent(40), 1000));
            progressTimers.push(setTimeout(() => setProgressPercent(65), 2500));

            const [groundedResult, stmData, ytData] = await Promise.all([groundedPromise, steamPromise, youtubePromise]);

            if (hasRedditSources && pipelineComments.filter(c => String(c?.source || '').toLowerCase().includes('reddit')).length === 0 && pipelineErrorMsg) {
                channelWarnings.push(`Reddit: ${pipelineErrorMsg}`);
            }

            const hasAnyChannelData =
                (groundedResult?.alerts?.length || 0) > 0 ||
                (ytData?.videos?.length || 0) > 0 ||
                (ytData?.comments?.length || 0) > 0 ||
                (stmData?.reviews?.length || 0) > 0 ||
                pipelineComments.length > 0;

            if (!hasAnyChannelData && channelWarnings.length > 0) {
                throw new Error(`All monitored channels failed (${channelWarnings.join(' | ')})`);
            }

            setProgressPercent(85);
            setThreadStatus(prev => ({ ...prev, synthesis: 'running' }));
            setStatusMessage(`🧠 Synthesizing Master Anomaly Report & Daily Summary audio track for "${keyword}"...`);

            const synthesizedReport = await synthesizeAlertsReportAndTalkTrack(keyword, resolvedCompany, groundedResult, ytData, stmData, pipelineComments);
            const seenContent = new Set<string>();
            synthesizedReport.sampleFeed = collectedEvidenceFeed.filter(item => {
                const key = (item.content || '').trim().toLowerCase().slice(0, 50);
                if (!key || seenContent.has(key)) return false;
                seenContent.add(key);
                return true;
            });

            const fullRunPayload = {
                ...synthesizedReport,
                monitoredKeyword: keyword,
                immediateGroundedAlerts: groundedResult?.alerts || [],
                youtubeAlertData: ytData,
                steamAlertData: stmData,
                channelWarnings
            };

            setImmediateGroundedAlerts(groundedResult?.alerts || []);
            setYoutubeAlertData(ytData);
            setSteamAlertData(stmData);
            setAlertData(fullRunPayload);
            setTalkTrackSynced(true);
            setThreadStatus(prev => ({ ...prev, synthesis: 'completed' }));
            setProgressPercent(100);
            if (channelWarnings.length > 0) {
                const warningSummary = channelWarnings.join(' | ');
                setApiError(`Channel warnings: ${warningSummary}`);
                setStatusMessage(`⚠️ Scan completed with channel errors: ${warningSummary}`);
            } else {
                setStatusMessage(`✅ Analysis complete. Ingested Filter Pipeline comments and verified feeds for "${keyword}".`);
            }

            await autoSaveDualRuns(fullRunPayload, keyword);
            await fetchPastRunsHistory();
        } catch (error: any) {
            console.error('[NoSilentFallback] Live monitor workflow error:', error);
            const msg = error instanceof Error ? error.message : String(error);
            setStatusMessage('Error running live monitor: ' + msg);
            setApiError(`Live feed monitoring failed: ${msg}`);
        } finally {
            progressTimers.forEach(clearTimeout);
            setIsLoading(false);
        }
    };

    return { handleStartLiveMonitor };
};
