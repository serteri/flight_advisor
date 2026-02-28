// Load airport data from CSV (all commercial airports worldwide)
let airportCache: any[] = [];

function loadAirports() {
    if (airportCache.length > 0) return airportCache;
    
    try {
        // Only run on server side
        if (typeof window !== 'undefined') {
            console.warn('[Airports] CSV loading attempted on client side');
            return [];
        }
        
        const fs = require('fs');
        const path = require('path');
        
        const csvPath = path.join(process.cwd(), 'data', 'airports.csv');
        const csvData = fs.readFileSync(csvPath, 'utf-8');
        const lines = csvData.split('\n').slice(1); // Skip header
        
        // CSV columns: [0]id, [1]ident, [2]type, [3]name, [4]latitude_deg, [5]longitude_deg, [8]iso_country, [10]municipality, [11]scheduled_service, [13]iata_code
        
        airportCache = lines
            .map((line: string) => {
                if (!line.trim()) return null;
                
                // Parse CSV line with proper quoted field handling
                const fields: string[] = [];
                let currentField = '';
                let insideQuotes = false;
                
                for (let i = 0; i < line.length; i++) {
                    const char = line[i];
                    const nextChar = line[i + 1];
                    
                    if (char === '"') {
                        if (insideQuotes && nextChar === '"') {
                            // Escaped quote - add one quote
                            currentField += '"';
                            i++; // Skip next quote
                        } else {
                            // Toggle quote state
                            insideQuotes = !insideQuotes;
                        }
                    } else if (char === ',' && !insideQuotes) {
                        // End of field
                        fields.push(currentField.trim());
                        currentField = '';
                    } else {
                        currentField += char;
                    }
                }
                
                // Add last field
                if (currentField || fields.length > 0) {
                    fields.push(currentField.trim());
                }
                
                if (fields.length < 14) return null;
                
                // Remove quotes from fields
                const clean = (f: string) => f.replace(/^"/, '').replace(/"$/, '').trim();
                
                const iataCode = clean(fields[13]);
                const type = clean(fields[2]);
                
                // Must have 3-letter IATA code
                if (!iataCode || iataCode.length !== 3) return null;
                
                return {
                    iata: iataCode,
                    name: clean(fields[3]),
                    city: clean(fields[10]), // municipality
                    country: clean(fields[8]),
                    type: type,
                    lat: parseFloat(clean(fields[4])) || 0,
                    lon: parseFloat(clean(fields[5])) || 0,
                };
            })
            .filter((a: any) => a !== null);
            
        console.log(`[Airports] Loaded ${airportCache.length} airports from CSV (file: ${csvPath})`);
        return airportCache;
    } catch (error) {
        console.error('[Airports] Error loading CSV:', error);
        return [];
    }
}

export interface CityData {
    iataCode: string;
    name: string;
    cityName: string;
    countryName: string;
    type: "CITY" | "AIRPORT";
    lat: number;
    lon: number;
}

const COMMERCIAL_TYPES = ['large_airport', 'medium_airport', 'small_airport', 'regional_airport'];

const normalizeSearchText = (value: string): string =>
    value
        .toLowerCase()
        .replace(/ı/g, 'i')
        .replace(/İ/g, 'i')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9\s]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();

const getBigrams = (value: string): Set<string> => {
    const text = value.replace(/\s+/g, '');
    if (text.length < 2) {
        return new Set(text ? [text] : []);
    }

    const grams: string[] = [];
    for (let index = 0; index < text.length - 1; index += 1) {
        grams.push(text.slice(index, index + 2));
    }

    return new Set(grams);
};

const diceSimilarity = (a: string, b: string): number => {
    if (!a || !b) return 0;
    if (a === b) return 1;

    const gramsA = getBigrams(a);
    const gramsB = getBigrams(b);
    if (gramsA.size === 0 || gramsB.size === 0) return 0;

    let overlap = 0;
    gramsA.forEach((gram) => {
        if (gramsB.has(gram)) overlap += 1;
    });

    return (2 * overlap) / (gramsA.size + gramsB.size);
};

const airportTypePriority = (type: string): number => {
    switch (type) {
        case 'large_airport':
            return 3;
        case 'medium_airport':
            return 2;
        case 'small_airport':
            return 1;
        default:
            return 0;
    }
};

// Helper to convert airports entry to our CityData format
function mapAirportToCityData(airport: any): CityData {
    return {
        iataCode: airport.iata,
        name: airport.city || airport.name, // Use city name, not airport name
        cityName: airport.city,
        countryName: airport.country,
        type: "CITY", // Mark as CITY, not AIRPORT
        // Handle various coordinate field names and ensure they are numbers
        lat: parseFloat(airport.lat || airport.latitude || "0"),
        lon: parseFloat(airport.lon || airport.long || airport.longitude || "0")
    };
}

