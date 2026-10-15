'use client';

import React from 'react';
import { useLocale, useTranslations } from 'next-intl';
import type { AlertEvent, FlightSegment, GuardianAlert, MonitoredTrip, TripSnapshot } from '@prisma/client';

import { pnrLabel } from '@/lib/guardian/tripBuckets';
import { scheduleDate, scheduleTime } from '@/lib/guardian/flightScheduleDisplay';
import {
    flightState,
    guardianStatus,
    isScheduleChangeEventType,
    lastCheckSummary,
    legacyAlertKind,
    latestMeaningfulChange,
    legacyAlertNeedsAction,
    monitoringDelayState,
    nextScheduledCheck,
    scheduleState,
    type FlightState,
} from '@/lib/guardian/tripPresentation';
import { routeText } from '@/lib/guardian/tripDisplay';
import { actionGuidance, describeChange } from '@/lib/guardian/disruptionContent';
import { airlineActions } from '@/lib/guardian/airlineActions';
import { dayFirstLocale, formatCheckTime } from '@/lib/guardian/checkTimeFormat';

export type GuardianCardSegment = FlightSegment & {
    scheduledDepartureLocal?: string | null;
    scheduledArrivalLocal?: string | null;
};

export interface GuardianCardTrip extends MonitoredTrip {
    alerts: GuardianAlert[];
    segments: GuardianCardSegment[];
    snapshot: TripSnapshot | null;
    alertEvents: AlertEvent[];
    scheduledChecks?: Array<{ kind: string; runAt: Date | string; status: string }>;
}

interface DashboardProps {
    trip: GuardianCardTrip;
}

const FLIGHT_STATE_STYLE: Record<FlightState, string> = {
    ON_TIME: 'bg-emerald-100 text-emerald-800 border-emerald-200',
    DELAYED: 'bg-amber-100 text-amber-800 border-amber-200',
    CANCELLED: 'bg-red-100 text-red-800 border-red-200',
    NOT_VERIFIED: 'bg-slate-100 text-slate-700 border-slate-200',
    UNABLE_TO_VERIFY: 'bg-slate-100 text-slate-700 border-slate-200',
};

