import { NextRequest, NextResponse } from "next/server";
import { getAmadeusClient } from "@/lib/amadeus";
import { getNearestFallbackCity } from "@/lib/fallback-cities";

/**
 * Cloudflare geolocation endpoint
 * Uses x-geo-* headers set by middleware from Cloudflare's request.cf object
 */
export async function GET(request: NextRequest) {
    // Get geolocation data from headers (set by middleware)
    const geoCity = request.headers.get('x-geo-city');
    const geoCountry = request.headers.get('x-geo-country');
    const geoLat = request.headers.get('x-geo-latitude');
    const geoLon = request.headers.get('x-geo-longitude');

    // If we have city name from Cloudflare, use it
    if (geoCity) {
        try {
            const client = getAmadeusClient();

            // Search for this city in Amadeus
            const results = await client.searchCitiesOnly(geoCity);

            if (results && results.length > 0) {
                const city = results[0];
                return NextResponse.json({
                    data: {
                        iataCode: city.iataCode,
                        name: city.address?.cityName || city.name,
                        cityName: city.address?.cityName || city.name,
                        countryName: city.address?.countryName || geoCountry,
                        type: 'CITY',
                        source: 'cloudflare-city'
                    }
                });
            }
        } catch (error) {
            console.error('[CF-Geo] Amadeus city search failed:', error);
        }
    }

    // Fallback to lat/lon if available
    if (geoLat && geoLon) {
        try {
            const lat = parseFloat(geoLat);
            const lon = parseFloat(geoLon);

            const client = getAmadeusClient();
            const airports = await client.getNearestAirport(lat, lon);

            if (airports && airports.length > 0) {
                const airport = airports[0];
                return NextResponse.json({
                    data: {
                        iataCode: airport.iataCode,
                        name: airport.address?.cityName || airport.name,
                        cityName: airport.address?.cityName || airport.name,
                        countryName: airport.address?.countryName || geoCountry,
                        type: 'CITY',
                        source: 'cloudflare-latlon'
                    }
                });
            }

            // If Amadeus fails, try fallback cities
            const fallback = getNearestFallbackCity(lat, lon);
            if (fallback) {
                return NextResponse.json({
                    data: {
                        iataCode: fallback.iataCode,
                        name: fallback.cityName,
                        cityName: fallback.cityName,
                        countryName: fallback.countryName,
                        type: 'CITY',
                        source: 'fallback-latlon'
                    }
                });
            }
        } catch (error) {
            console.error('[CF-Geo] Lat/lon geolocation failed:', error);
        }
    }

    // No geolocation data available
    return NextResponse.json({
        data: null,
        error: 'No geolocation data available'
    }, { status: 200 }); // Return 200 with null data instead of error
}