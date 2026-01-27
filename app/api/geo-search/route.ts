import { NextResponse } from "next/server";
import { getAmadeusClient } from "@/lib/amadeus";
import { getNearestFallbackCity } from "@/lib/fallback-cities";

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const lat = searchParams.get("lat");
    const lon = searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({ error: "Missing coordinates" }, { status: 400 });
    }

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);

    try {
        const client = getAmadeusClient();
        let item = null;

        try {
            const results = await client.getNearestAirport(latNum, lonNum);
            if (results && results.length > 0) {
                item = results[0];
            }
        } catch (apiError) {
            console.error("Amadeus geo search partial failure:", apiError);
        }

        // If API found nothing, try fallback
        if (!item) {
             const fallback = getNearestFallbackCity(latNum, lonNum);
             if (fallback) {
                 return NextResponse.json({
                     data: {
                         iataCode: fallback.iataCode,
                         name: fallback.cityName,
                         cityName: fallback.cityName,
                         countryName: fallback.countryName,
                         type: 'CITY'
                     }
                 });
             }
        } else {
             return NextResponse.json({
                data: {
                    iataCode: item.iataCode,
                    // Return city name, not full airport name
                    name: item.address?.cityName || item.name,
                    cityName: item.address?.cityName || item.name,
                    countryName: item.address?.countryName,
                    type: item.subType
                }
            });
        }

        return NextResponse.json({ data: null });
    } catch (error) {
        console.error("Geo search API error:", error);
        // Emergency fallback check
        const fallback = getNearestFallbackCity(latNum, lonNum);
        if (fallback) {
            return NextResponse.json({
                data: {
                    iataCode: fallback.iataCode,
                    name: fallback.cityName,
                    cityName: fallback.cityName,
                    countryName: fallback.countryName,
                    type: 'CITY'
                }
            });
        }

        return NextResponse.json({ error: "Failed to fetch nearest airport" }, { status: 500 });
    }
}