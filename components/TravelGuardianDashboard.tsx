
import React from 'react';
import { ShieldCheck, Clock, Armchair, Plane, DollarSign } from "lucide-react";
import type { AlertEvent, FlightSegment, GuardianAlert, MonitoredTrip, TripSnapshot } from "@prisma/client";
import { useTranslations } from 'next-intl';

import { calculateAirportDistanceKm } from '@/lib/compensation/haversine';

interface DashboardProps {
    trip: MonitoredTrip & {
        alerts: GuardianAlert[];
        segments: FlightSegment[];
        snapshot: TripSnapshot | null;
        alertEvents: AlertEvent[];
    };
}

const parsePotentialValue = (value?: string | null) => {
    if (!value) return { amount: 0, currency: null as string | null };
    const match = value.match(/(\d+[\d.,]*)\s*([A-Z]{3}|€|EUR|USD|AUD|GBP)?/i);
    if (!match) return { amount: 0, currency: null as string | null };

    const amount = Number(match[1].replace(/,/g, ''));
    const rawCurrency = (match[2] || '').toUpperCase();
    const currency = rawCurrency === '€' ? 'EUR' : rawCurrency || null;

    return {
        amount: Number.isFinite(amount) ? amount : 0,
        currency,
    };
};

const estimateEu261Value = (trip: DashboardProps['trip']) => {
    if (!trip.snapshot?.eu261Eligible) return 0;

    const firstSegment = trip.segments[0];
    if (!firstSegment) return 0;

    const distanceKm = calculateAirportDistanceKm(firstSegment.origin, firstSegment.destination);
    if (!distanceKm) return 0;
    if (distanceKm <= 1500) return 250;
    if (distanceKm <= 3500) return 400;
    return 600;
};

const formatValue = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency,
        maximumFractionDigits: 0,
    }).format(amount);
};

