
import { CheckCircle2, AlertTriangle, XCircle, Armchair, Clock, Plane, Luggage } from "lucide-react";

interface StressMapProps {
    stress?: {
        checkIn: string;
        transfer: string;
        baggage: string;
        timeline: string;
    };
}

export function StressMap({ stress }: StressMapProps) {
    if (!stress) return null;

    // Renk ve İkon Seçici Helper
    const getStatus = (level: string) => {
        switch (level) {
            case 'low':
            case 'smooth':
                return { color: 'bg-emerald-500', ring: 'ring-emerald-200', icon: CheckCircle2 };
            case 'medium':
                return { color: 'bg-yellow-400', ring: 'ring-yellow-200', icon: AlertTriangle };
            case 'high':
            case 'exhausting':
                return { color: 'bg-orange-500', ring: 'ring-orange-200', icon: AlertTriangle };
            case 'critical':
                return { color: 'bg-red-500', ring: 'ring-red-200', icon: XCircle };
            default:
                return { color: 'bg-slate-300', ring: 'ring-slate-100', icon: CheckCircle2 };
        }
    };

    const checkIn = getStatus(stress.checkIn);
    const transfer = getStatus(stress.transfer);
    const baggage = getStatus(stress.baggage);
    const timeline = getStatus(stress.timeline);

    return (
        <div className="flex items-center gap-3 p-2 bg-slate-50/80 rounded-lg border border-slate-100/50 backdrop-blur-sm">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest hidden sm:block">
                STRESS MAP
            </span>

            {/* 1. Airline Quality */}
            <div className="group relative flex items-center gap-1.5 cursor-help">
                <div className={`w-2.5 h-2.5 rounded-full ${checkIn.color} shadow-sm group-hover:ring-2 ${checkIn.ring} transition-all`} />
                <Plane className="w-3 h-3 text-slate-400" />
                {/* Tooltip */}
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Havayolu Kalitesi
                </div>
            </div>

            {/* 2. Transfer */}
            <div className="group relative flex items-center gap-1.5 cursor-help">
                <div className={`w-2.5 h-2.5 rounded-full ${transfer.color} shadow-sm group-hover:ring-2 ${transfer.ring} transition-all`} />
                <div className="flex -space-x-1">
                    <Plane className="w-3 h-3 text-slate-400 rotate-45" />
                </div>
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Aktarma Riski
                </div>
            </div>

            {/* 3. Baggage */}
            <div className="group relative flex items-center gap-1.5 cursor-help">
                <div className={`w-2.5 h-2.5 rounded-full ${baggage.color} shadow-sm group-hover:ring-2 ${baggage.ring} transition-all`} />
                <Luggage className="w-3 h-3 text-slate-400" />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Bagaj Durumu
                </div>
            </div>

            {/* 4. Timeline / Fatigue */}
            <div className="group relative flex items-center gap-1.5 cursor-help">
                <div className={`w-2.5 h-2.5 rounded-full ${timeline.color} shadow-sm group-hover:ring-2 ${timeline.ring} transition-all`} />
                <Clock className="w-3 h-3 text-slate-400" />
                <div className="absolute bottom-full mb-2 left-1/2 -translate-x-1/2 w-max px-2 py-1 bg-slate-800 text-white text-[10px] rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                    Yorgunluk Seviyesi
                </div>
            </div>
        </div>
    );
}
