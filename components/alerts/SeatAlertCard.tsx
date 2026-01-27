import { generateMockSeatMap } from '@/utils/mockSeatMap';
import { SeatMapVisualizer } from '../SeatMapVisualizer';

export function SeatAlertCard() {
    const layout = generateMockSeatMap();

    return (
        <div className="border border-red-200 bg-red-50 rounded-xl p-6 shadow-lg">
            <div className="flex items-start gap-4 mb-4">
                <div className="p-3 bg-red-100 text-red-600 rounded-lg">
                    🚨
                </div>
                <div>
                    <h3 className="text-lg font-bold text-slate-900">Konfor Uyarısı: Yanınız Doldu!</h3>
                    <p className="text-slate-700 mt-1">
                        Seçtiğiniz <strong>24A</strong> koltuğunun yanına (24B) az önce bir yolcu oturdu.
                        Konforunuz riskte.
                    </p>
                    <div className="mt-3 inline-block px-3 py-1 bg-emerald-100 text-emerald-800 text-sm font-bold rounded-lg border border-emerald-200">
                        ✨ Çözüm: 15. Sıra (A-B-C) Tamamen Boş!
                    </div>
                </div>
            </div>

            {/* Haritayı Aç / Kapa (Accordion yapılabilir) */}
            <div className="mt-4">
                <SeatMapVisualizer layout={layout} />
            </div>

            <button className="w-full mt-4 bg-slate-900 text-white py-3 rounded-lg font-bold hover:bg-slate-800 transition-colors">
                Hemen 15A Koltuğuna Geç (Ücretsiz)
            </button>
        </div>
    );
}
