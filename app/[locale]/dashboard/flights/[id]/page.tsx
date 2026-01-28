import { prisma } from "@/lib/prisma";
import { Button } from "@/components/ui/button";
import { Link } from "@/i18n/routing";
import { ArrowLeft, Clock, Plane, Calendar, RefreshCcw, TrendingDown } from "lucide-react";
import { notFound } from "next/navigation";
import { AirlineLogo } from "@/components/AirlineLogo";
import { PriceHistoryChart } from "@/components/PriceHistoryChart";
import { FlightItinerary } from "@/components/FlightItinerary";

function getTimeSince(date: Date) {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    if (seconds < 60) return "Just now";
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours}h ago`;
    return `${Math.floor(hours / 24)}d ago`;
}

export default async function FlightDetailPage({ params }: { params: Promise<{ id: string }> }) {
    const { id } = await params;
    const flight = await prisma.watchedFlight.findUnique({
        where: { id },
    });

    if (!flight) {
        notFound();
    }

    const depDate = new Date(flight.departureDate).toLocaleDateString('tr-TR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
    const time = new Date(flight.departureDate).toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' });

    // Ensure initialPrice is valid
    const initialPrice = flight.initialPrice ?? 0;
    const currentPrice = flight.currentPrice ?? 0;
    const drop = initialPrice - currentPrice;

    // Parse JSON fields
    const segments = (flight.segments as any[]) || [];
    const layovers = (flight.layovers as any[]) || [];
    const history = (flight.priceHistory as any[]) || [];

    const lastCheckedText = flight.lastChecked ? getTimeSince(flight.lastChecked) : "Just now";

    return (
        <div className="max-w-4xl mx-auto py-8 px-4">
            <Link href="/dashboard">
                <Button variant="ghost" className="mb-6 pl-0 hover:bg-transparent hover:text-blue-600">
                    <ArrowLeft className="w-4 h-4 mr-2" /> Back to Dashboard
                </Button>
            </Link>

            {/* Header Card */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                <div className="bg-slate-50 border-b border-slate-100 p-6 flex justify-between items-center">
                    <div className="flex items-center gap-4">
                        <div className="w-16 h-16 bg-white rounded-full flex items-center justify-center border border-slate-200 shadow-sm">
                            <AirlineLogo
                                carrierCode={flight.airline}
                                airlineName={flight.airline}
                                className="w-10 h-10 object-contain"
                            />
                        </div>
                        <div>
                            <div className="flex items-center gap-2">
                                <h1 className="text-2xl font-bold text-slate-900">{flight.airline} {flight.flightNumber}</h1>
                                <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full uppercase tracking-wide">
                                    Tracking Active
                                </span>
                            </div>
                            <div className="flex items-center gap-4 text-slate-500 mt-1 text-sm">
                                <span className="flex items-center gap-1"><Calendar className="w-4 h-4" /> {depDate}</span>
                                <span className="flex items-center gap-1"><Clock className="w-4 h-4" /> {time}</span>
                            </div>
                        </div>
                    </div>
                    <div className="text-right">
                        <div className="text-sm text-slate-500 mb-1">Current Price</div>
                        <div className="text-4xl font-black text-slate-900 flex items-baseline justify-end gap-1">
                            {currentPrice.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                            <span className="text-lg font-bold text-slate-400">{flight.currency}</span>
                        </div>
                        {drop > 0 && (
                            <div className="text-emerald-600 font-bold flex items-center justify-end gap-1 bg-emerald-50 px-2 py-1 rounded-md mt-2 inline-flex">
                                <TrendingDown className="w-4 h-4" />
                                Save {Math.round(drop)} {flight.currency}
                            </div>
                        )}
                    </div>
                </div>

                {/* Visual Route */}
                <div className="p-8 pb-4">
                    <div className="flex items-center justify-between max-w-2xl mx-auto">
                        <div className="text-center">
                            <div className="text-3xl font-bold text-slate-900">{flight.origin}</div>
                            <div className="text-sm text-slate-500 mt-1">Origin</div>
                        </div>

                        <div className="flex-1 px-8 relative flex flex-col items-center">
                            <div className="text-sm font-medium text-slate-500 mb-2">
                                {flight.totalDuration ? `${Math.floor(flight.totalDuration / 60)}h ${flight.totalDuration % 60}m` : 'Duration N/A'}
                            </div>
                            <div className="w-full h-[2px] bg-slate-200 relative">
                                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-white px-2 text-slate-400">
                                    <Plane className="w-6 h-6 transform rotate-90 text-slate-300" />
                                </div>
                            </div>
                            <div className="text-xs text-slate-400 mt-2 font-medium bg-slate-100 px-2 py-1 rounded-full">
                                {flight.stops === 0 ? 'Direct Flight' : `${flight.stops} Stop(s)`}
                            </div>
                        </div>

                        <div className="text-center">
                            <div className="text-3xl font-bold text-slate-900">{flight.destination}</div>
                            <div className="text-sm text-slate-500 mt-1">Destination</div>
                        </div>
                    </div>
                </div>

                <div className="bg-slate-50/50 border-t border-slate-100 p-4 flex justify-between items-center text-xs text-slate-500 px-6">
                    <div className="flex gap-6">
                        <span>Managed by <strong>FlightAI Agent</strong></span>
                        <span className="flex items-center gap-1"><RefreshCcw className="w-3 h-3" /> Last Checked: {lastCheckedText}</span>
                    </div>
                </div>
            </div>

            <div className="grid md:grid-cols-3 gap-8">
                {/* LEFT COLUMN: ITINERARY */}
                <div className="md:col-span-2">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="font-bold text-lg text-slate-900">Flight Itinerary</h3>
                    </div>
                    {segments.length > 0 ? (
                        <FlightItinerary segments={segments} layovers={layovers} />
                    ) : (
                        <div className="p-6 bg-slate-50 rounded-xl border border-dashed border-slate-200 text-center text-slate-400">
                            Detailed segment info not available for this flight.
                        </div>
                    )}
                </div>

                {/* RIGHT COLUMN: PRICE & INSIGHTS */}
                <div className="space-y-6">
                    <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                        <h3 className="font-bold text-base text-slate-900 mb-4 flex items-center gap-2">
                            Price History
                        </h3>
                        <PriceHistoryChart history={history} currency={flight.currency} />
                        <div className="mt-2 text-[10px] text-center text-slate-400">
                            Based on {history.length} data points
                        </div>
                    </div>

                    <div className="bg-blue-600 rounded-2xl p-6 text-white shadow-lg shadow-blue-600/20">
                        <h3 className="font-bold text-lg mb-4 opacity-90">What to expect?</h3>
                        <p className="text-blue-100 text-sm mb-4 leading-relaxed">
                            Our AI monitors this route 24/7.
                        </p>
                        <div className="bg-white/10 rounded-lg p-4 backdrop-blur-sm">
                            <div className="text-xs text-blue-200 uppercase tracking-wider font-bold mb-1">Target Price</div>
                            <div className="text-2xl font-bold">~{Math.round(currentPrice * 0.9)} {flight.currency}</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
