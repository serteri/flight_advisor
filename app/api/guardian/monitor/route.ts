
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addFlightCheckJob } from '@/workers/queue';

export async function POST(req: Request) {
    try {
        const body = await req.json();
        const { pnr } = body;

        // Mock User ID
        const userId = "user_clv4123";

        // 1. Create Monitored Trip (If not exists for this PNR/User)
        // For demo purposes, we create a new one or find existing
        let trip = await prisma.monitoredTrip.findFirst({
            where: { pnr, userId }
        });

        if (!trip) {
            trip = await prisma.monitoredTrip.create({
                data: {
                    userId,
                    pnr,
                    airlineCode: "TK",
                    flightNumber: "1984",
                    departureDate: new Date(Date.now() + 86400000), // Tomorrow
                    arrivalDate: new Date(Date.now() + 90000000),
                    origin: "IST",
                    destination: "JFK",
                    originalPrice: 1200,
                    ticketClass: "ECONOMY",
                    watchDelay: true,
                    watchUpgrade: true,
                    nextCheckAt: new Date()
                }
            });
        }

        // 2. Add to Queue
        await addFlightCheckJob(trip.id, 1);

        return NextResponse.json({
            success: true,
            message: `Monitoring started for PNR: ${pnr}`,
            tripId: trip.id
        });

    } catch (error) {
        console.error("Monitor API Error:", error);
        return NextResponse.json({ success: false, error: "Failed to start monitoring" }, { status: 500 });
    }
}
