
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
            suggestions = results.map((item: any) => ({
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
        const formattedSuggestions = uniqueSuggestions.map(item => {
            const isCity = item.type === 'CITY';

            // Display Name: Main Bold Text
            // e.g. "Paris" or "London"
            const displayName = item.cityName || item.name;

            // Detail Name: Subtitle Text
            // e.g. "France" (for City) OR "Heathrow, United Kingdom" (for Airport)
            let detailName = item.countryName || "";

            if (!isCity) {
                // If it's an airport, show Airport Name + Country
                // e.g. "Sabiha Gokcen, Turkey"
                // Clean up airport name if it contains the city name to avoid redundancy
                let airportName = item.name;
                if (airportName.toLowerCase().includes(item.cityName?.toLowerCase())) {
                    // e.g. "Istanbul Sabiha Gokcen" -> "Sabiha Gokcen" if we want, 
                    // but usually keeping full name is safer unless it's identical
                }

                detailName = `${airportName}, ${item.countryName}`;
            } else {
                // For City, just show Country or "All Airports" hint
                // e.g. "United Kingdom"
                // The UI can add generic "Any Airport" text if needed
            }

            return {
                iataCode: item.iataCode,
                name: item.name, // Original full name
                cityName: item.cityName,
                countryName: item.countryName,
                type: item.type,
                displayName: displayName,
                detailName: detailName
            };
        });

        return NextResponse.json({ data: formattedSuggestions });
    } catch (error) {
        console.error("City search API error:", error);
        // Even on error, try to return fallback
        const fallbacks = searchFallbackCities(keyword);
        const formattedFallbacks = fallbacks.map(item => ({
            iataCode: item.iataCode,
            name: item.cityName,
            cityName: item.cityName,
            countryName: item.countryName,
            type: 'CITY',
            displayName: item.cityName,
            detailName: item.countryName
        }));
        return NextResponse.json({ data: formattedFallbacks });
    }
}
