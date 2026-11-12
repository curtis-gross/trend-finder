import React, { useState, useMemo } from 'react';
import {
    ExternalLink,
    MinusCircle,
    Search,
    ThumbsDown,
    ThumbsUp
} from 'lucide-react';
import {
    ChannelFilterType,
    SentimentFilterType
} from './useAlertsPersistence';

interface AnomalyEvidenceStreamViewProps {
    sampleFeed: any[];
}

export const AnomalyEvidenceStreamView: React.FC<AnomalyEvidenceStreamViewProps> = ({ sampleFeed }) => {
    const [sentimentFilter, setSentimentFilter] = useState<SentimentFilterType>('all');
    const [channelFilter, setChannelFilter] = useState<ChannelFilterType>('all');
    const [evidenceSearchQuery, setEvidenceSearchQuery] = useState<string>('');

    const allEvidenceItems = useMemo(() => (Array.isArray(sampleFeed) ? sampleFeed : []), [sampleFeed]);

    const positiveEvidenceCount = useMemo(
        () => allEvidenceItems.filter(i => i.sentiment === 'positive').length,
        [allEvidenceItems]
    );
    const negativeEvidenceCount = useMemo(
        () => allEvidenceItems.filter(i => i.sentiment === 'negative').length,
        [allEvidenceItems]
    );
    const neutralEvidenceCount = useMemo(
        () => allEvidenceItems.filter(i => i.sentiment === 'neutral').length,
        [allEvidenceItems]
    );

    const filteredEvidence = useMemo(() => {
        return allEvidenceItems.filter(item => {
            if (sentimentFilter !== 'all' && item.sentiment !== sentimentFilter) return false;

            if (channelFilter !== 'all') {
                const src = (item.source || '').toLowerCase();
                if (channelFilter === 'pipeline' && !src.includes('pipeline') && !src.includes('reddit')) return false;
                if (channelFilter === 'reddit' && !src.includes('reddit')) return false;
                if (channelFilter === 'youtube' && !src.includes('youtube')) return false;
                if (channelFilter === 'steam' && !src.includes('steam')) return false;
                if (channelFilter === 'grounded' && !src.includes('grounded')) return false;
            }

            if (evidenceSearchQuery.trim()) {
                const q = evidenceSearchQuery.toLowerCase();
                const matchContent = (item.content || '').toLowerCase().includes(q);
                const matchAuthor = (item.author || '').toLowerCase().includes(q);
                const matchTitle = (item.videoTitle || '').toLowerCase().includes(q);
                if (!matchContent && !matchAuthor && !matchTitle) return false;
            }

            return true;
        });
    }, [allEvidenceItems, sentimentFilter, channelFilter, evidenceSearchQuery]);

    if (allEvidenceItems.length === 0) return null;

    return (
        <div className="bg-[var(--app-card)] rounded-3xl p-8 border border-[var(--app-border)] shadow-xs space-y-6 text-[var(--app-text)]">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-[var(--app-border)] pb-4">
                <div>
                    <h3 className="text-xl font-bold text-[var(--app-text)]">
                        Verified Evidence Stream
                    </h3>
                </div>

                {/* Channel Filter */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
                    {[
                        { id: 'all', label: 'All Channels' },
                        { id: 'pipeline', label: 'Filter Pipeline' },
                        { id: 'reddit', label: 'Reddit Reviews' },
                        { id: 'youtube', label: 'YouTube Comments' },
                        { id: 'grounded', label: 'Google Grounding' }
                    ].map(tab => (
                        <button
                            key={tab.id}
                            onClick={() => setChannelFilter(tab.id as ChannelFilterType)}
                            className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition whitespace-nowrap ${
                                channelFilter === tab.id
                                    ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white font-bold shadow-xs'
                                    : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] hover:bg-slate-100 dark:hover:bg-[#1A222E] hover:text-[var(--app-text)] dark:hover:text-white border border-[var(--app-border)] dark:border-[#041E3A]'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Sentiment Category Tabs Toolbar & Search Input */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-center gap-2 flex-wrap">
                    <button
                        onClick={() => setSentimentFilter('all')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            sentimentFilter === 'all'
                                ? 'bg-[#0077C8] dark:bg-[#041E3A] text-white font-bold shadow-xs'
                                : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-[var(--app-muted)] dark:text-[#D8E1EB] hover:bg-slate-100 dark:hover:bg-[#1A222E] dark:hover:text-white border border-[var(--app-border)] dark:border-[#041E3A]'
                        }`}
                    >
                        All Evidence{allEvidenceItems.length > 0 ? ` (${allEvidenceItems.length})` : ''}
                    </button>

                    <button
                        onClick={() => setSentimentFilter('positive')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            sentimentFilter === 'positive'
                                ? 'bg-emerald-600 text-white shadow-xs font-bold'
                                : 'bg-emerald-50 dark:bg-[#061C36] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-[#041E3A] hover:bg-emerald-100 dark:hover:bg-[#1A222E]'
                        }`}
                    >
                        <ThumbsUp size={14} />
                        Working Well{positiveEvidenceCount > 0 ? ` (${positiveEvidenceCount})` : ''}
                    </button>

                    <button
                        onClick={() => setSentimentFilter('negative')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            sentimentFilter === 'negative'
                                ? 'bg-yellow-400 text-slate-950 shadow-xs font-bold'
                                : 'bg-yellow-50 dark:bg-[#061C36] text-yellow-700 dark:text-yellow-300 border border-yellow-400/40 dark:border-[#041E3A] hover:bg-yellow-100 dark:hover:bg-[#1A222E]'
                        }`}
                    >
                        <ThumbsDown size={14} />
                        Critical Friction{negativeEvidenceCount > 0 ? ` (${negativeEvidenceCount})` : ''}
                    </button>

                    <button
                        onClick={() => setSentimentFilter('neutral')}
                        className={`px-4 py-2 rounded-xl text-xs font-bold transition flex items-center gap-1.5 ${
                            sentimentFilter === 'neutral'
                                ? 'bg-sky-500 text-slate-950 shadow-xs font-bold'
                                : 'bg-[var(--app-surface)] dark:bg-[#061C36] text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-[#1A222E] border border-sky-400/40 dark:border-[#041E3A]'
                        }`}
                    >
                        <MinusCircle size={14} />
                        Neutral{neutralEvidenceCount > 0 ? ` (${neutralEvidenceCount})` : ''}
                    </button>
                </div>

                <div className="relative w-full sm:w-64">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[var(--app-muted)]" size={14} />
                    <input
                        type="text"
                        value={evidenceSearchQuery}
                        onChange={(e) => setEvidenceSearchQuery(e.target.value)}
                        placeholder="Search feedback text..."
                        className="w-full pl-8 pr-3 py-1.5 bg-[var(--app-surface)] dark:bg-[#061C36] border border-[var(--app-border)] dark:border-[#041E3A] rounded-xl text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:border-[#0077C8] focus:bg-[var(--app-card)] dark:focus:bg-[#041527]"
                    />
                </div>
            </div>

            {/* Evidence Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-h-[600px] overflow-y-auto pr-1">
                {filteredEvidence.slice(0, 36).map((item, idx) => {
                    const isPositive = item.sentiment === 'positive';
                    const isNegative = item.sentiment === 'negative';

                    return (
                        <div key={idx} className={`p-4 rounded-2xl border flex flex-col justify-between transition hover:border-[var(--app-border)] dark:hover:border-[#0A2B52] text-[var(--app-text)] shadow-2xs ${
                            isPositive ? 'bg-emerald-50 dark:bg-[#061C36] border-emerald-200 dark:border-[#041E3A]' : isNegative ? 'bg-yellow-50 dark:bg-[#061C36] border-yellow-400/40 dark:border-[#041E3A]' : 'bg-sky-50 dark:bg-[#061C36] border-sky-400/40 dark:border-[#041E3A]'
                        }`}>
                            <div className="space-y-2">
                                <div className="flex items-center justify-between gap-2">
                                    <span className="text-xs font-bold text-[var(--app-text)] truncate max-w-[160px]">{item.author}</span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wide ${
                                        isPositive ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-mono' : isNegative ? 'bg-yellow-500/20 text-yellow-700 border border-yellow-400/40 font-mono' : 'bg-sky-500/20 text-sky-700 border border-sky-400/40 font-mono'
                                    }`}>
                                        {String(item.sentiment || '').toLowerCase().includes('pos') ? 'Working Well' : (String(item.sentiment || '').toLowerCase().includes('neg') || String(item.sentiment || '').toLowerCase().includes('crit')) ? 'Needs Attention' : (item.sentiment || 'Neutral')}
                                    </span>
                                </div>
                                <p className="text-xs text-[var(--app-muted)] leading-relaxed">"{item.content}"</p>
                                {item.videoTitle && (
                                    <div className="text-[10px] text-[var(--app-muted)] font-medium truncate">
                                        Re: {item.videoTitle}
                                    </div>
                                )}
                            </div>
                            <div className="pt-3 mt-3 border-t border-[var(--app-border)] flex items-center justify-between text-[11px] text-[var(--app-muted)] font-mono">
                                <span className="capitalize font-semibold">{item.source}</span>
                                {item.url && (
                                    <a href={item.url} target="_blank" rel="noreferrer" className="text-[#0077C8] font-bold hover:underline flex items-center gap-0.5">
                                        Source Link <ExternalLink size={10} />
                                    </a>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
