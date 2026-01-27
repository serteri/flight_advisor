import { prisma } from "@/lib/prisma";
import { searchFlights } from "@/lib/flightApi";
import { evaluateFlightDeals } from "@/lib/llm";
import type { PriceSnapshot } from "@prisma/client";

export async function collectPriceSnapshot(routeId: string): Promise<PriceSnapshot | null> {
    try {
        // Fetch route details from database
        const route = await prisma.route.findUnique({
            where: { id: routeId },
        });

        if (!route) {
            console.error(`[PriceCollector] Route not found: ${routeId}`);
            return null;
        }

        console.log(`[PriceCollector] Collecting price for route: ${route.originCode} → ${route.destinationCode}`);

        // Convert endDate to return date string if exists
        const returnDate = route.endDate
            ? route.endDate.toISOString().split('T')[0]
            : undefined;

        // Fetch multiple flight options instead of just the cheapest
        const flights = await searchFlights(
            route.originCode,
            route.destinationCode,
            route.startDate.toISOString().split('T')[0],
            returnDate,
            route.cabin as any,
            5 // Get top 5 results for LLM to analyze
        );

        if (flights.length === 0) {
            console.log(`[PriceCollector] No flights found for route ${routeId}`);
            return null;
        }

        console.log(`[PriceCollector] Found ${flights.length} options. Evaluating with LLM...`);

        // Use LLM to score and pick the best one
        const bestDeal = await evaluateFlightDeals(
            route.originCode,
            route.destinationCode,
            flights
        );

        if (!bestDeal) {
            console.log(`[PriceCollector] LLM evaluation failed, falling back.`);
            return null;
        }

        const { flight, score, explanation } = bestDeal;

        console.log(`[PriceCollector] Selected: ${flight.carrier} - ${flight.price} ${flight.currency} (Score: ${score}/10)`);

        // Create price snapshot in database with new fields
        const snapshot = await prisma.priceSnapshot.create({
            data: {
                routeId: route.id,
                provider: flight.carrier,
                amount: flight.price,
                currency: flight.currency,
                score: score,
                explanation: explanation,
                duration: flight.duration,
                stops: flight.stops,
                timestamp: new Date(),
            },
        });

        // Update route's current price (using the SELECTED flight's price)
        await prisma.route.update({
            where: { id: route.id },
            data: {
                currentPrice: flight.price,
            },
        });

        return snapshot;
    } catch (error) {
        console.error(`[PriceCollector] Failed to collect price for route ${routeId}:`, error);
        return null;
    }
}
