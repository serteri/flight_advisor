// components/dashboard/WellnessCard.tsx
import { JetLagAnalysis } from '@/lib/jetLagPredictor';

interface WellnessCardProps {
    jetLag: JetLagAnalysis;
}

export default function WellnessCard({ jetLag }: WellnessCardProps) {
    const isHighRisk = jetLag.impactScore > 6;
    const isMediumRisk = jetLag.impactScore > 3 && jetLag.impactScore <= 6;

    return (
        <div className={`p-6 rounded-3xl border-2 transition-all duration-300 ${isHighRisk ? 'bg-red-50 border-red-100' :
                isMediumRisk ? 'bg-amber-50 border-amber-100' :
                    'bg-emerald-50 border-emerald-100'
            }`}>
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold flex items-center gap-2">
                    🌙 Jet Lag Etkisi
                </h3>
                <span className={`px-3 py-1 rounded-full text-sm font-bold ${isHighRisk ? 'bg-red-200 text-red-800' :
                        isMediumRisk ? 'bg-amber-200 text-amber-800' :
                            'bg-emerald-200 text-emerald-800'
                    }`}>
                    Skor: {jetLag.impactScore}/10
                </span>
            </div>

            <div className="space-y-4">
                <p className="text-slate-700 font-medium leading-relaxed">
                    {jetLag.advice}
                </p>

                {isHighRisk && (
                    <div className="text-sm bg-white/60 p-3 rounded-lg text-slate-600">
                        💡 <strong>Pro Tip:</strong> Uçak içinde saatini varış yerine göre ayarla ve kafeini inişten 6 saat önce kes.
                    </div>
                )}
            </div>
        </div>
    );
}
