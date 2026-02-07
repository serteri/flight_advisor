import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { addFlightCheckJob } from '@/workers/queue';
import { searchFlights } from '@/lib/amadeus';

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
                    // Find matching flight by flight number (Robust Check)
                    const matchingOffer = searchResults.data.find((offer: any) => {
                        const offerSegments = offer.itineraries?.[0]?.segments || [];

                        // 1. Strict Segment Match (if segments exist in DB)
                        if (Array.isArray(watchedFlight.segments) && (watchedFlight.segments as any[]).length > 0) {
                            const wfSegments = watchedFlight.segments as any[];
                            if (wfSegments.length !== offerSegments.length) return false;

                            // Check all segments
                            return wfSegments.every((wfSeg, idx) => {
                                const offerSeg = offerSegments[idx];
                                const offerFlightNum = `${offerSeg.carrierCode}${offerSeg.number}`;
                                return offerFlightNum === wfSeg.flightNumber.replace(/\s/g, '');
                            });
                        }

                        // 2. Fallback: Main Flight Number Check
                        // Sanitize (remove spaces, e.g. "CI 54" -> "CI54")
                        const targetFn = watchedFlight.flightNumber.replace(/\s/g, '');
                        return offerSegments.some((seg: any) =>
                            `${seg.carrierCode}${seg.number}` === targetFn
                        );
                    });

                    if (matchingOffer) {
                        const newPrice = parseFloat(matchingOffer.price?.total || '0');
                        const currentHistory = (watchedFlight.priceHistory as any[]) || [];

                        // Only add to history if price changed or it's a new day
                        const lastEntry = currentHistory[currentHistory.length - 1];
                        const today = new Date().toISOString().split('T')[0];
                        const lastDate = lastEntry?.date ? new Date(lastEntry.date).toISOString().split('T')[0] : null;

                        // Log significantly different prices (anomaly detection)
                        if (Math.abs(newPrice - (watchedFlight.currentPrice || 0)) > 5000) {
                            console.warn(`[CRON] Large price swing for ${watchedFlight.flightNumber}: ${watchedFlight.currentPrice} -> ${newPrice}`);
                        }

                        // Check if we need to add a new history point
                        // 1. If no history exists
                        // 2. If it's a new day (even if price is same) -> User wants daily graph points
                        // 3. If price changed intraday
                        const isNewDay = lastDate !== today;
                        const hasPriceChanged = lastEntry?.price !== newPrice;

                        if (!lastEntry || isNewDay || hasPriceChanged) {
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

                            const changeType = hasPriceChanged ? (newPrice > (lastEntry?.price || 0) ? 'Price Change' : 'Price Change') : 'Daily Log';
                            console.log(`[CRON] ${watchedFlight.flightNumber}: ${changeType} at ${newPrice} (History updated)`);
                            updated++;
                        } else {
                            // Only update timestamp if we already logged a price for today and it hasn't changed
                            await prisma.watchedFlight.update({
                                where: { id: watchedFlight.id },
                                data: { lastChecked: new Date() }
                            });
                            console.log(`[CRON] ${watchedFlight.flightNumber}: Stable at ${newPrice} (Intraday check)`);
                        }
                    } else {
                        console.log(`[CRON] Flight ${watchedFlight.flightNumber} not found in search results. (Params: ${origin}->${destination} ${dateStr})`);
                        // Still update lastChecked to show we tried (and maybe mark as potentially unavailable?)
                        await prisma.watchedFlight.update({
                            where: { id: watchedFlight.id },
                            data: { lastChecked: new Date() }
                        });
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
