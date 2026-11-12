import React from 'react';
import { parseRedditTarget } from '../../../services/geminiService';
import { getVideoId } from '../typesAndConstants';

export const getDeletedListenItemsSetForCompany = (targetCompany: string): Set<string> => {
    const set = new Set<string>();
    if (typeof window === 'undefined') return set;
    try {
        const keys = ['deleted_listen_item_ids', `dml_deleted_listen_items_${targetCompany || 'default'}`];
        keys.forEach(k => {
            const raw = localStorage.getItem(k);
            if (raw) {
                const parsed = JSON.parse(raw);
                if (Array.isArray(parsed)) {
                    parsed.forEach(item => { if (item) set.add(String(item).toLowerCase().trim()); });
                }
            }
        });
    } catch {}
    return set;
};

export const isRowInDeletedBlocklist = (row: any, deletedSet: Set<string>): boolean => {
    if (!row || deletedSet.size === 0) return false;
    const id = String(row.id || '').toLowerCase().trim();
    const aId = String(row.analysisId || '').toLowerCase().trim();
    const abcdId = String(row.abcdAnalysisId || '').toLowerCase().trim();
    const firstVid = String((Array.isArray(row.videos) && row.videos[0]) || row.url || '').toLowerCase().trim();
    const cleanVid = String(getVideoId(firstVid) || firstVid).toLowerCase().trim();

    if (id && deletedSet.has(id)) return true;
    if (aId && deletedSet.has(aId)) return true;
    if (abcdId && deletedSet.has(abcdId)) return true;
    if (firstVid && deletedSet.has(`${String(row.type || '').toLowerCase()}:${firstVid}`)) return true;
    if (cleanVid && deletedSet.has(`${String(row.type || '').toLowerCase()}:${cleanVid}`)) return true;
    if (row.type === 'reddit' && (deletedSet.has('__all_reddit__') || (firstVid && deletedSet.has(firstVid)))) return true;
    if ((row.type === 'abcd' || row.type === 'competitor_abcd') && deletedSet.has('__all_abcd__')) return true;
    return false;
};

export const normalizeAndFilterListenRows = (rawRows: any[], targetCompany: string) => {
    const deletedSet = getDeletedListenItemsSetForCompany(targetCompany);
    const list = (Array.isArray(rawRows) ? [...rawRows] : []).filter(r => !isRowInDeletedBlocklist(r, deletedSet));
    return list.map((r: any) => ({
        ...r,
        videos: Array.isArray(r?.videos) && r.videos.length > 0 ? r.videos : [r?.url || r?.videoId || ''].filter(Boolean)
    }));
};

