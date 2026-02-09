import { FlightResult, HybridSearchParams } from '@/types/hybridFlight';

export async function searchRapidAPI(params: HybridSearchParams): Promise<FlightResult[]> {
    // Mocking RapidAPI (Skyscanner/Trip generic data)
    // Usually cheaper, sometimes less detail on aircraft

    await new Promise(resolve => setTimeout(resolve, 1200)); // Slightly slower

    return [
        {
            id: `rapid-${Date.now()}-1`,
            source: 'rapidapi',
            airline: 'China Eastern',
            flightNumber: 'MU716',
            aircraft: 'Airbus A330',
            from: params.origin,
            to: params.destination,
            departTime: '2026-03-10T09:00:00',
            arriveTime: '2026-03-11T20:00:00',
            duration: 1860, // Long layover
            stops: 2,
            price: 800,
            currency: 'USD',
            cabinClass: params.cabin || 'economy',
            baggage: 'checked',
            fareType: 'basic',
            seatComfortScore: 5.5,
            wifi: false,
            entertainment: false,
            power: false,
            meal: 'none',
            legroom: '71cm',
            aircraftAge: 15,
            layout: '2-4-2',
            delayRisk: 'high',
            bookingLink: 'https://skyscanner.com/...'
        },
        {
            id: `rapid-${Date.now()}-2`,
            source: 'rapidapi',
            airline: 'Emirates',
            flightNumber: 'EK415',
            aircraft: 'Airbus A380',
            from: params.origin,
            to: params.destination,
            departTime: '2026-03-10T06:00:00',
            arriveTime: '2026-03-10T22:00:00',
            duration: 960,
            stops: 1,
            price: 1400,
            currency: 'USD',
            cabinClass: params.cabin || 'economy',
            baggage: 'checked',
            fareType: 'flex',
            seatComfortScore: 9.5,
            wifi: true,
            entertainment: true,
            power: true,
            meal: 'included',
            legroom: '82cm',
            aircraftAge: 2,
            layout: '3-4-3',
            delayRisk: 'low',
            bookingLink: 'https://skyscanner.com/...'
        }
    ];
}
