'use client';

import { AlertTriangle, CheckCircle, ShieldCheck } from 'lucide-react';

export function DisruptionCard({ segment, alerts }: { segment: any, alerts: any[] }) {
    // Bu uçuş bacağı (Segment) ile ilgili bir 'DISRUPTION' (Rötar/İptal) alarmı var mı?
    const disruptionAlert = alerts.find(a =>
        a.type === 'DISRUPTION' &&
        (a.segmentId === segment.id || !a.segmentId) // Segment özelinde veya genel alarm
    );

    // ----------------------------------------------------------------
    // DURUM 1: HER ŞEY YOLUNDA (Yeşil Mod)
    // Alarm yoksa kullanıcıya güven verelim.
    // ----------------------------------------------------------------
    if (!disruptionAlert) {
        return (
            <div className="bg-white p-6 rounded-2xl border border-emerald-100 shadow-sm flex items-start gap-4 transition-all hover:shadow-md">
                <div className="bg-emerald-50 p-3 rounded-full text-emerald-600 shrink-0">
                    <ShieldCheck className="w-6 h-6" />
                </div>
                <div>
                    <div className="flex items-center gap-2 mb-1">
                        <h3 className="font-bold text-slate-900">Disruption Hunter</h3>
                        <span className="bg-emerald-100 text-emerald-700 text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wide">
                            Aktif
                        </span>
                    </div>
                    <p className="text-sm text-slate-500 leading-relaxed">
                        Uçuşunuz (<strong>{segment.airlineCode}{segment.flightNumber}</strong>) saniye saniye izleniyor.
                        Şu an herhangi bir rötar veya iptal görünmüyor.
                        Sorun olursa anında bildireceğiz.
                    </p>
                </div>
            </div>
        );
    }

    // ----------------------------------------------------------------
    // DURUM 2: SORUN VAR! (Kırmızı Mod - Tazminat Hakkı)
    // Alarm varsa parayı gösterelim.
    // ----------------------------------------------------------------
    return (
        <div className="bg-red-50 p-6 rounded-2xl border border-red-200 shadow-lg relative overflow-hidden group">

            {/* Arkaplan Efekti */}
            <div className="absolute top-0 right-0 p-4 opacity-10 -rotate-12 group-hover:opacity-20 transition-opacity">
                <AlertTriangle className="w-32 h-32 text-red-600" />
            </div>

            <div className="relative z-10">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-2 text-red-700 font-black">
                        <div className="bg-red-100 p-2 rounded-lg">
                            <AlertTriangle className="w-5 h-5" />
                        </div>
                        <span>Tazminat Hakkı Doğdu!</span>
                    </div>

                    {/* Para Miktarı */}
                    <div className="text-right">
                        <div className="text-xs font-bold text-red-400 uppercase">Tahmini Tutar</div>
                        <span className="text-3xl font-black text-slate-900">{disruptionAlert.potentialValue || '600€'}</span>
                    </div>
                </div>

                <p className="text-sm text-slate-700 font-medium mb-6 bg-white/50 p-3 rounded-lg border border-red-100">
                    {disruptionAlert.message}
                </p>

                <button className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-3.5 rounded-xl shadow-lg shadow-red-200 transition-transform active:scale-95 flex items-center justify-center gap-2">
                    Dilekçeyi Oluştur (%0 Komisyon)
                </button>
            </div>
        </div>
    );
}
