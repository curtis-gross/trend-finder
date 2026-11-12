import React from 'react';
import { createPortal } from 'react-dom';
import { Award, CheckCircle2, Gamepad2, Link, MessageSquare, Play, Plus, Search, Shield, X } from 'lucide-react';
import { FindInsightsModalProps, FindInsightsSource } from '../findInsightsStore';
import { AbcdVideoTab } from './AbcdVideoTab';
import { AddSourceTab } from './AddSourceTab';
import { GroundedSearchTab } from './GroundedSearchTab';
import { MetacriticModalTab } from './MetacriticModalTab';
import { RedditInsightsTab } from './RedditInsightsTab';
import { BTN_PRIMARY, BTN_SECONDARY, SteamSearchTab } from './SteamAndDirectUrlTabs';
import { YouTubeTrendsTab } from './YouTubeTrendsTab';
import { useFindInsightsModalController } from './useFindInsightsModalController';

const TABS: Array<{ id: FindInsightsSource; label: string; icon: any }> = [
    { id: 'grounded', label: 'Discover', icon: Search },
    { id: 'youtube', label: 'Video', icon: Play },
    { id: 'reddit', label: 'Reddit', icon: MessageSquare },
    { id: 'abcd', label: 'ABCD', icon: Shield },
    { id: 'steam', label: 'Steam', icon: Gamepad2 },
    { id: 'metacritic', label: 'Metacritic', icon: Award },
    { id: 'addsource', label: 'Add Source', icon: Link }
];

const SOURCE_NAMES: Record<string, string> = Object.fromEntries(TABS.map(t => [t.id, t.label]));

