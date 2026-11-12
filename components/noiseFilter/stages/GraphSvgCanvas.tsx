import React from 'react';
import { RefreshCw, Search } from 'lucide-react';
import { GraphNode } from '../../../services/noiseFilterService';
import { EnhancedGraphLink } from '../useRelationshipGraphLayout';

export interface GraphSvgCanvasProps {
    isDark: boolean;
    isLoading: boolean;
    svgRef: React.RefObject<SVGSVGElement | null>;
    densityMode: 'all' | 'core';
    setDensityMode: (mode: 'all' | 'core') => void;
    selectedSentiment: 'ALL' | 'positive' | 'negative' | 'mixed';
    setSelectedSentiment: (sent: 'ALL' | 'positive' | 'negative' | 'mixed') => void;
    availableCategories: string[];
    selectedCategory: string;
    setSelectedCategory: (cat: string) => void;
    graphSearchQuery: string;
    setGraphSearchQuery: (q: string) => void;
    onReanalyzeGraph: () => void;
    positionedNodes: GraphNode[];
    filteredNodes: GraphNode[];
    enhancedGraphLinks: EnhancedGraphLink[];
    selectedNode: GraphNode | null;
    setSelectedNode: (node: GraphNode | null) => void;
    hoveredNodeId: string | null;
    setHoveredNodeId: (id: string | null) => void;
    activeGraphFocusNodeId: string | null;
    connectedNeighborIds: Set<string>;
}

