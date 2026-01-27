
'use client';
import { useState } from 'react';
import { ShieldCheck, Loader2 } from 'lucide-react';

export function MonitorButton({ flightData }: { flightData: any }) {
    const [loading, setLoading] = useState(false);
    const [active, setActive] = useState(false);

    const startMonitoring = async () => {
        setLoading(true);

        // API'ye istek at
        try {
            const res = await fetch('/api/trips/monitor', {
                method: 'POST',
                body: JSON.stringify({
                    userId: 'user_clv4123', // Auth gelince dinamik olacak
                    pnr: 'MOCK_' + Math.floor(Math.random() * 10000), // Randomize PNR for demo
                    airlineCode: flightData.airlineCode || "TK",
                    flightNumber: flightData.flightNumber || "1923",
                    departureDate: flightData.departureDate || new Date().toISOString(),
                    arrivalDate: flightData.arrivalDate || new Date(Date.now() + 10000000).toISOString(),
                    pricePaid: flightData.price || 1500,
                    origin: flightData.origin || "IST",
                    destination: flightData.destination || "JFK"
                })
            });

            if (res.ok) {
                setActive(true);
                // alert("Travel Guardian Aktif! Arkanıza yaslanın.");
            } else {
                console.error("Failed to start monitoring");
            }
        } catch (e) {
            console.error(e);
        }
        setLoading(false);
    };

    if (active) {
        return (
            <div className="flex items-center gap-2 text-emerald-600 bg-emerald-50 px-4 py-2 rounded-lg font-bold border border-emerald-200">
                <ShieldCheck className="w-5 h-5" />
                Koruma Aktif
            </div>
        );
    }

    return (
        <button
            onClick={startMonitoring}
            disabled={loading}
            className="flex items-center gap-2 bg-slate-900 text-white px-6 py-3 rounded-xl font-bold hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl disabled:opacity-70"
        >
            {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <ShieldCheck className="w-5 h-5" />}
            {loading ? 'Sistem Başlatılıyor...' : 'Bu Uçuşu Korumaya Al (Premium)'}
        </button>
    );
}
