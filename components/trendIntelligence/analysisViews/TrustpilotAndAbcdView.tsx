import React from 'react';
import {
    AlertCircle, BarChart2, CheckCircle2, Layers, MessageSquare,
    ShieldCheck, Sparkles, Star, Tag, ThumbsDown, ThumbsUp
} from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { AbcdAndVideoMetadataView } from './AbcdAndVideoMetadataView';

interface TrustpilotAndAbcdViewProps {
    analysis: any;
    isDark: boolean;
    themeColors: any;
}

export const TrustpilotAndAbcdView: React.FC<TrustpilotAndAbcdViewProps> = ({
    analysis,
    isDark,
    themeColors
}) => {
    if (!analysis) return null;

    return (
        <>
            {analysis.type === 'trustpilot_sentiment' && (
                <div className="space-y-8 animate-fadeIn">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                            <ShieldCheck size={18} /> Trustpilot Retail Customer Sentiment Analysis
                        </h3>
                        {analysis.counts && (() => {
                            const tpPos = Number(analysis.counts.positive) || 0;
                            const tpNeg = Number(analysis.counts.negative) || 0;
                            const tpNeu = Number(analysis.counts.neutral) || 0;
                            const tpTot = Math.max(1, tpPos + tpNeg + tpNeu);
                            const tpPosPct = Math.round((tpPos / tpTot) * 100);
                            const tpNegPct = Math.round((tpNeg / tpTot) * 100);
                            const tpNeuPct = Math.max(0, 100 - tpPosPct - tpNegPct);
                            return (
                                <div className="w-64 py-1.5">
                                    <div className="w-full h-2.5 bg-[var(--app-surface)] rounded-full overflow-hidden flex border border-[var(--app-border)]">
                                        <div className="bg-emerald-500 h-full transition-all duration-300" style={{ width: `${tpPosPct}%` }} />
                                        <div className="bg-amber-400 h-full transition-all duration-300" style={{ width: `${tpNeuPct}%` }} />
                                        <div className="bg-rose-500 h-full transition-all duration-300" style={{ width: `${tpNegPct}%` }} />
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <div className="flex items-center justify-between mb-4">
                                <h4 className="font-bold text-[var(--app-text)] flex items-center gap-2 text-sm uppercase tracking-wider">
                                    <BarChart2 size={18} className="text-[#00b67a]" /> Overall Sentiment Split
                                </h4>
                                {analysis.sentiment_score !== undefined && (
                                    <span className="text-xs font-bold px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200">
                                        Sentiment Score: {analysis.sentiment_score}/100
                                    </span>
                                )}
                            </div>
                            <div className="h-[220px] w-full min-w-0">
                                <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={180} initialDimension={{ width: 520, height: 220 }}>
                                    <BarChart data={[
                                        { name: 'Working Well', count: analysis.counts?.positive || 0 },
                                        { name: 'Needs Attention', count: analysis.counts?.negative || 0 },
                                        { name: 'Neutral', count: analysis.counts?.neutral || 0 }
                                    ]}>
                                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                        <XAxis dataKey="name" stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 11 }} />
                                        <YAxis stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 10 }} />
                                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#041527' : '#FFFFFF', border: isDark ? '1px solid #041E3A' : '1px solid #E2E8F0', borderRadius: '8px', color: isDark ? '#F8F6F0' : '#0F172A' }} />
                                        <Bar dataKey="count" radius={[6, 6, 0, 0]}>
                                            <Cell fill="#10B981" />
                                            <Cell fill="#EF4444" />
                                            <Cell fill="#6B7280" />
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>

                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h4 className="font-bold text-[var(--app-text)] mb-4 flex items-center gap-2 text-sm uppercase tracking-wider">
                                <Star size={18} className="text-amber-500 fill-amber-500" /> Star Rating Distribution (1–5 Stars)
                            </h4>
                            <div className="h-[220px] w-full min-w-0">
                                <ResponsiveContainer width="100%" height={220} minWidth={100} minHeight={180} initialDimension={{ width: 520, height: 220 }}>
                                    <BarChart data={[
                                        { name: '5 ★', count: analysis.star_distribution?.star_5 || 0, fill: '#10B981' },
                                        { name: '4 ★', count: analysis.star_distribution?.star_4 || 0, fill: '#34D399' },
                                        { name: '3 ★', count: analysis.star_distribution?.star_3 || 0, fill: '#FBBF24' },
                                        { name: '2 ★', count: analysis.star_distribution?.star_2 || 0, fill: '#F87171' },
                                        { name: '1 ★', count: analysis.star_distribution?.star_1 || 0, fill: '#EF4444' }
                                    ]} layout="vertical">
                                        <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                        <XAxis type="number" stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 10 }} />
                                        <YAxis type="category" dataKey="name" stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 11 }} />
                                        <Tooltip contentStyle={{ backgroundColor: isDark ? '#041527' : '#FFFFFF', border: isDark ? '1px solid #041E3A' : '1px solid #E2E8F0', borderRadius: '8px', color: isDark ? '#F8F6F0' : '#0F172A' }} />
                                        <Bar dataKey="count" radius={[0, 6, 6, 0]}>
                                            {['#10B981', '#34D399', '#FBBF24', '#F87171', '#EF4444'].map((col, idx) => (
                                                <Cell key={idx} fill={col} />
                                            ))}
                                        </Bar>
                                    </BarChart>
                                </ResponsiveContainer>
                            </div>
                        </div>
                    </div>

                    {analysis.retail_dimensions && analysis.retail_dimensions.length > 0 && (
                        <div className="space-y-4">
                            <h4 className="font-bold text-[var(--app-text)] text-sm uppercase tracking-wider flex items-center gap-2">
                                <Layers size={18} className="text-emerald-600" /> Retail Operations &amp; Customer Experience Pillars
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                {(Array.isArray(analysis.retail_dimensions) ? analysis.retail_dimensions : []).map((dim: any, idx: number) => {
                                    const isPositive = dim.sentiment === 'Positive' || dim.sentiment === 'positive' || dim.sentiment === 'Working Well';
                                    const isNegative = dim.sentiment === 'Negative' || dim.sentiment === 'negative' || dim.sentiment === 'Needs Attention';
                                    const dimSentLabel = isPositive ? 'Working Well' : isNegative ? 'Needs Attention' : 'Neutral';
                                    return (
                                        <div key={idx} className="bg-[var(--app-surface)] p-5 rounded-2xl border border-[var(--app-border)] shadow-xs flex flex-col justify-between hover:border-[var(--app-border)] transition-all text-[var(--app-text)]">
                                            <div>
                                                <div className="flex items-center justify-between mb-3">
                                                    <h5 className="font-bold text-[var(--app-text)] text-sm">{dim.dimension}</h5>
                                                    <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${
                                                        isPositive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                        isNegative ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-amber-50 text-amber-700 border-amber-200'
                                                    }`}>
                                                        {dimSentLabel} {dim.score ? `(${dim.score}%)` : ''}
                                                    </span>
                                                </div>
                                                <p className="text-xs text-[var(--app-muted)] leading-relaxed mb-4">{dim.summary}</p>
                                            </div>
                                            <div className="space-y-2 border-t border-[var(--app-border)] pt-3 text-xs">
                                                {dim.strengths && dim.strengths.length > 0 && (
                                                    <div>
                                                        <span className="font-bold text-emerald-600 flex items-center gap-1 mb-1">
                                                            <CheckCircle2 size={12} /> Key Strengths:
                                                        </span>
                                                        <ul className="space-y-1 pl-4 text-[var(--app-text)] list-disc">
                                                            {(Array.isArray(dim.strengths) ? dim.strengths : []).map((s: string, sIdx: number) => <li key={sIdx}>{s}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                                {dim.pain_points && dim.pain_points.length > 0 && (
                                                    <div className="mt-2">
                                                        <span className="font-bold text-rose-600 flex items-center gap-1 mb-1">
                                                            <AlertCircle size={12} /> Friction Points:
                                                        </span>
                                                        <ul className="space-y-1 pl-4 text-[var(--app-text)] list-disc">
                                                            {(Array.isArray(dim.pain_points) ? dim.pain_points : []).map((p: string, pIdx: number) => <li key={pIdx}>{p}</li>)}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    )}

                    <div className="space-y-4">
                        <h4 className="font-bold text-[var(--app-text)] text-sm uppercase tracking-wider flex items-center gap-2">
                            <MessageSquare size={18} className="text-emerald-600" /> Representative Customer Feedback Quotes
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                            <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-[var(--app-text)]">
                                <h5 className="font-bold text-emerald-700 mb-4 flex items-center gap-2 text-sm">
                                    <ThumbsUp size={16} /> Working Well Customer Highlights
                                </h5>
                                <ul className="space-y-3">
                                    {(Array.isArray(analysis.reviews?.positive) ? analysis.reviews.positive : []).map((review: string, i: number) => (
                                        <li key={i} className="text-xs text-[var(--app-text)] bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] shadow-xs leading-relaxed italic">
                                            &ldquo;{review}&rdquo;
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-6 bg-rose-50 rounded-2xl border border-rose-200 text-[var(--app-text)]">
                                <h5 className="font-bold text-rose-700 mb-4 flex items-center gap-2 text-sm">
                                    <ThumbsDown size={16} /> Needs Attention &amp; Pain Points
                                </h5>
                                <ul className="space-y-3">
                                    {(Array.isArray(analysis.reviews?.negative) ? analysis.reviews.negative : []).map((review: string, i: number) => (
                                        <li key={i} className="text-xs text-[var(--app-text)] bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] shadow-xs leading-relaxed italic">
                                            &ldquo;{review}&rdquo;
                                        </li>
                                    ))}
                                </ul>
                            </div>

                            <div className="p-6 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] text-[var(--app-text)]">
                                <h5 className="font-bold text-[var(--app-text)] mb-4 flex items-center gap-2 text-sm">
                                    <MessageSquare size={16} /> Constructive &amp; Mixed Reviews
                                </h5>
                                <ul className="space-y-3">
                                    {(Array.isArray(analysis.reviews?.neutral) ? analysis.reviews.neutral : []).map((review: string, i: number) => (
                                        <li key={i} className="text-xs text-[var(--app-text)] bg-[var(--app-card)] p-3 rounded-xl border border-[var(--app-border)] shadow-xs leading-relaxed italic">
                                            &ldquo;{review}&rdquo;
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>

                    {analysis.strategic_recommendations && analysis.strategic_recommendations.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs space-y-4 text-[var(--app-text)]">
                            <h4 className="font-bold text-[var(--app-text)] text-sm uppercase tracking-wider flex items-center gap-2">
                                <Sparkles size={18} className="text-emerald-600" /> Actionable Strategic Recommendations for Retail Operations
                            </h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                {(Array.isArray(analysis.strategic_recommendations) ? analysis.strategic_recommendations : []).map((rec: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] flex flex-col justify-between">
                                        <div>
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-xs font-bold text-emerald-600 uppercase tracking-wider">{rec.area || 'Retail Operations'}</span>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
                                                    rec.priority === 'High' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                                    rec.priority === 'Medium' ? 'bg-amber-50 text-amber-700 border-amber-200' : 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                                }`}>
                                                    {rec.priority || 'Action'} Priority
                                                </span>
                                            </div>
                                            <p className="text-sm font-medium text-[var(--app-text)] leading-snug">{rec.recommendation}</p>
                                        </div>
                                        {rec.expected_impact && (
                                            <p className="text-xs text-emerald-600 font-semibold mt-3 pt-2 border-t border-[var(--app-border)]">
                                                Impact: {rec.expected_impact}
                                            </p>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.word_cloud && analysis.word_cloud.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h4 className="font-bold text-[var(--app-text)] text-sm uppercase tracking-wider mb-4 flex items-center gap-2">
                                <Tag size={16} className="text-emerald-600" /> Customer Feedback Word Cloud
                            </h4>
                            <div className="flex flex-wrap gap-2.5 justify-center p-6 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl">
                                {(Array.isArray(analysis.word_cloud) ? analysis.word_cloud : []).map((tag: string, tIdx: number) => {
                                    const colors = ['bg-emerald-50 text-emerald-700 border-emerald-200', 'bg-cyan-50 text-cyan-300 border-cyan-800/50', 'bg-amber-50 text-amber-700 border-amber-200', 'bg-purple-50 text-purple-700 border-purple-200', 'bg-rose-50 text-rose-700 border-rose-200'];
                                    return (
                                        <span key={tIdx} className={`px-3 py-1 rounded-full text-xs font-bold border shadow-xs hover:scale-105 transition-transform ${colors[tIdx % colors.length]}`}>
                                            {tag}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                    )}
                </div>
            )}

            <AbcdAndVideoMetadataView
                analysis={analysis}
                isDark={isDark}
                themeColors={themeColors}
            />
        </>
    );
};