export const GraphSvgCanvas: React.FC<GraphSvgCanvasProps> = ({
    isDark, isLoading, svgRef, densityMode, setDensityMode,
    selectedSentiment, setSelectedSentiment, availableCategories,
    selectedCategory, setSelectedCategory, graphSearchQuery, setGraphSearchQuery,
    onReanalyzeGraph, positionedNodes, filteredNodes, enhancedGraphLinks,
    selectedNode, setSelectedNode, hoveredNodeId, setHoveredNodeId,
    activeGraphFocusNodeId, connectedNeighborIds
}) => {
    return (
        <div className="lg:col-span-8 bg-[var(--app-card)] rounded-3xl border border-[var(--app-border)] p-6 shadow-xl space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-[var(--app-border)] text-xs">
                <div className="flex flex-wrap items-center gap-2">
                    <div className="flex items-center bg-[var(--app-surface)] p-1 rounded-xl border border-[var(--app-border)]">
                        <button
                            onClick={() => setDensityMode('all')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                                densityMode === 'all' ? 'bg-[#0077C8] text-white font-black shadow-xs' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                            }`}
                        >
                            All Keywords
                        </button>
                        <button
                            onClick={() => setDensityMode('core')}
                            className={`px-2.5 py-1 rounded-lg font-bold text-[11px] transition ${
                                densityMode === 'core' ? 'bg-[#0077C8] text-white font-black shadow-xs' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                            }`}
                        >
                            Core Only
                        </button>
                    </div>

                    <div className="flex items-center gap-1 bg-[var(--app-surface)] p-1 rounded-xl border border-[var(--app-border)]">
                        {(['ALL', 'positive', 'negative', 'mixed'] as const).map((sent) => (
                            <button
                                key={sent}
                                onClick={() => setSelectedSentiment(sent)}
                                className={`px-2 py-0.5 rounded-lg font-bold text-[10px] capitalize transition ${
                                    selectedSentiment === sent ? 'bg-[#0077C8] text-white font-black' : 'text-[var(--app-muted)] hover:text-[var(--app-text)]'
                                }`}
                            >
                                {sent === 'ALL' ? 'All' : sent}
                            </button>
                        ))}
                    </div>

                    {availableCategories.length > 0 && (
                        <select
                            value={selectedCategory}
                            onChange={(e) => setSelectedCategory(e.target.value)}
                            className="bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl px-2.5 py-1 text-[11px] font-bold text-[var(--app-text)] focus:outline-none focus:border-[#0077C8]"
                        >
                            <option value="ALL">All Categories</option>
                            {(availableCategories || []).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <button
                        onClick={onReanalyzeGraph}
                        disabled={isLoading}
                        className="btn-primary flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black text-[var(--app-text)] shrink-0 shadow-md disabled:opacity-50"
                        title="Re-analyze and build graph directly from saved Stage 3 topics"
                    >
                        <RefreshCw size={12} className={isLoading ? 'animate-spin' : ''} /> Re-analyze Graph
                    </button>

                    <div className="relative">
                        <Search size={13} className="absolute left-2.5 top-2.5 text-[var(--app-muted)]" />
                        <input
                            type="text"
                            placeholder="Search keywords..."
                            value={graphSearchQuery}
                            onChange={(e) => setGraphSearchQuery(e.target.value)}
                            className="pl-8 pr-3 py-1.5 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-lg text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-none focus:border-[#0077C8]"
                        />
                    </div>
                </div>
            </div>

            <div className="relative w-full h-[580px] bg-[var(--app-surface)] rounded-2xl overflow-hidden border border-[var(--app-border)] flex items-center justify-center shadow-inner">
                <svg ref={svgRef} viewBox="0 0 960 580" className="w-full h-full cursor-grab active:cursor-grabbing">
                    <defs>
                        <pattern id="tacticalGridDark" width="28" height="28" patternUnits="userSpaceOnUse">
                            <circle cx="2" cy="2" r="1" fill={isDark ? '#1E3A5F' : '#CBD5E1'} fillOpacity="0.7" />
                        </pattern>
                        <linearGradient id="positiveGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#00C48C" />
                            <stop offset="100%" stopColor="#059669" />
                        </linearGradient>
                        <linearGradient id="negativeGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FACC15" />
                            <stop offset="100%" stopColor="#EAB308" />
                        </linearGradient>
                        <linearGradient id="releaseGrad" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#8B5CF6" />
                            <stop offset="100%" stopColor="#6D28D9" />
                        </linearGradient>
                    </defs>

                    <rect width="960" height="580" fill="url(#tacticalGridDark)" />

                    <circle cx="480" cy="290" r="90" fill="none" stroke={isDark ? '#0A2B52' : '#CBD5E1'} strokeWidth="1" strokeDasharray="3,3" opacity="0.6" />
                    <circle cx="480" cy="290" r="175" fill="none" stroke={isDark ? '#0A2B52' : '#CBD5E1'} strokeWidth="1" strokeDasharray="3,3" opacity="0.5" />
                    <circle cx="480" cy="290" r="245" fill="none" stroke={isDark ? '#0A2B52' : '#CBD5E1'} strokeWidth="1" strokeDasharray="3,3" opacity="0.4" />
                    <circle cx="480" cy="290" r="310" fill="none" stroke={isDark ? '#0A2B52' : '#CBD5E1'} strokeWidth="1" strokeDasharray="3,3" opacity="0.3" />

                    {enhancedGraphLinks.map((link, idx) => {
                        const sourceNode = positionedNodes.find(n => n.id === link.source);
                        const targetNode = positionedNodes.find(n => n.id === link.target);
                        if (!sourceNode || !targetNode) return null;

                        const x1 = sourceNode.x || 480;
                        const y1 = sourceNode.y || 290;
                        const x2 = targetNode.x || 480;
                        const y2 = targetNode.y || 290;

                        const isFocusedEdge = Boolean(
                            activeGraphFocusNodeId && (activeGraphFocusNodeId === link.source || activeGraphFocusNodeId === link.target)
                        );
                        const hasAnyFocus = Boolean(activeGraphFocusNodeId);

                        const strokeColor = isFocusedEdge
                            ? link.kind === 'comment-cooccurrence' ? '#38BDF8' : link.kind === 'semantic-overlap' ? '#C084FC' : link.sentiment === 'positive' ? '#00C48C' : link.sentiment === 'negative' ? '#FACC15' : '#38BDF8'
                            : link.kind === 'comment-cooccurrence' ? '#0EA5E9' : link.kind === 'semantic-overlap' ? '#8B5CF6' : link.sentiment === 'positive' ? '#00C48C' : link.sentiment === 'negative' ? '#FACC15' : '#38BDF8';

                        const strokeWidth = isFocusedEdge
                            ? link.kind === 'comment-cooccurrence' ? 2.8 : 2.3
                            : Math.min(Math.max((link.weight || 10) / 7, 0.9), 1.8);

                        const strokeOpacity = isFocusedEdge ? 0.95 : hasAnyFocus ? 0.12 : link.kind === 'hub' ? 0.28 : 0.42;

                        if (link.kind === 'hub') {
                            return (
                                <line
                                    key={`edge-${idx}`}
                                    x1={x1} y1={y1} x2={x2} y2={y2}
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    strokeOpacity={strokeOpacity}
                                    strokeDasharray={link.sentiment === 'mixed' ? '3,3' : 'none'}
                                />
                            );
                        }

                        const midX = (x1 + x2) / 2;
                        const midY = (y1 + y2) / 2;
                        const ctrlX = midX + (480 - midX) * 0.22;
                        const ctrlY = midY + (290 - midY) * 0.22;
                        const labelX = 0.25 * x1 + 0.5 * ctrlX + 0.25 * x2;
                        const labelY = 0.25 * y1 + 0.5 * ctrlY + 0.25 * y2;

                        return (
                            <g key={`edge-${idx}`}>
                                <path
                                    d={`M ${x1} ${y1} Q ${ctrlX} ${ctrlY} ${x2} ${y2}`}
                                    fill="none"
                                    stroke={strokeColor}
                                    strokeWidth={strokeWidth}
                                    strokeOpacity={strokeOpacity}
                                    strokeDasharray={link.kind === 'semantic-overlap' ? '4,3' : link.kind === 'sentiment-affinity' ? '2,3' : 'none'}
                                />
                                {isFocusedEdge && link.badge && (
                                    <g transform={`translate(${labelX}, ${labelY})`} pointerEvents="none">
                                        <rect
                                            x={-44} y={-8} width={88} height={16} rx={8}
                                            fill={isDark ? '#041527' : '#FFFFFF'}
                                            fillOpacity={0.95}
                                            stroke={strokeColor}
                                            strokeWidth={1}
                                        />
                                        <text
                                            textAnchor="middle" dy={3}
                                            fill={isDark ? '#F8F6F0' : '#0F172A'}
                                            fontSize="7.5px" fontWeight="bold" fontFamily="monospace"
                                        >
                                            {link.badge.length > 16 ? `${link.badge.slice(0, 15)}…` : link.badge}
                                        </text>
                                    </g>
                                )}
                            </g>
                        );
                    })}

                    {(filteredNodes || []).map((node) => {
                        const isSelected = selectedNode?.id === node.id;
                        const isHovered = hoveredNodeId === node.id;
                        const isConnectedNeighbor = connectedNeighborIds.has(node.id);
                        const hasAnyFocus = Boolean(activeGraphFocusNodeId);
                        const isRelease = node.type === 'release' || node.type === 'category';
                        const isPositive = node.sentiment === 'positive';
                        const isNegative = node.sentiment === 'negative';

                        const baseRadius = node.size || (isRelease ? 28 : node.tier === 'micro' ? 14 : 19);
                        const currentRadius = isHovered || isSelected ? baseRadius + 4 : isConnectedNeighbor && hasAnyFocus ? baseRadius + 1.5 : baseRadius;

                        const fill = isRelease ? 'url(#releaseGrad)' : isPositive ? 'url(#positiveGrad)' : isNegative ? 'url(#negativeGrad)' : '#38BDF8';
                        const nLabel = String(node?.label || '');
                        const nodeOpacity = !hasAnyFocus || isConnectedNeighbor ? 1 : 0.35;

                        return (
                            <g
                                key={node.id}
                                transform={`translate(${node.x || 480}, ${node.y || 290})`}
                                onClick={() => setSelectedNode(node)}
                                onMouseEnter={() => setHoveredNodeId(node.id)}
                                onMouseLeave={() => setHoveredNodeId(null)}
                                className="cursor-pointer transition-opacity"
                                opacity={nodeOpacity}
                            >
                                <circle r={baseRadius + 10} fill="transparent" />
                                {(isHovered || isSelected || isRelease || (hasAnyFocus && isConnectedNeighbor)) && (
                                    <circle
                                        r={currentRadius + (isRelease ? 5 : 3)}
                                        fill="none"
                                        stroke={isSelected ? '#0077C8' : isHovered ? '#38BDF8' : isConnectedNeighbor && hasAnyFocus ? '#38BDF8' : '#8B5CF6'}
                                        strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                                        strokeDasharray={isRelease ? '4,4' : 'none'}
                                        opacity={isSelected ? 1 : isHovered ? 0.9 : 0.75}
                                    />
                                )}
                                <circle
                                    r={currentRadius}
                                    fill={fill}
                                    stroke={isSelected ? '#38BDF8' : isHovered ? '#38BDF8' : isConnectedNeighbor && hasAnyFocus ? '#7DD3FC' : isRelease ? '#DDD6FE' : (isDark ? '#0A2B52' : '#FFFFFF')}
                                    strokeWidth={isSelected || isHovered ? 2.5 : 1.5}
                                />
                                <text
                                    textAnchor="middle"
                                    dy={isRelease ? 4 : 3}
                                    fill="#FFFFFF"
                                    stroke="#000000"
                                    strokeWidth={isSelected || isHovered || isRelease ? '3.5px' : '3px'}
                                    paintOrder="stroke fill"
                                    strokeLinejoin="round"
                                    strokeLinecap="round"
                                    style={{ paintOrder: 'stroke fill' }}
                                    fontSize={isRelease ? '10px' : node.tier === 'micro' ? '8.5px' : '9px'}
                                    fontWeight="800"
                                    pointerEvents="none"
                                >
                                    {isRelease ? (nLabel.length > 14 ? `${nLabel.slice(0, 12)}..` : nLabel) : nLabel.length > 13 ? `${nLabel.slice(0, 11)}..` : nLabel}
                                </text>
                                {(isSelected || isHovered || isRelease || node.tier === 'core' || (hasAnyFocus && isConnectedNeighbor)) && (
                                    <text
                                        textAnchor="middle"
                                        dy={currentRadius + 12}
                                        fill="#FFFFFF"
                                        stroke="#000000"
                                        strokeWidth="2.75"
                                        paintOrder="stroke fill"
                                        strokeLinejoin="round"
                                        strokeLinecap="round"
                                        style={{ paintOrder: 'stroke fill' }}
                                        fontSize="8px"
                                        fontWeight="800"
                                        pointerEvents="none"
                                    >
                                        {isRelease ? `${node.mentionCount} • ${node.positiveRatio ?? 50}% Working Well` : `${node.positiveRatio ?? 50}% Working Well`}
                                    </text>
                                )}
                            </g>
                        );
                    })}
                </svg>

                <div className="absolute bottom-3 left-3 bg-[var(--app-card)] backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-[var(--app-border)] text-[10px] text-[var(--app-text)] font-bold flex flex-wrap items-center gap-3 shadow-lg">
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-purple-500"></span> Category Hubs</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-[#00C48C]"></span> Working Well</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-sky-400"></span> Mixed / Constructive</span>
                    <span className="flex items-center gap-1.5"><span className="w-2.5 h-2.5 rounded-full bg-yellow-400"></span> Needs Attention</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#38BDF8]"></span> Co-Mentioned in Comments</span>
                    <span className="flex items-center gap-1.5"><span className="w-3 h-0.5 bg-[#A855F7] border-b border-dashed border-[#A855F7]"></span> Cross-Topic Bridge</span>
                </div>
            </div>
        </div>
    );
};
