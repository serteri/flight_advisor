import { NextRequest, NextResponse } from "next/server";

/**
 * Reverse geocoding: lat/lon → city name
 * Used by frontend when browser geolocation is available
 */
export async function GET(req: NextRequest) {
    const lat = req.nextUrl.searchParams.get("lat");
    const lon = req.nextUrl.searchParams.get("lon");

    if (!lat || !lon) {
        return NextResponse.json({
            city: null,
            error: "Missing lat or lon parameter"
        }, { status: 400 });
    }

    try {
        const res = await fetch(
            `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lon}&format=json`,
            { headers: { "User-Agent": "flight-ai-app" } }
        );

        if (!res.ok) {
            throw new Error(`Nominatim API failed: ${res.status}`);
        }

        const data = await res.json();

        const city = data?.address?.city ||
            data?.address?.town ||
            data?.address?.village ||
            data?.address?.municipality ||
            null;

        return NextResponse.json({
            city,
            fullAddress: data?.display_name,
            country: data?.address?.country
        });
    } catch (error) {
        console.error('[reverse] Geocoding failed:', error);
        return NextResponse.json({
            city: null,
            error: error instanceof Error ? error.message : 'Unknown error'
        }, { status: 500 });
    }
}
