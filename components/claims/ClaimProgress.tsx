import { CheckCircle2, Circle } from 'lucide-react';
import { useTranslations } from 'next-intl';

export type ClaimStatus =
    | 'PENDING'
    | 'SUBMITTED'
    | 'LEGAL_REVIEW'
    | 'AIRLINE_CONTACTED'
    | 'SETTLED'
    | 'REJECTED';

interface ClaimProgressProps {
    status: ClaimStatus;
    orientation?: 'horizontal' | 'vertical';
}

const STATUS_FLOW: ClaimStatus[] = [
    'PENDING',
    'SUBMITTED',
    'LEGAL_REVIEW',
    'AIRLINE_CONTACTED',
    'SETTLED',
];

export function ClaimProgress({ status, orientation = 'horizontal' }: ClaimProgressProps) {
    const t = useTranslations('ClaimStatus');
    const currentIndex = STATUS_FLOW.indexOf(status);
    const effectiveIndex = currentIndex === -1 ? 0 : currentIndex;
    const isRejected = status === 'REJECTED';

    if (isRejected) {
        return (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-700">{t('title')}</p>
                <p className="mt-1 text-sm font-semibold text-rose-900">{t('status.REJECTED')}</p>
                <p className="mt-1 text-sm text-rose-800">{t('description.REJECTED')}</p>
            </div>
        );
    }

    const isVertical = orientation === 'vertical';

    return (
        <div className="rounded-2xl border border-slate-200 bg-white p-4 md:p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{t('title')}</p>
            <p className="mt-1 text-sm text-slate-700">{t('current', { status: t(`status.${status}`) })}</p>

            <div className={isVertical ? 'mt-4 space-y-3' : 'mt-4 grid gap-3 md:grid-cols-5'}>
                {STATUS_FLOW.map((step, index) => {
                    const completed = index < effectiveIndex;
                    const active = index === effectiveIndex;

                    return (
                        <div
                            key={step}
                            className={`relative rounded-xl border px-3 py-2.5 transition-colors ${
                                active
                                    ? 'border-sky-300 bg-sky-50'
                                    : completed
                                        ? 'border-emerald-200 bg-emerald-50'
                                        : 'border-slate-200 bg-slate-50'
                            }`}
                        >
                            <div className="flex items-center gap-2">
                                {completed ? (
                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                ) : active ? (
                                    <Circle className="h-4 w-4 text-sky-600 fill-sky-600" />
                                ) : (
                                    <Circle className="h-4 w-4 text-slate-300" />
                                )}
                                <span
                                    className={`text-xs font-semibold uppercase tracking-wide ${
                                        active
                                            ? 'text-sky-700'
                                            : completed
                                                ? 'text-emerald-700'
                                                : 'text-slate-500'
                                    }`}
                                >
                                    {index + 1}
                                </span>
                            </div>

                            <p className={`mt-1 text-sm font-semibold ${active ? 'text-slate-900' : 'text-slate-700'}`}>
                                {t(`status.${step}`)}
                            </p>
                            <p className="mt-0.5 text-xs text-slate-500">{t(`description.${step}`)}</p>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ClaimProgress;
