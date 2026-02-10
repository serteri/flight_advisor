// lib/booking/linkGenerator.ts

interface FlightParams {
    origin: string;       // e.g. BNE
    destination: string;  // e.g. IST
    departureDate: string; // YYYY-MM-DD
    returnDate?: string;
    passengers?: number;
    source?: string; // Normalized to string to accept 'duffel' | 'RAPID_API' etc.
    deepLink?: string;    // If API provided a ready-to-use link
}

export function generateBookingLink(flight: FlightParams): string {
    const source = flight.source?.toUpperCase();

    // 1. If we already have a ready-to-use affiliate link (Rare case, e.g. from a specific partner API)
    if (flight.deepLink && source === 'AVIASALES') {
        return flight.deepLink;
    }

    // 2. BUILD THE LINK (For Duffel, RapidAPI, and others)
    // Goal: Redirect user to Aviasales search results with your MARKER.

    const marker = process.env.NEXT_PUBLIC_TRAVELPAYOUTS_MARKER || 'direct';
    const domain = process.env.NEXT_PUBLIC_TP_DOMAIN || "aviasales.com";

    // Date Format: Aviasales wants "DDMM" (e.g. 22 March -> 2203)
    const d = new Date(flight.departureDate);
    const day = String(d.getDate()).padStart(2, '0');
    const month = String(d.getMonth() + 1).padStart(2, '0');

    // Route Construction: BNE2203IST1 (1 Passenger, Economy default)
    const pax = flight.passengers || 1;
    let searchRoute = `${flight.origin}${day}${month}${flight.destination}${pax}`;

    // Add Return Date if exists
    if (flight.returnDate) {
        const r = new Date(flight.returnDate);
        const rDay = String(r.getDate()).padStart(2, '0');
        const rMonth = String(r.getMonth() + 1).padStart(2, '0');
        searchRoute += `${rDay}${rMonth}`;
    }

    // 🔥 FINAL LINK (Marker is crucial!)
    // Format: https://aviasales.com/search/BNE2203IST1?marker=12345&currency=AUD
    return `https://${domain}/search/${searchRoute}?marker=${marker}&currency=USD&locale=en`;
}
