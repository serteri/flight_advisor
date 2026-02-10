import { FlightResult } from '@/types/hybridFlight';
import { analyzeForJunior } from '@/services/guardian/juniorGuardian';

interface JuniorBadgeProps {
    flight: FlightResult;
}

export default function JuniorBadge({ flight }: JuniorBadgeProps) {
    const analysis = analyzeForJunior(flight);

    if (!analysis) return null;

    return (
        <div className={`mt-3 p-3 rounded-xl border-l-4 ${analysis.isRecommended ? 'bg-green-50 border-green-500' : 'bg-orange-50 border-orange-500'}`}>
            <div className="flex justify-between items-center mb-2">
                <h4 className="font-bold text-sm flex items-center gap-2 text-slate-800">
                    👦 Junior Guardian
                </h4>
                <span className={`text-[10px] font-black px-2 py-1 rounded text-white ${analysis.isRecommended ? 'bg-green-500' : 'bg-orange-500'}`}>
                    {analysis.score.toFixed(1)}/10
                </span>
            </div>

            {/* Perks */}
            {analysis.perks.length > 0 && (
                <ul className="space-y-1 mb-2">
                    {analysis.perks.map((perk, i) => (
                        <li key={i} className="text-[10px] text-green-700 flex items-center gap-1 font-bold">✨ {perk}</li>
                    ))}
                </ul>
            )}

            {/* Alerts */}
            {analysis.alerts.length > 0 && (
                <ul className="space-y-1">
                    {analysis.alerts.map((alert, i) => (
                        <li key={i} className="text-[10px] text-orange-700 flex items-center gap-1 font-bold">{alert}</li>
                    ))}
                </ul>
            )}
        </div>
    );
}
