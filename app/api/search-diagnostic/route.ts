import { NextResponse } from 'next/server';
import { searchAllProviders } from '@/services/search/searchService';
import { HybridSearchParams } from '@/types/hybridFlight';

// Diagnostic endpoint to debug provider results
export const maxDuration = 300;
export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const origin = searchParams.get('origin');
    const destination = searchParams.get('destination');
    const date = searchParams.get('date');

    console.log(`🔍 [DIAGNOSTIC] Search: ${origin} -> ${destination} [${date}]`);
    console.log(`🔑 [DIAGNOSTIC] RAPID_API_KEY: ${process.env.RAPID_API_KEY ? process.env.RAPID_API_KEY.substring(0, 10) + '...' : 'NOT SET'}`);
    console.log(`🔑 [DIAGNOSTIC] RAPID_API_HOST_FLIGHT: ${process.env.RAPID_API_HOST_FLIGHT || 'NOT SET'}`);
    console.log(`🔑 [DIAGNOSTIC] DUFFEL_ACCESS_TOKEN: ${process.env.DUFFEL_ACCESS_TOKEN ? process.env.DUFFEL_ACCESS_TOKEN.substring(0, 10) + '...' : 'NOT SET'}`);

    try {
        const queryParams: HybridSearchParams = {
            origin: origin!,
            destination: destination!,
            date: date!,
            adults: parseInt(searchParams.get('adults') || '1'),
            children: parseInt(searchParams.get('children') || '0'),
            infants: parseInt(searchParams.get('infants') || '0'),
            cabin: (searchParams.get('cabin') || 'economy') as any,
            currency: searchParams.get('currency') || 'USD'
        };

        const allFlights = await searchAllProviders(queryParams);

        // Group by source
        const bySource: Record<string, any[]> = {};
        allFlights.forEach(f => {
            const src = f.source || 'unknown';
            if (!bySource[src]) bySource[src] = [];
            bySource[src].push(f);
        });

        const summary = {
            totalFlights: allFlights.length,
            bySource: Object.entries(bySource).reduce((acc, [src, flights]) => {
                acc[src] = flights.length;
                return acc;
            }, {} as Record<string, number>),
            timestamp: new Date().toISOString()
        };

        console.log(`✅ [DIAGNOSTIC] Summary:`, JSON.stringify(summary));

        return NextResponse.json({
            success: true,
            summary,
            flights: allFlights.slice(0, 5) // Just first 5 for diagnostics
        });

    } catch (error: any) {
        console.error(`🔥 [DIAGNOSTIC] ERROR:`, error.message, error.stack);
        return NextResponse.json({ 
            error: error.message,
            stack: error.stack 
        }, { status: 500 });
    }
}
