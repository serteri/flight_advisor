
import React from 'react';
import { ShieldCheck, Clock, Armchair, Plane, DollarSign } from "lucide-react";
import type { MonitoredTrip, GuardianAlert } from "@prisma/client";

interface DashboardProps {
    trip: MonitoredTrip & { alerts: GuardianAlert[] };
}

export function TravelGuardianDashboard({ trip }: DashboardProps) {

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
                        PNR: <span className="font-mono text-white">{trip.pnr}</span> • {trip.airlineCode}{trip.flightNumber} izleniyor.
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-xs text-slate-400 uppercase tracking-wider">Estimated Protection Value</div>
                    <div className="text-2xl font-black text-emerald-400">~$1,250</div>
                </div>
            </div>

            {/* GRID: AKTİF TARAMALAR (ANIMASYONLU) */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                <StatusCard
                    icon={<Clock />}
                    title="Disruption Hunter"
                    status="Scanning..."
                    desc="Rötar ve İptal takibi aktif."
                    active={trip.watchDelay}
                />
                <StatusCard
                    icon={<Armchair />}
                    title="Upgrade Sniper"
                    status="Searching..."
                    desc="Business Class koltuk aranıyor."
                    active={trip.watchUpgrade}
                />
                <StatusCard
                    icon={<Plane />}
                    title="Schedule Guardian"
                    status="Secure"
                    desc="Tarife değişikliği yok."
                    active={trip.watchSchedule}
                />
                <StatusCard
                    icon={<DollarSign />}
                    title="Price Protection"
                    status="Monitoring"
                    desc="Fiyat düşüşü bekleniyor."
                    active={trip.watchPrice}
                />
                {/* Diğer modüller... */}
            </div>

            {/* ALERTS: AKSİYON MERKEZİ */}
            {trip.alerts && trip.alerts.length > 0 && (
                <div className="space-y-4">
                    <h3 className="text-lg font-bold text-slate-800">🚨 Aksiyon Gerektiren Durumlar</h3>

                    {trip.alerts.map((alert, idx) => (
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
                                        Tahmini Değer: {alert.potentialValue}
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
                <div className="text-xs font-bold text-emerald-600 uppercase tracking-wider animate-pulse mb-1">{status}</div>
                <p className="text-xs text-slate-500">{desc}</p>
            </div>
        </div>
    )
}
