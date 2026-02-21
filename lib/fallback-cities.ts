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

    const term = keyword.toLowerCase();
    const airports = loadAirports();
    
    if (!airports || airports.length === 0) {
        console.warn('[searchFallbackCities] No airports loaded');
        return [];
    }
    
    // Commercial airport types (passenger flights only)
    const COMMERCIAL_TYPES = ['large_airport', 'medium_airport', 'small_airport', 'regional_airport'];

    // Search in the library
    const results = airports.filter((airport: any) => {
        // Must have IATA code
        if (!airport || !airport.iata || airport.iata === "") return false;
        
        // Filter by airport type - only commercial/passenger airports
        // If type not specified, include it (gives benefit of doubt)
        if (airport.type && !COMMERCIAL_TYPES.includes(airport.type)) return false;

        // Safely check properties
        const cityName = airport.city?.toLowerCase() || '';
        const airportName = airport.name?.toLowerCase() || '';
        const iataCode = airport.iata?.toLowerCase() || '';

        // Match name/city/iata
        return (
            cityName.includes(term) ||
            airportName.includes(term) ||
            iataCode === term
        );
    });

    console.log(`[searchFallbackCities] Query: "${keyword}" -> Found ${results.length} airports`);

    // Return up to 100 for better search coverage
    return results.slice(0, 100).map(mapAirportToCityData);
}

export function getNearestFallbackCity(lat: number, lon: number): CityData | null {
    let nearest: any = null;
    let minDistance = Infinity;
    
    const airports = loadAirports();
    if (!airports || airports.length === 0) {
        console.warn('[getNearestFallbackCity] No airports loaded');
        return null;
    }
    
    const COMMERCIAL_TYPES = ['large_airport', 'medium_airport', 'small_airport', 'regional_airport'];

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
