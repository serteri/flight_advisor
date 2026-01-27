import { Worker, Job } from 'bullmq';
import connection from '@/lib/redis';
import { prisma } from '@/lib/prisma';
import { searchFlights } from '@/lib/amadeus';

// CACHE HELPER: Prevent repeated API calls for same route/date
async function getCachedFlightSearch(origin: string, dest: string, date: string, currency: string) {
    // Key format: search:BNE:IST:2026-04-24:AUD
    const cacheKey = `search:${origin}:${dest}:${date}:${currency}`;

    // 1. Check Redis
    const cached = await connection.get(cacheKey);
    if (cached) return JSON.parse(cached);

    // 2. Call API if missing
    console.log(`🌍 API CALL: ${origin} -> ${dest} (${date})`);
    const results = await searchFlights({
        origin, destination: dest, departureDate: date, adults: 1, currency
    });

    // 3. Save to Redis for 1 hour (3600s)
    if (results?.data) {
        await connection.setex(cacheKey, 3600, JSON.stringify(results));
    }

    return results;
}

const worker = new Worker('flight-monitor', async (job: Job) => {
    const { flightId } = job.data;

    if (job.name !== 'check-price') return;

    // 1. Fetch Flight Details from DB
    // Using WatchedFlight to maintain compatibility with current Dashboard
    const flight = await prisma.watchedFlight.findUnique({ where: { id: flightId } });
    if (!flight) throw new Error("Flight not found");

    const dateStr = flight.departureDate.toISOString().split('T')[0];

    try {
        // 2. Search (Cache Protected)
        const searchResults = await getCachedFlightSearch(flight.origin, flight.destination, dateStr, flight.currency);

        if (!searchResults?.data) {
            console.log(`❌ Flight Not Found or API Error: ${flight.flightNumber}`);
            return;
        }

        // 3. LOGIC: Match Flight Number
        const matchingOffer = searchResults.data.find((offer: any) => {
            const segments = offer.itineraries?.[0]?.segments || [];
            // Check if our specific flight number exists in the segments
            return segments.some((seg: any) =>
                `${seg.carrierCode}${seg.number}` === flight.flightNumber
            );
        });

        if (matchingOffer) {
            const newPrice = parseFloat(matchingOffer.price?.total || '0');
            const currentHistory = (flight.priceHistory as any[]) || [];

            console.log(`📊 Price Check: ${flight.flightNumber} | Old: ${flight.currentPrice} -> New: ${newPrice}`);

            // 4. Update Database
            const lastEntry = currentHistory[currentHistory.length - 1];
            const today = new Date().toISOString();

            let needsUpdate = false;
            if (!lastEntry || lastEntry.price !== newPrice) {
                needsUpdate = true;
            }

            if (needsUpdate) {
                await prisma.watchedFlight.update({
                    where: { id: flight.id },
                    data: {
                        currentPrice: newPrice,
                        lastChecked: new Date(),
                        priceHistory: [
                            ...currentHistory,
                            { date: today, price: newPrice }
                        ]
                    }
                });
                console.log(`💰 Updated Price for ${flight.flightNumber}`);
            } else {
                // Just update timestamp
                await prisma.watchedFlight.update({
                    where: { id: flight.id },
                    data: { lastChecked: new Date() }
                });
            }

        } else {
            console.log(`⚠️ Flight (${flight.flightNumber}) not found in search results.`);
        }

    } catch (error) {
        console.error(`❌ Worker Error (${flight.flightNumber}):`, error);
        throw error; // Let BullMQ retry
    }

}, { connection });

console.log("👷 Flight Monitor Worker Started...");
