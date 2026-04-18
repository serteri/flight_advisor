import { buildTravelpayoutsLink } from '@/lib/monetization/travelpayouts';

export function generateBookingLink(flight: any): string {
    if (flight.deepLink) return flight.deepLink;
    if (flight.bookingLink) return flight.bookingLink;

    const src = (flight.source || '').toString().toUpperCase();
    if (src === 'DUFFEL') {
        if (flight.id) return `https://app.duffel.com/offers/${flight.id}`;
        return '#';
    }

    const origin = flight.origin || flight.from;
    const destination = flight.destination || flight.to;
    const departureTime = flight.departTime || flight.departureTime;

    if (!origin || !destination || !departureTime) return '#';

    const date = departureTime.includes('T') ? departureTime.split('T')[0] : departureTime;

    return buildTravelpayoutsLink({ origin, destination, date });
}
