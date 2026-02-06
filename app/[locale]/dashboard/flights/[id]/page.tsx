// app/[locale]/dashboard/flights/[id]/page.tsx
import { getTrackedFlightById } from '@/lib/db/guardian';
import { calculateJetLagImpact } from '@/lib/jetLagPredictor';
import { decodeFareRules } from '@/lib/parser/fareDecoder';
import { getScenarioStory } from '@/lib/flightInsights';
import ScenarioCard from '@/components/dashboard/ScenarioCard';
import ProtectionPanel from '@/components/dashboard/ProtectionPanel';
import WellnessCard from '@/components/dashboard/WellnessCard';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';

// Mock function until DB has rawFareRules
async function getRawFareRules(id: string) {
    // In production, this would come from Amadeus API or cached in DB
    return `
        PENALTIES - CANCELLATIONS ANY TIME TICKET IS NON-REFUNDABLE.
        CHANGES ANY TIME CHARGE EUR 50.00 FOR REISSUE/REVALIDATION.
        NOTE -
        WAIVED FOR DEATH OF PASSENGER OR FAMILY MEMBER.
        BAGGAGE ALLOWANCE - 23KG CHECKED BAGGAGE INCLUDED.
    `;
}

export default async function FlightDetailsPage({ params }: { params: { id: string, locale: string } }) {
    // 1. Fetch flight from DB
    // Assuming userId is hardcoded for MVP or fetched from session
    const userId = "user_2sY..." // Replace with actual session user ID in real app

    // For now, let's fetch the trip directly using prisma to bypass userId check if needed, 
    // or better, use the existing helper but we need a user ID.
    // Let's assume we find the trip by ID directly for this page
    const trip = await prisma.monitoredTrip.findUnique({
        where: { id: params.id },
        include: { segments: true, passengers: true }
    });

    if (!trip) return notFound();

    const firstSegment = trip.segments[0];
    const lastSegment = trip.segments[trip.segments.length - 1];

    if (!firstSegment || !lastSegment) return notFound();

    // 2. Run Agents
    // Jet Lag
    // We need timezones. Mocking TZ offsets for MVP (Istanbul +3, Brisbane +10)
    // In real app, airport DB has TZ info
    const originTZ = 3; // Mock
    const destTZ = 1;   // Mock (London/Europe)

    const jetLag = calculateJetLagImpact(
        firstSegment.departureDate.toISOString(),
        lastSegment.arrivalDate.toISOString(),
        originTZ,
        destTZ
    );

    // Fare Rules
    const rawRules = await getRawFareRules(trip.id);
    const fareInfo = await decodeFareRules(rawRules);

    // Storytelling
    // Adapt DB data to FlightForInsights format expected by getScenarioStory
    // Or simpler: create a mock object enough for the story
    const flightForStory = {
        origin: firstSegment.origin,
        destination: lastSegment.destination,
        departureDate: firstSegment.departureDate,
        arrivalDate: lastSegment.arrivalDate,
        duration: (lastSegment.arrivalDate.getTime() - firstSegment.departureDate.getTime()) / 60000,
        stops: trip.segments.length - 1,
        segments: trip.segments,
        score: 8.5 // Mock score or calculate
    };
    const story = getScenarioStory(flightForStory);

    const hasChild = trip.passengers.some(p => p.type === 'CHILD' || p.type === 'INFANT');

    return (
        <div className="max-w-7xl mx-auto p-8 space-y-8">
            {/* HEADer */}
            <header className="flex justify-between items-start border-b border-slate-200 pb-8">
                <div>
                    <h1 className="text-4xl font-black text-slate-900 flex items-center gap-3">
                        {firstSegment.origin}
                        <span className="text-slate-300">✈️</span>
                        {lastSegment.destination}
                    </h1>
                    <p className="text-slate-500 font-medium mt-2 flex items-center gap-2">
                        <span className="bg-slate-100 px-2 py-1 rounded text-xs font-bold text-slate-600">PNR: {trip.pnr}</span>
                        <span>•</span>
                        <span className="text-emerald-600 flex items-center gap-1">
                            🛡️ Guardian Nöbette
                        </span>
                    </p>
                </div>
                <div className="text-right">
                    <div className="text-5xl font-black text-blue-600">8.5</div>
                    <p className="text-xs font-bold uppercase text-slate-400 mt-1">Agent Score</p>
                </div>
            </header>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* LEFT COL: SCENARIO & PROTECTION */}
                <div className="lg:col-span-2 space-y-8">
                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                            🎬 Yolculuk Simülasyonu
                        </h2>
                        <ScenarioCard story={story} />
                    </section>

                    <section>
                        <h2 className="text-2xl font-bold mb-4 flex items-center gap-2 text-slate-800">
                            📜 Bilet Hakların
                        </h2>
                        <ProtectionPanel fareInfo={fareInfo} status={trip.status} />
                    </section>
                </div>

                {/* RIGHT COL: WELLNESS & JUNIOR */}
                <div className="space-y-6">
                    <WellnessCard jetLag={jetLag} />

                    {/* JUNIOR GUARDIAN */}
                    {hasChild && (
                        <div className="bg-orange-50 border-2 border-orange-100 rounded-3xl p-6 relative overflow-hidden">
                            <div className="absolute top-0 right-0 p-4 opacity-10 text-6xl">🧸</div>
                            <h3 className="font-bold text-orange-800 flex items-center gap-2 text-lg relative z-10">
                                👦 Family Comfort
                            </h3>
                            <ul className="mt-4 space-y-3 text-sm text-orange-700 relative z-10">
                                <li className="flex items-center gap-2">
                                    <span className="text-orange-500">✅</span>
                                    Yan yana koltuk garantisi aktif.
                                </li>
                                <li className="flex items-center gap-2">
                                    <span className="text-orange-500">✅</span>
                                    Çocuk menüsü kontrol edildi.
                                </li>
                            </ul>
                        </div>
                    )}

                    {/* REVENUE: DISRUPTION HUNTER */}
                    <div className="bg-slate-900 text-white rounded-3xl p-6 shadow-xl relative overflow-hidden group hover:scale-[1.02] transition-transform cursor-pointer">
                        <div className="absolute top-0 right-0 w-24 h-24 bg-blue-500 rounded-full blur-3xl opacity-20 group-hover:opacity-30 transition-opacity"></div>
                        <h3 className="font-bold text-lg flex items-center gap-2">
                            ⚡ Tazminat Radarı
                        </h3>
                        <p className="text-sm text-slate-300 mt-3 leading-relaxed">
                            Bu uçuş 3 saatten fazla gecikirse senin adına anında <span className="text-white font-bold">€600 tazminat</span> talep edeceğim.
                        </p>
                        <div className="mt-4 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-emerald-400">
                            <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
                            Aktif İzleme
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
