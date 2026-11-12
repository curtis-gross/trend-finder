import React from 'react';
import { AlertCircle, ShieldCheck, Sparkles, Tag } from 'lucide-react';
import { getVideoId, typePageTitles } from '../typesAndConstants';

interface CreatorAndFashionAnalysisViewProps {
    analysis: any;
    companyName: string;
    selectedVideoId: string;
}

export const CreatorAndFashionAnalysisView: React.FC<CreatorAndFashionAnalysisViewProps> = ({
    analysis,
    companyName,
    selectedVideoId
}) => {
    if (!analysis) return null;
    const activeBrand = companyName || 'test-company';

    return (
        <>
            {analysis.type === 'creator_partner' && (
                <div className="space-y-8">
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                        <ShieldCheck size={16} /> Creator Video Review Sign-Off Sheet
                    </h3>

                    <div className="bg-[var(--app-card)] border border-[var(--app-border)] p-6 rounded-2xl shadow-xs space-y-6 text-[var(--app-text)]">
                        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 pb-6 border-b border-[var(--app-border)]">
                            <div>
                                <h4 className="text-xl font-extrabold text-[var(--app-text)] mb-1">{activeBrand}: Creator Video Review Sign-Off Sheet</h4>
                                <p className="text-xs text-[var(--app-muted)] font-mono">Official 10-Point Legal, FTC &amp; Brand Compliance Audit</p>
                            </div>

                            <div className="flex flex-col items-end">
                                <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[var(--app-muted)] mb-1">Approval Decision</span>
                                <span className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-wider border shadow-xs ${
                                    (analysis.final_decision || 'APPROVED').includes('APPROVED') ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                    (analysis.final_decision || '').includes('REVISIONS') ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                    'bg-rose-50 text-rose-700 border-rose-200'
                                }`}>
                                    {(analysis.final_decision || 'APPROVED').includes('APPROVED') ? '[✓] APPROVED (Ready for publishing)' :
                                     (analysis.final_decision || '').includes('REVISIONS') ? '[!] REVISIONS REQUIRED (Send notes back)' :
                                     '[✕] REJECTED (Non-compliant issues)'}
                                </span>
                            </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs font-mono">
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] block mb-1 text-[10px] uppercase font-bold">Campaign Name</span>
                                <strong className="text-[var(--app-text)]">{analysis.metadata?.campaign_name || 'Brand Growth Campaign'}</strong>
                            </div>
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] block mb-1 text-[10px] uppercase font-bold">Creator / Handle</span>
                                <strong className="text-[var(--app-text)]">{analysis.metadata?.creator_handle || analysis.creator_info?.channel_name || '@creator_partner'}</strong>
                            </div>
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] block mb-1 text-[10px] uppercase font-bold">Reviewer Name</span>
                                <strong className="text-[var(--app-text)]">{analysis.metadata?.reviewer_name || 'AI Brand Auditor'}</strong>
                            </div>
                            <div className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)]">
                                <span className="text-[var(--app-muted)] block mb-1 text-[10px] uppercase font-bold">Review Date</span>
                                <strong className="text-[var(--app-text)]">{analysis.metadata?.review_date || new Date().toLocaleDateString()}</strong>
                            </div>
                        </div>
                    </div>

                    <div className="bg-[var(--app-card)] rounded-2xl border border-[var(--app-border)] shadow-xs overflow-hidden text-[var(--app-text)]">
                        <div className="p-4 bg-[var(--app-surface)] border-b border-[var(--app-border)] flex items-center justify-between">
                            <h4 className="font-bold text-[var(--app-text)] text-sm flex items-center gap-2">
                                <ShieldCheck className="text-emerald-600" size={16} /> 10-Point Review Criteria Table
                            </h4>
                            <span className="text-xs font-mono font-bold text-[var(--app-muted)]">
                                Compliance Score: <strong className="text-emerald-600">{analysis.compliance_score ?? 90}%</strong>
                            </span>
                        </div>

                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-xs border-collapse">
                                <thead>
                                    <tr className="bg-[var(--app-surface)] border-b border-[var(--app-border)] text-[var(--app-muted)] font-bold uppercase tracking-wider font-mono text-[11px]">
                                        <th className="p-3 w-12 text-center">#</th>
                                        <th className="p-3 w-48">Review Criteria</th>
                                        <th className="p-3">Focus Area</th>
                                        <th className="p-3 w-28 text-center">Status</th>
                                        <th className="p-3">Review Notes &amp; Required Fixes</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-200">
                                    {(Array.isArray(analysis.review_table) ? analysis.review_table : Array.isArray(analysis.deliverables_checklist) ? analysis.deliverables_checklist : []).map((row: any, idx: number) => (
                                        <tr key={idx} className="hover:bg-[var(--app-surface)] transition-colors">
                                            <td className="p-3 text-center font-mono font-bold text-[var(--app-muted)]">{row.id || idx + 1}</td>
                                            <td className="p-3 font-bold text-[var(--app-text)]">{row.criteria || row.item}</td>
                                            <td className="p-3 text-[var(--app-muted)] text-[11.5px] leading-snug">{row.focus_area || row.notes}</td>
                                            <td className="p-3 text-center">
                                                <span className={`px-2.5 py-1 rounded-md text-[10px] font-bold uppercase font-mono border ${
                                                    (row.status || '').toUpperCase() === 'PASS' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                                                    (row.status || '').toUpperCase() === 'PARTIAL' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                                                    'bg-rose-50 text-rose-700 border-rose-200'
                                                }`}>
                                                    {(row.status || 'PASS').toUpperCase()}
                                                </span>
                                            </td>
                                            <td className="p-3 text-[var(--app-muted)] font-medium leading-relaxed">{row.notes || 'Meets brand guidelines.'}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                            <h4 className="font-bold text-emerald-600 mb-3 flex items-center gap-2">
                                <Tag size={18} /> Product Mentions &amp; Placements
                            </h4>
                            <div className="space-y-3">
                                {(Array.isArray(analysis.product_mentions) ? analysis.product_mentions : []).map((p: any, i: number) => (
                                    <div key={i} className="p-3 bg-[var(--app-surface)] rounded-xl border border-[var(--app-border)] text-xs">
                                        <div className="flex justify-between font-bold text-[var(--app-text)] mb-1">
                                            <span>{p.product}</span>
                                            <span className="text-emerald-600">{p.timestamp}</span>
                                        </div>
                                        <p className="text-[var(--app-muted)]">{p.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="space-y-6">
                            <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                                <h4 className="font-bold text-rose-600 mb-3 flex items-center gap-2">
                                    <AlertCircle size={18} /> Compliance &amp; Audit Flags
                                </h4>
                                <ul className="space-y-2 text-xs text-[var(--app-text)] list-disc pl-5">
                                    {(Array.isArray(analysis.audit_flags) ? analysis.audit_flags : []).map((flag: string, i: number) => (
                                        <li key={i}>{flag}</li>
                                    ))}
                                </ul>
                            </div>

                            <div className="bg-[var(--app-card)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                                <h4 className="font-bold text-indigo-600 mb-3 flex items-center gap-2">
                                    <Sparkles size={18} /> Strategic Recommendations
                                </h4>
                                <ul className="space-y-2 text-xs text-[var(--app-text)] list-disc pl-5">
                                    {(Array.isArray(analysis.recommendations) ? analysis.recommendations : []).map((rec: string, i: number) => (
                                        <li key={i}>{rec}</li>
                                    ))}
                                </ul>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {(analysis.type === 'fashion_analysis' || analysis.type === 'trend_analysis') && (
                <div className="space-y-8">
                    <h3 className="flex items-center gap-2 text-emerald-600 font-bold text-sm uppercase tracking-[0.1em]">
                        <Sparkles size={16} /> {typePageTitles[analysis.type] || "Trend Analysis"}
                    </h3>

                    <div className="bg-[var(--app-card)] p-6 rounded-3xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                        <div className="overflow-x-auto">
                            <table className="data-table">
                                <thead>
                                    <tr>
                                        <th>Timestamp</th>
                                        <th>Video</th>
                                        <th>Trend</th>
                                        <th>Relation to Company</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {(Array.isArray(analysis.trends) ? analysis.trends : []).map((item: any, idx: number) => {
                                        const videoId = getVideoId(selectedVideoId);
                                        const timestampLink = `https://youtu.be/${videoId}?t=${item.seconds}`;
                                        const embedUrl = `https://www.youtube.com/embed/${videoId}?start=${item.seconds}`;
                                        return (
                                            <tr key={idx}>
                                                <td>
                                                    <a href={timestampLink} target="_blank" rel="noopener noreferrer" className="text-indigo-600 hover:underline">
                                                        {item.timestamp}
                                                    </a>
                                                </td>
                                                <td>
                                                    <iframe
                                                        width="200"
                                                        height="113"
                                                        src={embedUrl}
                                                        title={`Trend at ${item.timestamp}`}
                                                        frameBorder="0"
                                                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                                        allowFullScreen
                                                        className="rounded-lg border border-[var(--app-border)]"
                                                    />
                                                </td>
                                                <td className="font-medium text-[var(--app-text)]">{item.trend}</td>
                                                <td className="text-sm text-[var(--app-muted)]">{item.relation}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>

                    {analysis.collection_trends && (
                        <div>
                            <h4 className="font-bold text-emerald-600 mb-4 text-sm uppercase tracking-wider">{analysis.type === 'fashion_analysis' ? "Collection Trend Summary" : "Overarching Trends"}</h4>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                {(Array.isArray(analysis.collection_trends) ? analysis.collection_trends : []).map((trend: any, idx: number) => (
                                    <div key={idx} className="bg-[var(--app-surface)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                                        <div className="text-2xl font-bold text-emerald-600 mb-2">{idx + 1}</div>
                                        <h5 className="font-bold text-[var(--app-text)] mb-2">{trend.title}</h5>
                                        <p className="text-sm text-[var(--app-muted)]">{trend.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.look_by_look && (
                        <div>
                            <h4 className="font-bold text-emerald-600 mb-4 text-sm uppercase tracking-wider">{analysis.type === 'fashion_analysis' ? "Look-by-Look Intelligence" : "Specific Examples"}</h4>
                            <div className="space-y-4">
                                {(Array.isArray(analysis.look_by_look) ? analysis.look_by_look : []).map((look: any, idx: number) => (
                                    <div key={idx} className="bg-[var(--app-surface)] p-6 rounded-2xl border border-[var(--app-border)] shadow-xs text-[var(--app-text)]">
                                        <h5 className="font-bold text-[var(--app-text)] mb-1">{look.look}</h5>
                                        <p className="text-sm text-[var(--app-muted)]">{look.description}</p>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {analysis.strategy && (
                        <div>
                            <h4 className="font-bold text-emerald-600 mb-4 text-sm uppercase tracking-wider">Strategy &amp; Competitive Intelligence</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                <div className="bg-emerald-50 p-6 rounded-2xl border border-emerald-200 text-[var(--app-text)]">
                                    <h5 className="font-bold text-emerald-700 mb-3">What to Do</h5>
                                    <ul className="list-disc pl-5 text-sm text-[var(--app-text)] space-y-2">
                                        {(Array.isArray(analysis.strategy?.do) ? analysis.strategy.do : []).map((item: string, idx: number) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                                <div className="bg-rose-50 p-6 rounded-2xl border border-rose-200 text-[var(--app-text)]">
                                    <h5 className="font-bold text-rose-700 mb-3">What Not to Do</h5>
                                    <ul className="list-disc pl-5 text-sm text-[var(--app-text)] space-y-2">
                                        {(Array.isArray(analysis.strategy?.dont) ? analysis.strategy.dont : []).map((item: string, idx: number) => (
                                            <li key={idx}>{item}</li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            )}
        </>
    );
};
