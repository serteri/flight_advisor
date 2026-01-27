import { NextRequest, NextResponse } from "next/server";

/**
 * Combined city detection endpoint
 * Priority: browser geolocation → IP fallback
 */
export async function GET(req: NextRequest) {
    // 1) Try browser geolocation → reverse geocode
    try {
        const lat = req.nextUrl.searchParams.get("lat");
        const lon = req.nextUrl.searchParams.get("lon");

        if (lat && lon) {
            const city = await reverseGeocode(lat, lon);
            if (city) {
                return NextResponse.json({
                    city,
                    source: "browser",
                    coordinates: { lat, lon }
                });
            }
        }
    } catch (error) {
        console.error('[detect-city] Browser geolocation failed:', error);
    }

    // 2) IP-based fallback
    try {
        const ip = req.headers.get("x-real-ip") ||
            req.headers.get("x-forwarded-for")?.split(',')[0] ||
            '';

        // Use ip-api.com for city detection
        const res = await fetch(`http://ip-api.com/json/${ip}`, {
            headers: { 'User-Agent': 'flight-ai-app' }
        });

        if (!res.ok) {
            throw new Error(`IP API failed: ${res.status}`);
        }

        const data = await res.json();

        if (data?.city) {
            return NextResponse.json({
                city: data.city,
                source: "ip",
                country: data.country,
                countryCode: data.countryCode
            });
        }
    } catch (error) {
        console.error('[detect-city] IP fallback failed:', error);
    }

    // 3) No city detected
    return NextResponse.json({
        city: null,
        source: "none"
    });
}

/**
 * Helper: Reverse geocode coordinates to city name
 */
async function reverseGeocode(lat: string, lon: string): Promise<string | null> {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`;

    try {
        const res = await fetch(url, {
            headers: { "User-Agent": "flight-ai-app" }
        });

        if (!res.ok) {
            console.error('[reverseGeocode] Failed:', res.status);
            return null;
        }

        const data = await res.json();

        // Try to get city name from various fields
        const city = data?.address?.city ||
            data?.address?.town ||
            data?.address?.village ||
            data?.address?.municipality ||
            null;

        return city;
    } catch (error) {
        console.error('[reverseGeocode] Error:', error);
        return null;
    }
}
