// components/dashboard/ProtectionPanel.tsx
'use client'; // For interactive tooltips if needed later
import { FareRulesAnalysis } from '@/lib/parser/fareDecoder';

interface ProtectionPanelProps {
    fareInfo: FareRulesAnalysis | null;
    status?: string;
}

export default function ProtectionPanel({ fareInfo }: ProtectionPanelProps) {
    if (!fareInfo) {
        return (
            <div className="bg-slate-50 border border-dashed border-slate-300 rounded-3xl p-6 text-center text-slate-500">
                Bilet kuralları yüklenemedi veya çok karmaşık. Lütfen havayolu sitesini kontrol edin.
            </div>
        );
    }

    return (
        <div className="bg-white border rounded-3xl p-6 shadow-sm">
            <div className="mb-6">
                <div className="text-slate-500 text-sm font-semibold uppercase tracking-wider mb-2">Yapay Zeka Özeti</div>
                <p className="text-lg text-slate-800 font-medium">"{fareInfo.summary}"</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* REFUND STATUS */}
                <div className={`p-4 rounded-xl border ${fareInfo.isRefundable ? 'bg-emerald-50 border-emerald-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${fareInfo.isRefundable ? 'bg-emerald-200' : 'bg-red-200'
                            }`}>
                            {fareInfo.isRefundable ? '💰' : '🚫'}
                        </div>
                        <div className="font-bold text-slate-900">İade Hakkı</div>
                    </div>
                    <div className="text-sm text-slate-600 ml-11">
                        {fareInfo.refundPenalty}
                    </div>
                </div>

                {/* CHANGE STATUS */}
                <div className={`p-4 rounded-xl border ${fareInfo.isChangeable ? 'bg-blue-50 border-blue-100' : 'bg-red-50 border-red-100'}`}>
                    <div className="flex items-center gap-3 mb-2">
                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-lg ${fareInfo.isChangeable ? 'bg-blue-200' : 'bg-red-200'
                            }`}>
                            {fareInfo.isChangeable ? '🔄' : '🔒'}
                        </div>
                        <div className="font-bold text-slate-900">Değişim Hakkı</div>
                    </div>
                    <div className="text-sm text-slate-600 ml-11">
                        {fareInfo.changePenalty}
                    </div>
                </div>
            </div>

            <div className="mt-4 text-xs text-slate-400 text-center">
                * Bu analiz AI tarafından yapılmıştır. Kesin kurallar için havayolu sözleşmesi geçerlidir.
            </div>
        </div>
    );
}
