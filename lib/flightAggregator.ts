import { searchFlights } from "@/lib/amadeus";
import { findVirtualInterlineFlights } from "@/lib/virtualInterlining";
import { searchAirScraperFlights } from "@/lib/airScraper";
import { FlightForScoring } from "@/lib/flightTypes";

import { getAirlineInfo } from "@/lib/airlineDB";
import { generateMockFlights } from "@/lib/mockFlights";
import { groupFlights } from "@/lib/flightGrouping";

// Helper to parse Amadeus duration format (PT2H30M)
function parseDuration(isoDuration: string): number {
    const match = isoDuration.match(/PT(?:(\d+)H)?(?:(\d+)M)?/);
    if (!match) return 0;
    const hours = parseInt(match[1] || '0');
    const minutes = parseInt(match[2] || '0');
    return hours * 60 + minutes;
}

// -------------------------------------------------------------
// 1. STANDARD SEARCH WRAPPER (Parses Raw Amadeus to FlightForScoring)
// -------------------------------------------------------------
async function searchStandardFlights(params: any): Promise<FlightForScoring[]> {
    try {
        const rawResult = await searchFlights(params);
        if (!rawResult || !rawResult.data) return [];

        const carrierDictionaries = rawResult.dictionaries?.carriers || {};

        return rawResult.data.map((f: any): FlightForScoring => {
            const itinerary = f.itineraries[0];
            const duration = parseDuration(itinerary.duration);
            const stops = itinerary.segments.length - 1;
            const price = parseFloat(f.price.total);
            const carrier = f.validatingAirlineCodes[0];

            // Parse detailed segments
            const segments = itinerary.segments.map((seg: any) => ({
                from: seg.departure.iataCode,
                to: seg.arrival.iataCode,
                carrier: seg.carrierCode,
                carrierName: carrierDictionaries[seg.carrierCode] || getAirlineInfo(seg.carrierCode).name || seg.carrierCode,
                flightNumber: `${seg.carrierCode}${seg.number}`,
                departure: seg.departure.at,
                arrival: seg.arrival.at,
                duration: parseDuration(seg.duration),
                baggageWeight: 0, // Simplified for now, detailed parsing happens in detailed mapping if needed
            }));

            // Calc Layovers
            const layovers = [];
            for (let i = 0; i < segments.length - 1; i++) {
                const arr = new Date(segments[i].arrival).getTime();
                const dep = new Date(segments[i + 1].departure).getTime();
                const diffMins = (dep - arr) / (1000 * 60);
                layovers.push({
                    airport: segments[i].to,
                    duration: Math.round(diffMins),
                    city: segments[i].to // Placeholder
                });
            }

            // Baggage Quick Check
            let baggageWeight = 0;
            let baggageQuantity = 0;
            try {
                const bags = f.travelerPricings?.[0]?.fareDetailsBySegment?.[0]?.includedCheckedBags;
                if (bags) {
                    baggageWeight = bags.weight || 0;
                    baggageQuantity = bags.quantity || 0;
                }
            } catch (e) { }

            // DB Fallback if API returned 0
            if (baggageWeight === 0 && baggageQuantity === 0) {
                const { getAirlineInfo } = require('./airlineDB'); // Import locally if not at top, or ensure top import
                const info = getAirlineInfo(carrier);
                if (info.hasFreeBag) {
                    baggageWeight = 23;
                }
            }

            return {
                id: f.id,
                price,
                currency: f.price.currency,
                duration,
                stops,
                carrier,
                carrierName: carrierDictionaries[carrier] || getAirlineInfo(carrier).name || carrier,
                departureTime: segments[0].departure,
                arrivalTime: segments[segments.length - 1].arrival,
                segments,
                layovers,
                baggageWeight,
                baggageQuantity,
                fareRestrictions: {
                    refundable: false,
                    changeable: false,
                    seatSelection: false,
                    mealIncluded: false
                },
                // Raw object if needed for deep parsing later
                _raw: f
            };
        });
    } catch (error) {
        console.error("Standard Search Error:", error);
        return [];
    }
}

// -------------------------------------------------------------
// 🧠 AGGREGATOR ENGINE (ORCHESTRA CONDUCTOR)
// -------------------------------------------------------------
import { updateRouteStats } from '@/services/analyticsService';
import { prisma } from '@/lib/prisma';
import { enrichFlightData } from '@/lib/flightEnricher';
import { calculateBatchStats, scoreFlight, calculateRawScore } from '@/lib/flightScoreEngine';

// Yardımcı Fonksiyon: İstatistikleri Çek ama GÜVENİLİR Mİ kontrol et
async function getReliableBenchmark(origin: string, dest: string, currentMinPrice: number): Promise<number> {
    const currentMonth = new Date().getMonth() + 1;

    const stat = await prisma.routeStatistics.findFirst({
        where: {
            originCode: origin,
            destinationCode: dest,
            month: currentMonth
        }
    });

    // KURAL: Eğer veritabanında en az 10 farklı arama kaydı yoksa, veriye güvenme!
    // Bu durumda "Canlı En Düşük Fiyat"ı referans al.
    // Referansı biraz yukarı çekiyoruz (x1.1) ki en ucuz uçuş hemen "Harika" etiketi almasın, adil olsun.
    if (!stat || stat.sampleSize < 10) {
        console.log(`⚠️ [BENCHMARK] Yetersiz veri (Örneklem: ${stat?.sampleSize || 0}). Canlı veri kullanılıyor.`);
        return currentMinPrice * 1.1; // Referans = En ucuzun %10 fazlası
    }

    return stat.avgPrice;
}

