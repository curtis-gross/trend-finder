import React from 'react';
import { AlertTriangle, Filter, RefreshCw } from 'lucide-react';
import { useCompanyContext } from '../context/CompanyContext';
import { useSystemReadiness } from '../context/SystemReadinessContext';
import { LandingSetupReadinessCard } from './SystemReadinessBanner';
import { TaxonomyDomainGrid } from './TaxonomyDomainGrid';
import {
    TopicItem,
    FeatureClusterOverview,
    InsightsHomeProps,
    DEFAULT_FEATURE_CLUSTERS,
    DEFAULT_INITIAL_TOP_TOPICS,
    DEFAULT_INITIAL_RISING_TOPICS,
    detectAccurateCommentLanguage
} from './insightsHome/insightsHomeCache';
import { useTopicsHydration } from './insightsHome/useTopicsHydration';
import { useTopicDrilldownFilter } from './insightsHome/useTopicDrilldownFilter';
import { TrendsDualColumnWidget } from './insightsHome/TrendsDualColumnWidget';
import { InsightsTopicEvidenceModal } from './insightsHome/InsightsTopicEvidenceModal';

export type { TopicItem, FeatureClusterOverview, InsightsHomeProps };
export {
    DEFAULT_FEATURE_CLUSTERS,
    DEFAULT_INITIAL_TOP_TOPICS,
    DEFAULT_INITIAL_RISING_TOPICS,
    detectAccurateCommentLanguage
};

export const InsightsHome: React.FC<InsightsHomeProps> = ({
    initialSelectedTopic,
    onNavigateToTopic,
    onNavigateToTab
}) => {
    const { name: companyName } = useCompanyContext();
    const activeCompany = companyName || 'test-company';

    const {
        topTopics,
        risingTopics,
        featureClusters,
        enrichedComments,
        isLoading,
        hydrationError,
        handleRefresh
    } = useTopicsHydration(activeCompany);
    const { refreshReadiness } = useSystemReadiness();

    const handleRefreshAll = () => {
        handleRefresh();
        void refreshReadiness(activeCompany);
    };

    const {
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
    } = useTopicDrilldownFilter({
        initialSelectedTopic,
        topTopics,
        risingTopics,
        featureClusters,
        enrichedComments
    });

    const hasTopicData = topTopics.length > 0 || risingTopics.length > 0 || featureClusters.length > 0;

    return (
        <div className="w-full space-y-8 animate-fadeIn bg-[#F7F8FA] dark:bg-[#020F1D] text-[var(--app-text)] dark:text-slate-100 max-w-7xl mx-auto pb-12">
            {hydrationError && (
                <div
                    role="alert"
                    data-testid="topics-hydration-error"
                    className="bg-rose-50 dark:bg-[#041527] border border-rose-300 dark:border-rose-500/40 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 text-xs"
                >
                    <div className="flex items-start gap-2.5 min-w-0">
                        <AlertTriangle size={16} className="text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                        <div className="min-w-0">
                            <p className="font-bold text-rose-800 dark:text-rose-300">Failed to load topic snapshots</p>
                            <p className="text-rose-700 dark:text-slate-300 break-words">{hydrationError}</p>
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={handleRefreshAll}
                        className="px-3 py-1.5 rounded-xl bg-[#0072BC] hover:bg-[#0284C7] text-white keep-white-text font-bold text-xs inline-flex items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer"
                    >
                        <RefreshCw size={12} />
                        <span>Retry Load</span>
                    </button>
                </div>
            )}

            {!isLoading && !hasTopicData && (
                <LandingSetupReadinessCard
                    onNavigateToPipeline={() => onNavigateToTab?.('filter')}
                    hasTopicData={false}
                />
            )}

            <TrendsDualColumnWidget
                region={region}
                onRegionChange={setRegion}
                timeRange={timeRange}
                onTimeRangeChange={setTimeRange}
                searchQuery={searchQuery}
                onSearchQueryChange={setSearchQuery}
                isLoading={isLoading}
                onRefresh={handleRefreshAll}
                filteredTopTopics={filteredTopTopics}
                filteredRisingTopics={filteredRisingTopics}
                selectedTopic={selectedTopic}
                onTopicClick={handleTopicClick}
                onNavigateToTab={onNavigateToTab}
            />

            {/* TOPICS OVERVIEWS GRID */}
            {isLoading ? (
                <div className="bg-[var(--app-card)] rounded-3xl border border-[var(--app-border)] p-8 shadow-xs flex items-center justify-center gap-2.5 text-xs font-mono text-[var(--app-muted)] animate-pulse">
                    <RefreshCw size={14} className="animate-spin text-[#38bdf8]" />
                    <span>Loading...</span>
                </div>
            ) : (
                <TaxonomyDomainGrid
                    clusters={displayClusters}
                    enrichedComments={enrichedComments}
                    selectedTopic={selectedTopic}
                    onSelectTopic={handleTopicClick}
                    onNavigateToTab={onNavigateToTab}
                />
            )}

            {/* ALMOST FULL-SCREEN MODAL FOR TOPIC DRILLDOWN & ISOLATED COMMENT EVIDENCE FEED */}
            {selectedTopic && activeTopicItem && (
                <InsightsTopicEvidenceModal
                    selectedTopic={selectedTopic}
                    activeTopicItem={activeTopicItem}
                    topicComments={topicComments}
                    selectedSentimentFilter={selectedSentimentFilter}
                    onSelectSentimentFilter={setSelectedSentimentFilter}
                    selectedReleaseFilter={selectedReleaseFilter}
                    onSelectReleaseFilter={setSelectedReleaseFilter}
                    selectedSourceFilter={selectedSourceFilter}
                    onSelectSourceFilter={setSelectedSourceFilter}
                    drilldownSearch={drilldownSearch}
                    onDrilldownSearchChange={setDrilldownSearch}
                    onClose={() => setSelectedTopic(null)}
                    onNavigateToTopic={onNavigateToTopic}
                    onNavigateToTab={onNavigateToTab}
                />
            )}

            {/* Sleek Guidance State */}
            <div className="bg-[var(--app-card)] dark:bg-[#041527] border border-dashed border-[var(--app-border)] dark:border-[#041E3A] rounded-2xl p-4 text-center text-xs text-[var(--app-muted)] dark:text-slate-300 font-mono flex items-center justify-center gap-2">
                <Filter size={13} className="text-[#38bdf8]" />
                <span>Click any topic row or bar in <strong>Top topics</strong>, <strong>Rising topics</strong>, or <strong>Feature Domains</strong> to open the full-screen breakdown modal.</span>
            </div>
        </div>
    );
};