export function TravelGuardianDashboard({ trip }: DashboardProps) {
    const t = useTranslations('GuardianV2');
    const locale = useLocale();

    const first = trip.segments[0];
    const last = trip.segments[trip.segments.length - 1];
    const unavailable = t('times.notAvailable');
    const flightNumber = first ? `${first.airlineCode}${first.flightNumber}` : null;
    const route = first && last ? routeText(first.origin, last.destination) : null;
    const delayMinutes = trip.snapshot?.delayMinutes ?? 0;

    const state = flightState(trip);
    const guardian = guardianStatus(trip);
    const next = nextScheduledCheck(trip.scheduledChecks);
    const lastCheck = lastCheckSummary(trip);
    const hasScheduleEvent = trip.alertEvents.some((event) => isScheduleChangeEventType(event.eventType))
        || trip.alerts.some((alert) => alert.type === 'SCHEDULE_CHANGE');
    const schedule = scheduleState(trip, hasScheduleEvent);
    const delayState = monitoringDelayState(trip.alertEvents);

    const flightAlerts = trip.alerts.filter((alert) => legacyAlertKind(alert.type) === 'FLIGHT');
    const actionAlerts = flightAlerts.filter(legacyAlertNeedsAction);
    const change = latestMeaningfulChange(trip);
    const airlineName = airlineActions(first?.airlineCode).airlineName;
    const guidance = actionGuidance(change?.facts ?? null, airlineName);
    const changeText = change ? describeChange(change.facts, {
        flightNumber, airlineCode: first?.airlineCode ?? null, origin: first?.origin ?? null, destination: last?.destination ?? null,
    }).whatChanged : null;
    const needsAction = guidance.required || actionAlerts.length > 0;
    const pnr = pnrLabel(trip.pnr);

    return (
        <div className="p-5 md:p-6">
            {/* FLIGHT FIRST */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{t('productLabel')}</p>
                    <h2 className="mt-1 text-3xl font-black tracking-tight text-slate-900">{flightNumber ?? trip.routeLabel}</h2>
                    {route && <p className="mt-1 text-lg font-semibold text-slate-700">{route}</p>}
                    {first && (
                        <p className="mt-1 text-sm text-slate-500">
                            {scheduleDate(first.scheduledDepartureLocal, dayFirstLocale(locale), unavailable)}
                            {pnr && <span className="ml-2 font-mono text-slate-600">· PNR {pnr}</span>}
                        </p>
                    )}
                    {first && (
                        <p className="mt-2 text-xl font-bold text-slate-900">
                            {scheduleTime(first.scheduledDepartureLocal, unavailable)}
                            <span className="mx-2 text-slate-400" aria-hidden="true">→</span>
                            <span className="sr-only">{t('times.arrives')}</span>
                            {scheduleTime(last?.scheduledArrivalLocal, unavailable)}
                        </p>
                    )}
                </div>
                <span className={`inline-flex w-fit items-center rounded-full border px-3 py-1 text-sm font-bold ${FLIGHT_STATE_STYLE[state]}`}>
                    {t(`flightStatus.${state}`)}
                </span>
            </div>

            <p className="mt-3 text-sm text-slate-600">
                {changeText ?? t(`flightStatus.desc.${state}`, { minutes: delayMinutes })}
            </p>

            {/* GUARDIAN: next check, watching, action */}
            <dl className="mt-5 grid grid-cols-1 gap-4 border-t border-slate-100 pt-4 sm:grid-cols-3">
                <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">
                        {lastCheck.kind === 'NEVER' ? t('check.first') : t('check.next')}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                        {next ? formatCheckTime(next.runAt, locale, first) : t('check.notScheduled')}
                    </dd>
                    {next?.labelKey && <dd className="text-xs text-slate-500">{t(`checkKind.${next.labelKey}`)}</dd>}
                </div>
                <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('check.last')}</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">
                        {lastCheck.kind === 'VERIFIED' && formatCheckTime(lastCheck.at, locale, first)}
                        {lastCheck.kind === 'ATTEMPTED' && t('check.attempted', { time: formatCheckTime(lastCheck.at, locale, first) })}
                        {lastCheck.kind === 'NEVER' && t('check.notChecked')}
                    </dd>
                </div>
                <div>
                    <dt className="text-xs font-bold uppercase tracking-wider text-slate-500">{t('guardianStatus.title')}</dt>
                    <dd className="mt-1 text-sm font-semibold text-slate-900">{t(`guardianStatus.${guardian}`)}</dd>
                </div>
            </dl>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <p className="text-sm text-slate-600">
                    <span className="font-bold text-slate-500">{t('watching.title')}: </span>
                    {[
                        trip.watchDelay && t('watching.delay'),
                        t('watching.cancellation'),
                        trip.watchSchedule && t('watching.schedule'),
                        trip.watchSchedule && t('watching.gate'),
                    ].filter(Boolean).join(' · ')}
                </p>
                <p className={`text-sm font-bold ${needsAction ? 'text-red-700' : 'text-emerald-700'}`}>
                    {guidance.required ? guidance.summary : needsAction ? t('action.needed') : t('action.none')}
                </p>
            </div>

            <p className="mt-2 text-xs text-slate-500">
                <span className="font-bold">{t('schedule.title')}: </span>
                {t(`schedule.${schedule}`)}. {t(`schedule.desc.${schedule}`)}
            </p>

            {delayState === 'DELAYED' && (
                <div role="status" className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                    <p className="font-semibold">{t('monitoringDelay.title')}</p>
                    <p>{t('monitoringDelay.text')}</p>
                </div>
            )}

            {actionAlerts.length > 0 && (
                <div className="mt-4 space-y-2">
                    {actionAlerts.map((alert) => (
                        <div key={alert.id} className="rounded-xl border-l-4 border-red-400 bg-red-50 p-3 text-red-900">
                            <p className="font-bold">{alert.title}</p>
                            <p className="text-sm">{alert.message}</p>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
