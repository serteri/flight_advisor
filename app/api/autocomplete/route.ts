import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { normalizeCityName } from "@/lib/city-name-utils";

// Global instance to prevent connection exhaustion in dev
// @ts-ignore
const prisma = global.prisma || new PrismaClient();
// @ts-ignore
if (process.env.NODE_ENV !== "production") global.prisma = prisma;

/**
 * Skyscanner-like Autocomplete
 * - Search ALL airports (not just major)
 * - Prioritize: exact code match > major airports > other airports
 * - Clean display names
 */

function cleanAirportName(airportName: string): string {
    return airportName
        .replace(/\s*International\s*Airport$/i, '')
        .replace(/\s*Airport$/i, '')
        .replace(/\s*Intl\.?\s*$/i, '')
        .replace(/\s*\(.*\)$/i, '')
        .trim();
}

export async function GET(req: NextRequest) {
    const q = req.nextUrl.searchParams.get("q");

    if (!q || q.trim().length < 2) {
        return NextResponse.json([]);
    }

    const keyword = q.trim().toUpperCase();
    const keywordLower = q.trim().toLowerCase();

    try {
        // Search ALL airports (not just major) - Skyscanner style
        const airports = await prisma.airport.findMany({
            where: {
                OR: [
                    { code: { equals: keyword, mode: 'insensitive' } }, // Exact IATA match
                    { name: { contains: keywordLower, mode: 'insensitive' } },
                    { code: { contains: keyword, mode: 'insensitive' } },
                    { city: { name: { contains: keywordLower, mode: 'insensitive' } } }
                ]
            },
            include: {
                city: true
            },
            take: 20 // Get more results for better sorting
        });

        // Score and sort results
        const scoredResults = airports.map((airport: any) => {
            let score = 0;

            // Exact IATA code match = highest priority
            if (airport.code.toUpperCase() === keyword) {
                score += 100;
            }
            // Code starts with query
            else if (airport.code.toUpperCase().startsWith(keyword)) {
                score += 50;
            }

            // Major airport bonus
            if (airport.isMajor) {
                score += 30;
            }

            // City name exact match
            if (airport.city?.name?.toLowerCase() === keywordLower) {
                score += 40;
            }
            // City name starts with query
            else if (airport.city?.name?.toLowerCase().startsWith(keywordLower)) {
                score += 20;
            }

            // Airport name contains query
            if (airport.name.toLowerCase().includes(keywordLower)) {
                score += 10;
            }

            return { airport, score };
        });

        // Sort by score descending, then by name
        scoredResults.sort((a: { airport: any; score: number }, b: { airport: any; score: number }) => {
            if (b.score !== a.score) return b.score - a.score;
            return a.airport.name.localeCompare(b.airport.name);
        });

        // Take top 10 results
        const topResults = scoredResults.slice(0, 10);

        // Map to response format
        const results = topResults.map(({ airport }: { airport: any }) => {
            const normalizedCity = normalizeCityName(airport.city?.name || '');
            const cleanedName = cleanAirportName(airport.name);

            return {
                city: normalizedCity,
                iata: airport.code,
                country: airport.city?.country || '',
                type: 'AIRPORT' as const,
                name: cleanedName,
                isMajor: airport.isMajor
            };
        });

        return NextResponse.json(results);

    } catch (error) {
        console.error('[autocomplete] DB Error:', error);
        return NextResponse.json([]);
    }
}