export function searchFallbackCities(keyword: string): CityData[] {
    if (!keyword) return [];

    const termRaw = keyword.trim();
    const term = normalizeSearchText(termRaw);
    if (!term) return [];

    const iataTerm = termRaw.toUpperCase();
    const isThreeLetterIataQuery = /^[A-Za-z]{3}$/.test(termRaw);
    const fuzzyThreshold = 0.75;
    const airports = loadAirports();
    
    if (!airports || airports.length === 0) {
        console.warn('[searchFallbackCities] No airports loaded');
        return [];
    }
    
    const exactIataMatches = airports.filter((airport: any) => {
        const iataCode = (airport?.iata || '').toString().toUpperCase();
        return iataCode === iataTerm;
    });

    if (isThreeLetterIataQuery && exactIataMatches.length > 0) {
        return exactIataMatches.slice(0, 10).map(mapAirportToCityData);
    }

    const scored = airports
        .map((airport: any) => {
            if (!airport || !airport.iata || airport.iata === '') return null;
            if (airport.type && !COMMERCIAL_TYPES.includes(airport.type)) return null;

            const iataCode = (airport.iata || '').toString().toUpperCase();
            const cityNameRaw = (airport.city || '').toString();
            const airportNameRaw = (airport.name || '').toString();
            const cityName = normalizeSearchText(cityNameRaw);
            const airportName = normalizeSearchText(airportNameRaw);

            const cityStarts = cityName.startsWith(term);
            const airportStarts = airportName.startsWith(term);
            const cityTokenStarts = cityName.split(' ').some((part) => part.startsWith(term));
            const airportTokenStarts = airportName.split(' ').some((part) => part.startsWith(term));
            const iataStarts = iataCode.startsWith(iataTerm);
            const cityIncludes = term.length >= 3 && cityName.includes(term);
            const airportIncludes = term.length >= 3 && airportName.includes(term);

            const citySimilarity = diceSimilarity(term, cityName);
            const airportSimilarity = diceSimilarity(term, airportName);
            const bestSimilarity = Math.max(citySimilarity, airportSimilarity);
            const fuzzyMatch = bestSimilarity >= fuzzyThreshold;

            const hasStrongMatch =
                iataStarts || cityStarts || airportStarts || cityTokenStarts || airportTokenStarts || fuzzyMatch || cityIncludes || airportIncludes;

            if (!hasStrongMatch) {
                return null;
            }

            let score = 0;
            if (iataCode === iataTerm) score += 1000;
            else if (iataStarts) score += 700;

            if (cityStarts) score += 500;
            if (airportStarts) score += 420;
            if (cityTokenStarts) score += 320;
            if (airportTokenStarts) score += 260;
            if (cityIncludes) score += 120;
            if (airportIncludes) score += 80;
            if (fuzzyMatch) score += Math.round(bestSimilarity * 140);

            score += airportTypePriority(airport.type) * 15;

            return { airport, score };
        })
        .filter((item): item is { airport: any; score: number } => item !== null);

    scored.sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;

        const typeDelta = airportTypePriority((b.airport.type || '').toString()) - airportTypePriority((a.airport.type || '').toString());
        if (typeDelta !== 0) return typeDelta;

        const cityA = normalizeSearchText((a.airport.city || '').toString());
        const cityB = normalizeSearchText((b.airport.city || '').toString());
        return cityA.localeCompare(cityB);
    });

    const uniqueByIata = new Set<string>();
    const deduped = scored.filter(({ airport }) => {
        const code = (airport.iata || '').toString().toUpperCase();
        if (!code || uniqueByIata.has(code)) return false;
        uniqueByIata.add(code);
        return true;
    });

    console.log(`[searchFallbackCities] Query: "${keyword}" -> Found ${deduped.length} ranked airports`);

    return deduped.slice(0, 25).map(({ airport }) => mapAirportToCityData(airport));
}

export function getNearestFallbackCity(lat: number, lon: number): CityData | null {
    let nearest: any = null;
    let minDistance = Infinity;
    
    const airports = loadAirports();
    if (!airports || airports.length === 0) {
        console.warn('[getNearestFallbackCity] No airports loaded');
        return null;
    }
    
    // Iterate all airports
    for (const airport of airports) {
        const airportData = airport as any;
        if (!airportData.iata) continue;
        
        // Filter by airport type - only commercial/passenger airports
        if (airportData.type && !COMMERCIAL_TYPES.includes(airportData.type)) continue;

        const airportLat = parseFloat(airportData.lat || airportData.latitude);
        const airportLon = parseFloat(airportData.lon || airportData.long || airportData.longitude);

        if (isNaN(airportLat) || isNaN(airportLon)) continue;

        // Simple Euclidean distance squared
        const distSq = Math.pow(airportLat - lat, 2) + Math.pow(airportLon - lon, 2);

        if (distSq < minDistance) {
            minDistance = distSq;
            nearest = airport;
        }
    }

    // Check if within reasonable range (sqrt(25) = 5 degrees coverage)
    if (minDistance < 25 && nearest) {
        return mapAirportToCityData(nearest);
    }

    return null;
}
