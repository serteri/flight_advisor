'use client';

import { useLocale, useTranslations } from 'next-intl';
import { Check, PlaneTakeoff } from 'lucide-react';
import { formatLocalDateTime } from '@/lib/flights/legFormat';
import type { LookupOption } from '@/lib/flights/lookupFormState';

// Airline name arrives already resolved by the server (local list → provider → code).
type Option = LookupOption;

function airportLine(a: Option['origin']) {
    return [a.iata, a.city || a.name].filter(Boolean).join(' · ');
}

export function FlightLookupResult({
    options,
    selectedKey,
    onSelect,
}: {
    options: Option[];
    selectedKey: string | null;
    onSelect: (key: string) => void;
}) {
    const t = useTranslations('HomePage.guardian.heroForm.lookup');
    const locale = useLocale();
    const several = options.length > 1;

    return (
        <div className="space-y-2" role="group" aria-label={several ? t('chooseTitle') : t('foundTitle')}>
            <p className="text-sm font-semibold text-slate-700">{several ? t('chooseTitle') : t('foundTitle')}</p>
            {options.map((o) => {
                const selected = o.key === selectedKey;
                return (
                    <div
                        key={o.key}
                        className={`rounded-2xl border p-3 text-sm ${selected ? 'border-emerald-500 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}
                    >
                        <div className="flex items-center gap-2 font-semibold text-slate-900">
                            <PlaneTakeoff className="h-4 w-4 text-slate-500" aria-hidden="true" />
                            {airportLine(o.origin)} → {airportLine(o.destination)}
                        </div>
                        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 text-slate-600">
                            <dt>{t('departs')}</dt>
                            <dd>{formatLocalDateTime(o.departureLocal, locale) ?? '—'}</dd>
                            <dt>{t('arrives')}</dt>
                            <dd>{formatLocalDateTime(o.arrivalLocal, locale) ?? '—'}</dd>
                            {(o as Option & { airlineName?: string | null }).airlineName ? (
                                <>
                                    <dt>{t('airline')}</dt>
                                    <dd>{(o as Option & { airlineName?: string | null }).airlineName}</dd>
                                </>
                            ) : null}
                        </dl>
                        <p className="mt-1 text-xs text-slate-500">{t('localTimes')}</p>
                        <button
                            type="button"
                            onClick={() => onSelect(o.key)}
                            aria-pressed={selected}
                            className={`mt-2 inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold ${selected ? 'bg-emerald-600 text-white' : 'bg-white text-slate-800 border border-slate-300'}`}
                        >
                            {selected ? <Check className="h-3.5 w-3.5" aria-hidden="true" /> : null}
                            {selected ? t('confirmed') : t('confirm')}
                        </button>
                    </div>
                );
            })}
        </div>
    );
}
