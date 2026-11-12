import React from 'react';
import { ArrowRight, Clock, Loader2, Network, RefreshCw, Share2, Sparkles, TrendingUp, X } from 'lucide-react';
import { GraphNode, formatCommentTimestamp, getCommentYear } from '../../../services/noiseFilterService';

export const Stage4CompleteBanner: React.FC<{ onProceedToStage5: () => void }> = ({ onProceedToStage5 }) => (
    <div className="p-4 rounded-2xl bg-emerald-50 text-[var(--app-text)] border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
            <span className="text-xs font-bold text-emerald-700 flex items-center gap-1.5 font-mono">
                <TrendingUp size={14} /> Stage 4 Complete: Graph Built with Dynamic Category Pillars
            </span>
            <p className="text-[11px] text-[var(--app-muted)] font-medium">
                Proceed to Stage 5 to view the longitudinal Trajectory and strategic mandates.
            </p>
        </div>
        <button onClick={onProceedToStage5} className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-[var(--app-text)] shrink-0 shadow-md">
            Proceed to Stage 5: Trajectory <ArrowRight size={14} />
        </button>
    </div>
);

export const Stage4EmptyOrLoadingState: React.FC<{
    isHydratingCheckpoints: boolean;
    isLoading: boolean;
    onBuildRelationshipGraph: () => void;
    onReanalyzeGraph: () => void;
}> = ({ isHydratingCheckpoints, isLoading, onBuildRelationshipGraph, onReanalyzeGraph }) =>
    isHydratingCheckpoints ? (
        <div className="text-center py-16 bg-[var(--app-card)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] space-y-3">
            <Loader2 size={32} className="mx-auto text-indigo-600 animate-spin" />
            <h4 className="text-base font-bold text-[var(--app-text)]">Loading Topic Relationship Graph...</h4>
            <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">Hydrating saved topic nodes, feature domains, and cross-topic correlations.</p>
        </div>
    ) : (
        <div className="text-center py-16 bg-[var(--app-card)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] space-y-4">
            <Network size={36} className="mx-auto text-[var(--app-muted)]" />
            <h4 className="text-base font-bold text-[var(--app-text)]">Stage 4 Graph Not Built Yet</h4>
            <p className="text-xs text-[var(--app-muted)] max-w-sm mx-auto">Synthesize the saved Stage 3 topic data into the interactive 50-75+ node relationship network.</p>
            <div className="flex items-center justify-center gap-3 pt-2">
                <button onClick={onBuildRelationshipGraph} disabled={isLoading} className="btn-primary flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-black text-[var(--app-text)] shadow-md disabled:opacity-50">
                    <Sparkles size={14} /> Full Dual-Engine Build
                </button>
                <button onClick={onReanalyzeGraph} disabled={isLoading} className="px-4 py-2 rounded-xl bg-[var(--app-surface)] dark:bg-[#061C36] hover:bg-slate-200 dark:hover:bg-[#1A222E] text-[var(--app-text)] dark:text-[#D8E1EB] dark:hover:text-white text-xs font-bold border border-[var(--app-border)] dark:border-[#041E3A] flex items-center gap-1.5 transition disabled:opacity-50">
                    <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} /> Re-analyze Graph from Saved Topics
                </button>
            </div>
        </div>
    );

export interface GraphNodeInspectorDrawerProps {
    selectedNode: GraphNode | null;
    setSelectedNode: (node: GraphNode | null) => void;
    setHoveredNodeId: (id: string | null) => void;
    effectiveNodeMetrics: {
        mentions: number;
        positiveRatio: number;
        percentageOfTotal: number;
        posCount: number;
        negCount: number;
        neuCount: number;
    };
    totalDatasetCount: number;
    selectedNodeConnections: {
        node: GraphNode;
        kind: 'hub' | 'comment-cooccurrence' | 'semantic-overlap' | 'sentiment-affinity';
        reason: string;
        badge: string;
        weight: number;
        sharedComments: number;
    }[];
    selectedNodeComments: any[];
}

