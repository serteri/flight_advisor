import { NextRequest, NextResponse } from "next/server";
import { getAmadeusClient } from "@/lib/amadeus";

/**
 * IP-based geolocation endpoint
 * Works on localhost and production as a fallback
 * Uses ip-api.com (free, no API key needed)
 */
export async function GET(request: NextRequest) {
    try {
        // Get client IP (works on localhost too)
        const forwarded = request.headers.get('x-forwarded-for');
        const ip = forwarded?.split(',')[0] || request.headers.get('x-real-ip') || '';

        console.log('[IP-Geo] Detecting location for IP:', ip || 'auto');

        // Call ip-api.com (free service, 45 req/min limit)
        const ipApiUrl = ip && ip !== '::1' && ip !== '127.0.0.1'
            ? `http://ip-api.com/json/${ip}`
            : 'http://ip-api.com/json/'; // Auto-detect

        const response = await fetch(ipApiUrl);
        const data = await response.json();

        if (data.status === 'success' && data.city) {
            console.log('[IP-Geo] Detected city:', data.city, data.country);

            // Search this city in Amadeus
            try {
                const client = getAmadeusClient();
                const cityResults = await client.searchCitiesOnly(data.city);

                if (cityResults && cityResults.length > 0) {
                    const city = cityResults[0];
                    return NextResponse.json({
                        data: {
                            iataCode: city.iataCode,
                            name: city.address?.cityName || city.name,
                            cityName: city.address?.cityName || city.name,
                            countryName: city.address?.countryName || data.country,
                            type: 'CITY',
                            source: 'ip-api'
                        }
                    });
                }
            } catch (amadeusError) {
                console.error('[IP-Geo] Amadeus search failed:', amadeusError);
            }

            // Fallback: Return city name without IATA (better than nothing)
            return NextResponse.json({
                data: {
                    iataCode: data.city.substring(0, 3).toUpperCase(), // Rough estimate
                    name: data.city,
                    cityName: data.city,
                    countryName: data.country,
                    type: 'CITY',
                    source: 'ip-api-fallback'
                }
            });
        }

        return NextResponse.json({
            data: null,
            error: 'Unable to detect location'
        }, { status: 200 });

    } catch (error) {
        console.error('[IP-Geo] Failed:', error);
        return NextResponse.json({
            data: null,
            error: 'Geolocation service unavailable'
        }, { status: 200 });
    }
}