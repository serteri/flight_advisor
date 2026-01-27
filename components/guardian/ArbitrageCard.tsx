import { TrendingDown, RefreshCw } from 'lucide-react';

export function ArbitrageCard({ original, current, currency }: any) {
    const profit = original - current - 150; // 150 ceza varsayımı

    return (
        <div className="bg-white border-l-4 border-blue-500 rounded-r-xl shadow-sm p-6">
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="p-2 bg-blue-100 text-blue-600 rounded-lg">
                        <TrendingDown className="w-6 h-6" />
                    </div>
                    <div>
                        <h3 className="font-bold text-slate-900">Fiyat Arbitraj Fırsatı</h3>
                        <p className="text-xs text-slate-500">Cezalı iptal yapsanız bile kâr ediyorsunuz.</p>
                    </div>
                </div>
                <div className="text-right">
                    <div className="text-[10px] uppercase font-bold text-slate-400">Net Kazanç</div>
                    <div className="text-2xl font-black text-blue-600">+{profit} {currency}</div>
                </div>
            </div>

            <div className="bg-slate-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center text-sm relative overflow-hidden">
                <div>
                    <div className="text-slate-400 text-xs">Aldığınız Fiyat</div>
                    <div className="font-bold text-slate-500 line-through">{original} {currency}</div>
                </div>
                <div>
                    <div className="text-slate-400 text-xs">Yeni Fiyat</div>
                    <div className="font-bold text-emerald-600">{current} {currency}</div>
                </div>
                <div>
                    <div className="text-slate-400 text-xs">Ceza</div>
                    <div className="font-bold text-red-400">-150 {currency}</div>
                </div>

                {/* Ok İşareti */}
                <div className="absolute top-1/2 left-1/3 -translate-y-1/2 text-slate-300">➝</div>
                <div className="absolute top-1/2 right-1/3 -translate-y-1/2 text-slate-300">➝</div>
            </div>

            <button className="w-full mt-4 bg-blue-600 text-white py-3 rounded-lg font-bold flex items-center justify-center gap-2 hover:bg-blue-700">
                <RefreshCw className="w-4 h-4" />
                Değişim İşlemini Göster
            </button>
        </div>
    );
}
