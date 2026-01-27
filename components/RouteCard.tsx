"use client";

import { Plane, ArrowRight, Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { DeleteRouteDialog } from "@/components/DeleteRouteDialog";
import { getCityFromAirportCode } from "@/lib/airport-utils";

export function RouteCard({ id, from, to, cabin, dealScore, alertCount = 0 }: RouteCardProps) {
    // Get city names from airport codes
    const fromCity = getCityFromAirportCode(from);
    const toCity = getCityFromAirportCode(to);




    // Mock color based on score
    const scoreColor = (score: number) => {
        if (score >= 8) return "bg-green-100 text-green-700 border-green-200";
        if (score >= 5) return "bg-yellow-100 text-yellow-700 border-yellow-200";
        return "bg-slate-100 text-slate-600 border-slate-200";
    };

    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm hover:shadow-lg transition-all duration-200 p-6">
            {/* Header: Route + Alert Badge */}
            <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                    <div className="bg-blue-50 p-2 rounded-lg">
                        <Plane className="text-blue-600" size={20} />
                    </div>
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <span className="text-xl font-bold text-slate-900">{fromCity}</span>
                            <ArrowRight className="text-slate-400" size={18} />
                            <span className="text-xl font-bold text-slate-900">{toCity}</span>
                        </div>
                        <div className="text-sm text-slate-500 capitalize">
                            {cabin.toLowerCase()}
                        </div>
                    </div>
                </div>

                {alertCount > 0 && (
                    <div className="relative">
                        <div className="bg-red-500 text-white text-xs font-bold rounded-full px-2 py-1 flex items-center gap-1">
                            <Bell size={12} />
                            {alertCount}
                        </div>
                    </div>
                )}
            </div>

            {/* Deal Score */}
            <div className="mb-4">
                {dealScore ? (
                    <div className={`inline-flex px-4 py-2 rounded-lg text-sm font-bold border ${scoreColor(dealScore)}`}>
                        Deal Score: {dealScore}/10
                    </div>
                ) : (
                    <div className="inline-flex px-4 py-2 rounded-lg text-sm text-slate-500 bg-slate-50 border border-slate-200">
                        Collecting data...
                    </div>
                )}
            </div>

            {/* Actions */}
            <div className="flex gap-2">
                <Link href={`/dashboard/routes/${id}`} className="flex-1">
                    <Button variant="outline" className="w-full">
                        View Details
                    </Button>
                </Link>
                <DeleteRouteDialog routeId={id} />
            </div>
        </div>
    );
}

interface RouteCardProps {
    id: string;
    from: string;
    to: string;
    cabin: string;
    dealScore?: number;
    alertCount?: number;
}
