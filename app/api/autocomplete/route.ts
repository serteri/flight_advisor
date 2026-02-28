import { NextRequest, NextResponse } from "next/server";
import { normalizeCityName } from "@/lib/city-name-utils";
import { searchFallbackCities } from "@/lib/fallback-cities";

/**
 * Skyscanner-like Autocomplete
 * - Search ALL airports (not just major)
 * - Prioritize: exact code match > major airports > other airports
 * - Clean display names
 */

function cleanAirportName(airportName: string): string {
    return airportName
        .replace(/\s*International\s*Airport$/i, '')
        .replace(/\s*Airport$/i, '')
        .replace(/\s*Intl\.?\s*$/i, '')
        .replace(/\s*\(.*\)$/i, '')
        .trim();
}

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q");

    if (!q || q.trim().length < 2) {
        return NextResponse.json([]);
    }

    try {
        const results = searchFallbackCities(q.trim()).slice(0, 10).map((airport) => {
            const normalizedCity = normalizeCityName(airport.cityName || airport.name || '');
            const cleanedName = cleanAirportName(airport.name || normalizedCity);

            return {
                city: normalizedCity,
                iata: airport.iataCode,
                country: airport.countryName || '',
                type: 'AIRPORT' as const,
                name: cleanedName,
                isMajor: false
            };
        });

        return NextResponse.json(results);

    } catch (error) {
        console.error('[autocomplete] DB Error:', error);
        return NextResponse.json([]);
    }
}