export const GraphNodeInspectorDrawer: React.FC<GraphNodeInspectorDrawerProps> = ({
    selectedNode,
    setSelectedNode,
    setHoveredNodeId,
    effectiveNodeMetrics,
    totalDatasetCount,
    selectedNodeConnections,
    selectedNodeComments
}) => {
    return (
        <div className="lg:col-span-4 bg-[var(--app-card)] rounded-3xl text-[var(--app-text)] border border-[var(--app-border)] shadow-xl p-6 flex flex-col justify-between h-full min-h-[660px]">
            {selectedNode ? (
                <div className="space-y-4 flex-1 flex flex-col justify-between animate-fadeIn">
                    <div>
                        <div className="flex items-start justify-between pb-3 border-b border-[var(--app-border)]">
                            <div>
                                <span className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-md ${
                                    selectedNode.type === 'release' || selectedNode.type === 'category'
                                        ? 'bg-purple-50 text-purple-700 border border-purple-200 font-mono'
                                        : effectiveNodeMetrics.positiveRatio >= 50
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-200 font-bold'
                                        : effectiveNodeMetrics.positiveRatio < 36
                                        ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30 font-bold'
                                        : 'bg-sky-500/15 text-sky-700 border border-sky-400/30 font-bold'
                                }`}>
                                    {selectedNode.type === 'release' || selectedNode.type === 'category' ? 'Category Pillar' : selectedNode.category || 'Topic Node'}
                                </span>
                                <h4 className="text-lg font-bold text-[var(--app-text)] mt-1">{selectedNode.label}</h4>
                            </div>
                            <button onClick={() => setSelectedNode(null)} className="p-1 text-[var(--app-muted)] hover:text-[var(--app-text)] rounded-lg hover:bg-[var(--app-surface)] transition">
                                <X size={16} />
                            </button>
                        </div>

                        <div className="grid grid-cols-2 gap-3 text-xs mt-3">
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] font-bold block text-[11px]">Total Mentions</span>
                                <div className="flex items-baseline gap-1 mt-0.5">
                                    <span className="text-base font-bold text-[var(--app-text)] font-mono">
                                        {effectiveNodeMetrics.mentions.toLocaleString()}
                                    </span>
                                    <span className="text-[11px] text-[var(--app-muted)]">comments</span>
                                </div>
                                {totalDatasetCount > effectiveNodeMetrics.mentions && (
                                    <span className="text-[10px] text-[var(--app-muted)] font-mono block mt-0.5">
                                        ({effectiveNodeMetrics.percentageOfTotal}% of {totalDatasetCount.toLocaleString()})
                                    </span>
                                )}
                            </div>
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] font-bold block text-[11px]">Percentage Working Well</span>
                                <div className="flex items-baseline gap-1.5 mt-0.5">
                                    <span className={`text-base font-bold font-mono ${
                                        effectiveNodeMetrics.positiveRatio >= 50 ? 'text-emerald-600' : effectiveNodeMetrics.positiveRatio >= 36 ? 'text-sky-600' : 'text-yellow-400'
                                    }`}>
                                        {effectiveNodeMetrics.positiveRatio}%
                                    </span>
                                    <span className="text-[10px] text-[var(--app-muted)] uppercase font-mono">
                                        {effectiveNodeMetrics.positiveRatio >= 50 ? 'Favorable' : effectiveNodeMetrics.positiveRatio >= 36 ? 'Mixed' : 'Friction'}
                                    </span>
                                </div>
                                {selectedNodeComments.length > 0 && (
                                    <span className="text-[10px] text-[var(--app-muted)] font-mono block mt-0.5">
                                        ({effectiveNodeMetrics.posCount} pos / {selectedNodeComments.length} matched)
                                    </span>
                                )}
                            </div>
                        </div>

                        {selectedNode.releaseDistribution && (
                            <div className="mt-3 p-2.5 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] grid grid-cols-3 gap-2 text-center text-[10px] font-mono">
                                <div>
                                    <span className="text-[var(--app-muted)] block">Prior</span>
                                    <span className="font-bold text-[var(--app-text)]">{selectedNode.releaseDistribution.priorPeriod ?? 0}%</span>
                                </div>
                                <div>
                                    <span className="text-[var(--app-muted)] block">Current</span>
                                    <span className="font-bold text-[var(--app-text)]">{selectedNode.releaseDistribution.currentPeriod ?? 0}%</span>
                                </div>
                                <div>
                                    <span className="text-[var(--app-muted)] block">Next</span>
                                    <span className="font-bold text-[var(--app-text)]">{selectedNode.releaseDistribution.nextPeriod ?? 0}%</span>
                                </div>
                            </div>
                        )}

                        {selectedNodeConnections.length > 0 && (
                            <div className="mt-3 pt-3 border-t border-[var(--app-border)] space-y-2">
                                <div className="flex items-center justify-between">
                                    <span className="text-[11px] font-bold text-[var(--app-muted)] uppercase tracking-wider font-mono flex items-center gap-1.5">
                                        <Network size={12} className="text-[#38BDF8]" /> Connected Topics &amp; Comment Bridges ({selectedNodeConnections.length})
                                    </span>
                                </div>
                                <div className="max-h-36 overflow-y-auto space-y-1.5 pr-1">
                                    {selectedNodeConnections.slice(0, 10).map((conn, cIdx) => (
                                        <button
                                            key={`${conn.node.id}-${cIdx}`}
                                            type="button"
                                            onClick={() => setSelectedNode(conn.node)}
                                            onMouseEnter={() => setHoveredNodeId(conn.node.id)}
                                            onMouseLeave={() => setHoveredNodeId(null)}
                                            className="w-full text-left p-2 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] hover:border-[#38BDF8]/60 transition flex items-center justify-between gap-2 group cursor-pointer"
                                        >
                                            <div className="min-w-0">
                                                <div className="flex items-center gap-1.5">
                                                    <span
                                                        className={`w-2 h-2 rounded-full shrink-0 ${
                                                            conn.node.type === 'category' || conn.node.type === 'release'
                                                                ? 'bg-purple-500'
                                                                : conn.node.sentiment === 'positive'
                                                                ? 'bg-[#00C48C]'
                                                                : conn.node.sentiment === 'negative'
                                                                ? 'bg-yellow-400'
                                                                : 'bg-sky-400'
                                                        }`}
                                                    />
                                                    <span className="text-xs font-bold text-[var(--app-text)] group-hover:text-[#38BDF8] truncate">
                                                        {conn.node.label}
                                                    </span>
                                                </div>
                                                <p className="text-[10px] text-[var(--app-muted)] truncate mt-0.5 font-mono">
                                                    {conn.reason}
                                                </p>
                                            </div>
                                            <span
                                                className={`text-[9.5px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 border ${
                                                    conn.kind === 'comment-cooccurrence'
                                                        ? 'bg-sky-50 text-sky-700 border-sky-200'
                                                        : conn.kind === 'semantic-overlap'
                                                        ? 'bg-purple-50 text-purple-700 border-purple-200'
                                                        : conn.kind === 'sentiment-affinity'
                                                        ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                                        : 'bg-[var(--app-surface)] text-[var(--app-muted)] border-[var(--app-border)]'
                                                }`}
                                            >
                                                {conn.badge}
                                            </span>
                                        </button>
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="space-y-3 pt-2 flex-1 flex flex-col min-h-0">
                        <span className="text-xs font-bold text-[var(--app-muted)] uppercase tracking-wider block shrink-0 font-mono">
                            High-Signal Customer Quotes:
                        </span>
                        <div className="space-y-2.5 flex-1 min-h-[260px] max-h-[380px] overflow-y-auto pr-1">
                            {selectedNodeComments.length === 0 ? (
                                <div className="text-center py-6 text-[var(--app-muted)] text-xs font-mono">
                                    No authentic comments matched this specific topic in the current harvest.
                                </div>
                            ) : (
                                (selectedNodeComments || []).slice(0, 8).map((c, i) => (
                                    <div key={i} className="p-3.5 rounded-xl bg-[var(--app-surface)] border border-[var(--app-border)] text-xs space-y-2 hover:border-[var(--app-border)] transition">
                                        <div className="flex items-center justify-between">
                                            <span className="font-bold text-[var(--app-text)]">{c.author}</span>
                                            <div className="flex items-center gap-1.5">
                                                <span className="text-[10px] text-[var(--app-muted)] font-mono flex items-center gap-1 mr-1">
                                                    <Clock size={11} className="text-[var(--app-muted)]" />
                                                    {c.timestamp || formatCommentTimestamp(null, getCommentYear(c))}
                                                </span>
                                                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${
                                                    c.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : c.sentiment === 'negative' ? 'bg-yellow-500/15 text-yellow-700 border border-yellow-400/30' : 'bg-sky-500/15 text-sky-700 border border-sky-400/30'
                                                }`}>
                                                    {c.sentiment === 'positive' ? 'Working Well' : c.sentiment === 'negative' ? 'Needs Attention' : 'Neutral'}
                                                </span>
                                                <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)]">
                                                    {getCommentYear(c)} • {c.source}
                                                </span>
                                            </div>
                                        </div>
                                        <p className="text-[var(--app-muted)] font-medium italic leading-relaxed">"{c.rawText}"</p>
                                        {c.actionableSuggestion && (
                                            <div className="text-[11px] text-emerald-700 bg-emerald-50 p-2 rounded-lg font-medium border border-emerald-200">
                                                <strong>Takeaway:</strong> {c.actionableSuggestion}
                                            </div>
                                        )}
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                <div className="text-center py-16 space-y-3">
                    <Share2 size={36} className="text-purple-600 mx-auto" />
                    <h4 className="text-base font-bold text-[var(--app-text)]">Explore Network Graph</h4>
                    <p className="text-xs text-[var(--app-muted)] max-w-xs mx-auto">
                        Click any topic or category pillar node to inspect connected topic bridges, shared comment co-mentions, and customer quotes.
                    </p>
                </div>
            )}
        </div>
    );
};
