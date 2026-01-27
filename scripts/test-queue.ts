
import 'dotenv/config';
import { addFlightCheckJob } from '@/workers/queue';
import { prisma } from '@/lib/prisma';

async function main() {
    console.log("💉 Injecting Job directly into Queue...");

    // Ensure a trip exists to process

    // 1. Ensure User Exists
    const userId = 'user_clv4123';
    await prisma.user.upsert({
        where: { id: userId },
        update: {},
        create: {
            id: userId,
            email: 'test@example.com',
            name: 'Test User'
        }
    });

    let trip = await prisma.monitoredTrip.findFirst();
    if (!trip) {
        console.log("Creating mock trip...");
        trip = await prisma.monitoredTrip.create({
            data: {
                userId: userId,
                pnr: 'TEST_DIRECT',
                airlineCode: 'TK',
                flightNumber: '2024',
                origin: 'IST',
                destination: 'JFK',
                departureDate: new Date(),
                arrivalDate: new Date(),
                originalPrice: 1000,
                ticketClass: 'ECONOMY',
                status: 'ACTIVE',
                nextCheckAt: new Date()
            }
        });
    }

    console.log(`Adding job for Trip ID: ${trip.id}`);
    await addFlightCheckJob(trip.id, 99); // High priority
    console.log("Job added. Check Worker Logs!");

    // Allow time for Redis op
    await new Promise(r => setTimeout(r, 2000));
    process.exit(0);
}

main().catch(console.error);
