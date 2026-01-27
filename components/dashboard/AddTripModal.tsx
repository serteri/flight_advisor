'use client';

import { X } from 'lucide-react';
import { PricingTable } from './PricingTable';

export function AddTripModal({ user, onClose }: { user: any, onClose: () => void }) {
    // 1. Kullanıcı Premium DEĞİLSE -> Pricing Table Göster (FEATURE GATING)
    // @ts-ignore
    if (!user.isPremium) {
        return (
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                <div className="relative w-full max-w-md">
                    <button onClick={onClose} className="absolute -top-10 right-0 text-white hover:text-slate-300 font-bold flex items-center gap-1">
                        <X className="w-5 h-5" /> Kapat
                    </button>
                    <PricingTable />
                </div>
            </div>
        );
    }

    // 2. Kullanıcı Premium İSE -> Formu Göster
    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-2xl relative">
                <button onClick={onClose} className="absolute top-4 right-4 text-slate-400 hover:text-slate-600">
                    <X className="w-5 h-5" />
                </button>

                <h2 className="text-2xl font-bold text-slate-900 mb-6">Yeni Seyahat İzle</h2>

                <form className="space-y-4">
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">PNR Kodu</label>
                        <input type="text" placeholder="Örn: R7X992" className="w-full border border-slate-300 rounded-lg p-3 font-mono uppercase focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>
                    <div>
                        <label className="block text-sm font-bold text-slate-700 mb-1">Uçuş Numarası</label>
                        <input type="text" placeholder="Örn: TK1984" className="w-full border border-slate-300 rounded-lg p-3 font-mono uppercase focus:ring-2 focus:ring-emerald-500 outline-none" />
                    </div>

                    <button type="button" className="w-full bg-slate-900 text-white font-bold py-4 rounded-xl mt-4 hover:bg-slate-800">
                        Takibi Başlat
                    </button>
                </form>
            </div>
        </div>
    );
}