export function TravelGuardianDashboard({ trip }: DashboardProps) {
    const t = useTranslations('Guardian');
    const legacyAlerts = trip.alerts || [];
    const lifecycleAlerts = trip.alertEvents || [];
    const snapshot = trip.snapshot;
    const delayMinutes = snapshot?.delayMinutes || 0;
    const hasCancellation = lifecycleAlerts.some((event) => event.eventType === 'CANCELLATION_DETECTED');
    const hasScheduleChange = lifecycleAlerts.some((event) => event.eventType === 'GATE_CHANGE' || event.eventType === 'TERMINAL_CHANGE')
        || legacyAlerts.some((alert) => alert.type === 'SCHEDULE_CHANGE');
    const hasPriceDrop = lifecycleAlerts.some((event) => event.eventType === 'PRICE_DROP' || event.eventType === 'TARGET_PRICE_REACHED')
        || legacyAlerts.some((alert) => alert.type === 'PRICE_DROP');
    const hasUpgradeOpportunity = legacyAlerts.some((alert) => alert.type === 'UPGRADE' || alert.type === 'UPGRADE_OPPORTUNITY');

    const explicitProtection = legacyAlerts.reduce((sum, alert) => sum + parsePotentialValue(alert.potentialValue).amount, 0);
    const firstAlertCurrency = legacyAlerts.map((alert) => parsePotentialValue(alert.potentialValue).currency).find(Boolean) || null;
    const eu261Estimate = estimateEu261Value(trip);
    const protectionAmount = explicitProtection > 0 ? explicitProtection : eu261Estimate;
    const protectionCurrency = explicitProtection > 0
        ? (firstAlertCurrency || trip.currency || 'EUR')
        : eu261Estimate > 0
            ? 'EUR'
            : trip.currency || 'EUR';
    const protectionValueLabel = protectionAmount > 0 ? formatValue(protectionAmount, protectionCurrency) : '--';

    const disruptionStatus = hasCancellation
        ? 'Cancellation detected'
        : delayMinutes > 0
            ? `Delay ${delayMinutes}m`
            : trip.lastCheckedAt
                ? 'Clear'
                : 'Pending first check';
    const disruptionDesc = hasCancellation
        ? 'Guardian recorded a cancellation event for this trip.'
        : delayMinutes > 0
            ? `Latest snapshot shows a ${delayMinutes}-minute delay.`
            : 'No cancellation or material delay has been detected yet.';

    const upgradeStatus = hasUpgradeOpportunity
        ? 'Opportunity found'
        : trip.targetUpgradePrice
            ? `Target ${formatValue(trip.targetUpgradePrice, trip.currency || 'EUR')}`
            : 'No opportunity yet';
    const upgradeDesc = hasUpgradeOpportunity
        ? 'A monitored upgrade-related alert exists for this booking.'
        : trip.targetUpgradePrice
            ? 'Guardian is watching against your configured upgrade threshold.'
            : 'Upgrade monitoring is enabled but no offer has been detected.';

    const scheduleStatus = hasScheduleChange
        ? 'Change detected'
        : snapshot?.status === 'UNKNOWN'
            ? 'Waiting for verified data'
            : 'No change';
    const scheduleDesc = hasScheduleChange
        ? 'Gate or schedule change activity has been recorded.'
        : snapshot?.status === 'UNKNOWN'
            ? 'Schedule data is not yet reliable for this trip.'
            : 'No schedule or gate change is currently recorded.';

    const priceStatus = hasPriceDrop
        ? 'Price drop detected'
        : trip.lastCheckedAt
            ? 'Monitoring active'
            : 'Pending first check';
    const priceDesc = hasPriceDrop
        ? 'A price-related alert exists for this trip.'
        : 'No price protection opportunity is currently recorded.';

    // Renk ve İkon Yardımcıları
    const getSeverityStyle = (severity: string) => {
        switch (severity) {
            case 'CRITICAL': return 'bg-red-50 border-red-200 text-red-800';
            case 'MONEY': return 'bg-emerald-50 border-emerald-200 text-emerald-800'; // Para fırsatı
            case 'WARNING': return 'bg-amber-50 border-amber-200 text-amber-800';
            default: return 'bg-blue-50 border-blue-200 text-blue-800';
        }
    };

    return (
        <div className="max-w-4xl mx-auto p-6">

            {/* HEADER: KORUMA DURUMU */}
            <div className="flex items-center justify-between mb-8 bg-slate-900 text-white p-6 rounded-2xl shadow-lg">
                <div>
                    <h2 className="text-xl font-bold flex items-center gap-2">
                        <ShieldCheck className="text-emerald-400" />
                        Travel Guardian Active
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">
                        PNR: <span className="font-mono text-white">{trip.pnr}</span> • {trip.routeLabel} izleniyor.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Estimated Protection Value</div>
                    <div className="text-2xl font-black text-emerald-400">{protectionValueLabel}</div>
                </div>
            </div>

            {/* GRID: AKTİF TARAMALAR (ANIMASYONLU) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatusCard
                    icon={<Clock />}
                    title="Disruption Hunter"
                    status={disruptionStatus}
                    desc={disruptionDesc}
                    active={trip.watchDelay}
                />
                <StatusCard
                    icon={<Armchair />}
                    title="Upgrade Sniper"
                    status={upgradeStatus}
                    desc={upgradeDesc}
                    active={trip.watchUpgrade}
                />
                <StatusCard
                    icon={<Plane />}
                    title="Schedule Guardian"
                    status={scheduleStatus}
                    desc={scheduleDesc}
                    active={trip.watchSchedule}
                />
                <StatusCard
                    icon={<DollarSign />}
                    title="Price Protection"
                    status={priceStatus}
                    desc={priceDesc}
                    active={trip.watchPrice}
                />
                {/* Diğer modüller... */}
            </div>

            {/* ALERTS: AKSİYON MERKEZİ */}
            {legacyAlerts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">🚨 Aksiyon Gerektiren Durumlar</h3>

                    {legacyAlerts.map((alert, idx) => (
                        <div key={idx} className={`p-4 rounded-xl border-l-4 shadow-sm flex items-start justify-between ${getSeverityStyle(alert.severity)}`}>
                            <div>
                                <h4 className="font-bold flex items-center gap-2">
                                    {alert.severity === 'MONEY' && '💰'}
                                    {alert.severity === 'CRITICAL' && '🚨'}
                                    {alert.title}
                                </h4>
                                <p className="text-sm mt-1 opacity-90">{alert.message}</p>
                                {alert.potentialValue && (
                                    <div className="mt-2 inline-block bg-white/50 px-2 py-1 rounded text-xs font-bold">
                                        {t('estimatedValue')}: {alert.potentialValue}
                                    </div>
                                )}
                            </div>

                            {alert.actionLabel && (
                                <button className="px-4 py-2 bg-white shadow-sm rounded-lg text-sm font-bold hover:bg-gray-50 transition-colors shrink-0 ml-4">
                                    {alert.actionLabel} &rarr;
                                </button>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

function StatusCard({ icon, title, status, desc, active }: any) {
    if (!active) return null; // Don't show inactive modules
    return (
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex items-start gap-3">
            <div className="p-2 bg-slate-100 rounded-lg text-slate-600">
                {icon}
            </div>
            <div>
                <h4 className="font-bold text-slate-900">{title}</h4>
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider mb-1">{status}</div>
                <p className="text-xs text-slate-500">{desc}</p>
            </div>
        </div>
    )
}
