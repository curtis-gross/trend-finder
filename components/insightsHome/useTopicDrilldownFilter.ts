import { useState, useEffect, useMemo } from 'react';
import { sortCommentsBySourcePriority, matchTopicToTaxonomy } from '../../services/noiseFilterService';
import { TopicItem, FeatureClusterOverview, getCountryFlag } from './insightsHomeCache';

export type TimeRangeOption = '24h' | '7d' | '30d' | '90d' | 'all';
export type SentimentFilterOption = 'ALL' | 'positive' | 'negative' | 'neutral';
export type ReleaseFilterOption = 'ALL' | '2024' | '2025' | '2026' | '2027';
export type SourceFilterOption = 'ALL' | 'youtube' | 'reviews' | 'reddit';

interface UseTopicDrilldownFilterParams {
    initialSelectedTopic?: string | null;
    topTopics: TopicItem[];
    risingTopics: TopicItem[];
    featureClusters: FeatureClusterOverview[];
    enrichedComments: any[];
}

const REGION_MAP: Record<string, string> = {
    US: 'English',
    UK: 'English',
    DE: 'German',
    JP: 'Japanese'
};

const getScaledTopics = (items: TopicItem[], range: TimeRangeOption): TopicItem[] => {
    const scaleFactor = range === 'all' || range === '90d' ? 1.0 : range === '30d' ? 0.68 : range === '7d' ? 0.35 : 0.12;
    const velocityScale = range === 'all' || range === '90d' ? 1.0 : range === '30d' ? 1.15 : range === '7d' ? 1.35 : 1.6;
    const maxFrequency = Math.max(...items.map(t => t.commentFrequency), 1);

    return items.map((t, idx) => {
        const scaledCount = Math.max(1, Math.round(t.commentFrequency * scaleFactor));
        const scaledVelocity = t.velocityChange > 0
            ? Math.round(t.velocityChange * velocityScale)
            : Math.round(t.velocityChange * (2.0 - velocityScale));
        const relativeFreqPct = Math.max(12, Math.min(100, Math.round((t.commentFrequency / maxFrequency) * 100)));

        return {
            ...t,
            rank: idx + 1,
            commentFrequency: scaledCount,
            frequencyPercentage: relativeFreqPct,
            velocityChange: scaledVelocity,
            isBreakout: scaledVelocity >= 150
        };
    });
};

