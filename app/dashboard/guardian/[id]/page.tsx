'use client';
import { useState, useEffect } from 'react';
import {
    ArrowLeft, Clock, ShieldCheck, Plane,
    Armchair, DollarSign, AlertTriangle,
    Activity, CheckCircle
} from 'lucide-react';
import Link from 'next/link';

// Componentler
import { SeatAlertCard } from '@/components/alerts/SeatAlertCard';
import { ArbitrageCard } from '@/components/guardian/ArbitrageCard';
import { DisruptionCard } from '@/components/guardian/DisruptionCard';

export default function TripDetailsPage({ params }: { params: { id: string } }) {
    // MOCK VERİ (Gerçekte veritabanından 'params.id' ile çekilecek)
    const trip = {
        id: params.id,
        pnr: 'QLWZE',
        route: 'Brisbane (BNE) ➝ Istanbul (IST)',
        airline: 'Turkish Airlines',
        flightNumber: 'TK1984',
        date: '12 Şubat 2026',
        status: 'ACTIVE',
        lastChecked: 'Az önce',
        originalPrice: 1500,
        currency: 'AUD',
        // AKTİF UYARILAR (Worker bunları bulmuş!)
        alerts: [
            { type: 'DISRUPTION', severity: 'MONEY', value: '600€' }, // 1. Fırsat
            { type: 'SEAT_ALERT', severity: 'WARNING' }               // 2. Uyarı
        ]
    };

    return (
        <div className="min-h-screen bg-slate-50 p-6">
            <div className="max-w-5xl mx-auto">

                {/* NAVİGASYON */}
                <Link href="/dashboard" className="flex items-center gap-2 text-slate-500 hover:text-slate-800 mb-6 font-bold transition-colors">
                    <ArrowLeft className="w-4 h-4" /> Geri Dön
                </Link>

                {/* 1. HEADER (KİMLİK KARTI) */}
                <div className="bg-white rounded-2xl p-6 border border-slate-200 shadow-sm mb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                    <div className="flex items-center gap-4">
                        <div className="w-14 h-14 bg-slate-900 text-white rounded-xl flex items-center justify-center shadow-lg">
                            <Plane className="w-7 h-7" />
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-slate-900">{trip.route}</h1>
                            <div className="flex items-center gap-3 text-slate-500 font-medium text-sm mt-1">
                                <span className="bg-slate-100 px-2 py-0.5 rounded text-slate-700 font-bold">{trip.pnr}</span>
                                <span>{trip.airline} ({trip.flightNumber})</span>
                                <span>•</span>
                                <span>{trip.date}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-3">
                        <div className="text-right hidden md:block">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Sistem Durumu</div>
                            <div className="text-sm font-bold text-emerald-600 flex items-center gap-1 justify-end">
                                <Activity className="w-4 h-4" /> Aktif & Taranıyor
                            </div>
                        </div>
                        <div className="h-10 w-[1px] bg-slate-200 mx-2 hidden md:block"></div>
                        <div className="text-right">
                            <div className="text-[10px] uppercase font-bold text-slate-400">Son Kontrol</div>
                            <div className="text-sm font-bold text-slate-700">{trip.lastChecked}</div>
                        </div>
                    </div>
                </div>

                {/* 2. ACTION CENTER (AKSİYON GEREKTİRENLER) */}
                {trip.alerts.length > 0 && (
                    <div className="mb-8 space-y-4">
                        <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                            <AlertTriangle className="text-amber-500" />
                            Aksiyon Gerektiren Fırsatlar
                        </h2>

                        {/* ALERT TİPİNE GÖRE KART GÖSTER */}
                        {trip.alerts.map((alert, idx) => (
                            <div key={idx}>
                                {alert.type === 'DISRUPTION' && <DisruptionCard value={alert.value} />}
                                {alert.type === 'PRICE_DROP' && <ArbitrageCard original={trip.originalPrice} current={1100} currency={trip.currency} />}
                // @ts-ignore
                                {alert.type === 'SEAT_ALERT' && <SeatAlertCard />}
                            </div>
                        ))}
                    </div>
                )}

                {/* 3. MODÜL DURUMU (HANGİLERİ ÇALIŞIYOR?) */}
                <div>
                    <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                        <ShieldCheck className="text-emerald-600" />
                        Aktif Koruma Kalkanları
                    </h2>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        <ModuleStatusCard
                            icon={<Clock />}
                            title="Disruption Hunter"
                            status="Aktif"
                            desc="Rötar ve İptal takibi yapılıyor."
                            color="emerald"
                        />
                        <ModuleStatusCard
                            icon={<DollarSign />}
                            title="Price Arbitrage"
                            status="Aktif"
                            desc="Fiyat düşüşü bekleniyor."
                            color="emerald"
                        />
                        <ModuleStatusCard
                            icon={<Armchair />}
                            title="Seat Spy"
                            status="Uyarı Var"
                            desc="Yan koltuk doldu, aksiyon alın."
                            color="amber" // Uyarı rengi
                            animate={true}
                        />
                        <ModuleStatusCard
                            icon={<Plane />}
                            title="Schedule Guardian"
                            status="Aktif"
                            desc="Tarife değişikliği yok."
                            color="emerald"
                        />
                        <ModuleStatusCard
                            icon={<ShieldCheck />}
                            title="Upgrade Sniper"
                            status="Beklemede"
                            desc="Business Class henüz açılmadı."
                            color="slate"
                        />
                    </div>
                </div>

            </div>
        </div>
    );
}

// Alt Bileşen: Modül Kartı
function ModuleStatusCard({ icon, title, status, desc, color, animate }: any) {
    const colors: any = {
        emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
        amber: 'bg-amber-50 text-amber-700 border-amber-100',
        slate: 'bg-slate-50 text-slate-600 border-slate-100',
    };

    return (
        <div className={`p-4 rounded-xl border ${colors[color]} relative overflow-hidden transition-all hover:shadow-md`}>
            {animate && <div className="absolute top-0 right-0 p-2"><span className="flex h-3 w-3"><span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-400 opacity-75"></span><span className="relative inline-flex rounded-full h-3 w-3 bg-amber-500"></span></span></div>}

            <div className="flex items-center gap-3 mb-2">
                <div className={`p-2 rounded-lg bg-white/50 backdrop-blur-sm`}>{icon}</div>
                <h3 className="font-bold text-sm">{title}</h3>
            </div>
            <div className="text-xs font-bold uppercase opacity-80 mb-1">{status}</div>
            <p className="text-xs opacity-70 leading-relaxed">{desc}</p>
        </div>
    );
}