export async function getAllFlights(
    origin: string,
    destination: string,
    date: string,
    adults: number = 1,
    currencyCode: string = "TRY"
): Promise<FlightForScoring[]> {
    console.log(`🚀 Tüm Motorlar Çalıştırılıyor: ${origin} -> ${destination}`);

    // Import simulated LCC engine
    const { searchLCCFares } = await import("@/lib/lccFares");

    // 1. RUN ENGINES IN PARALLEL
    const [standardResult, hackerResult, lccResult, scraperResult] = await Promise.allSettled([
        searchStandardFlights({
            origin,
            destination,
            departureDate: date,
            adults,
            currency: currencyCode
        }),
        findVirtualInterlineFlights(origin, destination, date, adults),
        searchLCCFares(origin, destination, date),
        searchAirScraperFlights({
            origin,
            destination,
            departureDate: date,
            adults
        })
    ]);

    let standardFlights = standardResult.status === 'fulfilled' ? standardResult.value : [];
    let hackerFlights = hackerResult.status === 'fulfilled' ? hackerResult.value : [];
    let lccFlights = lccResult.status === 'fulfilled' ? lccResult.value : [];
    let scraperFlights = scraperResult.status === 'fulfilled' ? scraperResult.value : [];

    console.log(`📊 Sonuçlar: Standard (${standardFlights.length}) + Hacker (${hackerFlights.length}) + LCC (${lccFlights.length}) + Scraper (${scraperFlights.length})`);

    // 2. MERGE LISTS
    let allFlights = [...standardFlights, ...hackerFlights, ...lccFlights, ...scraperFlights];

    // 3. DEDUPLICATION (TEMİZLİK) 🧹
    const uniqueFlights = new Map<string, FlightForScoring>();

    // CURRENCY CONVERSION RATES (APPROXIMATE MOCK) - TODO: Use Live API
    const RATES: Record<string, number> = {
        'TRY': 1,
        'AUD': 23.5,
        'USD': 34.2,
        'EUR': 37.5,
        'GBP': 45.0
    };

    function convertTo(price: number, fromCurr: string, toCurr: string): number {
        if (fromCurr === toCurr) return price;
        const priceInTry = price * (RATES[fromCurr] || 1);
        const result = priceInTry / (RATES[toCurr] || 1);
        return parseFloat(result.toFixed(2));
    }

    allFlights.forEach(flight => {
        // Normalize Currency
        if (flight.currency !== currencyCode) {
            flight.price = convertTo(flight.price, flight.currency, currencyCode);
            flight.effectivePrice = flight.effectivePrice ? convertTo(flight.effectivePrice, flight.currency, currencyCode) : undefined;
            flight.currency = currencyCode;
        }

        const signature = `${flight.carrier}-${new Date(flight.departureTime).toISOString()}-${Math.round(flight.price)}`;

        if (!uniqueFlights.has(signature)) {
            uniqueFlights.set(signature, flight);
        } else {
            const existing = uniqueFlights.get(signature)!;
            if (existing.isSelfTransfer && !flight.isSelfTransfer) {
                uniqueFlights.set(signature, flight);
            }
            else if (flight.price < existing.price) {
                uniqueFlights.set(signature, flight);
            }
        }
    });

    let mergedList = Array.from(uniqueFlights.values());
    console.log(`💱 Currency Normalized to ${currencyCode}. Total Unique: ${mergedList.length}`);

    // =========================================================
    // 🟢 1. VERİ ZENGİNLEŞTİRME (DATA ENRICHMENT)
    // =========================================================
    // Her uçuşa bagaj bilgisi, amenities ve efektif fiyat eklenir.
    mergedList = mergedList.map(flight => enrichFlightData(flight));

    // --- 3.1 STRICT FILTERING REMOVED ---
    // User often searches 'LON' but lands at 'LHR'. The previous logic filtered these out incorrectly.
    // We now trust the Amadeus API to return valid routes for the requested query.
    // If exact airport match is needed, it should be done at the API request level, not post-filtering.

    // 3.2 MOCK FALLBACK REMOVED (User Request)
    // User explicitly requested NO mock data. Return empty array if API returns 0 results.
    if (mergedList.length === 0) {
        console.warn("[AGGREGATOR] 0 results from APIs. Returning empty list per user request.");
        return [];
    }

    // =========================================================
    // 📊 2. İSTATİSTİK ANALİZİ (CONTEXT) - CURVED GRADING
    // =========================================================
    const batchStats = calculateBatchStats(mergedList);

    if (!batchStats) {
        console.warn("[ENGINE v7] No stats generated.");
        return [];
    }

    // --- PASS 1: Calculate Max Raw Score for Curve Normalization ---
    let maxRawScore = 0;
    mergedList.forEach(flight => {
        const raw = calculateRawScore(flight, batchStats);
        if (raw > maxRawScore) maxRawScore = raw;
    });
    batchStats.maxRawScore = maxRawScore;

    console.log(`[ENGINE v7] MinPrice: ${batchStats.minPrice} | MaxRawScore: ${maxRawScore.toFixed(1)}`);

    // D. Analytics Update 
    updateRouteStats(origin, destination, mergedList).catch(err => console.error("Stats update failed", err));

    // =========================================================
    // 🧠 3. PUANLAMA (CURVED GRADING v7)
    // =========================================================
    // --- PASS 2: Apply Curve and Score ---
    const scoredResults = mergedList.map(flight => {
        return scoreFlight(flight, batchStats, maxRawScore);
    });

    // 4. SORTING
    // Sort by Total Score Descending
    scoredResults.sort((a, b) => (b.scores?.total || 0) - (a.scores?.total || 0));

    // 5. FINAL LOGGING
    const bestPick = scoredResults[0];
    console.log(`✅ Aggregation Complete. Final Count: ${scoredResults.length}. Best Pick Score: ${bestPick?.scores?.total}`);

    return scoredResults;
}
