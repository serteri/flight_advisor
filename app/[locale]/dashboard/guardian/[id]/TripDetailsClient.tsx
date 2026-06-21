'use client';

import { useParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useTranslations } from 'next-intl';
import { useRouter } from '@/i18n/routing';
import {
    AlertTriangle,
    ArrowLeft,
    ArrowRight,
    Bell,
    CheckCircle2,
    Clock,
    Euro,
    Plane,
    ShieldCheck,
} from 'lucide-react';
import { AIRLINE_CLAIM_PORTALS, getAirlineClaimUrl } from '@/lib/airlineClaimPortals';
import { TripAuditLog } from '@/components/guardian/TripAuditLog';
import { CompensationCard } from '@/components/guardian/CompensationCard';

type TripDetailsClientProps = {
    locale: string;
    trip: {
        id: string;
        pnr: string | null;
        routeLabel: string;
        status: string;
        lastCheckedAt: Date | string | null;
        nextCheckAt: Date | string;
        checkFrequency: number;
        watchDelay: boolean;
        watchSchedule: boolean;
        watchPrice: boolean;
        watchSeat: boolean;
        watchUpgrade: boolean;
        segments: Array<{
            id: string;
            segmentOrder: number;
            airlineCode: string;
            flightNumber: string;
            origin: string;
            destination: string;
            departureDate: Date | string;
            arrivalDate: Date | string;
            cabinClass: string | null;
        }>;
        alerts: Array<{
            id: string;
            type: string;
            title: string;
            message: string;
            severity: string;
            isRead: boolean;
            createdAt: Date | string;
        }>;
        alertEvents: Array<{
            id: string;
            eventType: string;
            state: string;
            severity: string;
            title: string;
            message: string;
            detectedAt: Date | string;
            queuedAt: Date | string | null;
            sentAt: Date | string | null;
            deliveredAt: Date | string | null;
            failedAt: Date | string | null;
            suppressionReason: string | null;
            deliveries: Array<{
                id: string;
                channel: string;
                status: string;
                attempt: number;
                maxAttempts: number;
                lastError: string | null;
                nextRetryAt: Date | string | null;
                sentAt: Date | string | null;
                updatedAt: Date | string;
            }>;
        }>;
        snapshot: {
            delayMinutes: number;
            status: string;
            dataQuality: string;
            departureGate: string | null;
            arrivalGate: string | null;
            statusDetail: string | null;
            gateDetail: string | null;
            eu261Eligible: boolean;
            snapshotAt: Date | string;
        } | null;
        deliveries: Array<{
            id: string;
            eventId: string;
            channel: string;
            status: string;
            sentAt: Date | string | null;
            updatedAt: Date | string;
        }>;
    };
};

const LOCALE_MAP: Record<string, string> = {
    en: 'en-US',
    tr: 'tr-TR',
    de: 'de-DE',
};

