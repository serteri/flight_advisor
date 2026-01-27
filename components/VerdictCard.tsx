import { AlertOctagon, CheckCircle2, Info, ThumbsUp, ThumbsDown, AlertTriangle, ArrowRightLeft, Users } from "lucide-react";
import { useTranslations } from "next-intl";

interface VerdictCardProps {
    verdict?: {
        decision: 'recommended' | 'consider' | 'avoid';
        badge: string;
        headline?: string;
        reason: string;
        pros?: string[];
        cons?: string[];
        warning?: string;
        tradeoff?: string;
        scenario?: string;
        socialProof?: string[];
    };
}

export function VerdictCard({ verdict }: VerdictCardProps) {
    const t = useTranslations();

    if (!verdict) return null;

    const styles = {
        recommended: {
            bg: 'bg-emerald-50',
            border: 'border-emerald-200',
            text: 'text-emerald-900',
            icon: <CheckCircle2 className="w-5 h-5 text-emerald-600" />,
        },
        consider: {
            bg: 'bg-amber-50',
            border: 'border-amber-200',
            text: 'text-amber-900',
            icon: <Info className="w-5 h-5 text-amber-600" />,
        },
        avoid: {
            bg: 'bg-red-50',
            border: 'border-red-200',
            text: 'text-red-900',
            icon: <AlertOctagon className="w-5 h-5 text-red-600" />,
        }
    };

    const style = styles[verdict.decision] || styles.consider;

    // Translate functions with fallback
    const tr = (key: string) => {
        const translated = t(key);
        return translated === key ? key.replace(/_/g, ' ').replace(/^(pro|con|verdict|warning|tradeoff)\s/, '') : translated;
    };

    const headline = verdict.headline ? tr(verdict.headline) : tr(verdict.reason);
    const pros = verdict.pros || [];
    const cons = verdict.cons || [];

    return (
        <div className={`mt-4 rounded-xl border-2 ${style.border} ${style.bg} overflow-hidden transition-all`}>
            {/* Header */}
            <div className="p-4 flex gap-3 items-start">
                <div className="shrink-0 mt-0.5">
                    {style.icon}
                </div>
                <div className="flex-1">
                    <p className={`text-sm font-semibold leading-snug ${style.text}`}>
                        {headline}
                    </p>
                </div>
            </div>

            {/* Pros & Cons */}
            {(pros.length > 0 || cons.length > 0) && (
                <div className="px-4 pb-3 grid grid-cols-2 gap-3">
                    {/* Pros Column */}
                    {pros.length > 0 && (
                        <div className="space-y-1">
                            {pros.slice(0, 3).map((pro, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-emerald-700">
                                    <ThumbsUp className="w-3 h-3 shrink-0" />
                                    <span>{tr(pro)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                    {/* Cons Column */}
                    {cons.length > 0 && (
                        <div className="space-y-1">
                            {cons.slice(0, 3).map((con, i) => (
                                <div key={i} className="flex items-center gap-1.5 text-xs text-red-600">
                                    <ThumbsDown className="w-3 h-3 shrink-0" />
                                    <span>{tr(con)}</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Warning Banner */}
            {verdict.warning && (
                <div className="bg-amber-100 border-t border-amber-200 px-4 py-2 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                    <p className="text-xs text-amber-800 font-medium">
                        {tr(verdict.warning)}
                    </p>
                </div>
            )}

            {/* Trade-off Footer */}
            {verdict.tradeoff && (
                <div className="bg-slate-100 border-t border-slate-200 px-4 py-2 flex items-center gap-2">
                    <ArrowRightLeft className="w-3 h-3 text-slate-500 shrink-0" />
                    <p className="text-xs text-slate-600 italic">
                        {tr(verdict.tradeoff)}
                    </p>
                </div>
            )}

            {/* Scenario Simulation */}
            {verdict.scenario && (
                <div className="bg-slate-50 border-t border-slate-200 px-4 py-3">
                    <p className="text-[10px] uppercase font-bold text-slate-400 mb-1">Journey Simulation</p>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                        {verdict.scenario}
                    </p>
                </div>
            )}
            {/* Social Proof */}
            {verdict.socialProof && verdict.socialProof.length > 0 && (
                <div className="bg-blue-50 border-t border-blue-100 px-4 py-2 flex items-start gap-2">
                    <Users className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                    <div className="space-y-1">
                        {verdict.socialProof.map((proof, i) => (
                            <p key={i} className="text-xs text-blue-800 font-medium">
                                {tr(proof)}
                            </p>
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
