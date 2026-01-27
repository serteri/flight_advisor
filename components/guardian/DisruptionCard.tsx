'use client';
import { useState } from 'react';
import { FileText, ArrowRight, Loader2, CheckCircle } from 'lucide-react';

export function DisruptionCard({ value, tripId }: { value: string, tripId?: string }) {
    const [status, setStatus] = useState<'IDLE' | 'LOADING' | 'SENT'>('IDLE');

    const handleClaim = async () => {
        setStatus('LOADING');

        // API'ye istek at
        const res = await fetch('/api/actions/claim', {
            method: 'POST',
            body: JSON.stringify({ tripId, iban: 'TR12...' }) // IBAN normalde formdan gelir
        });

        if (res.ok) {
            setStatus('SENT');
            // Kullanıcıya konfetili bir başarı mesajı gösterebiliriz
        } else {
            setStatus('IDLE'); // Reset on failure for now
            alert("Failed to send claim");
        }
    };

    if (status === 'SENT') {
        return (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-6 flex items-center gap-4">
                <div className="bg-emerald-100 p-3 rounded-full text-emerald-600">
                    <CheckCircle className="w-8 h-8" />
                </div>
                <div>
                    <h3 className="text-lg font-bold text-emerald-900">Dosya Gönderildi!</h3>
                    <p className="text-emerald-700 text-sm">
                        Resmi dilekçe oluşturuldu ve havayolu hukuk departmanına iletildi.
                        Cevap geldiğinde (ort. 14 gün) seni bilgilendireceğiz.
                    </p>
                </div>
            </div>
        );
    }

    return (
        <div className="bg-white border-l-4 border-emerald-500 rounded-r-xl shadow-sm p-6 flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-4">
                <div className="p-4 bg-emerald-100 text-emerald-700 rounded-full">
                    <span className="text-2xl font-black">€</span>
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Tazminat Hakkı: {value}</h3>
                    <p className="text-slate-600 text-sm mt-1 max-w-md">
                        Uluslararası kurallar gereği (EC261), yaşanan 3+ saatlik gecikme için nakit tazminat hakkınız var.
                    </p>
                </div>
            </div>

            <div className="flex items-center gap-6 w-full md:w-auto">
                <button
                    onClick={handleClaim}
                    disabled={status === 'LOADING'}
                    className="flex-1 md:flex-none bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-3 rounded-xl font-bold flex items-center justify-center gap-2 transition-all shadow-lg shadow-emerald-200 disabled:opacity-70"
                >
                    {status === 'LOADING' ? <Loader2 className="animate-spin" /> : <FileText className="w-4 h-4" />}
                    {status === 'LOADING' ? 'Dilekçe Hazırlanıyor...' : 'Başvuruyu Başlat (%0 Komisyon)'}
                </button>
            </div>
        </div>
    );
}
