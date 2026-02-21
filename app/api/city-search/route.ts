
import { NextResponse } from "next/server";
import { getAmadeusClient } from "@/lib/amadeus";
import { searchFallbackCities } from "@/lib/fallback-cities";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const keyword = searchParams.get("keyword");

    if (!keyword || keyword.length < 2) {
        return NextResponse.json({ data: [] });
    }

    try {
        const client = getAmadeusClient();

        // 1. Search for BOTH cities AND airports
        let suggestions: any[] = [];
        try {
            // Use searchCity which searches both CITY and AIRPORT types
            const results = await client.searchCity(keyword);
            suggestions = results
                .filter((item: any) => item.iataCode && item.iataCode.length === 3) // ONLY valid IATA codes
                .map((item: any) => ({
                    iataCode: item.iataCode,
                    name: item.name || item.address?.cityName,
                    cityName: item.address?.cityName || item.name,
                    countryName: item.address?.countryName,
                    type: item.subType // 'CITY' or 'AIRPORT'
                }));
        } catch (apiError) {
            console.error("Amadeus city/airport search partial failure:", apiError);
        }

        // 2. Fallback Search (if Amadeus misses or fails)
        const fallbacks = searchFallbackCities(keyword);

        // Check if fallbacks are already in suggestions (avoid duplicates by IATA code)
        const existingCodes = new Set(suggestions.map(s => s.iataCode?.toUpperCase()));

        for (const fb of fallbacks) {
            const fbCode = fb.iataCode?.toUpperCase();
            if (fbCode && !existingCodes.has(fbCode)) {
                suggestions.push({
                    iataCode: fb.iataCode,
                    name: fb.cityName,
                    cityName: fb.cityName,
                    countryName: fb.countryName,
                    type: 'CITY'
                });
            }
        }

        // 3. Remove duplicates by IATA code (keep first occurrence)
        const seenCodes = new Set<string>();
        const uniqueSuggestions = suggestions.filter(item => {
            const code = item.iataCode?.toUpperCase();
            if (!code || seenCodes.has(code)) {
                return false;
            }
            seenCodes.add(code);
            return true;
        });

        // 4. Format for Skyscanner-style display
        const formattedSuggestions = uniqueSuggestions
            .filter(item => item.type === 'AIRPORT') // 🚫 SADECE HAVALIMANLAR
            .map(item => {
            // For AIRPORT type only
            const airportName = item.name || item.iataCode;
            const cityName = item.cityName || item.iataCode;

            return {
                iataCode: item.iataCode,
                name: item.name || cityName,
                cityName: cityName,
                countryName: item.countryName || "",
                type: item.type,
                displayName: cityName, // City name for display
                airportName: airportName, // Full airport name (NEW FIELD)
                detailName: item.countryName || ""
            };
        });

        return NextResponse.json({ data: formattedSuggestions });
    } catch (error) {
        console.error("City search API error:", error);
        // Even on error, try to return fallback
        const fallbacks = searchFallbackCities(keyword);
        const formattedFallbacks = fallbacks
            .filter(item => item.type === 'AIRPORT' || item.iataCode) // Only airports
            .map(item => ({
                iataCode: item.iataCode,
                name: item.cityName,
                cityName: item.cityName,
                countryName: item.countryName,
                type: 'AIRPORT',
                displayName: item.cityName,
                airportName: item.name || item.iataCode, // Airport full name
                detailName: item.countryName
            }));
        return NextResponse.json({ data: formattedFallbacks });
    }
}
