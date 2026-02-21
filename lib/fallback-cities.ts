
// @ts-ignore
import airports from 'airports';

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

    // Search in the library
    const results = airports.filter((airport: any) => {
        // Must have IATA code
        if (!airport || !airport.iata || airport.iata === "") return false;

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

    // Limit and map results (return up to 50 for better search coverage)
    return results.slice(0, 50).map(mapAirportToCityData);
}

export function getNearestFallbackCity(lat: number, lon: number): CityData | null {
    let nearest: any = null;
    let minDistance = Infinity;

    // Iterate all airports
    for (const airport of airports) {
        const airportData = airport as any;
        if (!airportData.iata) continue;

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
