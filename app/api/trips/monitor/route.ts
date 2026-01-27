
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addFlightCheckJob } from '@/workers/queue';

export async function POST(req: Request) {
    try {
        const body = await req.json();

        // 1. Kullanıcıdan gelen veriyi al
        const {
            pnr, airlineCode, flightNumber, departureDate,
            arrivalDate, pricePaid, userId, origin, destination
        } = body;

        // Basic Validation
        if (!pnr || !airlineCode || !flightNumber) {
            return NextResponse.json({ success: false, error: 'Missing required fields' }, { status: 400 });
        }

        // 2. Veritabanına Kaydet (The Contract)
        const trip = await prisma.monitoredTrip.create({
            data: {
                userId,
                pnr,
                airlineCode,
                flightNumber,
                origin,
                destination,
                departureDate: new Date(departureDate),
                arrivalDate: new Date(arrivalDate),
                originalPrice: pricePaid,
                ticketClass: 'ECONOMY', // Default or from body
                // Varsayılan olarak tüm koruma kalkanları aktif başlar
                watchPrice: true,
                watchDelay: true,
                watchUpgrade: true,
                watchSchedule: true,
                status: 'ACTIVE',
                nextCheckAt: new Date(), // "Hemen şimdi kontrol et" komutu
            }
        });

        console.log(`✅ Trip saved to DB: ${trip.id}`);

        // 3. Kuyruğa At (The Trigger)
        // Bu, Worker'ı dürtmek demektir: "Hey, iş var!"
        await addFlightCheckJob(trip.id, 1); // Öncelik 1 (Yüksek)

        return NextResponse.json({ success: true, tripId: trip.id });

    } catch (error) {
        console.error("Monitor Error:", error);
        return NextResponse.json({ success: false, error: 'Failed to start monitoring' }, { status: 500 });
    }
}
