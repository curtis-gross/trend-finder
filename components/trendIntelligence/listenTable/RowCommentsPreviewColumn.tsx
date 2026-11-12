import React from 'react';
import { AlertCircle, Loader2, MessageCircle, Play } from 'lucide-react';

interface RowCommentsPreviewColumnProps {
    row: any;
    previewState: any;
    rawPreviewComments: any[];
    filteredPreviewComments: any[];
    commentSearchByRowId: Record<string, string>;
    setCommentSearchByRowId: React.Dispatch<React.SetStateAction<Record<string, string>>>;
    analyzingRowIds: Set<string>;
    handleAnalyze: (id: string) => void;
}

export const RowCommentsPreviewColumn: React.FC<RowCommentsPreviewColumnProps> = ({
    row,
    previewState,
    rawPreviewComments,
    filteredPreviewComments,
    commentSearchByRowId,
    setCommentSearchByRowId,
    analyzingRowIds,
    handleAnalyze
}) => {
    return (
        <div className="lg:col-span-6 flex flex-col justify-between bg-[var(--app-surface)] rounded-2xl border border-[var(--app-border)] p-4 space-y-3">
            <div className="space-y-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2">
                        <MessageCircle size={15} className="text-[#041E3A]" />
                        <h5 className="text-xs font-black uppercase tracking-wider text-[var(--app-text)] font-mono">
                            Comments Within Content
                        </h5>
                        <span className="px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-[#F8F6F1] text-[#9C7A3C] border border-[#D6C5A3]">
                            {rawPreviewComments.length} Comments
                        </span>
                    </div>
                    <input
                        type="text"
                        value={commentSearchByRowId[row.id] || ''}
                        onChange={e => setCommentSearchByRowId(prev => ({ ...prev, [row.id]: e.target.value }))}
                        placeholder="Filter comments in this item..."
                        className="px-2.5 py-1 bg-[var(--app-card)] border border-[var(--app-border)] rounded-lg text-xs text-[var(--app-text)] placeholder-slate-400 focus:outline-hidden focus:border-[#041E3A]"
                    />
                </div>

                {previewState?.error && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 space-y-1 text-xs">
                        <div className="flex items-center gap-1.5 font-bold">
                            <AlertCircle size={14} className="text-rose-600 shrink-0" />
                            <span>YouTube Comments Notice</span>
                        </div>
                        <p className="font-mono text-[11px] leading-relaxed break-all">
                            {previewState.error}
                        </p>
                    </div>
                )}

                {previewState?.loading && rawPreviewComments.length === 0 ? (
                    <div className="py-10 flex items-center justify-center gap-2 text-xs font-mono text-[var(--app-muted)]">
                        <Loader2 size={15} className="animate-spin text-[#041E3A]" />
                        <span>Fetching comments for this content...</span>
                    </div>
                ) : filteredPreviewComments.length > 0 ? (
                    <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                        {filteredPreviewComments.map((c: any, cIdx: number) => {
                            const sent = String(c.sentiment || 'neutral').toLowerCase();
                            const sentBadge =
                                sent === 'positive'
                                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                                    : sent === 'negative'
                                    ? 'bg-rose-50 text-rose-700 border-rose-200'
                                    : 'bg-[var(--app-surface)] text-[var(--app-muted)] border-[var(--app-border)]';
                            return (
                                <div
                                    key={c.id || cIdx}
                                    className="p-3 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] space-y-1.5 shadow-2xs"
                                >
                                    <div className="flex items-center justify-between gap-2 flex-wrap text-[11px] font-mono">
                                        <div className="flex items-center gap-1.5">
                                            <span className="font-bold text-[var(--app-text)]">
                                                {c.author || 'Community Member'}
                                            </span>
                                            {c.subreddit && (
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-orange-50 text-orange-700 border border-orange-200">
                                                    {c.subreddit}
                                                </span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {typeof c.score === 'number' && (
                                                <span className="text-[var(--app-muted)] font-bold">
                                                    ↑ {c.score}
                                                </span>
                                            )}
                                            <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold border uppercase ${sentBadge}`}>
                                                {sent}
                                            </span>
                                        </div>
                                    </div>
                                    <p className="text-xs text-[var(--app-muted)] leading-relaxed">
                                        {c.text}
                                    </p>
                                </div>
                            );
                        })}
                    </div>
                ) : (
                    <div className="p-6 rounded-xl bg-[var(--app-card)] border border-[var(--app-border)] text-center space-y-2">
                        <p className="text-xs text-[var(--app-muted)]">
                            No comments cached yet for this item. Click <strong>Analyze</strong> to harvest &amp; evaluate comments for this source.
                        </p>
                        <button
                            type="button"
                            onClick={() => handleAnalyze(row.id)}
                            disabled={analyzingRowIds.has(row.id)}
                            className="px-3 py-1.5 rounded-xl text-xs font-bold bg-[#041E3A] text-white keep-white-text hover:bg-[#072B54] transition inline-flex items-center gap-1.5 cursor-pointer"
                        >
                            {analyzingRowIds.has(row.id) ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                            <span>Analyze &amp; Harvest Comments</span>
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};