export const FindInsightsModal: React.FC<FindInsightsModalProps> = (props) => {
    const {
        isOpen, prompt, setPrompt, selectedContentTypes, setSelectedContentTypes,
        setIsOpen, foundInsights, isFindingInsights, onRunSearch, existingRows
    } = props;

    const ctrl = useFindInsightsModalController(props);

    if (!isOpen) return null;

    const {
        activeBrand, modalMode, setModalMode, activeResultFilter, setActiveResultFilter,
        queue, queuedEntries, queuedCountBySource, sessionAddedCount, handleAddQueued, clearQueue,
        guidance, setGuidance, showGroundingTrace, setShowGroundingTrace,
        youtubeQuery, setYoutubeQuery, youtubeLoading, youtubeError, youtubeTrends, handleSearchYouTubeTrends,
        abcdQuery, setAbcdQuery, abcdLoading, abcdError, abcdVideos, handleSearchAbcd,
        steamQuery, setSteamQuery, steamLoading, steamError, steamGames, handleSearchSteam,
        metacriticUrl, setMetacriticUrl, metacriticLoading, metacriticError, metacriticScans,
        showRawJsonLd, setShowRawJsonLd, handleAddAndScanMetacritic, filteredInsights
    } = ctrl;

    const queuedCount = queuedEntries.length;
    const sourceSummary = Object.entries(queuedCountBySource)
        .map(([src, n]) => `${n} ${SOURCE_NAMES[src] || src}`)
        .join(' · ');

    const modalContent = (
        <div
            className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[99999] flex items-center justify-center p-3 sm:p-5 md:p-8 animate-fadeIn font-sans select-none"
            onClick={() => setIsOpen(false)}
        >
            <div
                role="dialog"
                aria-modal="true"
                aria-label="Find Insights"
                className="bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100 rounded-2xl shadow-2xl w-full max-w-7xl h-[90vh] max-h-[92vh] overflow-hidden flex flex-col border border-[var(--app-border)] dark:border-sky-500/20 relative select-text"
                onClick={e => e.stopPropagation()}
            >
                <div className="px-4 sm:px-6 py-3 border-b border-[var(--app-border)] dark:border-sky-500/20 flex flex-row justify-between items-center gap-2 bg-[var(--app-surface)] dark:bg-[#041527] shrink-0">
                    <div className="flex flex-row items-center gap-2.5 min-w-0">
                        <div className="p-1.5 bg-sky-50 dark:bg-[#061C36] border border-sky-200 dark:border-sky-500/40 rounded-lg text-[#0072BC] dark:text-sky-400 shrink-0">
                            <Search size={16} />
                        </div>
                        <h3 className="font-bold text-base text-[var(--app-text)] dark:text-white leading-none whitespace-nowrap">Find Insights</h3>
                        {sessionAddedCount > 0 && (
                            <span data-testid="session-added-badge" className="h-7 px-2.5 rounded-full text-[11px] font-semibold bg-emerald-50 dark:bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-500/40 flex items-center gap-1 whitespace-nowrap shrink-0">
                                <CheckCircle2 size={12} className="shrink-0" /> Added {sessionAddedCount} to Listen
                            </span>
                        )}
                    </div>
                    <button
                        type="button"
                        aria-label="Close Find Insights"
                        onClick={() => setIsOpen(false)}
                        className="h-9 w-9 bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-sky-500/40 text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] dark:hover:text-white rounded-lg flex items-center justify-center transition shrink-0 cursor-pointer"
                    >
                        <X size={16} />
                    </button>
                </div>

                <div role="tablist" aria-label="Insight sources" className="px-4 sm:px-6 py-2.5 bg-[var(--app-surface)] dark:bg-[#041527] border-b border-[var(--app-border)] dark:border-sky-500/20 flex flex-row items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
                    {TABS.map(tab => {
                        const Icon = tab.icon;
                        const active = modalMode === tab.id;
                        const n = queuedCountBySource[tab.id] || 0;
                        return (
                            <button
                                key={tab.id}
                                type="button"
                                role="tab"
                                aria-selected={active}
                                onClick={() => setModalMode(tab.id)}
                                className={`h-9 px-3 sm:px-3.5 rounded-lg text-xs font-semibold transition flex flex-row items-center gap-1.5 whitespace-nowrap shrink-0 cursor-pointer ${
                                    active
                                        ? 'bg-[#0072BC] text-white keep-white-text shadow-xs'
                                        : 'bg-[var(--app-card)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] hover:text-[var(--app-text)] border border-[var(--app-border)] dark:border-sky-500/30'
                                }`}
                            >
                                <Icon size={13} className="shrink-0" /> {tab.label}
                                {n > 0 && (
                                    <span className={`min-w-[18px] h-[18px] px-1 rounded-full text-[10px] font-bold flex items-center justify-center ${active ? 'bg-white/25 text-white keep-white-text' : 'bg-[#0072BC] text-white keep-white-text'}`}>{n}</span>
                                )}
                            </button>
                        );
                    })}
                </div>

                <div className="flex-1 overflow-y-auto min-h-0 p-4 sm:p-6 overscroll-contain bg-[#F7F8FA] dark:bg-[#020F1D]">
                    {modalMode === 'grounded' && (
                        <GroundedSearchTab
                            companyName={activeBrand}
                            prompt={prompt}
                            setPrompt={setPrompt}
                            guidance={guidance}
                            setGuidance={setGuidance}
                            selectedContentTypes={selectedContentTypes}
                            setSelectedContentTypes={setSelectedContentTypes}
                            onRunSearch={onRunSearch}
                            isFindingInsights={isFindingInsights}
                            foundInsights={foundInsights}
                            filteredInsights={filteredInsights}
                            activeResultFilter={activeResultFilter}
                            setActiveResultFilter={setActiveResultFilter}
                            showGroundingTrace={showGroundingTrace}
                            setShowGroundingTrace={setShowGroundingTrace}
                            queue={queue}
                        />
                    )}

                    {modalMode === 'youtube' && (
                        <YouTubeTrendsTab
                            companyName={activeBrand}
                            youtubeQuery={youtubeQuery}
                            setYoutubeQuery={setYoutubeQuery}
                            youtubeLoading={youtubeLoading}
                            youtubeError={youtubeError}
                            youtubeTrends={youtubeTrends}
                            handleSearchYouTubeTrends={handleSearchYouTubeTrends}
                            queue={queue}
                            guidance={guidance}
                        />
                    )}

                    {modalMode === 'reddit' && <RedditInsightsTab companyName={activeBrand} queue={queue} guidance={guidance} />}

                    {modalMode === 'abcd' && (
                        <AbcdVideoTab
                            companyName={activeBrand}
                            rows={existingRows || []}
                            queue={queue}
                            guidance={guidance}
                            abcdQuery={abcdQuery}
                            setAbcdQuery={setAbcdQuery}
                            abcdLoading={abcdLoading}
                            abcdError={abcdError}
                            abcdVideos={abcdVideos}
                            handleSearchAbcd={handleSearchAbcd}
                        />
                    )}

                    {modalMode === 'steam' && (
                        <SteamSearchTab
                            steamQuery={steamQuery}
                            setSteamQuery={setSteamQuery}
                            steamLoading={steamLoading}
                            steamError={steamError}
                            steamGames={steamGames}
                            queue={queue}
                            handleSearchSteam={handleSearchSteam}
                        />
                    )}

                    {modalMode === 'metacritic' && (
                        <MetacriticModalTab
                            companyName={activeBrand}
                            metacriticUrl={metacriticUrl}
                            setMetacriticUrl={setMetacriticUrl}
                            metacriticLoading={metacriticLoading}
                            metacriticError={metacriticError}
                            metacriticScans={metacriticScans}
                            showRawJsonLd={showRawJsonLd}
                            setShowRawJsonLd={setShowRawJsonLd}
                            handleAddAndScanMetacritic={handleAddAndScanMetacritic}
                        />
                    )}

                    {modalMode === 'addsource' && <AddSourceTab queue={queue} guidance={guidance} />}
                </div>

                <div className="px-4 sm:px-6 py-3 border-t border-[var(--app-border)] dark:border-sky-500/20 bg-[var(--app-surface)] dark:bg-[#041527] flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 rounded-b-2xl shrink-0">
                    <div className="text-xs text-[var(--app-muted)] min-w-0 truncate" data-testid="queue-summary">
                        {queuedCount > 0
                            ? <><span className="font-semibold text-[var(--app-text)]">{queuedCount} selected</span> — {sourceSummary}</>
                            : 'Select items on any tab, or use + Add to send them to Listen instantly.'}
                    </div>
                    <div className="flex flex-row items-center gap-2 flex-nowrap overflow-x-auto no-scrollbar max-w-full shrink-0">
                        {queuedCount > 0 && (
                            <button type="button" onClick={clearQueue} className={`${BTN_SECONDARY} whitespace-nowrap`}>Clear</button>
                        )}
                        <button type="button" onClick={() => handleAddQueued(false)} disabled={queuedCount === 0} className={`${BTN_SECONDARY} whitespace-nowrap`}>
                            <Plus size={13} className="shrink-0" /> Add Selected ({queuedCount})
                        </button>
                        <button type="button" onClick={() => handleAddQueued(true)} className={`${BTN_PRIMARY} whitespace-nowrap`}>
                            {queuedCount > 0 ? <><CheckCircle2 size={13} className="shrink-0" /> Add &amp; Done ({queuedCount})</> : 'Done'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );

    if (typeof document !== 'undefined') {
        return createPortal(modalContent, document.body);
    }
    return modalContent;
};
