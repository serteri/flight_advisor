import { NextResponse } from "next/server";
import { getAmadeusClient } from "@/lib/amadeus";

export async function GET() {
    try {
        const client = getAmadeusClient();

        // Use a date 30 days in the future
        const futureDate = new Date();
        futureDate.setDate(futureDate.getDate() + 30);
        const departureDate = futureDate.toISOString().split('T')[0];

        // Test with IST → LHR route
        const result = await client.searchFlights({
            originLocationCode: 'IST',
            destinationLocationCode: 'LHR',
            departureDate,
            adults: 1,
            currencyCode: 'TRY'
        });

        if (result.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'API working but no offers found',
                offers: 0
            });
        }

        return NextResponse.json({
            success: true,
            message: 'Amadeus API connected successfully!',
            offers: result.length,
            samplePrice: {
                total: result[0].price.total,
                currency: result[0].price.currency,
                carrier: result[0].validatingAirlineCodes[0]
            },
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('[Test] Amadeus API test failed:', error);

        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error',
            timestamp: new Date().toISOString()
        }, { status: 500 });
    }
}
