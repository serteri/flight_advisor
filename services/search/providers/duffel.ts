import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

export async function searchDuffel(params: HybridSearchParams): Promise<FlightResult[]> {
    // In a real implementation, we would call the Duffel API here.
    // For now, we'll return mock data that looks like Duffel's NDC content.

    await new Promise(resolve => setTimeout(resolve, 800)); // Simulate API latency

    // Basic NDC-like results (Direct flights, major carriers)
    return [
        {
            id: `duffel-${Date.now()}-1`,
            source: 'duffel',
            airline: 'Qatar Airways',
            flightNumber: 'QR899',
            aircraft: 'Airbus A350-1000',
            from: params.origin,
            to: params.destination,
            departTime: '2026-03-10T22:10:00',
            arriveTime: '2026-03-11T11:55:00',
            duration: 825, // minutes
            stops: 1,
            price: 1142,
            currency: 'USD',
            cabinClass: params.cabin || 'economy',
            baggage: 'checked',
            fareType: 'standard',
            seatComfortScore: 8.5, // Mock data for enrichment later
            wifi: true,
            entertainment: true,
            power: true,
            meal: 'included',
            legroom: '79cm',
            aircraftAge: 3,
            layout: '3-3-3',
            delayRisk: 'low',
            bookingLink: 'https://duffel.com/book/...'
        },
        {
            id: `duffel-${Date.now()}-2`,
            source: 'duffel',
            airline: 'Turkish Airlines',
            flightNumber: 'TK9331',
            aircraft: 'Boeing 777-300ER',
            from: params.origin,
            to: params.destination,
            departTime: '2026-03-10T14:00:00',
            arriveTime: '2026-03-11T05:00:00',
            duration: 900,
            stops: 1,
            price: 1035,
            currency: 'USD',
            cabinClass: params.cabin || 'economy',
            baggage: 'checked',
            fareType: 'basic',
            seatComfortScore: 7.0,
            wifi: false,
            entertainment: true,
            power: false,
            meal: 'paid',
            legroom: '74cm',
            aircraftAge: 12,
            layout: '3-4-3',
            delayRisk: 'medium',
            bookingLink: 'https://duffel.com/book/...'
        }
    ];
}
