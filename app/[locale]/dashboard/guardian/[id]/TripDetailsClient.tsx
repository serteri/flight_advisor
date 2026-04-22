'use client';

import { Link } from '@/i18n/routing';
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

type TripDetailsClientProps = {
    locale: string;
    trip: {
        id: string;
        pnr: string;
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

const formatDateTime = (value?: Date | string | null) => {
    if (!value) return 'Unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleString('en-US', {
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
};

const formatDate = (value?: Date | string | null) => {
    if (!value) return 'Unknown';
    const parsed = new Date(value);
    if (Number.isNaN(parsed.getTime())) return 'Unknown';
    return parsed.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
    });
};

const toStatusLabel = (snapshotStatus?: string | null, delayMinutes?: number) => {
    const normalized = (snapshotStatus || '').toLowerCase();
    if (normalized.includes('cancel')) return 'Cancelled';
    if (delayMinutes && delayMinutes > 0) return `Delayed (${delayMinutes}m)`;
    if (!snapshotStatus) return 'Unknown';
    if (normalized.includes('scheduled')) return 'On time';
    return snapshotStatus;
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
            ? 'EUR 250 - 600 (estimate)'
            : 'EUR 250 (possible minimum, estimate)'
        : eu261State === 'NOT_ELIGIBLE'
            ? 'No current payout signal'
            : 'Unknown (needs more disruption data)';

    const eu261Explanation = eu261State === 'ELIGIBLE'
        ? 'Guardian detected a disruption pattern that may satisfy EU261 criteria.'
        : eu261State === 'NOT_ELIGIBLE'
            ? 'No qualifying cancellation or long-delay pattern is currently confirmed.'
            : 'Eligibility is unknown because Guardian has not gathered enough verified disruption evidence yet.';

    const recentChanges = [
        ...trip.alerts.slice(0, 5).map((alert) => ({
            id: alert.id,
            when: formatDateTime(alert.createdAt),
            type: alert.type,
            text: `${alert.title}: ${alert.message}`,
            severity: alert.severity,
        })),
        ...(snapshot?.gateDetail
            ? [{
                id: 'gate-detail',
                when: formatDateTime(snapshot.snapshotAt),
                type: 'GATE_UPDATE',
                text: snapshot.gateDetail,
                severity: 'INFO',
            }]
            : []),
        ...(snapshot?.statusDetail
            ? [{
                id: 'status-detail',
                when: formatDateTime(snapshot.snapshotAt),
                type: 'STATUS_UPDATE',
                text: snapshot.statusDetail,
                severity: 'INFO',
            }]
            : []),
    ].slice(0, 6);

    const checks = [
        { label: 'Disruption Hunter', enabled: trip.watchDelay },
        { label: 'Schedule Guardian', enabled: trip.watchSchedule },
        { label: 'Price Protection', enabled: trip.watchPrice },
        { label: 'Seat Watch', enabled: trip.watchSeat },
        { label: 'Upgrade Watch', enabled: trip.watchUpgrade },
    ];

    const alertsTriggered = trip.alerts.length;
    const unreadAlerts = trip.alerts.filter((alert) => !alert.isRead).length;
    const latestRunAt = trip.lastCheckedAt || snapshot?.snapshotAt || null;

    const channelState = Array.from(
        trip.deliveries.reduce((map, delivery) => {
            const key = delivery.channel.toUpperCase();
            if (!map.has(key)) {
                map.set(key, delivery);
            }
            return map;
        }, new Map<string, TripDetailsClientProps['trip']['deliveries'][number]>()),
    ).map(([channel, delivery]) => ({
        channel,
        status: delivery.status,
        lastSent: delivery.sentAt,
        updatedAt: delivery.updatedAt,
    }));

    const latestNotification = trip.deliveries
        .filter((item) => item.sentAt)
        .sort((a, b) => new Date(b.sentAt as Date | string).getTime() - new Date(a.sentAt as Date | string).getTime())[0] || null;
    const latestNotificationType = parseNotificationType(latestNotification?.eventId);
    const latestAlertSummary = trip.alerts[0]
        ? `${trip.alerts[0].title}: ${trip.alerts[0].message}`
        : 'No alert summary is available yet for the latest notification.';

    return (
        <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
            <div className="max-w-6xl mx-auto px-4 md:px-6 py-10 space-y-6">
                <Link href={`/${locale}/dashboard/guardian`} className="inline-flex items-center gap-2 text-sm text-slate-500 hover:text-sky-600 transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Back to booked trip monitoring
                </Link>

                <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 md:p-8 space-y-5">
                    <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-5">
                        <div>
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Booked trip monitoring</div>
                            <h1 className="text-2xl md:text-3xl font-black text-slate-900">{trip.routeLabel}</h1>
                            <div className="flex flex-wrap gap-3 text-sm text-slate-500 mt-2">
                                <span>PNR: {trip.pnr || 'Unknown (unconfirmed)'}</span>
                                <span className="text-slate-300">•</span>
                                <span>Departure: {formatDate(firstSegment?.departureDate)}</span>
                                <span className="text-slate-300">•</span>
                                <span>Airline: {airlines.length > 0 ? airlines.join(', ') : 'Unknown'}</span>
                            </div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 min-w-full lg:min-w-[280px]">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Current flight status</div>
                            <div className="text-2xl font-black text-slate-900">{currentFlightStatus}</div>
                            <div className="text-sm text-slate-500 mt-1">Last checked: {formatDateTime(latestRunAt)}</div>
                            <div className="text-sm text-slate-500">Next check: {formatDateTime(trip.nextCheckAt)}</div>
                        </div>
                    </div>

                    <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900">
                        <div className="font-semibold mb-1">Data honesty</div>
                        <p>Guardian can only show verified values from latest monitoring runs. Unknown fields are shown as unknown and are not inferred as confirmed facts.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Delay risk</div>
                            <div className="text-lg font-black text-slate-900">{delayRisk}</div>
                            <div className="text-sm text-slate-500 mt-1">Current delay: {snapshot ? `${delayMinutes} min` : 'Unknown'}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Cancellation risk</div>
                            <div className="text-lg font-black text-slate-900">{cancellationFlag ? 'HIGH' : 'LOW'}</div>
                            <div className="text-sm text-slate-500 mt-1">Signal: {cancellationFlag ? 'Cancellation indicators found' : 'No cancellation indicator yet'}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Disruption flags</div>
                            <div className="text-lg font-black text-slate-900">{overallRisk}</div>
                            <div className="text-sm text-slate-500 mt-1">{delayFlag ? 'Delay flag' : 'No delay flag'} • {scheduleFlag ? 'Schedule/gate change flag' : 'No schedule flag'}</div>
                        </div>
                        <div className="rounded-2xl border border-slate-200 p-4">
                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Guardian loop</div>
                            <div className="text-lg font-black text-slate-900">Every {trip.checkFrequency} min</div>
                            <div className="text-sm text-slate-500 mt-1">Alerts triggered: {alertsTriggered}</div>
                        </div>
                    </div>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    <div className="lg:col-span-2 space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Plane className="w-5 h-5 text-sky-600" />
                                <h2 className="text-lg font-bold text-slate-900">Trip summary</h2>
                            </div>
                            <div className="space-y-3">
                                {trip.segments.length > 0 ? trip.segments.map((segment) => (
                                    <div key={segment.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                                            <div>
                                                <div className="text-sm font-bold text-slate-900 flex items-center gap-2">
                                                    {segment.origin} <ArrowRight className="w-4 h-4 text-slate-400" /> {segment.destination}
                                                </div>
                                                <div className="text-sm text-slate-500 mt-1">
                                                    {segment.airlineCode}{segment.flightNumber} • Cabin: {segment.cabinClass || 'Unknown'}
                                                </div>
                                            </div>
                                            <div className="text-sm text-slate-600">
                                                <div>Dep: {formatDateTime(segment.departureDate)}</div>
                                                <div>Arr: {formatDateTime(segment.arrivalDate)}</div>
                                            </div>
                                        </div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">No segment data available.</div>
                                )}
                            </div>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Euro className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-900">EU261 status</h2>
                            </div>
                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Eligibility</div>
                                    <div className="text-lg font-black text-slate-900">{eu261State}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Estimated compensation</div>
                                    <div className="text-lg font-black text-slate-900">{compensationRange}</div>
                                </div>
                                <div className="rounded-2xl border border-slate-200 p-4">
                                    <div className="text-xs uppercase tracking-wider font-bold text-slate-500 mb-1">Data quality</div>
                                    <div className="text-lg font-black text-slate-900">{snapshot?.dataQuality || 'UNKNOWN'}</div>
                                </div>
                            </div>
                            <p className="text-sm text-slate-700">{eu261Explanation}</p>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-600" />
                                <h2 className="text-lg font-bold text-slate-900">Recent changes</h2>
                            </div>
                            {recentChanges.length > 0 ? (
                                <div className="space-y-3">
                                    {recentChanges.map((item) => (
                                        <div key={item.id} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                            <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{item.type} • {item.when}</div>
                                            <p className="text-sm text-slate-800 mt-1">{item.text}</p>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">No recent disruption/change event has been detected yet.</div>
                            )}
                        </div>
                    </div>

                    <div className="space-y-6">
                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <ShieldCheck className="w-5 h-5 text-emerald-600" />
                                <h2 className="text-lg font-bold text-slate-900">Guardian activity</h2>
                            </div>
                            <ul className="space-y-3 text-sm text-slate-700">
                                <li className="flex items-start gap-2">
                                    <Clock className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>Last monitoring run: {formatDateTime(latestRunAt)}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <CheckCircle2 className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>What was checked: {checks.filter((item) => item.enabled).map((item) => item.label).join(', ') || 'No active checks configured'}</span>
                                </li>
                                <li className="flex items-start gap-2">
                                    <Bell className="w-4 h-4 mt-0.5 text-slate-400" />
                                    <span>{alertsTriggered > 0 ? `${alertsTriggered} alerts triggered (${unreadAlerts} unread).` : 'No alerts triggered yet.'}</span>
                                </li>
                            </ul>
                        </div>

                        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm p-6 space-y-4">
                            <div className="flex items-center gap-2">
                                <Bell className="w-5 h-5 text-sky-600" />
                                <h2 className="text-lg font-bold text-slate-900">Notification status</h2>
                            </div>
                            <div className="space-y-3">
                                {channelState.length > 0 ? channelState.map((channel) => (
                                    <div key={channel.channel} className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                        <div className="text-xs uppercase tracking-wider font-bold text-slate-500">{channel.channel}</div>
                                        <div className="text-sm text-slate-800 mt-1">State: {channel.status || 'Unknown'}</div>
                                        <div className="text-xs text-slate-500 mt-1">Last sent: {formatDateTime(channel.lastSent)}</div>
                                    </div>
                                )) : (
                                    <div className="rounded-2xl border border-slate-200 p-4 text-sm text-slate-500">No notification delivery records yet.</div>
                                )}
                            </div>
                            <div className="text-sm text-slate-600">
                                Last notification sent: {latestNotification ? formatDateTime(latestNotification.sentAt) : 'Unknown'}
                            </div>
                            <div className="rounded-2xl border border-slate-200 p-4 bg-slate-50">
                                <div className="text-xs uppercase tracking-wider font-bold text-slate-500">Latest notification detail</div>
                                <div className="text-sm text-slate-800 mt-1">Type: {latestNotification ? latestNotificationType : 'UNKNOWN'}</div>
                                <div className="text-sm text-slate-800 mt-1">Summary: {latestNotification ? latestAlertSummary : 'Unknown'}</div>
                            </div>
                        </div>

                        <div className="bg-slate-900 rounded-3xl p-6 text-white">
                            <div className="text-xs uppercase tracking-wider font-bold text-sky-300 mb-2">What happens next</div>
                            <p className="text-sm text-slate-200 leading-relaxed">
                                Guardian will run the next monitoring cycle at {formatDateTime(trip.nextCheckAt)}. If disruption risk increases or eligibility changes, an alert and notification record will be created.
                            </p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
