
import { calculateUniversalScore } from '../lib/flightConsultant';
import { BatchStats } from '../lib/flightStatistics';
import { FlightForScoring } from '../lib/flightTypes';

const mockStats: BatchStats = {
    minPrice: 1000,
    maxPrice: 4000,
    medianPrice: 1500,
    minDuration: 1200,
    maxDuration: 2400,
    p10Price: 1100
};

const createFlight = (id: string, price: number, duration: number, stops: number): FlightForScoring => ({
    id,
    price,
    currency: 'AUD',
    duration,
    stops,
    carrier: 'TK',
    carrierName: 'Turkish Airlines',
    departureTime: '2024-01-01T10:00:00',
    arrivalTime: '2024-01-02T10:00:00',
    layoverHoursTotal: stops > 0 ? 2 : 0,
    layovers: stops > 0 ? [{ airport: 'SIN', duration: 120 }] : [],
    baggageWeight: 30, // Good bag
    isSelfTransfer: false,
    amenities: { hasMeals: true, hasEntertainment: true, tier: 'TIER_1' } // Top tier
} as any);

const flights = [
    createFlight('flight_best', 1050, 1200, 1),   // 1.05x - Best
    createFlight('flight_mid', 1800, 1300, 1),    // 1.8x  - Expensive
    createFlight('flight_high', 2600, 1250, 1),   // 2.6x  - Overpriced
    createFlight('flight_insane', 4000, 1200, 1), // 4.0x  - Insane
];

console.log('--- SCORING TEST ---');
flights.forEach(f => {
    const result = calculateUniversalScore(f, mockStats);
    console.log(`Flight P=${f.price} Ratio=${(f.price / mockStats.minPrice).toFixed(1)}x`);
    console.log(`Score: ${result.score}`);
    console.log(`Penalties: ${result.penalties.join(', ')}`);
    console.log(`Bonuses: ${result.bonuses.join(', ')}\n`);
});