export const useTopicDrilldownFilter = ({
    initialSelectedTopic,
    topTopics,
    risingTopics,
    featureClusters,
    enrichedComments
}: UseTopicDrilldownFilterParams) => {
    const [timeRange, setTimeRange] = useState<TimeRangeOption>('all');
    const [region, setRegion] = useState<string>('GLOBAL');
    const [searchQuery, setSearchQuery] = useState('');

    const [selectedTopic, setSelectedTopic] = useState<string | null>(() => {
        const raw = initialSelectedTopic || (() => {
            try { return sessionStorage.getItem('deep_media_initial_topic'); } catch { return null; }
        })();
        if (!raw) return null;
        return matchTopicToTaxonomy(raw, {
            topTopics,
            risingTopics,
            featureClusters
        });
    });

    const [selectedSentimentFilter, setSelectedSentimentFilter] = useState<SentimentFilterOption>('ALL');
    const [selectedReleaseFilter, setSelectedReleaseFilter] = useState<ReleaseFilterOption>('ALL');
    const [selectedSourceFilter, setSelectedSourceFilter] = useState<SourceFilterOption>('ALL');
    const [drilldownSearch, setDrilldownSearch] = useState('');

    useEffect(() => {
        const target = initialSelectedTopic || (() => {
            try { return sessionStorage.getItem('deep_media_initial_topic'); } catch { return null; }
        })();
        if (target) {
            const matched = matchTopicToTaxonomy(target, {
                topTopics,
                risingTopics,
                featureClusters
            });
            setSelectedTopic(matched);
            try {
                sessionStorage.removeItem('deep_media_initial_topic');
                sessionStorage.removeItem('deep_media_initial_topic_keywords');
            } catch {}
        }
    }, [initialSelectedTopic, topTopics, risingTopics, featureClusters]);

    useEffect(() => {
        if (!selectedTopic) return;
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') {
                setSelectedTopic(null);
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [selectedTopic]);

    const filterByRegionAndSearch = (items: TopicItem[]) => {
        return items.filter(t => {
            const langInfo = getCountryFlag(t.country, t.title);
            const matchesSearch = !searchQuery ||
                t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                t.country?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                langInfo.label.toLowerCase().includes(searchQuery.toLowerCase());

            if (region === 'GLOBAL') return matchesSearch;
            const targetLanguage = REGION_MAP[region];
            const matchesRegion = langInfo.language === targetLanguage || t.country === targetLanguage || (!t.country && region === 'US');
            return matchesSearch && (matchesRegion || items.length < 3);
        });
    };

    const scaledTopTopics = useMemo(() => getScaledTopics(topTopics, timeRange), [topTopics, timeRange]);
    const scaledRisingTopics = useMemo(() => getScaledTopics(risingTopics, timeRange), [risingTopics, timeRange]);

    const filteredTopTopics = useMemo(() => {
        const list = filterByRegionAndSearch(scaledTopTopics);
        const sorted = [...list].sort((a, b) => b.commentFrequency - a.commentFrequency).map((item, idx) => ({ ...item, rank: idx + 1 }));
        return searchQuery ? sorted : sorted.slice(0, 8);
    }, [scaledTopTopics, region, searchQuery]);

    const filteredRisingTopics = useMemo(() => {
        const list = filterByRegionAndSearch(scaledRisingTopics);
        const sorted = [...list]
            .sort((a, b) => (b.velocityChange - a.velocityChange) || (b.commentFrequency - a.commentFrequency))
            .map((item, idx) => ({ ...item, rank: idx + 1 }));
        return searchQuery ? sorted : sorted.slice(0, 8);
    }, [scaledRisingTopics, region, searchQuery]);

    const displayClusters = useMemo(() => {
        if (!searchQuery) return featureClusters || [];
        const q = searchQuery.toLowerCase();
        return (featureClusters || []).filter(c => {
            if (!c || typeof c !== 'object') return false;
            const catName = String(c.category || (c as any).name || (c as any).title || '').toLowerCase();
            const kws = Array.isArray(c.topKeywords) && c.topKeywords.length > 0
                ? c.topKeywords
                : Array.isArray((c as any).keywords) ? (c as any).keywords : [];
            return catName.includes(q) ||
                kws.some((k: any) => {
                    const str = typeof k === 'string' ? k : (k?.keyword || k?.name || k?.topic || '');
                    return str.toLowerCase().includes(q);
                });
        });
    }, [featureClusters, searchQuery]);

    const handleTopicClick = (topicTitle: string) => {
        setSelectedTopic(prev => (prev === topicTitle ? null : topicTitle));
    };

    const activeTopicItem = useMemo<TopicItem | null>(() => {
        if (!selectedTopic) return null;
        const clean = selectedTopic.replace(/^#/, '').toLowerCase().trim();
        const found = [...filteredTopTopics, ...filteredRisingTopics].find(t => t.title.toLowerCase() === clean);
        if (found) return found;

        const directCluster = (featureClusters || []).find(c =>
            c && String(c.category || (c as any).name || '').toLowerCase().trim() === clean
        );
        if (directCluster) {
            const breakdown = directCluster.sentimentBreakdown || { positive: 0, negative: 0, neutral: 0 };
            const totalQuotes = ((Number(breakdown.positive) || 0) + (Number(breakdown.negative) || 0) + (Number(breakdown.neutral) || 0));
            return {
                id: 'category-focus',
                rank: 1,
                title: directCluster.category || clean,
                commentFrequency: totalQuotes || directCluster.keywordCount || 86,
                frequencyPercentage: 92,
                velocityChange: 24,
                category: directCluster.category || clean,
                country: 'English',
                channel: 'Multi-Source Feedback'
            };
        }

        const parentCluster = (featureClusters || []).find(c => {
            if (!c || typeof c !== 'object') return false;
            const kws = Array.isArray(c.topKeywords) ? c.topKeywords : Array.isArray((c as any).keywords) ? (c as any).keywords : [];
            const matchesKw = kws.some((k: any) => {
                const str = typeof k === 'string' ? k : (k?.keyword || k?.name || k?.topic || '');
                return str.replace(/^#/, '').toLowerCase().trim() === clean;
            });
            const matchesCat = String(c.category || '').toLowerCase().trim() === clean;
            return matchesKw || matchesCat;
        });

        return {
            id: 'selected-custom',
            rank: 1,
            title: selectedTopic,
            commentFrequency: parentCluster?.keywordCount ? Math.min(parentCluster.keywordCount, 45) : 36,
            frequencyPercentage: 78,
            velocityChange: 18,
            category: parentCluster?.category || 'General',
            country: 'English',
            channel: 'Multi-Source Feedback'
        };
    }, [selectedTopic, filteredTopTopics, filteredRisingTopics, featureClusters]);

    const topicComments = useMemo(() => {
        if (!selectedTopic) return [];
        const cleanTopic = selectedTopic.replace(/^#/, '').toLowerCase().trim();

        const matchingCluster = (featureClusters || []).find(fc =>
            fc && String(fc.category || (fc as any).name || '').toLowerCase().trim() === cleanTopic
        );

        let comments: any[] = [];

        if (matchingCluster) {
            const matchCat = String(matchingCluster.category || cleanTopic).toLowerCase().trim();
            comments = enrichedComments.filter(c =>
                c && c.featureCategory && String(c.featureCategory).toLowerCase().trim() === matchCat
            );
        } else {
            const directMatches = enrichedComments.filter(c => {
                if (!c) return false;
                const kwMatch = Array.isArray(c.keywords) && c.keywords.some((k: any) => {
                    const str = typeof k === 'string' ? k : (k?.keyword || k?.name || k?.topic || '');
                    const cleanK = str.replace(/^#/, '').toLowerCase();
                    return cleanK.includes(cleanTopic) || cleanTopic.includes(cleanK);
                });
                const textMatch = typeof c.rawText === 'string' && c.rawText.toLowerCase().includes(cleanTopic);
                return kwMatch || textMatch;
            });

            const keyTokens = cleanTopic.split(/\s+/).filter(w => w.length >= 4);
            const tokenMatches = enrichedComments.filter(c => {
                if (!c || directMatches.some(dm => dm.id === c.id)) return false;
                const text = (typeof c.rawText === 'string' ? c.rawText : '').toLowerCase();
                const kwText = (Array.isArray(c.keywords) ? c.keywords : []).map((k: any) => {
                    const str = typeof k === 'string' ? k : (k?.keyword || k?.name || k?.topic || '');
                    return str.toLowerCase();
                }).join(' ');
                return keyTokens.some(tok => text.includes(tok) || kwText.includes(tok));
            });

            comments = [...directMatches, ...tokenMatches];

            const parentCategory = activeTopicItem?.category || ((featureClusters || []).find(c => {
                if (!c || typeof c !== 'object') return false;
                const kws = Array.isArray(c.topKeywords) ? c.topKeywords : Array.isArray((c as any).keywords) ? (c as any).keywords : [];
                return kws.some((k: any) => {
                    const str = typeof k === 'string' ? k : (k?.keyword || k?.name || k?.topic || '');
                    return str.replace(/^#/, '').toLowerCase().trim() === cleanTopic;
                });
            })?.category);

            if (comments.length < 6 && parentCategory) {
                const parentCatClean = String(parentCategory).toLowerCase().trim();
                const categoryComms = enrichedComments.filter(c =>
                    c && c.featureCategory && String(c.featureCategory).toLowerCase().trim() === parentCatClean &&
                    !comments.some(existing => existing.id === c.id)
                );
                comments = [...comments, ...categoryComms];
            }
        }

        const filtered = comments.filter(c => {
            const matchesSentiment = selectedSentimentFilter === 'ALL' || c.sentiment === selectedSentimentFilter;
            const matchesRelease = selectedReleaseFilter === 'ALL' ||
                c.release === selectedReleaseFilter ||
                (c.release && typeof c.release === 'string' && (
                    (selectedReleaseFilter === '2024' && c.release.includes('2024')) ||
                    (selectedReleaseFilter === '2025' && (c.release.includes('2025') || c.release.includes('priorPeriod'))) ||
                    (selectedReleaseFilter === '2026' && (c.release.includes('2026') || c.release.includes('currentPeriod'))) ||
                    (selectedReleaseFilter === '2027' && (c.release.includes('2027') || c.release.includes('nextPeriod')))
                ));
            const matchesSource = selectedSourceFilter === 'ALL' ||
                (selectedSourceFilter === 'youtube' && (c.source || '').toLowerCase().includes('youtube')) ||
                (selectedSourceFilter === 'reviews' && ((c.source || '').toLowerCase().includes('customer') || (c.source || '').toLowerCase().includes('review') || (c.source || '').toLowerCase().includes('trustpilot') || (c.source || '').toLowerCase().includes('store') || (c.source || '').toLowerCase().includes('steam'))) ||
                (selectedSourceFilter === 'reddit' && (c.source || '').toLowerCase().includes('reddit'));
            const matchesSearch = !drilldownSearch ||
                (c.rawText && c.rawText.toLowerCase().includes(drilldownSearch.toLowerCase())) ||
                (c.author && c.author.toLowerCase().includes(drilldownSearch.toLowerCase())) ||
                (c.constructiveSummary && c.constructiveSummary.toLowerCase().includes(drilldownSearch.toLowerCase()));
            return matchesSentiment && matchesRelease && matchesSource && matchesSearch;
        });

        return sortCommentsBySourcePriority(filtered);
    }, [selectedTopic, enrichedComments, selectedSentimentFilter, selectedReleaseFilter, selectedSourceFilter, drilldownSearch, activeTopicItem, featureClusters]);

    return {
        timeRange,
        setTimeRange,
        region,
        setRegion,
        searchQuery,
        setSearchQuery,
        selectedTopic,
        setSelectedTopic,
        handleTopicClick,
        selectedSentimentFilter,
        setSelectedSentimentFilter,
        selectedReleaseFilter,
        setSelectedReleaseFilter,
        selectedSourceFilter,
        setSelectedSourceFilter,
        drilldownSearch,
        setDrilldownSearch,
        filteredTopTopics,
        filteredRisingTopics,
        displayClusters,
        activeTopicItem,
        topicComments
    };
};
