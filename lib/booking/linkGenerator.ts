export function generateBookingLink(flight: any): string | null {
    if (flight.deepLink) return flight.deepLink;
    if (flight.bookingLink) return flight.bookingLink;

    if ((flight.source || '').toLowerCase() === 'duffel') {
        if (flight.id) return `https://app.duffel.com/offers/${flight.id}`;
        return null;
    }

    return null;
}
