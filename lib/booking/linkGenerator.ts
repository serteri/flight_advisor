import { normalizeSource } from '@/lib/utils';

export function generateBookingLink(flight: any): string | null {
    if (flight.deepLink) return flight.deepLink;
    if (flight.bookingLink) return flight.bookingLink;

    if (normalizeSource(flight.source) === 'duffel') {
        if (flight.id) return `https://app.duffel.com/offers/${flight.id}`;
        return null;
    }

    return null;
}
