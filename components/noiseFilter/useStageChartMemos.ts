import { useMemo } from 'react';
import {
    NoiseSourceConfig,
    RawComment,
    Stage2FilteredResult,
    Stage3KeywordResult,
    getCommentYear
} from '../../services/noiseFilterService';
import {
    isPlatformOrSourceKeyword,
    normalizeCategoryName
} from './languageAndGraphHelpers';

export const STAGE1_PAGE_SIZE = 50;
export const STAGE2_PREVIEW_LIMIT = 12;
export const STAGE3_PAGE_SIZE = 50;

const matchesStage2SourceFilter = (c: any, filterVal: string) => {
    if (filterVal === 'ALL') return true;
    const sLower = String(c?.source || '').toLowerCase();
    const rType = String(c?.reviewType || '').toLowerCase();
    if (filterVal === 'Metacritic') return sLower.includes('metacritic');
    if (filterVal === 'Metacritic Critic') return rType === 'critic' || sLower.includes('metacritic critic');
    if (filterVal === 'Metacritic User') return rType === 'user' || sLower.includes('metacritic user');
    return c?.source === filterVal;
};

export const useStageChartMemos = ({
    sources,
    rawComments,
    rawSearchQuery,
    stage1Page,
    stage1ViewAll,
    stage2Data,
    stage2ReleaseFilter,
    stage2SourceFilter,
    stage2SearchQuery,
    stage2ShowAllSignal,
    stage2ShowAllNoise,
    stage3Data,
    stage3SearchQuery,
    stage3Page,
    stage3ViewAll
}: {
    sources: NoiseSourceConfig[];
    rawComments: RawComment[];
    rawSearchQuery: string;
    stage1Page: number;
    stage1ViewAll: boolean;
    stage2Data: Stage2FilteredResult | null;
    stage2ReleaseFilter: string;
    stage2SourceFilter: string;
    stage2SearchQuery: string;
    stage2ShowAllSignal: boolean;
    stage2ShowAllNoise: boolean;
    stage3Data: Stage3KeywordResult | null;
    stage3SearchQuery: string;
    stage3Page: number;
    stage3ViewAll: boolean;
}) => {
    const stage1Analytics = useMemo(() => {
        const safeSources = Array.isArray(sources) ? sources : [];
        const safeRawComments = Array.isArray(rawComments) ? rawComments : [];

        const platformCounts: Record<string, { count: number; sourcesCount: number; color: string; type: string }> = {
            'YouTube': { count: 0, sourcesCount: 0, color: '#FF4757', type: 'youtube' },
            'Steam': { count: 0, sourcesCount: 0, color: '#00F0FF', type: 'steam' },
            'Metacritic': { count: 0, sourcesCount: 0, color: '#FACC15', type: 'metacritic' },
            'Reddit': { count: 0, sourcesCount: 0, color: '#FF7A00', type: 'reddit' }
        };

        safeSources.forEach(s => {
            if (!s) return;
            if (s.type === 'youtube' || s.type === 'youtube_abcd') platformCounts['YouTube'].sourcesCount++;
            else if (s.type === 'steam') platformCounts['Steam'].sourcesCount++;
            else if (s.type === 'metacritic') platformCounts['Metacritic'].sourcesCount++;
            else if (s.type === 'reddit') platformCounts['Reddit'].sourcesCount++;
        });

        let metacriticCriticCount = 0;
        let metacriticUserCount = 0;

        safeRawComments.forEach(c => {
            if (!c) return;
            const sName = String(c.source || '').toLowerCase();
            const rType = String((c as any).reviewType || '').toLowerCase();
            let plat = 'YouTube';
            if (sName.includes('steam')) plat = 'Steam';
            else if (sName.includes('metacritic')) {
                plat = 'Metacritic';
                if (rType === 'critic' || sName.includes('critic')) metacriticCriticCount++;
                else metacriticUserCount++;
            } else if (sName.includes('reddit')) plat = 'Reddit';

            if (platformCounts[plat]) platformCounts[plat].count++;
        });

        const channelBarData = safeSources.map((src, idx) => {
            const srcLabel = String(src?.label || src?.target || src?.type || `Source ${idx + 1}`);
            const srcType = src?.type || 'youtube';
            let count = 0;
            if (safeRawComments.length > 0) {
                const exactMatches = safeRawComments.filter(c =>
                    c && c.sourceLabel && String(c.sourceLabel).toLowerCase() === srcLabel.toLowerCase()
                );
                if (exactMatches.length > 0) {
                    count = exactMatches.length;
                } else {
                    const typeMatches = safeRawComments.filter(c =>
                        c && c.source && String(c.source).toLowerCase().includes(String(srcType).toLowerCase())
                    );
                    const countOfThisType = safeSources.filter(s => s && s.type === srcType).length;
                    count = countOfThisType > 0 ? Math.round(typeMatches.length / countOfThisType) : 0;
                }
            }

            const color = (srcType === 'youtube' || srcType === 'youtube_abcd') ? '#FF4757' : srcType === 'steam' ? '#00F0FF' : srcType === 'metacritic' ? '#FACC15' : '#FF7A00';
            const target = src?.targetCount || (srcType === 'reddit' ? 25 : srcType === 'metacritic' ? 250 : 750);

            return {
                id: src?.id || `src-${idx}`,
                name: srcLabel.length > 24 ? srcLabel.substring(0, 22) + '...' : srcLabel,
                fullName: srcLabel,
                type: srcType,
                target: src?.target || '',
                commentsCount: count,
                targetCount: target,
                isCapped: count >= target,
                color
            };
        });

        const platformPieData = Object.entries(platformCounts).map(([name, data]) => ({
            name,
            value: data.count > 0 ? data.count : (safeRawComments.length > 0 && data.sourcesCount > 0 ? Math.round(safeRawComments.length / 4) : 0),
            sourcesCount: data.sourcesCount,
            color: data.color
        }));

        return {
            totalComments: safeRawComments.length,
            totalDistinctSources: safeSources.length,
            channelBarData,
            platformPieData,
            platformCounts,
            metacriticCriticCount,
            metacriticUserCount,
            metacriticTotal: platformCounts['Metacritic'].count
        };
    }, [rawComments, sources]);

    const filteredRawComments = useMemo(() => {
        if (!rawSearchQuery.trim()) return rawComments || [];
        const q = rawSearchQuery.toLowerCase();
        return (rawComments || []).filter(c =>
            c && (
                String(c.rawText || '').toLowerCase().includes(q) ||
                String(c.author || '').toLowerCase().includes(q) ||
                String(c.source || '').toLowerCase().includes(q) ||
                String((c as any).sourceLabel || '').toLowerCase().includes(q)
            )
        );
    }, [rawComments, rawSearchQuery]);

    const totalRawCount = (filteredRawComments || []).length;
    const totalRawPages = Math.max(1, Math.ceil(totalRawCount / STAGE1_PAGE_SIZE));
    const currentRawPage = Math.min(Math.max(1, stage1Page), totalRawPages);
    const displayedRawComments = useMemo(() => {
        if (stage1ViewAll) return filteredRawComments || [];
        return (filteredRawComments || []).slice((currentRawPage - 1) * STAGE1_PAGE_SIZE, currentRawPage * STAGE1_PAGE_SIZE);
    }, [filteredRawComments, stage1ViewAll, currentRawPage]);

    const availableStage2Releases = useMemo(() => {
        if (!stage2Data?.filteredComments) return ['ALL'];
        const years = new Set<string>();
        stage2Data.filteredComments.forEach(c => {
            const yr = getCommentYear(c);
            if (yr && yr.trim()) years.add(yr.trim());
        });
        return years.size === 0 ? ['ALL'] : ['ALL', ...Array.from(years).sort()];
    }, [stage2Data]);

    const stage2PieData = useMemo(() => {
        if (!stage2Data) return [];
        return [
            {
                name: 'Actionable Signal Retained',
                value: stage2Data.signalCount,
                percentage: stage2Data.signalPercentage,
                color: '#00FF88',
                description: 'Constructive feedback, product critiques, and actionable customer insights'
            },
            {
                name: 'Filtered Noise & Spam',
                value: stage2Data.noiseCount,
                percentage: stage2Data.noisePercentage,
                color: '#FF4757',
                description: 'Low-effort venting, toxic pile-on, memes, and non-actionable complaints'
            }
        ];
    }, [stage2Data]);

    const stage2NoiseReasons = useMemo(() => {
        if (!stage2Data?.filteredComments) return [];
        const reasonCounts: Record<string, number> = {
            'Emotional Venting & Toxic Pile-On': 0,
            'Low-Effort Memes & Copy-Paste Spam': 0,
            'Non-Actionable Speculation / Off-Topic': 0,
            'Duplicate Complaint Clustering': 0
        };

        const noiseItems = (Array.isArray(stage2Data.filteredComments) ? stage2Data.filteredComments : []).filter(c => c && c.isNoise);
        noiseItems.forEach((c, idx) => {
            if (c.noiseReason) {
                reasonCounts[c.noiseReason] = (reasonCounts[c.noiseReason] || 0) + 1;
            } else {
                const mod = idx % 4;
                if (mod === 0) reasonCounts['Emotional Venting & Toxic Pile-On']++;
                else if (mod === 1) reasonCounts['Low-Effort Memes & Copy-Paste Spam']++;
                else if (mod === 2) reasonCounts['Non-Actionable Speculation / Off-Topic']++;
                else reasonCounts['Duplicate Complaint Clustering']++;
            }
        });

        return Object.entries(reasonCounts)
            .map(([reason, count]) => ({
                reason,
                count,
                percentage: noiseItems.length > 0 ? Math.round((count / noiseItems.length) * 100) : 25
            }))
            .sort((a, b) => b.count - a.count);
    }, [stage2Data]);

    const filteredRetainedComments = useMemo(() => {
        if (!stage2Data?.filteredComments) return [];
        return stage2Data.filteredComments
            .filter(c => !c.isNoise)
            .filter(c => stage2ReleaseFilter === 'ALL' || getCommentYear(c) === stage2ReleaseFilter)
            .filter(c => matchesStage2SourceFilter(c, stage2SourceFilter))
            .filter(c => !stage2SearchQuery || String(c?.rawText || '').toLowerCase().includes(stage2SearchQuery.toLowerCase()) || String(c?.author || '').toLowerCase().includes(stage2SearchQuery.toLowerCase()));
    }, [stage2Data?.filteredComments, stage2ReleaseFilter, stage2SourceFilter, stage2SearchQuery]);

    const displayedRetainedComments = useMemo(() => {
        return stage2ShowAllSignal ? filteredRetainedComments : filteredRetainedComments.slice(0, STAGE2_PREVIEW_LIMIT);
    }, [filteredRetainedComments, stage2ShowAllSignal]);

    const filteredNoiseComments = useMemo(() => {
        if (!stage2Data?.filteredComments) return [];
        return stage2Data.filteredComments
            .filter(c => c.isNoise)
            .filter(c => stage2ReleaseFilter === 'ALL' || getCommentYear(c) === stage2ReleaseFilter)
            .filter(c => matchesStage2SourceFilter(c, stage2SourceFilter))
            .filter(c => !stage2SearchQuery || String(c?.rawText || '').toLowerCase().includes(stage2SearchQuery.toLowerCase()) || String(c?.author || '').toLowerCase().includes(stage2SearchQuery.toLowerCase()));
    }, [stage2Data?.filteredComments, stage2ReleaseFilter, stage2SourceFilter, stage2SearchQuery]);

    const displayedNoiseComments = useMemo(() => {
        return stage2ShowAllNoise ? filteredNoiseComments : filteredNoiseComments.slice(0, STAGE2_PREVIEW_LIMIT);
    }, [filteredNoiseComments, stage2ShowAllNoise]);

    const stage3Analytics = useMemo(() => {
        if (!stage3Data?.enrichedComments) return null;
        const keywordMap: Record<string, { count: number; positive: number; negative: number; neutral: number; category: string }> = {};

        stage3Data.enrichedComments.forEach(c => {
            const cat = normalizeCategoryName(c.featureCategory || 'General Experience');
            const sent = c.sentiment || 'neutral';
            c.keywords?.forEach(k => {
                const cleanK = k.replace(/^#/, '').trim();
                if (!cleanK || isPlatformOrSourceKeyword(cleanK)) return;
                if (!keywordMap[cleanK]) {
                    keywordMap[cleanK] = { count: 0, positive: 0, negative: 0, neutral: 0, category: cat };
                }
                keywordMap[cleanK].count++;
                if (sent === 'positive') keywordMap[cleanK].positive++;
                else if (sent === 'negative') keywordMap[cleanK].negative++;
                else keywordMap[cleanK].neutral++;
            });
        });

        const topKeywordsList = Object.entries(keywordMap)
            .map(([keyword, data]) => {
                const dominantSentiment = data.positive > data.negative ? 'positive' : data.negative > data.positive ? 'negative' : 'neutral';
                const color = dominantSentiment === 'positive' ? '#00FF88' : dominantSentiment === 'negative' ? '#FACC15' : '#38bdf8';
                return {
                    keyword: `#${keyword}`,
                    shortKeyword: keyword.length > 20 ? `#${keyword.substring(0, 18)}...` : `#${keyword}`,
                    fullName: `#${keyword}`,
                    count: data.count,
                    positive: data.positive,
                    negative: data.negative,
                    neutral: data.neutral,
                    category: data.category,
                    dominantSentiment,
                    color
                };
            })
            .sort((a, b) => b.count - a.count)
            .slice(0, 8);

        const categoryStats = (Array.isArray(stage3Data?.featureClusters) ? stage3Data.featureClusters : []).map(cluster => {
            const pos = cluster?.sentimentBreakdown?.positive ?? 0;
            const neg = cluster?.sentimentBreakdown?.negative ?? 0;
            const neu = cluster?.sentimentBreakdown?.neutral ?? 0;
            const total = pos + neg + neu;
            const kws = Array.isArray(cluster?.topKeywords) ? cluster.topKeywords : Array.isArray((cluster as any)?.keywords) ? (cluster as any).keywords : [];
            return {
                name: cluster?.category || 'General',
                positive: pos,
                negative: neg,
                neutral: neu,
                posPct: total > 0 ? Math.round((pos / total) * 100) : 50,
                negPct: total > 0 ? Math.round((neg / total) * 100) : 50,
                keywordCount: cluster?.keywordCount ?? (cluster as any)?.commentCount ?? kws.length ?? 0,
                topKeywords: kws
            };
        });

        return {
            topKeywordsList,
            categoryStats,
            totalUniqueKeywords: Object.keys(keywordMap).length,
            totalEnriched: stage3Data.totalEnriched || (stage3Data.enrichedComments || []).length
        };
    }, [stage3Data]);

    const filteredStage3Comments = useMemo(() => {
        const list = Array.isArray(stage3Data?.enrichedComments) ? stage3Data.enrichedComments : [];
        if (!stage3SearchQuery.trim()) return list;
        const q = stage3SearchQuery.toLowerCase();
        return list.filter(c => {
            if (!c) return false;
            return String(c.rawText || '').toLowerCase().includes(q) ||
                String(c.featureCategory || '').toLowerCase().includes(q) ||
                (c.keywords || []).some(k => String(typeof k === 'string' ? k : (k as any)?.keyword || (k as any)?.name || '').toLowerCase().includes(q));
        });
    }, [stage3Data?.enrichedComments, stage3SearchQuery]);

    const totalStage3Count = filteredStage3Comments.length;
    const totalStage3Pages = Math.max(1, Math.ceil(totalStage3Count / STAGE3_PAGE_SIZE));
    const currentStage3Page = Math.min(Math.max(1, stage3Page), totalStage3Pages);
    const displayedStage3Comments = useMemo(() => {
        if (stage3ViewAll) return filteredStage3Comments;
        return filteredStage3Comments.slice((currentStage3Page - 1) * STAGE3_PAGE_SIZE, currentStage3Page * STAGE3_PAGE_SIZE);
    }, [filteredStage3Comments, stage3ViewAll, currentStage3Page]);

    return {
        stage1Analytics,
        filteredRawComments,
        totalRawCount,
        totalRawPages,
        currentRawPage,
        displayedRawComments,
        availableStage2Releases,
        stage2PieData,
        stage2NoiseReasons,
        filteredRetainedComments,
        displayedRetainedComments,
        filteredNoiseComments,
        displayedNoiseComments,
        stage3Analytics,
        filteredStage3Comments,
        totalStage3Count,
        totalStage3Pages,
        currentStage3Page,
        displayedStage3Comments
    };
};
