import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { flightMonitorQueue } from '@/workers/queue';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    // 1. Security Check
    const authHeader = request.headers.get('authorization');
    const cronSecret = process.env.CRON_SECRET;

    // Optional: Allow local dev/test without secret
    if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
        console.log('[CRON] Unauthorized request');
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    console.log('[CRON] Starting daily price update...');

    try {
        // Get all active watched flights
        const activeFlights = await prisma.watchedFlight.findMany({
            where: {
                status: 'ACTIVE',
                departureDate: { gte: new Date() } // Only future flights
            },
        });

        console.log(`[CRON] Found ${activeFlights.length} active flights to update`);

        let updated = 0;
        let failed = 0;

        // Group flights by route to minimize API calls
        const routeGroups: Record<string, typeof activeFlights> = {};

        for (const flight of activeFlights) {
            // Group by route AND currency to ensure correct price updates
            // Use pipe | separator to avoid issues with date dashes (2025-01-01)
            const key = `${flight.origin}|${flight.destination}|${flight.departureDate.toISOString().split('T')[0]}|${flight.currency}`;
            if (!routeGroups[key]) routeGroups[key] = [];
            routeGroups[key].push(flight);
        }

        for (const [routeKey, flights] of Object.entries(routeGroups)) {
            const [origin, destination, dateStr, currency] = routeKey.split('|');

            try {
                console.log(`[CRON] Searching ${origin} -> ${destination} on ${dateStr} in ${currency}`);

                // Search for current prices
                const searchResults = await searchFlights({
                    origin,
                    destination,
                    departureDate: dateStr,
                    adults: 1,
                    currency: currency // Use the specific currency for this group
                });

                if (!searchResults?.data) {
                    console.log(`[CRON] No results for ${routeKey}`);
                    failed += flights.length;
                    continue;
                }

                // Update each watched flight
                for (const watchedFlight of flights) {
                    // Find matching flight by flight number
                    const matchingOffer = searchResults.data.find((offer: any) => {
                        const segments = offer.itineraries?.[0]?.segments || [];
                        return segments.some((seg: any) =>
                            `${seg.carrierCode}${seg.number}` === watchedFlight.flightNumber
                        );
                    });

                    if (matchingOffer) {
                        const newPrice = parseFloat(matchingOffer.price?.total || '0');
                        const currentHistory = (watchedFlight.priceHistory as any[]) || [];

                        // Only add to history if price changed or it's a new day
                        const lastEntry = currentHistory[currentHistory.length - 1];
                        const today = new Date().toISOString().split('T')[0];
                        const lastDate = lastEntry?.date?.split('T')[0];

                        if (!lastEntry || lastDate !== today || lastEntry.price !== newPrice) {
                            await prisma.watchedFlight.update({
                                where: { id: watchedFlight.id },
                                data: {
                                    currentPrice: newPrice,
                                    lastChecked: new Date(),
                                    priceHistory: [
                                        ...currentHistory,
                                        { date: new Date().toISOString(), price: newPrice }
                                    ]
                                }
                            });

                            console.log(`[CRON] Updated ${watchedFlight.flightNumber}: ${watchedFlight.currentPrice} -> ${newPrice}`);
                            updated++;
                        } else {
                            // Even if price/date same, update lastChecked to show we tried
                            await prisma.watchedFlight.update({
                                where: { id: watchedFlight.id },
                                data: {
                                    lastChecked: new Date()
                                }
                            });
                            console.log(`[CRON] ${watchedFlight.flightNumber}: No change (updated timestamp)`);
                        }
                    } else {
                        console.log(`[CRON] Flight ${watchedFlight.flightNumber} not found in search results`);
                        failed++;
                    }
                }

                // Rate limiting - wait 1 second between route searches
                await new Promise(resolve => setTimeout(resolve, 1000));

            } catch (searchError) {
                console.error(`[CRON] Search failed for ${routeKey}:`, searchError);
                failed += flights.length;
            }
        }

        console.log(`[CRON] Completed. Updated: ${updated}, Failed: ${failed}`);

        return NextResponse.json({
            success: true,
            message: 'Price update completed',
            stats: {
                total: activeFlights.length,
                updated,
                failed
            }
        });

    } catch (error) {
        console.error('[CRON] Fatal error:', error);
        return NextResponse.json(
            { error: 'Price update failed', details: String(error) },
            { status: 500 }
        );
    }
}
