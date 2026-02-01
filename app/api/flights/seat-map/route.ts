
import { getAmadeusClient } from "@/lib/amadeus";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
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