const formatDateTime = (value: Date | string | null | undefined, intlLocale: string, unknownLabel: string) => {
    if (!value) return unknownLabel;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return unknownLabel;
    return parsed.toLocaleString(intlLocale, {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDate = (value: Date | string | null | undefined, intlLocale: string, unknownLabel: string) => {
    if (!value) return unknownLabel;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return unknownLabel;
    return parsed.toLocaleDateString(intlLocale, {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const formatTime = (value: Date | string | null | undefined, intlLocale: string, unknownLabel: string) => {
    if (!value) return unknownLabel;
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return unknownLabel;
    return parsed.toLocaleTimeString(intlLocale, {
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const toRiskLevel = (delayMinutes: number, cancellationRisk: number) => {
    const delayRisk = delayMinutes >= 120 ? 3 : delayMinutes >= 45 ? 2 : delayMinutes > 0 ? 1 : 0;
    const score = Math.max(delayRisk, cancellationRisk);
    if (score >= 3) return 'HIGH';
    if (score >= 2) return 'MEDIUM';
    return 'LOW';
};

const parseNotificationType = (eventId?: string | null): string => {
    if (!eventId) return 'UNKNOWN';
    const parts = eventId.split(':');
    return (parts[1] || 'UNKNOWN').toUpperCase();
};

export function TripDetailsClient({ trip, locale }: TripDetailsClientProps) {
    const t = useTranslations('GuardianTripDetails');
    const router = useRouter();
    const params = useParams<{ locale?: string | string[] }>();
    const [isClearingStale, setIsClearingStale] = useState(false);
    const [isDeletingTrip, setIsDeletingTrip] = useState(false);
    const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
    const [deleteTripError, setDeleteTripError] = useState<string | null>(null);
    const [deleteTripSuccess, setDeleteTripSuccess] = useState<string | null>(null);
    const [claimCopyState, setClaimCopyState] = useState<'idle' | 'copying' | 'copied' | 'failed'>('idle');
    const localeParam = Array.isArray(params?.locale) ? params.locale[0] : params?.locale;
    const safeLocale = (localeParam || locale || 'en').replace(/^\/+/, '');
    const intlLocale = LOCALE_MAP[safeLocale] || 'en-US';
    const backLinkHref = '/dashboard/guardian';

    const unknownLabel = t('unknown');
    const dt = (value: Date | string | null | undefined) => formatDateTime(value, intlLocale, unknownLabel);
    const d = (value: Date | string | null | undefined) => formatDate(value, intlLocale, unknownLabel);
    const tm = (value: Date | string | null | undefined) => formatTime(value, intlLocale, unknownLabel);

    const toStatusLabel = (snapshotStatus?: string | null, delayMinutes?: number) => {
        const normalized = (snapshotStatus || '').toLowerCase();
        if (normalized.includes('cancel')) return t('status.cancelled');
        if (delayMinutes && delayMinutes > 0) return t('status.delayed', { minutes: delayMinutes });
        if (!snapshotStatus) return t('status.unknown');
        if (normalized.includes('scheduled')) return t('status.onTime');
        return snapshotStatus;
    };

    useEffect(() => {
        console.log('locale value:', locale);
        console.log('locale param value:', localeParam);
        console.log('back link href:', backLinkHref);
    }, [locale, localeParam, backLinkHref]);

    const firstSegment = trip.segments[0] || null;
    const airlines = Array.from(new Set(trip.segments.map((segment) => segment.airlineCode))).filter(Boolean);

    const snapshot = trip.snapshot;
    const delayMinutes = snapshot?.delayMinutes ?? 0;
    const currentFlightStatus = toStatusLabel(snapshot?.status, delayMinutes);

    const cancellationFlag =
        (snapshot?.status || '').toLowerCase().includes('cancel') ||
        trip.alerts.some((alert) => /cancel/i.test(alert.type) || /cancel/i.test(alert.title));

    const delayFlag = delayMinutes > 0 || trip.alerts.some((alert) => /delay/i.test(alert.type) || /delay/i.test(alert.title));
    const scheduleFlag = trip.alerts.some((alert) => /schedule|gate/i.test(alert.type) || /schedule|gate/i.test(alert.title));

    const cancellationRisk = cancellationFlag ? 3 : scheduleFlag ? 2 : 1;
    const delayRisk = delayMinutes >= 120 ? 'HIGH' : delayMinutes >= 45 ? 'MEDIUM' : delayMinutes > 0 ? 'LOW' : 'LOW';
    const overallRisk = toRiskLevel(delayMinutes, cancellationRisk);

    const eu261State = snapshot
        ? snapshot.eu261Eligible
            ? 'ELIGIBLE'
            : 'NOT_ELIGIBLE'
        : 'UNKNOWN';

    const compensationRange = eu261State === 'ELIGIBLE'
        ? delayMinutes >= 180 || cancellationFlag
            ? t('compensation.eligibleHigh')
            : t('compensation.eligibleLow')
        : eu261State === 'NOT_ELIGIBLE'
            ? t('compensation.notEligible')
            : t('compensation.unknown');

    const eu261Explanation = eu261State === 'ELIGIBLE'
        ? t('explanation.eligible')
        : eu261State === 'NOT_ELIGIBLE'
            ? t('explanation.notEligible')
            : t('explanation.unknown');

    const hasDisruptionDetected = cancellationFlag || delayFlag || scheduleFlag;
    const hasSevereDisruption =
        cancellationFlag ||
        trip.status === 'CANCELLED' ||
        trip.alertEvents.some((event) => event.severity === 'HIGH');
    const shouldShowClaimSection =
        eu261State === 'ELIGIBLE' ||
        hasDisruptionDetected ||
        (trip.lastCheckedAt !== null &&
            trip.lastCheckedAt !== undefined);
    const airlineCodeForClaim = (firstSegment?.airlineCode || '').trim().toUpperCase();
    const airlineNameForClaim =
        AIRLINE_CLAIM_PORTALS[airlineCodeForClaim]?.name ||
        (airlineCodeForClaim ? t('airlineFallback', { code: airlineCodeForClaim }) : t('airlineFallback', { code: '' }));
    const claimUrl = getAirlineClaimUrl(airlineCodeForClaim, airlineNameForClaim);

    const routeHero = firstSegment && trip.segments.length > 0
        ? `${firstSegment.origin} → ${trip.segments[trip.segments.length - 1].destination}`
        : trip.routeLabel;

    const statusBadge = cancellationFlag
        ? {
            label: t('statusBadge.cancelled'),
            classes: 'bg-red-100 text-red-700 border-red-200',
        }
        : delayMinutes > 0
            ? {
                label: t('statusBadge.delayed'),
                classes: 'bg-amber-100 text-amber-700 border-amber-200',
            }
            : {
                label: t('statusBadge.onTime'),
                classes: 'bg-emerald-100 text-emerald-700 border-emerald-200',
            };

    const delayRiskClasses = delayRisk === 'HIGH'
        ? 'bg-red-50 border-red-200 text-red-700'
        : delayRisk === 'MEDIUM'
            ? 'bg-amber-50 border-amber-200 text-amber-700'
            : 'bg-emerald-50 border-emerald-200 text-emerald-700';

    const cancellationRiskClasses = cancellationFlag
        ? 'bg-red-50 border-red-200 text-red-700'
        : 'bg-emerald-50 border-emerald-200 text-emerald-700';

    const eu261BadgeClasses = eu261State === 'ELIGIBLE'
        ? 'bg-emerald-100 text-emerald-700 border-emerald-200'
        : eu261State === 'NOT_ELIGIBLE'
            ? 'bg-slate-100 text-slate-700 border-slate-200'
            : 'bg-amber-100 text-amber-700 border-amber-200';



    const firstDepartureMs = firstSegment ? new Date(firstSegment.departureDate).getTime() : NaN;
    const hoursUntilDeparture = Number.isNaN(firstDepartureMs)
        ? null
        : (firstDepartureMs - Date.now()) / (1000 * 60 * 60);
    const canShowGateNumbers = hoursUntilDeparture === null || hoursUntilDeparture <= 24;

    const recentChanges = [
        ...trip.alertEvents.slice(0, 5).map((alert) => ({
            id: alert.id,
            when: dt(alert.detectedAt),
            type: alert.eventType,
            text: `${alert.title}: ${alert.message} State: ${alert.state}.`,
            severity: alert.severity,
        })),
        ...trip.alerts.slice(0, 5).map((alert) => ({
            id: alert.id,
            when: dt(alert.createdAt),
            type: alert.type,
            text: `${alert.title}: ${alert.message}`,
            severity: alert.severity,
        })),
        ...(snapshot?.gateDetail
            ? [{
                id: 'gate-detail',
                when: dt(snapshot.snapshotAt),
                type: 'GATE_UPDATE',
                text: snapshot.gateDetail,
                severity: 'INFO',
            }]
            : []),
        ...(snapshot?.statusDetail
            ? [{
                id: 'status-detail',
                when: dt(snapshot.snapshotAt),
                type: 'STATUS_UPDATE',
                text: snapshot.statusDetail,
                severity: 'INFO',
            }]
            : []),
    ].slice(0, 6);

    const checks = [
        { label: t('checks.disruptionHunter'), enabled: trip.watchDelay },
        { label: t('checks.scheduleGuardian'), enabled: trip.watchSchedule },
        { label: t('checks.seatWatch'), enabled: trip.watchSeat },
        { label: t('checks.upgradeWatch'), enabled: trip.watchUpgrade },
    ];

    const alertsTriggered = trip.alertEvents.filter((alert) => alert.state !== 'SUPPRESSED').length || trip.alerts.length;
    const unreadAlerts = trip.alerts.filter((alert) => !alert.isRead).length;
    const latestRunAt = trip.lastCheckedAt || snapshot?.snapshotAt || null;

    const lifecycleDeliveries = trip.alertEvents.flatMap((alert) => alert.deliveries);
    const deliveryRows = lifecycleDeliveries.length > 0 ? lifecycleDeliveries : trip.deliveries;

    const channelState = Array.from(
        deliveryRows.reduce((map, delivery) => {
            const key = delivery.channel.toUpperCase();
            if (!map.has(key)) {
                map.set(key, delivery);
            }
            return map;
        }, new Map<string, (typeof deliveryRows)[number]>()),
    ).map(([channel, delivery]) => ({
        channel,
        status: delivery.status,
        lastSent: delivery.sentAt,
        updatedAt: delivery.updatedAt,
        attempt: 'attempt' in delivery ? delivery.attempt : undefined,
        maxAttempts: 'maxAttempts' in delivery ? delivery.maxAttempts : undefined,
    }));

    const latestNotification = trip.deliveries
        .filter((item) => item.sentAt)
        .sort((a, b) => new Date(b.sentAt as Date | string).getTime() - new Date(a.sentAt as Date | string).getTime())[0] || null;
    const latestNotificationType = parseNotificationType(latestNotification?.eventId);
    const latestAlertSummary = trip.alerts[0]
        ? `${trip.alerts[0].title}: ${trip.alerts[0].message}`
        : t('notifications.noSummary');
    const latestLifecycleAlert = trip.alertEvents[0] || null;

    const clearStaleAlerts = async () => {
        if (isClearingStale) return;
        setIsClearingStale(true);
        try {
            const response = await fetch(`/api/guardian/${trip.id}/alerts/stale`, {
                method: 'DELETE',
            });
            if (!response.ok) {
                throw new Error('Failed to clear stale alerts.');
            }
            router.refresh();
        } catch (error) {
            console.error('[GUARDIAN] Failed to clear stale alerts', error);
        } finally {
            setIsClearingStale(false);
        }
    };

    const deleteTrip = async () => {
        if (isDeletingTrip) return;

        setIsDeletingTrip(true);
        setDeleteTripError(null);
        try {
            const response = await fetch(`/api/guardian/${trip.id}`, {
                method: 'DELETE',
            });

            if (!response.ok) {
                throw new Error('Failed to delete trip.');
            }

            setDeleteTripSuccess(t('modal.tripRemoved'));
            setTimeout(() => {
                router.push(backLinkHref);
                router.refresh();
            }, 900);
        } catch (error) {
            console.error('[GUARDIAN] Failed to delete trip', error);
            setDeleteTripError(t('modal.deleteFailed'));
        } finally {
            setIsDeletingTrip(false);
        }
    };

    const copyClaimLetter = async () => {
        if (claimCopyState === 'copying') return;

        const segmentForClaim = firstSegment;
        if (!segmentForClaim) {
            setClaimCopyState('failed');
            return;
        }

        setClaimCopyState('copying');
        try {
            const delayHours = delayMinutes > 0 ? Math.round((delayMinutes / 60) * 10) / 10 : undefined;
            const response = await fetch('/api/compensation/generate-letter', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    passengerName: 'Passenger',
                    flightDetails: {
                        flightNumber: `${segmentForClaim.airlineCode}${segmentForClaim.flightNumber}`,
                        origin: segmentForClaim.origin,
                        destination: segmentForClaim.destination,
                        scheduledDate: d(segmentForClaim.departureDate),
                        delayHours,
                        regulation: 'EU261',
                    },
                }),
            });

            if (!response.ok) {
                setClaimCopyState('failed');
                return;
            }

            const letter = await response.text();
            await navigator.clipboard.writeText(letter);
            setClaimCopyState('copied');
        } catch (error) {
            console.error('[GUARDIAN] Failed to copy claim letter', error);
            setClaimCopyState('failed');
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
                <button
                    type="button"
                    onClick={() => router.back()}
                    className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors"
                >
                    <ArrowLeft className="w-4 h-4" /> {t('back')}
                </button>

                {hasSevereDisruption && <CompensationCard />}

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-6">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-6">
                        <div className="space-y-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{t('header.label')}</div>
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight text-slate-900">{routeHero}</h1>
                            <div className="flex flex-wrap items-center gap-3">
                                <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-900 text-xs font-bold text-white">
                                        {firstSegment?.airlineCode || 'QF'}
                                    </span>
                                    <span className="text-sm font-semibold text-slate-700">{t('header.airlineBadge')}</span>
                                </div>
                                <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${statusBadge.classes}`}>
                                    {statusBadge.label}
                                </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-3 text-sm text-slate-500">
                                <span>{t('header.pnr', { pnr: trip.pnr || t('header.pnrUnknown') })}</span>
                                <span className="text-slate-300">•</span>
                                <span>{t('header.airline', { airlines: airlines.length > 0 ? airlines.join(', ') : t('unknown') })}</span>
                            </div>
                        </div>

                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-5 min-w-full lg:min-w-[320px] shadow-sm">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('departureCard.label')}</div>
                            <div className="text-2xl md:text-3xl font-black text-slate-900">{d(firstSegment?.departureDate)}</div>
                            <div className="text-sm text-slate-600 mt-2">{t('departureCard.flightStatus')} <span className="font-semibold text-slate-800">{currentFlightStatus}</span></div>
                            {snapshot && canShowGateNumbers && (
                                <div className="flex flex-wrap gap-3 mt-2">
                                    {snapshot.departureGate && (
                                        <span className="text-sm text-slate-700">{t('departureCard.depGate')} <span className="font-bold">{snapshot.departureGate}</span></span>
                                    )}
                                    {snapshot.arrivalGate && (
                                        <span className="text-sm text-slate-700">{t('departureCard.arrGate')} <span className="font-bold">{snapshot.arrivalGate}</span></span>
                                    )}
                                </div>
                            )}
                            {snapshot && !canShowGateNumbers && (
                                <div className="text-sm text-slate-600 mt-2">{t('departureCard.gateCloser')}</div>
                            )}
                            {snapshot?.statusDetail && (
                                <div className="text-sm text-slate-600 mt-1 italic">{snapshot.statusDetail}</div>
                            )}
                            <div className="text-sm text-slate-500 mt-3">{t('departureCard.lastChecked')} {dt(latestRunAt)}</div>
                            <div className="text-sm text-slate-500">{t('departureCard.nextCheck')} {dt(trip.nextCheckAt)}</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <div className="font-semibold mb-1">{t('honesty.title')}</div>
                        <p>{t('honesty.text')}</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className={`rounded-2xl border p-4 ${delayRiskClasses}`}>
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('kpi.delayRisk')}</div>
                            <div className="text-lg font-black">{delayRisk}</div>
                            <div className="text-sm text-slate-500 mt-1">{t('kpi.currentDelay')} {snapshot ? t('kpi.delayMinutes', { minutes: delayMinutes }) : t('unknown')}</div>
                        </div>
                        <div className={`rounded-2xl border p-4 ${cancellationRiskClasses}`}>
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('kpi.cancellationRisk')}</div>
                            <div className="text-lg font-black">{cancellationFlag ? 'HIGH' : 'LOW'}</div>
                            <div className="text-sm text-slate-500 mt-1">{t('kpi.signal')} {cancellationFlag ? t('kpi.cancellationFound') : t('kpi.cancellationNone')}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('kpi.guardianLoop')}</div>
                            <div className="flex items-center gap-2 text-lg font-black text-slate-900">
                                <Clock className="w-5 h-5 text-sky-600" /> {t('kpi.every6Hours')}
                            </div>
                            <div className="text-sm text-slate-500 mt-1">{t('kpi.currentDisruptionLevel')} {overallRisk}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4 bg-white">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('kpi.alerts')}</div>
                            <div className="flex items-center gap-2">
                                <span className="text-lg font-black text-slate-900">{alertsTriggered}</span>
                                <span className="inline-flex items-center rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-bold text-sky-700">
                                    {t('kpi.active')}
                                </span>
                            </div>
                            <div className="text-sm text-slate-500 mt-1">{t('kpi.unreadLegacy')} {unreadAlerts}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Plane className="w-5 h-5 text-sky-600" />
                                <h2 className="text-lg font-bold text-slate-900">{t('summary.title')}</h2>
                            </div>
                            <div className="space-y-3">
                                {trip.segments.length > 0 ? trip.segments.map((segment) => (
                                    <div key={segment.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                        <div className="flex flex-col gap-4">
                                            <div className="flex items-center justify-between text-xs uppercase tracking-wider text-slate-500 font-bold">
                                                <span>{segment.origin}</span>
                                                <span>{segment.destination}</span>
                                            </div>
                                            <div className="relative">
                                                <div className="h-0.5 w-full bg-slate-200" />
                                                <div className="absolute left-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-sky-600" />
                                                <div className="absolute right-0 top-1/2 h-2.5 w-2.5 -translate-y-1/2 rounded-full bg-emerald-600" />
                                            </div>
                                            <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{t('summary.depTime')}</div>
                                                    <div className="text-base font-bold text-slate-900">{tm(segment.departureDate)}</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{t('summary.flight')}</div>
                                                    <div className="text-base font-bold text-slate-900">{segment.airlineCode}{segment.flightNumber}</div>
                                                </div>
                                                <div className="rounded-xl border border-slate-200 bg-white px-3 py-2">
                                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{t('summary.arrTime')}</div>
                                                    <div className="text-base font-bold text-slate-900">{segment.arrivalDate ? tm(segment.arrivalDate) : '—'}</div>
                                                </div>
                                            </div>
                                            <div className="text-xs text-slate-500">
                                                {t('summary.cabin')} {segment.cabinClass || t('unknown')}
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">{t('summary.noSegments')}</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Euro className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-900">{t('eu261.title')}</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-slate-200 p-4 bg-emerald-50">
                                    <div className="flex items-center gap-2 text-emerald-700">
                                        <CheckCircle2 className="w-5 h-5" />
                                        <div className="text-xs uppercase tracking-wider font-bold">{t('eu261.protectionLabel')}</div>
                                    </div>
                                    <div className="text-lg font-black text-slate-900 mt-2">{eu261State === 'ELIGIBLE' ? t('eu261.protected') : t('eu261.notProtected')}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">{t('eu261.compensation')}</div>
                                    <div className={`font-black text-slate-900 ${eu261State === 'ELIGIBLE' ? 'text-3xl leading-tight' : 'text-lg'}`}>
                                        {compensationRange}
                                    </div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-2">{t('eu261.eligibility')}</div>
                                    <span className={`inline-flex items-center rounded-full border px-3 py-1 text-sm font-bold ${eu261BadgeClasses}`}>
                                        {eu261State}
                                    </span>
                                    <div className="text-xs text-slate-500 mt-2">{t('eu261.dataQuality')} {snapshot?.dataQuality || 'UNKNOWN'}</div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-700">{eu261Explanation}</p>
                        </div>

                        {shouldShowClaimSection && (
                            <div className="bg-white rounded-3xl border border-emerald-200 shadow-sm p-6 space-y-4">
                                <div className="flex items-center gap-2">
                                    <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                    <h2 className="text-lg font-bold text-slate-900">{t('claim.title')}</h2>
                                </div>
                                <p className="text-sm text-slate-700">
                                    {hasDisruptionDetected || eu261State === 'ELIGIBLE'
                                        ? t('claim.readyText')
                                        : t('claim.notReadyText')}
                                </p>

                                <a
                                    href={claimUrl.url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center justify-center rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-bold text-white hover:bg-emerald-700"
                                >
                                    {claimUrl.isKnown
                                        ? t('claim.openPortal', { airline: airlineNameForClaim })
                                        : t('claim.searchPortal', { airline: airlineNameForClaim })}
                                </a>

                                <div className="flex flex-wrap items-center gap-3">
                                    <button
                                        type="button"
                                        onClick={copyClaimLetter}
                                        disabled={claimCopyState === 'copying'}
                                        className="rounded-xl border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                                    >
                                        {claimCopyState === 'copying' ? t('claim.copying') : t('claim.copyLetter')}
                                    </button>
                                    <span className="text-xs text-slate-500">
                                        {claimCopyState === 'copied'
                                            ? t('claim.copied')
                                            : claimCopyState === 'failed'
                                                ? t('claim.failed')
                                                : ''}
                                    </span>
                                </div>

                                <p className="text-xs text-slate-500">
                                    {t('claim.pasteHint')}
                                </p>
                            </div>
                        )}

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <h2 className="text-lg font-bold text-slate-900">{t('changes.title')}</h2>
                            </div>
                            <div className="space-y-3">
                                {recentChanges.length > 0 ? (
                                    <div className="space-y-0">
                                        {recentChanges.map((item) => (
                                            <div key={item.id} className="relative pl-8 pb-5 last:pb-0">
                                                <span className="absolute left-0 top-0 flex h-5 w-5 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                                                    {item.severity === 'CRITICAL' || item.severity === 'HIGH' ? (
                                                        <AlertTriangle className="w-3.5 h-3.5" />
                                                    ) : (
                                                        <CheckCircle2 className="w-3.5 h-3.5" />
                                                    )}
                                                </span>
                                                <span className="absolute left-2 top-6 h-[calc(100%-18px)] w-px bg-slate-200 last:hidden" />
                                                <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{item.type}</div>
                                                    <div className="text-xs text-slate-500 mt-1">{item.when}</div>
                                                    <p className="text-sm text-slate-800 mt-2">{item.text}</p>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                ) : (
                                    <div className="rounded-2xl border border-slate-200 p-6 text-sm text-slate-500 bg-slate-50 flex items-center gap-3">
                                        <Clock className="w-5 h-5 text-slate-400" />
                                        <span>{t('changes.empty')}</span>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="rounded-3xl border border-red-200 bg-white p-6">
                            <button
                                type="button"
                                onClick={() => {
                                    setDeleteTripError(null);
                                    setDeleteTripSuccess(null);
                                    setIsDeleteModalOpen(true);
                                }}
                                disabled={isDeletingTrip}
                                className="inline-flex items-center text-sm font-semibold text-red-600 hover:text-red-700 underline underline-offset-4 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t('stopMonitoring.button')}
                            </button>
                            <p className="mt-2 text-xs text-slate-500">{t('stopMonitoring.desc')}</p>
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-900">{t('activity.title')}</h2>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{t('activity.lastRun')} {dt(latestRunAt)}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{t('activity.checked')} {checks.filter((item) => item.enabled).map((item) => item.label).join(', ') || t('activity.noChecks')}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Bell className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{alertsTriggered > 0 ? t('activity.eventsDetected', { count: alertsTriggered, unread: unreadAlerts }) : t('activity.noEvents')}</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-sky-600" />
                                <h2 className="text-lg font-bold text-slate-900">{t('notifications.title')}</h2>
                            </div>
                            <div className="space-y-3">
                                {channelState.length > 0 ? channelState.map((channel) => (
                                    <div key={channel.channel} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{channel.channel}</div>
                                        <div className="text-sm text-slate-800 mt-1">{t('notifications.state')} {channel.status || t('unknown')}</div>
                                        <div className="text-xs text-slate-500 mt-1">{t('notifications.lastSent')} {dt(channel.lastSent)}</div>
                                        {channel.attempt !== undefined && channel.maxAttempts !== undefined && (
                                            <div className="text-xs text-slate-500 mt-1">{t('notifications.attempts')} {channel.attempt}/{channel.maxAttempts}</div>
                                        )}
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">{t('notifications.noRecords')}</div>
                                )}
                            </div>
                            <div className="text-sm text-slate-600">
                                {t('notifications.lastNotificationSent')} {latestNotification ? dt(latestNotification.sentAt) : t('unknown')}
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{t('notifications.detailTitle')}</div>
                                <div className="text-sm text-slate-800 mt-1">{t('notifications.type')} {latestNotification ? latestNotificationType : 'UNKNOWN'}</div>
                                <div className="text-sm text-slate-800 mt-1">{t('notifications.summary')} {latestLifecycleAlert ? `${latestLifecycleAlert.title}: ${latestLifecycleAlert.message}` : latestNotification ? latestAlertSummary : t('unknown')}</div>
                                <div className="text-sm text-slate-800 mt-1">{t('notifications.lifecycle')} {latestLifecycleAlert?.state || 'UNKNOWN'}</div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 text-white">
                            <div className="text-xs uppercase tracking-wider font-bold text-sky-300 mb-2">{t('nextStep.title')}</div>
                            <p className="text-sm text-slate-200 leading-relaxed">
                                {t('nextStep.text', { time: dt(trip.nextCheckAt) })}
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            <div className="mt-6">
                <TripAuditLog
                    events={trip.alertEvents.map((event) => ({
                        id: event.id,
                        eventType: event.eventType,
                        severity: event.severity,
                        title: event.title,
                        message: event.message,
                        when: dt(event.detectedAt),
                    }))}
                />
            </div>

            {isDeleteModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4">
                    <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl border border-slate-200">
                        <h3 className="text-lg font-bold text-slate-900">{t('modal.title')}</h3>
                        <p className="mt-2 text-sm text-slate-600">
                            {t('modal.desc', { route: trip.routeLabel })}
                        </p>

                        <div className="mt-5 flex items-center justify-end gap-3">
                            <button
                                type="button"
                                onClick={() => {
                                    if (isDeletingTrip) return;
                                    setDeleteTripError(null);
                                    setDeleteTripSuccess(null);
                                    setIsDeleteModalOpen(false);
                                }}
                                disabled={isDeletingTrip}
                                className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {t('modal.cancel')}
                            </button>
                            <button
                                type="button"
                                onClick={deleteTrip}
                                disabled={isDeletingTrip}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-semibold text-white hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
                            >
                                {isDeletingTrip ? t('modal.stopping') : t('modal.stop')}
                            </button>
                        </div>

                        {deleteTripError && (
                            <p className="mt-3 text-sm font-medium text-red-600">{deleteTripError}</p>
                        )}

                        {deleteTripSuccess && (
                            <p className="mt-3 text-sm font-medium text-emerald-600">{deleteTripSuccess}</p>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
