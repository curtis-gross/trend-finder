import { useMemo } from 'react';
import {
    EnrichedComment,
    Stage3KeywordResult,
    NoiseFilterResult,
    CrossReleaseEvolution,
    getCommentYear,
    sortCommentsBySourcePriority
} from '../../services/noiseFilterService';

const getNormalizedTrajectory = (
    evo: CrossReleaseEvolution
): 'improving' | 'declining' | 'stable' | 'emerging' | 'critical' => {
    if (!evo) return 'stable';
    const current = evo.year2026Sentiment ?? evo.currentSentiment ?? 0;
    const prior = evo.year2025Sentiment ?? evo.priorSentiment ?? 0;
    const delta = current - prior;
    if (delta >= 2) {
        return evo.trajectory === 'emerging' ? 'emerging' : 'improving';
    }
    if (delta <= -2) {
        return 'critical';
    }
    return 'stable';
};

export const useTrajectoryAndNodeMemos = ({
    stage3Data,
    stage4Data,
    stage3Analytics,
    selectedTopic,
    drilldownSentimentFilter,
    drilldownReleaseFilter,
    drilldownSourceFilter,
    drilldownSearch
}: {
    stage3Data: Stage3KeywordResult | null;
    stage4Data: NoiseFilterResult | null;
    stage3Analytics: any;
    selectedTopic: string | null;
    drilldownSentimentFilter: 'ALL' | 'positive' | 'negative' | 'neutral';
    drilldownReleaseFilter: string;
    drilldownSourceFilter: string;
    drilldownSearch: string;
}) => {
    const availableDrilldownReleases = useMemo(() => {
        const years = new Set<string>();
        (stage3Data?.enrichedComments || []).forEach(c => {
            const yr = getCommentYear(c);
            if (yr && yr.trim()) years.add(yr.trim());
        });
        return years.size === 0 ? ['ALL'] : ['ALL', ...Array.from(years).sort()];
    }, [stage3Data]);

    const stage5TimelineData = useMemo(() => {
        if (!stage4Data?.crossReleaseEvolution || !Array.isArray(stage4Data.crossReleaseEvolution)) {
            return { timelinePoints: [], pillars: [] };
        }

        const pillars = (stage4Data.crossReleaseEvolution || []).map(p => {
            const base = p.year2024Sentiment ?? p.baselineSentiment ?? 50;
            const prior = p.year2025Sentiment ?? p.priorSentiment ?? 55;
            const curr = p.year2026Sentiment ?? p.currentSentiment ?? 60;
            const delta = curr - prior;
            const multiYearDelta = (curr - base) / 2;
            const effectiveSlope = Math.round((delta * 0.6) + (multiYearDelta * 0.4));
            const predicted2027 = Math.max(15, Math.min(95, Math.round(curr + (effectiveSlope * 0.8))));

            let target = p.year2027Sentiment ?? p.targetSentiment ?? predicted2027;
            if (typeof target !== 'number' || (curr < 50 && target >= 68) || (delta < 0 && target > curr + 5) || (target - curr > 14)) {
                target = predicted2027;
            }

            return {
                ...p,
                year2024Sentiment: base,
                year2025Sentiment: prior,
                year2026Sentiment: curr,
                year2027Sentiment: target,
                targetSentiment: target,
                trajectory: getNormalizedTrajectory(p)
            };
        });

        const point2022: Record<string, any> = { release: '2022', milestone: '2022', label: '2022 · Foundation Baseline' };
        const point2023: Record<string, any> = { release: '2023', milestone: '2023', label: '2023 · Historical Horizon' };
        const pointBaseline: Record<string, any> = { release: '2024', milestone: '2024', label: '2024 · Benchmark Year' };
        const pointPrior: Record<string, any> = { release: '2025', milestone: '2025', label: '2025 · Prior Year' };
        const pointCurrent: Record<string, any> = { release: '2026', milestone: '2026', label: '2026 · Current Performance (Active)' };
        const pointTarget: Record<string, any> = { release: '2027', milestone: '2027', label: '2027 · Trend Prediction' };

        pillars.forEach((p) => {
            const base = p.year2024Sentiment ?? 50;
            const prior = p.year2025Sentiment ?? 55;
            const curr = p.year2026Sentiment ?? 60;
            const target = p.year2027Sentiment ?? curr;
            const isCritical = p.trajectory === 'critical' || p.trajectory === 'declining';
            const y22 = p.year2022Sentiment ?? (isCritical ? Math.min(85, base + 10) : Math.max(40, base - 8));
            const y23 = p.year2023Sentiment ?? (isCritical ? Math.min(82, base + 5) : Math.max(45, base - 4));

            point2022[p.feature] = y22;
            point2023[p.feature] = y23;
            pointBaseline[p.feature] = base;
            pointPrior[p.feature] = prior;
            pointCurrent[p.feature] = curr;
            pointTarget[p.feature] = target;
        });

        return {
            timelinePoints: [point2022, point2023, pointBaseline, pointPrior, pointCurrent, pointTarget],
            pillars
        };
    }, [stage4Data]);

    const activeTopicItem = useMemo(() => {
        if (!selectedTopic) return null;
        const clean = String(selectedTopic || '').replace(/^#/, '').toLowerCase().trim();

        const directCluster = (stage3Data?.featureClusters || []).find(
            c => String(c?.category || '').toLowerCase().trim() === clean
        );
        if (directCluster) {
            const totalQuotes =
                (directCluster.sentimentBreakdown?.positive || 0) +
                (directCluster.sentimentBreakdown?.negative || 0) +
                (directCluster.sentimentBreakdown?.neutral || 0);
            return {
                title: directCluster.category || clean,
                commentFrequency: totalQuotes || directCluster.keywordCount || 86,
                frequencyPercentage: 92,
                velocityChange: 24,
                isBreakout: false,
                category: directCluster.category || clean,
                country: 'United States',
                sentiment: 'positive'
            };
        }

        if (stage3Data?.topKeywords && Array.isArray(stage3Data.topKeywords)) {
            const match = (stage3Data.topKeywords as any[]).find(k => {
                const kwName = String(typeof k === 'string' ? k : k?.keyword || k?.title || '').replace(/^#/, '').toLowerCase().trim();
                return kwName === clean;
            });
            if (match && typeof match === 'object') {
                return {
                    title: match.keyword || match.title || selectedTopic,
                    commentFrequency: match.mentions || match.count || 24,
                    frequencyPercentage: match.frequencyPercentage || 68,
                    velocityChange: match.velocityChange ?? 18,
                    isBreakout: match.isBreakout || false,
                    category: match.category || 'Customer Experience',
                    country: match.country || 'United States',
                    sentiment: match.sentiment || 'positive'
                };
            }
        }

        const analyticsMatch = stage3Analytics?.topKeywordsList?.find(
            (k: any) => String(k?.keyword || '').replace(/^#/, '').toLowerCase().trim() === clean
        );
        if (analyticsMatch) {
            return {
                title: analyticsMatch.fullName || selectedTopic,
                commentFrequency: analyticsMatch.count,
                frequencyPercentage: Math.round((analyticsMatch.count / (stage3Analytics.totalEnriched || 1)) * 100),
                velocityChange: 15,
                isBreakout: false,
                category: analyticsMatch.category || 'Customer Experience',
                country: 'United States',
                sentiment: analyticsMatch.dominantSentiment
            };
        }

        const parentCluster = (stage3Data?.featureClusters || []).find(c =>
            (c?.topKeywords || (c as any)?.keywords || []).some(
                (k: any) => String(typeof k === 'string' ? k : k?.keyword || '').replace(/^#/, '').toLowerCase().trim() === clean
            ) || String(c?.category || '').toLowerCase().trim() === clean
        );

        return {
            title: selectedTopic,
            commentFrequency: parentCluster?.keywordCount ? Math.min(parentCluster.keywordCount, 45) : 36,
            frequencyPercentage: 58,
            velocityChange: 14,
            isBreakout: false,
            category: parentCluster?.category || 'Customer Experience',
            country: 'United States',
            sentiment: 'positive'
        };
    }, [selectedTopic, stage3Data, stage3Analytics]);

    const activeTopicComments = useMemo(() => {
        if (!selectedTopic) return [];
        const clean = String(selectedTopic || '').replace(/^#/, '').toLowerCase().trim();
        let comments: EnrichedComment[] = [];

        if (stage3Data?.enrichedComments && Array.isArray(stage3Data.enrichedComments)) {
            const matchingCluster = (stage3Data.featureClusters || []).find(
                fc => String(fc?.category || '').toLowerCase().trim() === clean
            );

            if (matchingCluster) {
                comments = stage3Data.enrichedComments.filter(
                    c => c && String(c.featureCategory || '').toLowerCase().trim() === String(matchingCluster.category || '').toLowerCase().trim()
                );
            } else {
                const directMatches = stage3Data.enrichedComments.filter(c => {
                    if (!c) return false;
                    const textMatch = String(c.rawText || '').toLowerCase().includes(clean);
                    const kwMatch = (c.keywords || []).some(k => {
                        const kClean = String(typeof k === 'string' ? k : (k as any)?.keyword || (k as any)?.name || '').replace(/^#/, '').toLowerCase().trim();
                        return kClean === clean || (kClean && clean.includes(kClean));
                    });
                    return textMatch || kwMatch;
                });

                const keyTokens = clean.split(/\s+/).filter(w => w.length >= 4);
                const tokenMatches = stage3Data.enrichedComments.filter(c => {
                    if (!c || directMatches.some(dm => dm.id === c.id)) return false;
                    const text = String(c.rawText || '').toLowerCase();
                    const kwText = (c.keywords || []).map(k => String(typeof k === 'string' ? k : (k as any)?.keyword || '').toLowerCase()).join(' ');
                    return keyTokens.some(tok => text.includes(tok) || kwText.includes(tok));
                });

                comments = [...directMatches, ...tokenMatches];

                const parentCategory =
                    activeTopicItem?.category ||
                    (stage3Data.featureClusters || []).find(c =>
                        (c?.topKeywords || (c as any)?.keywords || []).some(
                            (k: any) => String(typeof k === 'string' ? k : k?.keyword || '').replace(/^#/, '').toLowerCase().trim() === clean
                        )
                    )?.category;

                if (comments.length < 6 && parentCategory) {
                    const parentCatClean = String(parentCategory || '').toLowerCase().trim();
                    const categoryComms = stage3Data.enrichedComments.filter(
                        c =>
                            c &&
                            String(c.featureCategory || '').toLowerCase().trim() === parentCatClean &&
                            !comments.some(existing => existing.id === c.id)
                    );
                    comments = [...comments, ...categoryComms];
                }
            }
        }

        const filtered = comments.filter(c => {
            if (drilldownSentimentFilter !== 'ALL' && c.sentiment !== drilldownSentimentFilter) return false;
            if (drilldownReleaseFilter !== 'ALL' && getCommentYear(c) !== drilldownReleaseFilter) return false;
            if (drilldownSourceFilter !== 'ALL') {
                const s = (c.source || '').toLowerCase();
                const rType = String((c as any).reviewType || '').toLowerCase();
                if (drilldownSourceFilter === 'youtube' && !s.includes('youtube')) return false;
                if (drilldownSourceFilter === 'reviews' && !(s.includes('customer') || s.includes('review') || s.includes('trustpilot') || s.includes('store') || s.includes('steam') || s.includes('metacritic'))) return false;
                if (drilldownSourceFilter === 'metacritic' && !s.includes('metacritic')) return false;
                if (drilldownSourceFilter === 'metacritic_critic' && !(rType === 'critic' || s.includes('metacritic critic'))) return false;
                if (drilldownSourceFilter === 'metacritic_user' && !(rType === 'user' || s.includes('metacritic user'))) return false;
                if (drilldownSourceFilter === 'reddit' && !s.includes('reddit')) return false;
            }
            if (drilldownSearch.trim()) {
                const q = drilldownSearch.toLowerCase().trim();
                const authorMatch = String(c?.author || '').toLowerCase().includes(q);
                const textMatch = String(c?.rawText || '').toLowerCase().includes(q);
                const catMatch = String(c?.featureCategory || '').toLowerCase().includes(q);
                const suggestionMatch = String(c?.actionableSuggestion || '').toLowerCase().includes(q);
                if (!authorMatch && !textMatch && !catMatch && !suggestionMatch) return false;
            }
            return true;
        });

        return sortCommentsBySourcePriority(filtered);
    }, [selectedTopic, stage3Data, activeTopicItem, drilldownSentimentFilter, drilldownReleaseFilter, drilldownSourceFilter, drilldownSearch]);

    return {
        availableDrilldownReleases,
        stage5TimelineData,
        activeTopicItem,
        activeTopicComments
    };
};
