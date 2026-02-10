/**
 * Library to generate deep links for flight bookings.
 * Acts as a "Bridge" between our search results and affiliate partners.
 */

interface FlightParams {
    origin: string;      // e.g. BNE
    destination: string; // e.g. IST
    departureDate: string; // YYYY-MM-DD format (2026-06-15)
    returnDate?: string;   // Optional
    passengers?: number;
    source?: 'DUFFEL' | 'TRAVELPAYOUTS' | 'AMADEUS' | 'RAPIDAPI' | string;
    deepLink?: string; // If API provided a ready-to-use link
}

export function generateBookingLink(flight: FlightParams): string {
    // 1. If we already have a direct affiliate link (e.g. from RapidAPI/Kiwi), use it.
    if (flight.deepLink && (flight.source === 'TRAVELPAYOUTS' || flight.source === 'RAPIDAPI')) {
        return flight.deepLink;
    }

    // 2. For Duffel/Amadeus (or missing links), construct a search link for Aviasales/Skyscanner.
    // This ensures we monetize the traffic even if we didn't get a direct link.

    // Default to Aviasales (Travelpayouts White Label)
    const marker = process.env.NEXT_PUBLIC_TP_MARKER || 'direct';
    const domain = process.env.NEXT_PUBLIC_TP_DOMAIN || 'aviasales.com';

    // Date Formatting: YYYY-MM-DD -> DDMM (Aviasales format)
    // Example: 2026-06-15 -> 1506
    const depDateObj = new Date(flight.departureDate);
    const day = String(depDateObj.getDate()).padStart(2, '0');
    const month = String(depDateObj.getMonth() + 1).padStart(2, '0');
    const dateStr = `${day}${month}`;

    let route = `${flight.origin}${dateStr}${flight.destination}`;

    // Add Return Date if exists
    if (flight.returnDate) {
        const retDateObj = new Date(flight.returnDate);
        const rDay = String(retDateObj.getDate()).padStart(2, '0');
        const rMonth = String(retDateObj.getMonth() + 1).padStart(2, '0');
        route += `${rDay}${rMonth}`;
    }

    // Passenger count (Default 1)
    const pax = flight.passengers || 1;
    route += pax;

    // Final Link Construction
    // Format: https://aviasales.com/search/BNE1506IST1?marker=12345&currency=AUD
    return `https://${domain}/search/${route}?marker=${marker}&currency=USD&locale=en`;
}
