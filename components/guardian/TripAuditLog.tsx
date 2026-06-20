'use client';

import { useTranslations } from 'next-intl';
import { AlertTriangle, CheckCircle2, Clock } from 'lucide-react';

export type TripAuditLogEvent = {
    id: string;
    eventType: string;
    severity: string;
    title: string;
    message: string;
    when: string;
};

type TripAuditLogProps = {
    events: TripAuditLogEvent[];
};

const DISRUPTION_TYPES = new Set([
    'DELAY_DETECTED',
    'CANCELLATION_DETECTED',
    'GATE_CHANGE',
    'TERMINAL_CHANGE',
    'CONNECTION_RISK',
    'EQUIPMENT_CHANGE',
]);

type EventTone = 'disruption-high' | 'disruption-medium' | 'recovered' | 'system';

const getEventTone = (eventType: string, severity: string): EventTone => {
    if (eventType === 'MONITORING_RECOVERED') return 'recovered';
    if (DISRUPTION_TYPES.has(eventType)) {
        return severity === 'HIGH' ? 'disruption-high' : 'disruption-medium';
    }
    return 'system';
};

const TONE_CLASSES: Record<EventTone, { dot: string; card: string; badge: string }> = {
    'disruption-high': {
        dot: 'bg-red-500 ring-red-100',
        card: 'border-red-200 bg-red-50',
        badge: 'border-red-200 bg-red-100 text-red-700',
    },
    'disruption-medium': {
        dot: 'bg-amber-500 ring-amber-100',
        card: 'border-amber-200 bg-amber-50',
        badge: 'border-amber-200 bg-amber-100 text-amber-700',
    },
    recovered: {
        dot: 'bg-emerald-500 ring-emerald-100',
        card: 'border-emerald-200 bg-emerald-50',
        badge: 'border-emerald-200 bg-emerald-100 text-emerald-700',
    },
    system: {
        dot: 'bg-slate-400 ring-slate-100',
        card: 'border-slate-200 bg-slate-50',
        badge: 'border-slate-200 bg-slate-100 text-slate-600',
    },
};

const ToneIcon = ({ tone }: { tone: EventTone }) => {
    if (tone === 'disruption-high' || tone === 'disruption-medium') {
        return <AlertTriangle className="w-3.5 h-3.5" />;
    }
    if (tone === 'recovered') {
        return <CheckCircle2 className="w-3.5 h-3.5" />;
    }
    return <Clock className="w-3.5 h-3.5" />;
};

export function TripAuditLog({ events }: TripAuditLogProps) {
    const t = useTranslations('GuardianTripDetails.auditLog');

    return (
        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
            <div className="flex items-center gap-2">
                <Clock className="w-5 h-5 text-sky-600" />
                <h2 className="text-lg font-bold text-slate-900">{t('title')}</h2>
            </div>

            {events.length === 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
                    {t('empty')}
                </div>
            ) : (
                <ol className="relative space-y-0">
                    {events.map((event, index) => {
                        const tone = getEventTone(event.eventType, event.severity);
                        const classes = TONE_CLASSES[tone];
                        const isLast = index === events.length - 1;
                        const message = event.message || t('checkCompleted');

                        return (
                            <li key={event.id} className="relative pl-8 pb-6 last:pb-0">
                                {!isLast && (
                                    <span className="absolute left-[7px] top-5 h-[calc(100%-8px)] w-px bg-slate-200" />
                                )}
                                <span
                                    className={`absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full ring-4 ${classes.dot}`}
                                />
                                <div className={`rounded-2xl border p-4 ${classes.card}`}>
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-xs font-bold ${classes.badge}`}>
                                            <ToneIcon tone={tone} />
                                            {event.title}
                                        </span>
                                        <span className="text-xs text-slate-500">{event.when}</span>
                                    </div>
                                    <p className="mt-2 text-sm text-slate-700">{message}</p>
                                    {event.eventType === 'EQUIPMENT_CHANGE' && (
                                        <p className="mt-2 text-sm font-semibold text-amber-700">
                                            {t('equipmentChangeNotice')}
                                        </p>
                                    )}
                                </div>
                            </li>
                        );
                    })}
                </ol>
            )}
        </div>
    );
}