export const resolveVideoTitleAndEmbed = async (
    videoId: string,
    type: string | undefined,
    videoTitles: Record<string, any>,
    setVideoTitles: React.Dispatch<React.SetStateAction<Record<string, any>>>,
    setUnembeddableVideos: React.Dispatch<React.SetStateAction<Record<string, boolean>>>
): Promise<void> => {
    if (!videoId || videoTitles[videoId]) return;

    if (type === 'grounded_search') {
        const trimmedQuery = videoId.length > 30 ? videoId.substring(0, 30) + '...' : videoId;
        setVideoTitles(prev => ({ ...prev, [videoId]: { title: `Grounded Search: ${trimmedQuery}`, image: null } }));
        return;
    }

    if (type === 'reddit' || videoId.includes('reddit.com') || videoId.startsWith('r/')) {
        const target = parseRedditTarget(videoId);
        setVideoTitles(prev => ({
            ...prev,
            [videoId]: {
                title: target.displayTitle || 'Reddit Community Discussions',
                image: null
            }
        }));
        return;
    }

    if (type === 'tiktok' || type === 'tiktok_hashtag') {
        const clean = videoId.replace(/^#/, '').trim();
        setVideoTitles(prev => ({
            ...prev,
            [videoId]: {
                title: clean ? `TikTok: #${clean}` : 'TikTok Trends',
                image: null
            }
        }));
        return;
    }

    if (type === 'social_intelligence' || type === 'social_feed') {
        const clean = videoId.replace(/^#/, '').trim();
        setVideoTitles(prev => ({
            ...prev,
            [videoId]: {
                title: clean ? `Social Pulse: #${clean}` : 'Social & Community Intelligence',
                image: null
            }
        }));
        return;
    }

    if (type === 'trustpilot_sentiment' || videoId.includes('trustpilot.com')) {
        const cleanDomain = videoId.replace(/^https?:\/\//i, '').replace(/^www\./i, '').replace(/trustpilot\.com\/review\//i, '').split('/')[0].split('?')[0];
        const cleanName = cleanDomain.split('.')[0].charAt(0).toUpperCase() + cleanDomain.split('.')[0].slice(1);
        setVideoTitles(prev => ({
            ...prev,
            [videoId]: {
                title: `Trustpilot: ${cleanName} (${cleanDomain})`,
                image: null
            }
        }));
        return;
    }

    if (type === 'steam_reviews' || videoId.includes('steampowered.com')) {
        const appMatch = videoId.match(/app\/(\d+)/i);
        const appId = appMatch ? appMatch[1] : (/^\d+$/.test(videoId.trim()) ? videoId.trim() : '');
        setVideoTitles(prev => ({
            ...prev,
            [videoId]: {
                title: appId ? `Steam App (${appId})` : videoId,
                image: appId ? `https://shared.cloudflare.steamstatic.com/store_item_assets/steam/apps/${appId}/header.jpg` : null
            }
        }));
        return;
    }

    if ((type === 'website_analysis' || type === 'website') && !videoId.startsWith('http')) {
        setVideoTitles(prev => ({ ...prev, [videoId]: { title: videoId, image: null } }));
        return;
    }

    const potentialYtId = getVideoId(videoId);
    if (potentialYtId && potentialYtId !== videoId) {
        await resolveVideoTitleAndEmbed(potentialYtId, type, videoTitles, setVideoTitles, setUnembeddableVideos);
        return;
    }

    if (videoId.startsWith('http')) {
        try {
            const parsed = new URL(videoId);
            const host = parsed.hostname.replace(/^www\./, '');
            const pathSlug = parsed.pathname.split('/').filter(Boolean).pop() || '';
            const cleanSlug = pathSlug.replace(/[-_]/g, ' ').replace(/\.[^/.]+$/, '').trim();
            const isMcUrl = host.includes('metacritic.com') || type === 'metacritic_reviews';
            const formattedSlug = cleanSlug ? cleanSlug.replace(/\b\w/g, (l: string) => l.toUpperCase()) : host;
            const displayTitle = isMcUrl
                ? `${formattedSlug} (Metacritic)`
                : (cleanSlug ? `${host.split('.')[0].toUpperCase()}: ${cleanSlug.charAt(0).toUpperCase() + cleanSlug.slice(1)}` : `Web Source: ${host}`);
            setVideoTitles(prev => ({
                ...prev,
                [videoId]: { title: displayTitle, image: null }
            }));
        } catch {
            setVideoTitles(prev => ({
                ...prev,
                [videoId]: { title: videoId, image: null }
            }));
        }
        return;
    }

    if (!/^[A-Za-z0-9_-]{11}$/.test(videoId)) {
        setVideoTitles(prev => ({ ...prev, [videoId]: videoId }));
        return;
    }

    try {
        const res = await fetch(`https://www.youtube.com/oembed?url=https://www.youtube.com/watch?v=${videoId}&format=json`);
        if (res.ok) {
            const data = await res.json();
            setVideoTitles(prev => ({ ...prev, [videoId]: { title: data.title, image: data.thumbnail_url } }));
            setUnembeddableVideos(prev => ({ ...prev, [videoId]: false }));
        } else {
            const is401 = res.status === 401;
            try {
                const detailRes = await fetch(`/api/youtube/video-details?videoId=${encodeURIComponent(videoId)}`);
                if (detailRes.ok) {
                    const data = await detailRes.json();
                    const title = data.video?.title || data.video?.snippet?.title || data.normalized?.title;
                    if (title) {
                        setVideoTitles(prev => ({
                            ...prev,
                            [videoId]: {
                                title,
                                image: data.normalized?.thumbnail || data.video?.snippet?.thumbnails?.high?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`
                            }
                        }));
                    }
                    const isUnembeddable = Boolean(
                        data.video?.embeddable === false || data.video?.status?.embeddable === false || data.normalized?.embeddable === false || is401
                    );
                    setUnembeddableVideos(prev => ({ ...prev, [videoId]: isUnembeddable }));
                } else if (is401) {
                    setUnembeddableVideos(prev => ({ ...prev, [videoId]: true }));
                }
            } catch {
                if (is401) setUnembeddableVideos(prev => ({ ...prev, [videoId]: true }));
            }
        }
    } catch (error) {
        console.warn(`Failed to fetch title for ${videoId}:`, error);
    }
};
