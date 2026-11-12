import React from 'react';
import { Eye, Layers, MessageSquare, Music, Sparkles, Tag, TrendingUp, Users } from 'lucide-react';
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { getWordCloud } from '../typesAndConstants';

interface AbcdAndVideoMetadataViewProps {
    analysis: any;
    isDark: boolean;
    themeColors: any;
}

export const AbcdAndVideoMetadataView: React.FC<AbcdAndVideoMetadataViewProps> = ({
    analysis,
    isDark,
    themeColors
}) => {
    if (!analysis) return null;
    const isAbcdType = !analysis.type || analysis.type === 'abcd' || analysis.type === 'competitor_abcd';
    const hasSharedVideoMetadata = ['abcd', 'competitor_abcd', 'sentiment_video', 'competitor_sentiment_video', 'fashion_analysis', 'trend_analysis', 'video_metadata', 'creator_partner'].includes(analysis.type || 'abcd');

    return (
        <>
            {isAbcdType && analysis.abcd_scores && typeof analysis.abcd_scores === 'object' && (
                <div>
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em] mb-6">
                        <TrendingUp size={16} /> ABCD Framework Scoring
                    </h3>

                    {analysis.first_mention && (
                        <div className="mb-6 p-6 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] shadow-sm flex items-center justify-between hover:border-emerald-200 transition-all">
                            <div>
                                <h4 className="text-[var(--app-muted)] text-xs uppercase font-bold mb-1 tracking-wider">First Brand Mention/Appearance</h4>
                                <p className="text-2xl font-black text-[var(--app-text)]">{analysis.first_mention.seconds} seconds</p>
                                <p className="text-xs text-[var(--app-muted)]">Via {analysis.first_mention.method}</p>
                            </div>
                            <div className={`px-4 py-2 rounded-full font-bold text-sm ${analysis.first_mention.result === 'Pass' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                                {analysis.first_mention.result}
                            </div>
                        </div>
                    )}

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {Object.entries(analysis.abcd_scores || {}).map(([key, data]: [string, any]) => {
                            const scoreVal = typeof data === 'object' && data !== null ? (data.score ?? 0) : (typeof data === 'number' ? data : 0);
                            const obsVal = typeof data === 'object' && data !== null ? (data.observation || '') : String(data || '');
                            return (
                                <div key={key} className="flex flex-col gap-3 p-6 bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] hover:border-emerald-200 transition-all group">
                                    <div className="flex justify-between items-center">
                                        <h4 className="text-[var(--app-text)] font-bold tracking-wider uppercase text-sm">{key}</h4>
                                        <span className="text-2xl font-black text-emerald-600">{scoreVal}/10</span>
                                    </div>
                                    <div className="w-full bg-[var(--app-surface)] rounded-full h-2.5">
                                        <div className="bg-[#0AF468] h-2.5 rounded-full" style={{ width: `${Math.min(100, Math.max(0, scoreVal * 10))}%` }} />
                                    </div>
                                    <p className="text-[var(--app-muted)] text-sm leading-relaxed transition-colors">
                                        {obsVal}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {analysis.branding_timeline && (
                <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em] mb-6">
                        <TrendingUp size={16} /> Branding Presence Timeline (% of Screen Time)
                    </h3>
                    <div className="h-[250px] w-full min-w-0">
                        <ResponsiveContainer width="100%" height={250} minWidth={100} minHeight={200} initialDimension={{ width: 520, height: 250 }}>
                            <AreaChart data={analysis.branding_timeline} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                                <defs>
                                    <linearGradient id="colorPresence" x1="0" y1="0" x2="0" y2="1">
                                        <stop offset="5%" stopColor="#0077C8" stopOpacity={0.8} />
                                        <stop offset="95%" stopColor="#0077C8" stopOpacity={0} />
                                    </linearGradient>
                                </defs>
                                <CartesianGrid strokeDasharray="3 3" stroke={isDark ? '#041E3A' : '#E2E8F0'} />
                                <XAxis dataKey="time_segment" stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 10 }} />
                                <YAxis domain={[0, 100]} stroke={isDark ? '#061C36' : '#CBD5E1'} tick={{ fill: isDark ? '#94A3B8' : '#475569', fontSize: 11 }} />
                                <Tooltip
                                    contentStyle={{ backgroundColor: isDark ? '#041527' : '#FFFFFF', border: isDark ? '1px solid #041E3A' : '1px solid #E2E8F0', borderRadius: '8px', color: isDark ? '#F8F6F0' : '#0F172A' }}
                                    formatter={(value: number) => [`${value}%`, 'Presence']}
                                />
                                <Area type="monotone" dataKey="presence_percent" stroke="#0077C8" fillOpacity={1} fill="url(#colorPresence)" />
                            </AreaChart>
                        </ResponsiveContainer>
                    </div>
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {(Array.isArray(analysis.branding_timeline) ? analysis.branding_timeline : []).map((point: any, i: number) => (
                            <div key={i} className="p-3 bg-[var(--app-surface)] rounded-lg border border-[var(--app-border)]">
                                <span className="text-sm font-bold text-[var(--app-muted)]">{point.time_segment}</span>
                                <div className="flex justify-between items-center mt-1">
                                    <span className="text-sm font-bold text-emerald-600">{point.presence_percent}%</span>
                                    <span className="text-xs text-[var(--app-muted)] truncate max-w-[150px]">{point.action}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isAbcdType && (
                <div>
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em] mb-6">
                        <Eye size={16} /> Scene &amp; Creative Observations
                    </h3>
                    <div className="grid grid-cols-1 gap-4">
                        {(Array.isArray(analysis.observations) ? analysis.observations : []).map((item: any, i: number) => (
                            <div key={i} className="p-6 bg-[var(--app-surface)] rounded-2xl border-l-[3px] border-[#0AF468] border-y border-r border-[var(--app-border)] shadow-md">
                                <h4 className="text-emerald-600 font-bold text-xs uppercase tracking-widest mb-2">{item.category}</h4>
                                <p className="text-[var(--app-muted)] text-sm leading-relaxed">{item.notes}</p>
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {isAbcdType && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div className="space-y-6">
                        <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                            <Layers size={16} /> Strategic Takeaways
                        </h3>
                        <div className="space-y-4">
                            {(Array.isArray(analysis.takeaways) ? analysis.takeaways : []).map((takeaway: string, i: number) => (
                                <p key={i} className="text-sm text-[var(--app-text)] font-medium border-l-[3px] border-[#0AF468] pl-6 py-4 leading-relaxed bg-[var(--app-surface)] rounded-r-2xl border border-[var(--app-border)] border-l-0 shadow-xs">
                                    {takeaway}
                                </p>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {hasSharedVideoMetadata && (
                <div className="space-y-12 mt-12 pt-12 border-t border-[var(--app-border)]">
                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs relative overflow-hidden group text-[var(--app-text)]">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400 rounded-full blur-[60px] -mr-16 -mt-16 opacity-[0.05] group-hover:opacity-[0.1] transition-opacity" style={{ backgroundColor: themeColors?.accent }} />
                        <h3 className="font-bold text-indigo-600 mb-3 text-xs uppercase tracking-wider flex items-center gap-2">
                            <Sparkles size={14} /> Key Word Cloud
                        </h3>
                        <div className="flex flex-wrap gap-4 justify-center items-center p-6 bg-[var(--app-surface)] border border-[var(--app-border)] rounded-xl relative z-10">
                            {(Array.isArray(getWordCloud(analysis)) ? getWordCloud(analysis) : []).map((word: string, idx: number) => {
                                const sizes = ['text-xs', 'text-sm', 'text-base', 'text-lg', 'text-xl', 'text-2xl'];
                                const colors = ['text-indigo-600', 'text-emerald-600', 'text-sky-600', 'text-purple-600', 'text-rose-600', 'text-amber-600'];
                                return (
                                    <span key={idx} className={`${sizes[idx % sizes.length]} font-bold ${colors[idx % colors.length]} transition-transform hover:scale-110 cursor-default hover:text-[var(--app-text)]`}>
                                        {word}
                                    </span>
                                );
                            })}
                        </div>
                    </div>

                    {analysis.products && analysis.products.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-[var(--app-text)] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                <Tag size={16} className="text-emerald-600" />
                                Extracted Products &amp; Offerings ({analysis.products.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(Array.isArray(analysis.products) ? analysis.products : []).map((product: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] hover:border-[var(--app-border)] hover:bg-[var(--app-surface)] transition-all group">
                                        <div className="flex justify-between items-start gap-2">
                                            <h4 className="font-bold text-[var(--app-text)] text-sm group-hover:text-emerald-600 transition-colors">{product.name}</h4>
                                            {product.timestamp && (
                                                <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200 shrink-0">
                                                    {product.timestamp}
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{product.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.themes && analysis.themes.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-[var(--app-text)] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                <Eye size={16} className="text-emerald-600" />
                                Narrative &amp; Campaign Themes
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(Array.isArray(analysis.themes) ? analysis.themes : []).map((theme: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                        <h4 className="font-bold text-[var(--app-text)] text-sm">{theme.name}</h4>
                                        <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{theme.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.characters && analysis.characters.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-[var(--app-text)] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                <Users size={16} className="text-emerald-600" />
                                Spokespersons, Characters &amp; Figures ({analysis.characters.length})
                            </h3>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                {(Array.isArray(analysis.characters) ? analysis.characters : []).map((char: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--app-surface)] dark:bg-[#061C36] rounded-xl border border-[var(--app-border)] dark:border-[#041E3A] flex gap-3 items-start">
                                        <div className="w-8 h-8 rounded-full bg-emerald-50 dark:bg-[#041527] text-emerald-700 dark:text-emerald-300 border border-emerald-200 dark:border-[#041E3A] font-bold flex items-center justify-center shrink-0 text-sm uppercase">
                                            {char.name?.charAt(0) || 'C'}
                                        </div>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex justify-between items-start gap-1">
                                                <h4 className="font-bold text-[var(--app-text)] text-xs truncate">{char.name}</h4>
                                                {char.appearance_timestamp && (
                                                    <span className="text-[9px] font-bold text-[var(--app-muted)] shrink-0">
                                                        In at {char.appearance_timestamp}
                                                    </span>
                                                )}
                                            </div>
                                            <p className="text-xs text-[var(--app-muted)] mt-1 leading-relaxed">{char.role_description}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.music && analysis.music.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-[var(--app-text)] mb-4 text-sm uppercase tracking-wider flex items-center gap-2">
                                <Music size={16} className="text-emerald-600" />
                                Background Soundtrack &amp; Audio Vibe
                            </h3>
                            <div className="space-y-3">
                                {(Array.isArray(analysis.music) ? analysis.music : []).map((track: any, idx: number) => (
                                    <div key={idx} className="p-4 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                        <div className="flex justify-between items-start gap-2">
                                            <div>
                                                <p className="font-bold text-[var(--app-text)] text-sm">{track.description}</p>
                                                <div className="flex gap-2 items-center mt-1">
                                                    <span className="text-[9px] font-bold uppercase bg-indigo-50 text-indigo-700 border border-indigo-200 px-1.5 py-0.5 rounded">
                                                        Vibe: {track.vibe}
                                                    </span>
                                                </div>
                                            </div>
                                            {track.duration && (
                                                <span className="text-[9px] font-bold text-[var(--app-muted)] shrink-0">
                                                    {track.duration}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.talking_points && analysis.talking_points.length > 0 && (
                        <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h3 className="font-bold text-[var(--app-text)] mb-6 text-sm uppercase tracking-wider flex items-center gap-2">
                                <MessageSquare size={16} className="text-emerald-600" />
                                Talking Points &amp; Dialogue Timeline
                            </h3>
                            <div className="relative pl-4 border-l-2 border-[var(--app-border)] space-y-6">
                                {(Array.isArray(analysis.talking_points) ? analysis.talking_points : []).map((tp: any, idx: number) => (
                                    <div key={idx} className="relative">
                                        <div className="absolute -left-[21px] top-1 w-2 h-2 rounded-full bg-emerald-500 border border-[var(--app-border)]" />
                                        <div>
                                            <div className="flex items-center gap-2">
                                                {tp.timestamp && <span className="text-[10px] font-bold text-emerald-600">{tp.timestamp}</span>}
                                                {tp.speaker && <span className="text-xs font-bold text-[var(--app-text)] bg-[var(--app-surface)] border border-[var(--app-border)] px-2 py-0.5 rounded">{tp.speaker}</span>}
                                            </div>
                                            <p className="text-xs text-[var(--app-text)] mt-1.5 leading-relaxed break-words bg-[var(--app-surface)] p-3 rounded-lg border border-[var(--app-border)] inline-block">
                                                &ldquo;{tp.point}&rdquo;
                                            </p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
