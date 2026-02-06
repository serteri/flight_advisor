import { ArrowUpCircle, Gem } from 'lucide-react';

export function UpgradeAlertCard({ opportunity }: { opportunity: any }) {
    if (!opportunity) return null;

    return (
        <div className="bg-gradient-to-r from-violet-900 to-indigo-900 text-white p-5 rounded-xl shadow-xl flex items-center justify-between animate-in slide-in-from-right duration-500">
            <div className="flex items-center gap-4">
                <div className="bg-white/10 p-3 rounded-full animate-pulse">
                    <Gem className="w-6 h-6 text-fuchsia-300" />
                </div>
                <div>
                    <h4 className="font-bold text-lg flex items-center gap-2">
                        Upgrade Sniper Hit!
                        <span className="bg-fuchsia-500 text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider">Rare Deal</span>
                    </h4>
                    <p className="text-violet-200 text-sm">
                        Business Class is only <strong>{opportunity.upgradePrice} {opportunity.currency}</strong> (+{opportunity.upgradePrice - 500} diff).
                        <span className="block text-xs opacity-70 mt-1">You save {opportunity.savings}% vs normal price!</span>
                    </p>
                </div>
            </div>

            <a href={opportunity.actionUrl} target="_blank" className="bg-white text-indigo-900 font-bold px-6 py-3 rounded-lg hover:scale-105 transition-transform shadow-lg flex items-center gap-2">
                Upgrade Now <ArrowUpCircle className="w-4 h-4" />
            </a>
        </div>
    );
}
