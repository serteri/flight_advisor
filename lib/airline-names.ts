/**
 * Map of IATA airline codes to airline names
 * Add more as needed
 */
export const AIRLINE_NAMES: Record<string, string> = {
    // Major Airlines
    'QR': 'Qatar Airways',
    'TK': 'Turkish Airlines',
    'EK': 'Emirates',
    'LH': 'Lufthansa',
    'BA': 'British Airways',
    'AF': 'Air France',
    'KL': 'KLM',
    'AA': 'American Airlines',
    'UA': 'United Airlines',
    'DL': 'Delta Air Lines',
    'SQ': 'Singapore Airlines',
    'EY': 'Etihad Airways',
    'QF': 'Qantas',
    'CX': 'Cathay Pacific',
    'AY': 'Finnair',
    'LX': 'Swiss International Air Lines',
    'OS': 'Austrian Airlines',
    'IB': 'Iberia',
    'AZ': 'ITA Airways',
    'SK': 'Scandinavian Airlines',
    'JL': 'Japan Airlines',
    'NH': 'All Nippon Airways',
    'KE': 'Korean Air',
    'OZ': 'Asiana Airlines',
    'AC': 'Air Canada',
    'NZ': 'Air New Zealand',
    'SA': 'South African Airways',
    'ET': 'Ethiopian Airlines',
    'MS': 'EgyptAir',
    'SV': 'Saudia',
    'GF': 'Gulf Air',
    'RJ': 'Royal Jordanian',
    'PC': 'Pegasus Airlines',
    'VY': 'Vueling',
    'FR': 'Ryanair',
    'U2': 'easyJet',
    'W6': 'Wizz Air',
    'FZ': 'flydubai',
    'WY': 'Oman Air',
    'SU': 'Aeroflot',
    'PS': 'Ukraine International Airlines',
    'LO': 'LOT Polish Airlines',
    'OK': 'Czech Airlines',
    'JU': 'Air Serbia',
    'A3': 'Aegean Airlines',
    'TP': 'TAP Air Portugal',
    'UX': 'Air Europa',
};

/**
 * Get airline name from IATA code
 * Returns the full name if known, otherwise returns the code
 */
export function getAirlineName(iataCode: string): string {
    if (!iataCode) return '';
    return AIRLINE_NAMES[iataCode.toUpperCase()] || iataCode;
}