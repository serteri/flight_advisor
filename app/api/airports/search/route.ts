/**
 * Airport Search API
 * 
 * GET /api/airports/search?q=istanbul
 * Returns: Array of matching AIRPORTS ONLY (no POIs/districts)
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
        
        // CRITICAL: searchFallbackCities already filters to commercial airports only
        // Format for client consumption
        // Extract MAIN CITY NAME from "City, Country" format
        // e.g., "Bakırköy, Istanbul" → "Istanbul"
        const formatted = results.map(city => {
            // Get main city name - if contains comma, take the part after comma (the city)
            // Otherwise use whole name
            const rawCityName = (city.cityName || city.name || '').toString();
            const mainCity = rawCityName.includes(',') 
                ? rawCityName.split(',').pop()?.trim() || rawCityName
                : rawCityName;
            
            // ENSURE all fields are strings, not objects
            return {
                city: String(mainCity || 'Unknown'),
                iata: String(city.iataCode || 'XXX'),
                country: String(city.countryName || 'Unknown')
            };
        });

        console.log(`[/api/airports/search] Query: "${query}" -> Found ${formatted.length} airports`);

        return NextResponse.json(formatted, { status: 200 });
    } catch (error) {
        console.error('[API] Airport search error:', error);
        return NextResponse.json(
            { error: 'Search failed' },
            { status: 500 }
        );
    }
}
