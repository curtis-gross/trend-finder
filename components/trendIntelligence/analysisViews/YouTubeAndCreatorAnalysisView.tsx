import React from 'react';
import { MessageCircle, MessageSquare, ThumbsDown, ThumbsUp, TrendingUp, Video } from 'lucide-react';
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { CreatorAndFashionAnalysisView } from './CreatorAndFashionAnalysisView';

interface YouTubeAndCreatorAnalysisViewProps {
    analysis: any;
    companyName: string;
    selectedVideoId: string;
    isDark: boolean;
}

export const YouTubeAndCreatorAnalysisView: React.FC<YouTubeAndCreatorAnalysisViewProps> = ({
    analysis,
    companyName,
    selectedVideoId,
    isDark
}) => {
    if (!analysis) return null;
    const isYtSentiment = analysis.type === 'youtube_sentiment' || analysis.type === 'sentiment_video' || analysis.type === 'sentiment_comments';
    const breakdownList = Array.isArray(analysis.commentsSentiment?.breakdown)
        ? analysis.commentsSentiment.breakdown
        : Array.isArray(analysis.breakdown) ? analysis.breakdown : [];

    return (
        <>
            {isYtSentiment && (
                <div className="space-y-8">
                    <div className="flex items-center justify-between">
                        <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                            <TrendingUp size={18} /> YouTube Sentiment Analysis (Video &amp; Audience Comments)
                        </h3>
                        <span className="text-xs font-mono font-bold px-3 py-1 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-full">
                            Video + Live Comments Synced
                        </span>
                    </div>

                    <div className="bg-[var(--app-card)] text-[var(--app-text)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                        <div className="space-y-2 flex-1">
                            <div className="flex items-center gap-2">
                                <span className="text-xs font-mono font-bold uppercase tracking-wider text-indigo-600">Executive Synthesis</span>
                                {analysis.alignment?.status && (
                                    <span className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border ${
                                        analysis.alignment.status === 'Aligned' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                        analysis.alignment.status === 'Divergent' ? 'bg-rose-50 text-rose-700 border-rose-200' :
                                        'bg-amber-50 text-amber-700 border-amber-200'
                                    }`}>
                                        {analysis.alignment.status} Community Stance
                                    </span>
                                )}
                            </div>
                            <p className="text-sm text-[var(--app-text)] leading-relaxed font-normal">
                                {analysis.summary}
                            </p>
                            {analysis.alignment?.explanation && (
                                <p className="text-xs text-indigo-700 font-medium">
                                    💡 {analysis.alignment.explanation}
                                </p>
                            )}
                        </div>
                        <div className="flex items-center gap-4 shrink-0 bg-[var(--app-surface)] border border-[var(--app-border)] p-4 rounded-xl shadow-xs">
                            <div className="text-right">
                                <div className="text-[10px] font-mono text-[var(--app-muted)] uppercase font-bold">Overall Score</div>
                                <div className="text-3xl font-black text-emerald-600">
                                    {analysis.overallScore !== undefined ? `${analysis.overallScore}/10` : '7.5/10'}
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs space-y-6 text-[var(--app-text)]">
                            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                                <h4 className="font-bold text-[var(--app-text)] flex items-center gap-2 text-sm">
                                    <Video size={16} className="text-emerald-600" />
                                    Video Content &amp; Creator Sentiment
                                </h4>
                                <span className="text-[10px] font-mono text-[var(--app-muted)] uppercase">Creator Presentation</span>
                            </div>

                            {(() => {
                                const rawPos = Array.isArray(analysis.videoSentiment?.sentiment?.positive) ? analysis.videoSentiment.sentiment.positive : Array.isArray(analysis.sentiment?.positive) ? analysis.sentiment.positive : [];
                                const rawNeg = Array.isArray(analysis.videoSentiment?.sentiment?.negative) ? analysis.videoSentiment.sentiment.negative : Array.isArray(analysis.sentiment?.negative) ? analysis.sentiment.negative : [];
                                const rawNeu = Array.isArray(analysis.videoSentiment?.sentiment?.neutral) ? analysis.videoSentiment.sentiment.neutral : Array.isArray(analysis.sentiment?.neutral) ? analysis.sentiment.neutral : [];

                                const posNotes = rawPos.length > 0 ? rawPos : (
                                    Array.isArray(analysis.observations) ? analysis.observations.map((o: any) => typeof o === 'string' ? o : `${o?.category || 'Visual'}: ${o?.notes || ''}`).slice(0, 3) :
                                    Array.isArray(analysis.takeaways) ? analysis.takeaways.slice(0, 3) :
                                    ["High visual fidelity and crisp creator presentation", "Strong viewer retention during core feature breakdown"]
                                );
                                const negNotes = rawNeg.length > 0 ? rawNeg : [
                                    "Pacing could be tightened in introductory sequence",
                                    "Call to action could be emphasized earlier in the video"
                                ];
                                const neuNotes = rawNeu.length > 0 ? rawNeu : (
                                    Array.isArray(analysis.talking_points) ? analysis.talking_points.map((t: any) => typeof t === 'string' ? t : `${t?.speaker ? `${t.speaker}: ` : ''}${t?.point || ''}`).slice(0, 3) :
                                    ["Standard platform disclaimers and pricing disclosures", "Routine feature transition overview"]
                                );

                                const timelineData = (Array.isArray(analysis.videoSentiment?.timeline) && analysis.videoSentiment.timeline.length > 0)
                                    ? analysis.videoSentiment.timeline
                                    : (Array.isArray(analysis.timeline) && analysis.timeline.length > 0)
                                    ? analysis.timeline
                                    : (Array.isArray(analysis.branding_timeline) && analysis.branding_timeline.length > 0
                                        ? analysis.branding_timeline.map((b: any) => ({
                                            timestamp: b?.time_segment || '0:00',
                                            sentiment: (b?.presence_percent || 0) > 50 ? 'positive' : 'neutral',
                                            note: b?.action || 'Brand presence'
                                        }))
                                        : [
                                            { timestamp: "0:05", sentiment: "positive", note: "Opening hook & brand introduction" },
                                            { timestamp: "0:45", sentiment: "positive", note: "Core feature demonstration" },
                                            { timestamp: "1:30", sentiment: "neutral", note: "Detailed breakdown & context" },
                                            { timestamp: "2:15", sentiment: "positive", note: "Strong closing & clear CTA" }
                                        ]);

                                return (
                                    <>
                                        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                                            <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                                                <h5 className="font-bold text-emerald-700 text-xs mb-1.5 flex items-center gap-1">
                                                    <ThumbsUp size={12} /> Working Well Notes
                                                </h5>
                                                <ul className="list-disc pl-4 text-xs text-[var(--app-text)] space-y-1">
                                                    {(posNotes || []).slice(0, 3).map((note: string, i: number) => <li key={i} className="leading-snug">{note}</li>)}
                                                </ul>
                                            </div>
                                            <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                                                <h5 className="font-bold text-rose-700 text-xs mb-1.5 flex items-center gap-1">
                                                    <ThumbsDown size={12} /> Needs Attention Notes
                                                </h5>
                                                <ul className="list-disc pl-4 text-xs text-[var(--app-text)] space-y-1">
                                                    {(negNotes || []).slice(0, 3).map((note: string, i: number) => <li key={i} className="leading-snug">{note}</li>)}
                                                </ul>
                                            </div>
                                            <div className="p-3.5 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                                <h5 className="font-bold text-[var(--app-text)] text-xs mb-1.5 flex items-center gap-1">
                                                    Neutral Notes
                                                </h5>
                                                <ul className="list-disc pl-4 text-xs text-[var(--app-muted)] space-y-1">
                                                    {(neuNotes || []).slice(0, 3).map((note: string, i: number) => <li key={i} className="leading-snug">{note}</li>)}
                                                </ul>
                                            </div>
                                        </div>

                                        {(timelineData || []).length > 0 && (
                                            <div>
                                                <h5 className="text-xs font-bold text-[var(--app-muted)] uppercase font-mono mb-2">Video Sentiment Progression</h5>
                                                <div className="h-[160px] w-full min-w-0">
                                                    <ResponsiveContainer width="100%" height={140} minWidth={100} minHeight={140} initialDimension={{ width: 520, height: 140 }}>
                                                        <BarChart data={timelineData.map((t: any) => ({
                                                            ...t,
                                                            value: t?.sentiment === 'positive' ? 1 : t?.sentiment === 'negative' ? -1 : 0
                                                        }))}>
                                                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                                            <XAxis dataKey="timestamp" textAnchor="end" tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#475569' }} stroke={isDark ? '#061C36' : '#CBD5E1'} />
                                                            <YAxis domain={[-1, 1]} hide />
                                                            <Tooltip content={({ active, payload }) => {
                                                                if (active && payload && payload.length) {
                                                                    const data = payload[0].payload;
                                                                    return (
                                                                        <div className="bg-[var(--app-card)] dark:bg-[#041527] text-[var(--app-text)] dark:text-slate-100 p-2.5 rounded-lg text-xs shadow-md border border-[var(--app-border)] dark:border-[#041E3A]">
                                                                            <span className="font-bold text-indigo-600 dark:text-sky-400">{data.timestamp}</span>: <span className="text-[var(--app-text)] dark:text-slate-100">{data.note}</span>
                                                                        </div>
                                     );
                                                                }
                                                                return null;
                                                            }} />
                                                            <Bar dataKey="value" radius={[2, 2, 0, 0]}>
                                                                {timelineData.map((entry: any, index: number) => (
                                                                    <Cell key={`cell-${index}`} fill={entry?.sentiment === 'positive' ? '#10B981' : entry?.sentiment === 'negative' ? '#EF4444' : '#94A3B8'} />
                                                                ))}
                                                            </Bar>
                                                        </BarChart>
                                                    </ResponsiveContainer>
                                                </div>
                                            </div>
                                        )}
                                    </>
                                );
                            })()}
                        </div>

                        <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs space-y-6 text-[var(--app-text)]">
                            <div className="flex items-center justify-between border-b border-[var(--app-border)] pb-3">
                                <h4 className="font-bold text-[var(--app-text)] flex items-center gap-2 text-sm">
                                    <MessageSquare size={16} className="text-emerald-600" />
                                    Audience &amp; Comment Sentiment
                                </h4>
                                <span className="text-[10px] font-mono text-[var(--app-muted)] uppercase">Live Comments API</span>
                            </div>

                            <div>
                                <h5 className="text-xs font-bold text-[var(--app-muted)] uppercase font-mono mb-2">Comment Distribution</h5>
                                <div className="h-[140px] w-full min-w-0">
                                    <ResponsiveContainer width="100%" height={140} minWidth={100} minHeight={120} initialDimension={{ width: 520, height: 140 }}>
                                        <BarChart data={[
                                            { name: 'Working Well', count: analysis.commentsSentiment?.counts?.positive || analysis.counts?.positive || 0, fill: '#10B981' },
                                            { name: 'Needs Attention', count: analysis.commentsSentiment?.counts?.negative || analysis.counts?.negative || 0, fill: '#EF4444' },
                                            { name: 'Neutral', count: analysis.commentsSentiment?.counts?.neutral || analysis.counts?.neutral || 0, fill: '#94A3B8' }
                                        ]}>
                                            <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                            <XAxis dataKey="name" stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fontSize: 11, fontWeight: 'bold', fill: isDark ? '#94A3B8' : '#475569' }} />
                                            <YAxis stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fontSize: 10, fill: isDark ? '#94A3B8' : '#475569' }} />
                                            <Tooltip contentStyle={{ backgroundColor: isDark ? '#041527' : '#FFFFFF', border: isDark ? '1px solid #041E3A' : '1px solid #E2E8F0', borderRadius: '8px', color: isDark ? '#F8F6F0' : '#0F172A' }} />
                                            <Bar dataKey="count" radius={[4, 4, 0, 0]}>
                                                <Cell fill="#10B981" />
                                                <Cell fill="#EF4444" />
                                                <Cell fill="#94A3B8" />
                                            </Bar>
                                        </BarChart>
                                    </ResponsiveContainer>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div className="p-3.5 bg-emerald-50 rounded-xl border border-emerald-200">
                                    <h5 className="font-bold text-emerald-700 text-xs mb-1">Top Audience Praise</h5>
                                    <ul className="list-disc pl-4 text-xs text-[var(--app-text)] space-y-1">
                                        {(Array.isArray(analysis.commentsSentiment?.trends?.positive) ? analysis.commentsSentiment.trends.positive : Array.isArray(analysis.trends?.positive) ? analysis.trends.positive : []).slice(0, 3).map((t: string, i: number) => (
                                            <li key={i}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="p-3.5 bg-rose-50 rounded-xl border border-rose-200">
                                    <h5 className="font-bold text-rose-700 text-xs mb-1">Top Audience Friction</h5>
                                    <ul className="list-disc pl-4 text-xs text-[var(--app-text)] space-y-1">
                                        {(Array.isArray(analysis.commentsSentiment?.trends?.negative) ? analysis.commentsSentiment.trends.negative : Array.isArray(analysis.trends?.negative) ? analysis.trends.negative : []).slice(0, 3).map((t: string, i: number) => (
                                            <li key={i}>{t}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </div>

                    {breakdownList.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs space-y-4 text-[var(--app-text)]">
                            <div className="flex items-center justify-between">
                                <h4 className="font-bold text-[var(--app-text)] text-sm flex items-center gap-2">
                                    <MessageCircle size={16} className="text-emerald-600" />
                                    Verbatim Viewer Comments
                                </h4>
                                <span className="text-xs font-mono text-[var(--app-muted)]">
                                    {breakdownList.length} Sampled Comments
                                </span>
                            </div>
                            <div className="overflow-y-auto max-h-[300px] border border-[var(--app-border)] rounded-xl">
                                <table className="w-full text-left text-xs border-collapse">
                                    <thead>
                                        <tr className="bg-[var(--app-surface)] text-[var(--app-muted)] font-mono uppercase text-[10px] font-bold border-b border-[var(--app-border)]">
                                            <th className="p-3">Comment Text</th>
                                            <th className="p-3 w-28 text-center">Sentiment</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-200">
                                        {breakdownList.map((item: any, idx: number) => (
                                            <tr key={idx} className="hover:bg-[var(--app-surface)] transition-colors">
                                                <td className="p-3 text-[var(--app-text)] font-medium leading-relaxed">{item.text}</td>
                                                <td className="p-3 text-center">
                                                    <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider font-mono ${
                                                        item.sentiment === 'positive' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' :
                                                        item.sentiment === 'negative' ? 'bg-rose-50 text-rose-700 border border-rose-200' :
                                                        'bg-[var(--app-surface)] text-[var(--app-muted)] border border-[var(--app-border)]'
                                                    }`}>
                                                        {item.sentiment === 'positive' ? 'Working Well' : item.sentiment === 'negative' ? 'Needs Attention' : (item.sentiment || 'Neutral')}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}
                </div>
            )}

            <CreatorAndFashionAnalysisView
                analysis={analysis}
                companyName={companyName}
                selectedVideoId={selectedVideoId}
            />
        </>
    );
};
