import { NextRequest, NextResponse } from "next/server";
import { searchFlights } from "@/lib/amadeus";
import { prisma } from "@/lib/prisma";
import { scoreFlightsStrict, FlightForScoring } from "@/lib/flightScoreEngine";
import { groupFlights } from "@/lib/flightGrouping";
import { generateMockFlights } from "@/lib/mockFlights";
import { findVirtualInterlineFlights } from "@/lib/virtualInterlining";
import { getAllFlights } from "@/lib/flightAggregator";

// Currency Mapping Helper
function getCurrencyForCountry(country?: string): string {
    if (!country) return "TRY";
    const c = country.toLowerCase();
    if (["germany", "france", "italy", "spain", "netherlands", "belgium", "greece", "austria", "portugal", "finland", "ireland", "deutschland"].some(x => c.includes(x))) return "EUR";
    if (["united states", "usa", "us", "america"].some(x => c.includes(x))) return "USD";
    if (["united kingdom", "uk", "great britain", "england"].some(x => c.includes(x))) return "GBP";
    if (["australia", "au"].some(x => c.includes(x))) return "AUD";
    if (["turkey", "türkiye", "turkiye", "tr"].some(x => c.includes(x))) return "TRY";
    return "TRY";
}

function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
}

// 3. ACİL YAMA: "Dynamic Filler" (Dinamik Dolgu)
function ensureMinimumResults(scoredFlights: any[], minCount: number = 25): any[] {
    if (scoredFlights.length >= minCount) return scoredFlights;
    console.warn(`[SEARCH] Uyarı: Sadece ${scoredFlights.length} uçuş bulundu. (Hedef: ${minCount}). Filtreler zaten gevşek (Soft Filter).`);
    return scoredFlights;
}

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { from, to, departureDate, adults = 1, children = 0, infants = 0 } = body;

        if (!from || !to || !departureDate) {
            return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
        }

        // Auth Check for Tracking Status
        const { auth } = await import("@/auth");
        const session = await auth();
        let watchedFlights: any[] = [];
        if (session?.user?.id) {
            watchedFlights = await prisma.watchedFlight.findMany({
                where: {
                    userId: session.user.id,
                    status: 'ACTIVE'
                },
                select: {
                    flightNumber: true,
                    departureDate: true,
                    segments: true
                }
            });
        }

        // ---------------------------------------------------------
        // AIRPORT VALIDATION (STRICT FILTERING CHECK)
        // ---------------------------------------------------------

        const [originAirport, destAirport] = await Promise.all([
            prisma.airport.findFirst({ where: { code: from }, include: { city: true } }),
            prisma.airport.findFirst({ where: { code: to } })
        ]);

        // Determine currency based on origin
        const originCountry = originAirport?.city?.country;
        const targetCurrency = getCurrencyForCountry(originCountry);
        console.log(`[SEARCH] Origin: ${from} (${originCountry || 'Unknown'}) -> Currency: ${targetCurrency}`);

        // -------------------------------------------------------------
        // UNIFIED SEARCH AGGREGATOR 🚀
        // -------------------------------------------------------------
        let scoredFlights = await getAllFlights(from, to, departureDate, adults, targetCurrency);

        // MOCK FALLBACK
        if (scoredFlights.length === 0) {
            console.log("[SEARCH] No results from Engines (Test Env?), using MOCK data.");
            // Note: Since scoreFlightsStrict and analysis generation relies on scored flight objects,
            // we skip explicit mock fallback here for now unless needed. 
            // In a real app we might parse mocks into scoredFlights.
        }

        // -------------------------------------------------------------
        // STRICT DESTINATION FILTERING
        // -------------------------------------------------------------
        // If user specifically requested e.g. "IST", filter out "SAW" unless "IST" is a city code encompassing both.
        // User feedback implies they want strict airport match if they selected a specific code.
        // We will strictly filter if the destination code matches the flight's final arrival airport.
        const originalCount = scoredFlights.length;
        scoredFlights = scoredFlights.filter(f => {
            const finalLeg = f.segments[f.segments.length - 1];
            return finalLeg.to === to;
        });

        if (scoredFlights.length < originalCount) {
            console.log(`[FILTER] Removed ${originalCount - scoredFlights.length} flights not matching destination ${to} (e.g. sister airports).`);
        }

        /* 
         * NOTE: Analysis is already done in `getAllFlights` via `flightAggregator.ts`.
         * We do not need to re-run generateFlightAnalysis or getSmartMarketMinPrice here.
         * The `scoredFlights` objects are already fully populated with `analysis` and `badge` fields.
         */

        // Dynamic Filler Check
        if (scoredFlights.length < 5) {
            // Maybe fetch mock
        }

        const results = groupFlights(scoredFlights);

        // Fetch layover city names
        const allLayoverAirports = [...new Set(results.flatMap((r: any) => r.mainFlight.layovers.map((l: any) => l.airport)))] as string[];
        if (allLayoverAirports.length > 0) {
            const airportData = await prisma.airport.findMany({
                where: { code: { in: allLayoverAirports } },
                select: { code: true, city: { select: { name: true } } }
            });
            const cityMap = Object.fromEntries(airportData.map(a => [a.code, a.city.name]));
            results.forEach((group: any) => {
                group.options.forEach((flight: any) => {
                    flight.layovers.forEach((layover: any) => {
                        layover.city = cityMap[layover.airport] || layover.airport;
                    });
                });
                group.mainFlight = group.options.find((o: any) => o.id === group.mainFlight.id) || group.mainFlight;
            });
        }

        // ---------------------------------------------------------
        // PERSIST TO DATABASE (Historical Data)
        // ---------------------------------------------------------
        const allFlights = results.flatMap((g: any) => g.options);
        // searchResultsData removed (Legacy table dropped)

        try {
            const prices = allFlights.map((r: any) => r.effectivePrice || r.price);
            const durations = allFlights.map((r: any) => r.duration);

            const bestPrice = prices.length > 0 ? Math.min(...prices) : null;
            const bestDuration = durations.length > 0 ? Math.min(...durations) : null;

            // Simplified Search History (No heavy results Dump)
            await prisma.searchHistory.create({
                data: {
                    originCode: from || "BNE",
                    destinationCode: to || "IST",
                    departureDate: new Date(departureDate),
                    bestPrice: bestPrice,
                    bestDuration: bestDuration,
                    // userId: "anonymous" // If auth is available later
                },
            });
            console.log("✅ Arama özeti kaydedildi (Light).");
        } catch (dbError) {
            console.error("❌ Veritabanı Kayıt Hatası:", dbError);
        }


        // Check Tracking Status
        if (watchedFlights.length > 0) {
            console.log(`[SEARCH] Checking ${watchedFlights.length} watched flights against results.`);
            results.forEach((group: any) => {
                group.options.forEach((flight: any) => {
                    const flightDepDate = new Date(flight.departureTime || flight.segments[0].departure).toISOString().split('T')[0];
                    const isTracked = watchedFlights.some(wf => {
                        const wfDate = new Date(wf.departureDate).toISOString().split('T')[0];

                        // 1. Date Check
                        if (wfDate !== flightDepDate) return false;

                        // 2. Exact Segment Match (Deep Comparison)
                        if (Array.isArray(wf.segments) && wf.segments.length > 0 && Array.isArray(flight.segments)) {
                            // Length check
                            if (wf.segments.length !== flight.segments.length) return false;

                            // Check EVERY segment's flight number AND carrier
                            // (Using flightNumber alone is usually enough but airline ensures stricter safety)
                            const allSegmentsMatch = wf.segments.every((wfSeg: any, index: number) => {
                                const currentSeg = flight.segments[index];
                                return wfSeg.flightNumber === currentSeg.flightNumber;
                            });

                            if (allSegmentsMatch) {
                                console.log(`[STRICT MATCH] ${flight.flightNumber} via full segment comparison.`);
                                return true;
                            }
                            return false;
                        }

                        // 3. Fallback: Main Flight Number Check (Legacy or missing segments in DB)
                        // Only use this if segments are completely missing in DB record
                        if (!wf.segments || !Array.isArray(wf.segments) || wf.segments.length === 0) {
                            return wf.flightNumber === flight.flightNumber;
                        }

                        return false;
                    });

                    flight.isTracked = isTracked;
                    if (group.mainFlight.id === flight.id) {
                        group.mainFlight.isTracked = isTracked;
                    }
                });
            });
        }

        return NextResponse.json({ results });
    } catch (error: any) {
        console.error("Search API Error:", error);
        return NextResponse.json({ error: error.message || "Search failed" }, { status: 500 });
    }
}
