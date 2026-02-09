
import { EnrichedFlightResult, FlightResult } from "@/types/flight";


// lib/enrichment.ts
export function enrichFlight(f: FlightResult): EnrichedFlightResult {
    const enriched: EnrichedFlightResult = { ...f };

    // Uçak konfor tahmini
    if (f.aircraft?.includes("A350") || f.aircraft?.includes("787") || f.aircraft?.includes("A380")) {
        enriched.seatComfortScore = 9;
    } else if (f.aircraft?.includes("777") || f.aircraft?.includes("A330")) {
        enriched.seatComfortScore = 7;
    } else if (f.aircraft?.includes("737") || f.aircraft?.includes("A320") || f.aircraft?.includes("A321")) {
        enriched.seatComfortScore = 5;
    } else {
        enriched.seatComfortScore = 6;
    }

    // Wifi tahmini (geniş gövdeli uçaklarda daha olası)
    enriched.wifi = ["A380", "A350", "787", "A330", "777"].some(a => f.aircraft?.includes(a));

    // Gecikme riski
    if (f.stops > 1) {
        enriched.delayRisk = "high";
    } else if (f.stops === 1) {
        enriched.delayRisk = "medium";
    } else {
        enriched.delayRisk = "low";
    }

    // Fiyat nadirliği (Bu kısım daha sonra global fiyat istatistiklerine göre geliştirilebilir)
    if (f.price < 400) {
        enriched.rarityScore = 9;
    } else if (f.price < 700) {
        enriched.rarityScore = 6;
    } else {
        enriched.rarityScore = 3;
    }

    return enriched;
}
