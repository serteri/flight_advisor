
import { getAmadeusClient } from "@/lib/amadeus";
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { NextResponse } from "next/server";

export async function POST(req: Request) {
    // Paid Amadeus quota (and, for PNR lookups, booking data): signed-in users only.
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { airlineCode, flightNumber, date, origin, destination } = body;

        const client = getAmadeusClient();

        // Amadeus SeatMap requires fetching a flight offer first
        const seatMapData = await client.getRealSeatMap({
            airlineCode,
            flightNumber,
            date,
            origin,
            destination
        });

        if (!seatMapData) {
            // Fallback or Error
            return NextResponse.json({ success: false, error: "Seat map unavailable" }, { status: 404 });
        }

        return NextResponse.json({ success: true, data: seatMapData });
    } catch (error) {
        console.error("SeatMap API Error:", error);
        return NextResponse.json({ success: false, error: "Internal Server Error" }, { status: 500 });
    }
}
