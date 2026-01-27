
// workers/flightMonitor.ts
import { Queue, Worker } from 'bullmq';
import { prisma } from '../lib/prisma'; // Adjust import path as needed
import { checkAmadeusPrice, checkFlightAwareStatus } from '../services/api/flightProviders'; // Using the API layer we created

// Redis Connection (Mock for local dev if needed, or process.env)
const redisConnection = {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379'),
};

// 1. JOB QUEUE
export const flightQueue = new Queue('flight-monitoring', { connection: redisConnection });

// 2. WORKER LOGIC
// Note: In a real app, this runs in a separate process.
export const flightWorker = new Worker('flight-monitoring', async (job) => {
    const { tripId } = job.data;

    // Fetch Trip
    const trip = await prisma.monitoredTrip.findUnique({ where: { id: tripId } });
    if (!trip || trip.status !== 'ACTIVE') return;

    console.log(`[Worker] Checking flight: ${trip.airlineCode}${trip.flightNumber} (${trip.pnr})`);

    try {
        // --- A. PRICE CHECK (AMADEUS) ---
        if (trip.watchPrice) {
            // Fetch real price
            const currentPriceData = await checkAmadeusPrice(trip.pnr);
            const currentPrice = currentPriceData.price;

            const refundFee = 150; // Mock or from DB
            const netProfit = trip.originalPrice - currentPrice - refundFee;

            if (netProfit > 50) {
                // Create Alert
                await prisma.guardianAlert.create({
                    data: {
                        tripId: trip.id,
                        type: 'PRICE_DROP',
                        severity: 'MONEY',
                        title: '📉 Price Arbitrage Detected!',
                        message: `Price dropped! Net profit chance: ${netProfit} AUD.`,
                        potentialValue: `${netProfit} AUD`,
                        actionLabel: 'Swap Ticket'
                    }
                });
                console.log(`💰 [Price Drop] Found profit: ${netProfit} for ${trip.pnr}`);
            }
        }

        // --- B. DISRUPTION CHECK (FLIGHTAWARE) ---
        if (trip.watchDelay) {
            const status = await checkFlightAwareStatus(trip.flightNumber, trip.departureDate.toISOString()); // Approx date usage

            if (status.delayMinutes > 180 && status.reason === 'TECHNICAL') { // strict check
                await prisma.guardianAlert.create({
                    data: {
                        tripId: trip.id,
                        type: 'DISRUPTION_MONEY',
                        severity: 'MONEY',
                        title: '💰 Disruption Compensation',
                        message: 'Flight delayed > 3 hours due to airline fault. Claim 600€.',
                        potentialValue: '600 EUR',
                        actionLabel: 'File Claim'
                    }
                });
                console.log(`🚨 [Disruption] Found eligible delay for ${trip.pnr}`);
            }
        }

        // --- C. RESCHEDULE ---
        // Simple logic: check again in 1 hour
        const nextCheck = new Date(Date.now() + 60 * 60 * 1000);

        await prisma.monitoredTrip.update({
            where: { id: trip.id },
            data: {
                lastCheckedAt: new Date(),
                nextCheckAt: nextCheck
            }
        });

    } catch (error) {
        console.error(`[Worker] Error processing ${trip.pnr}:`, error);
    }

}, { connection: redisConnection });

// 3. SCHEDULER (Simulated for this file, normally a Cron/Separate script)
export async function runScheduler() {
    console.log("⏰ Scheduler started...");
    // Find due trips
    const tripsToCheck = await prisma.monitoredTrip.findMany({
        where: {
            status: 'ACTIVE',
            nextCheckAt: { lte: new Date() }
        },
        take: 50
    });

    for (const trip of tripsToCheck) {
        await flightQueue.add('check-flight', { tripId: trip.id });
        // Bump next check temporarily to prevent double-queuing before worker picks it up
        await prisma.monitoredTrip.update({
            where: { id: trip.id },
            data: { nextCheckAt: new Date(Date.now() + 5 * 60 * 1000) } // +5 mins buffer
        });
    }
}
