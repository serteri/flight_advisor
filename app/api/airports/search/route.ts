/**
 * Airport Search API
 * 
 * GET /api/airports/search?q=istanbul
 * Returns: Array of matching airports
 */

import { searchFallbackCities } from '@/lib/fallback-cities';
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
    const query = request.nextUrl.searchParams.get('q');

    if (!query || query.length < 2) {
        return NextResponse.json([], { status: 200 });
    }

    try {
        const results = searchFallbackCities(query);
        
        // Format for client consumption
        const formatted = results.map(city => ({
            city: city.cityName || city.name,
            iata: city.iataCode,
            country: city.countryName
        }));

        return NextResponse.json(formatted, { status: 200 });
    } catch (error) {
        console.error('[API] Airport search error:', error);
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}
