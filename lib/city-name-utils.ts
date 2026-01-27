// City name normalization mapping
// Maps municipality/district names to actual city names for major airports
export const CITY_NAME_MAP: Record<string, string> = {
    // Istanbul districts
    'Arnavutköy': 'Istanbul',
    'Pendik': 'Istanbul',
    'Bakırköy': 'Istanbul',
    'Beylikdüzü': 'Istanbul',

    // Add more mappings here as we discover them
};

/**
 * Normalize a municipality/district name to the actual city name
 * Handles formats like:
 * - "Pendik, Istanbul" -> "Istanbul"
 * - "Arnavutköy" -> "Istanbul"  
 * - "Brisbane" -> "Brisbane"
 */
export function normalizeCityName(municipality: string): string {
    if (!municipality) return municipality;

    // If it contains a comma, take the last part (e.g., "Pendik, Istanbul" -> "Istanbul")
    if (municipality.includes(',')) {
        const parts = municipality.split(',').map(p => p.trim());
        return parts[parts.length - 1];
    }

    // Otherwise check the mapping
    return CITY_NAME_MAP[municipality] || municipality;
}

/**
 * Clean airport name by removing unnecessary suffixes
 * "Brisbane International Airport" -> "Brisbane International Airport" (keep for clarity)
 */
export function cleanAirportName(airportName: string): string {
    // We actually want to keep the full airport name for the subtitle
    // Just return as-is
    return airportName;
}
