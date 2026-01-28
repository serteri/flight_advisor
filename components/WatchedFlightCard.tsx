"use client";

import { Plane, Calendar, Clock, ArrowRight, RefreshCcw, TrendingDown, TrendingUp, Minus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { AirlineLogo } from "@/components/AirlineLogo";
import { deleteWatchedFlight } from "@/app/actions/deleteWatchedFlight";
import { useTransition } from "react";
import { toast } from "sonner";

interface WatchedFlightCardProps {
    flight: any;
}

export function WatchedFlightCard({ flight }: WatchedFlightCardProps) {
    const t = useTranslations("Dashboard");
    const tSearch = useTranslations("FlightSearch");
    const [isPending, startTransition] = useTransition();

    const depDate = new Date(flight.departureDate).toLocaleDateString('tr-TR', { day: 'numeric', month: 'short' });
    const depTime = new Date(flight.departureDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Last Updated Time Formatting
    const updatedAt = new Date(flight.updatedAt || flight.createdAt);
    const updatedTimeStr = updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Next Update Calculation (+24h)
    const nextUpdate = new Date(updatedAt);
    nextUpdate.setDate(nextUpdate.getDate() + 1);
    const nextUpdateTimeStr = nextUpdate.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Calculate Trend
    const history = flight.priceHistory || [];
    const lastPrice = history.length > 1 ? history[history.length - 2].price : flight.initialPrice;
    const currentPrice = flight.currentPrice;
    const diff = lastPrice - currentPrice;

    // Sparkline Data Generation
    const sparklinePoints = history.map((h: any, i: number) => {
        return h.price;
    });

    let sparklinePath = "";
    if (sparklinePoints.length > 1) {
        const min = Math.min(...sparklinePoints);
        const max = Math.max(...sparklinePoints);
        const range = max - min || 1;

        sparklinePath = sparklinePoints.map((p: number, i: number) => {
            const x = (i / (sparklinePoints.length - 1)) * 100;
            const y = 50 - ((p - min) / range) * 40 - 5; // padding
            return `${i === 0 ? 'M' : 'L'} ${x} ${y}`;
        }).join(" ");
    }

    const handleDelete = () => {
        startTransition(async () => {
            const result = await deleteWatchedFlight(flight.id);
            if (result.success) {
                toast.success("Flight removed from tracking");
            } else {
                toast.error("Failed to remove flight");
            }
        });
    }


    return (
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 hover:shadow-md transition-shadow relative overflow-hidden group">

            {/* Daily Update Badge */}
            <div className="absolute top-0 right-0 bg-blue-50 text-blue-600 text-[10px] font-bold px-2 py-1 rounded-bl-lg border-b border-l border-blue-100 flex items-center gap-1">
                <RefreshCcw className="w-3 h-3" />
                {t('updatesDaily')}
            </div>

            <div className="flex justify-between items-start mb-4 mt-2">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-slate-50 flex items-center justify-center border border-slate-100">
                        <AirlineLogo
                            carrierCode={flight.airline}
                            airlineName={flight.airline}
                            className="w-8 h-8 object-contain"
                        />
                    </div>
                    <div>
                        <div className="font-bold text-slate-900">{flight.flightNumber}</div>
                        <div className="text-xs text-slate-500">{flight.airline}</div>
                    </div>
                </div>
                <div className="text-right mt-4">
                    <div className="text-xl font-black text-slate-900">
                        {flight.currentPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                        <span className="text-sm font-medium text-slate-500 ml-1">{flight.currency}</span>
                    </div>
                    {/* Trend Indicator */}
                    {diff > 0 ? (
                        <div className="text-xs text-emerald-600 font-bold flex items-center justify-end gap-1">
                            <TrendingDown className="w-3 h-3" />
                            -{Math.round(diff)} {flight.currency}
                        </div>
                    ) : diff < 0 ? (
                        <div className="text-xs text-red-500 font-bold flex items-center justify-end gap-1">
                            <TrendingUp className="w-3 h-3" />
                            +{Math.round(Math.abs(diff))} {flight.currency}
                        </div>
                    ) : (
                        <div className="text-xs text-slate-400 font-medium flex items-center justify-end gap-1">
                            <Minus className="w-3 h-3" />
                            Stable
                        </div>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-4 mb-4 bg-slate-50 p-3 rounded-lg border border-slate-100/50">
                <div className="text-center min-w-[50px]">
                    <div className="font-bold text-slate-900">{flight.origin}</div>
                    <div className="text-xs text-slate-400">{depTime}</div>
                </div>

                <div className="flex-1 flex flex-col items-center">
                    <div className="text-[10px] text-slate-400 font-medium">{flight.stops === 0 ? tSearch('nonstop') : `${flight.stops} Stop`}</div>
                    <div className="w-full h-[2px] bg-slate-200 relative my-1">
                        <Plane className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-1/2 w-3 h-3 text-slate-300 transform rotate-90" />
                    </div>
                </div>

                <div className="text-center min-w-[50px]">
                    <div className="font-bold text-slate-900">{flight.destination}</div>
                    <div className="text-xs text-slate-400">Arrive</div>
                </div>
            </div>

            {/* Sparkline & Actions */}
            <div className="flex justify-between items-end border-t border-slate-100 pt-3">
                <div className="flex-1 pr-4">
                    <div className="flex flex-col gap-1 mb-2">
                        <div className="text-[10px] text-slate-400 font-medium tracking-wide uppercase">
                            {t('lastUpdated', { time: updatedTimeStr })}
                        </div>
                        <div className="text-[10px] text-emerald-600 font-bold tracking-wide uppercase flex items-center gap-1">
                            <Clock className="w-3 h-3" />
                            {t('nextUpdate', { time: nextUpdateTimeStr })}
                        </div>
                    </div>
                    {sparklinePath ? (
                        <svg width="100%" height="30" viewBox="0 0 100 50" preserveAspectRatio="none" className="overflow-visible">
                            <path d={sparklinePath} fill="none" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
                        </svg>
                    ) : (
                        <div className="h-[30px] flex items-center text-[10px] text-slate-300 italic">
                            Collecting data...
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-2">
                    <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-slate-400 hover:text-red-600 hover:bg-red-50"
                        onClick={handleDelete}
                        disabled={isPending}
                    >
                        <Trash2 className="w-4 h-4" />
                    </Button>

                    <Link href={`/dashboard/flights/${flight.id}`}>
                        <Button variant="ghost" size="sm" className="h-8 text-xs hover:bg-slate-100 gap-1 text-blue-600 font-bold">
                            View Details <ArrowRight className="w-3 h-3" />
                        </Button>
                    </Link>
                </div>
            </div>
        </div>
    );
}
