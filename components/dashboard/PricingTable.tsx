'use client';
import { useState } from 'react';
import { CheckCircle, ShieldCheck, Loader2 } from 'lucide-react';

export function PricingTable() {
    const [loading, setLoading] = useState(false);

    const handleSubscribe = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/stripe/checkout', { method: 'POST' });
            const data = await res.json();
            // Stripe ödeme sayfasına yönlendir
            if (data.url) window.location.href = data.url;
        } catch (err) {
            console.error(err);
            setLoading(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-xl border border-slate-200 overflow-hidden max-w-md mx-auto">
            {/* Header */}
            <div className="bg-slate-900 p-8 text-center text-white">
                <div className="inline-flex p-3 bg-emerald-500/20 rounded-full mb-4 ring-1 ring-emerald-500/50">
                    <ShieldCheck className="w-8 h-8 text-emerald-400" />
                </div>
                <h3 className="text-2xl font-black">Travel Guardian Premium</h3>
                <p className="text-slate-400 mt-2 text-sm">Seyahatinizi şansa bırakmayın.</p>

                <div className="mt-6 flex items-baseline justify-center gap-1">
                    <span className="text-4xl font-black text-white">$9.99</span>
                    <span className="text-slate-400">/ay</span>
                </div>
            </div>

            {/* Özellikler */}
            <div className="p-8">
                <ul className="space-y-4">
                    <FeatureItem text="7/24 Uçuş Takibi (Sınırsız)" />
                    <FeatureItem text="Tazminat Avcısı (%0 Komisyon)" bold />
                    <FeatureItem text="Business Upgrade Fırsatları" />
                    <FeatureItem text="Fiyat Arbitraj Uyarıları" />
                    <FeatureItem text="Koltuk Casusu (Yan Koltuk Uyarısı)" />
                    <FeatureItem text="Öncelikli E-posta Bildirimleri" />
                </ul>

                <button
                    onClick={handleSubscribe}
                    disabled={loading}
                    className="w-full mt-8 bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-xl font-bold text-lg shadow-lg shadow-emerald-200 transition-all flex items-center justify-center gap-2 relative overflow-hidden"
                >
                    {loading ? (
                        <div className="flex items-center gap-2">
                            <Loader2 className="animate-spin w-5 h-5" /> Yönlendiriliyor...
                        </div>
                    ) : 'Korumayı Başlat'}
                </button>

                <p className="text-xs text-center text-slate-400 mt-4">
                    İstediğiniz zaman iptal edebilirsiniz. Güvenli ödeme Stripe ile sağlanır.
                </p>
            </div>
        </div>
    );
}

function FeatureItem({ text, bold }: { text: string, bold?: boolean }) {
    return (
        <li className="flex items-center gap-3 text-slate-700">
            <CheckCircle className="w-5 h-5 text-emerald-500 shrink-0" />
            <span className={bold ? "font-bold" : ""}>{text}</span>
        </li>
    );
}
