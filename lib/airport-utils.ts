// @ts-ignore
import airports from 'airports';

/**
 * Get city name from airport IATA code
 * Returns city name or the airport code if not found
 */
export function getCityFromAirportCode(iataCode: string): string {
    if (!iataCode) return '';

    const airport = airports.find((a: any) => a.iata === iataCode.toUpperCase());

    if (airport && (airport as any).city) {
        return (airport as any).city;
    }

    // Fallback to the code itself if not found
    return iataCode;
}

/**
 * Get full airport information from IATA code
 */
export function getAirportInfo(iataCode: string): { city: string; name: string; country: string } | null {
    if (!iataCode) return null;

    const airport = airports.find((a: any) => a.iata === iataCode.toUpperCase()) as any;

    if (airport) {
        return {
            city: airport.city || iataCode,
            name: airport.name || '',
            country: airport.country || ''
        };
    }

    return null;
}