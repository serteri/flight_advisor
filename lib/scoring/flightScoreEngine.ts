import { FlightResult } from '@/types/hybridFlight';

export function scoreFlight(flight: FlightResult): number {
    let score = 10;

    // 1. Price Factor (Lower price is better, but not linear)
    // Penalize high price
    if (flight.price > 1000) score -= 1;
    if (flight.price > 1500) score -= 2;

    // 2. Duration Factor
    if (flight.duration > 1000) score -= 1;
    if (flight.duration > 1500) score -= 2;

    // 3. Stops Factor
    score -= (flight.stops * 1.5);

    // 4. Comfort Factors
    if (flight.seatComfortScore && flight.seatComfortScore > 8) score += 1;
    if (flight.wifi) score += 0.5;

    // 5. Risk Factors
    if (flight.delayRisk === 'high') score -= 2;
    if (flight.delayRisk === 'medium') score -= 1;

    // Cap score between 0 and 10
    return Math.max(0, Math.min(10, Number(score.toFixed(1))));
}

export function generateInsights(flight: FlightResult): { pros: string[], cons: string[], stressMap: string[], recommendationText: string } {
    const pros: string[] = [];
    const cons: string[] = [];

    if (flight.price < 800) pros.push('Great Price');
    if (flight.stops === 0) pros.push('Direct Flight');
    if (flight.wifi) pros.push('Wi-Fi Onboard');
    if (flight.seatComfortScore && flight.seatComfortScore > 8) pros.push('High Comfort');

    if (flight.stops > 1) cons.push('Multiple Stops');
    if (flight.delayRisk === 'high') cons.push('High Delay Risk');
    if (flight.duration > 1200) cons.push('Long Duration');

    return {
        pros,
        cons,
        stressMap: flight.stops > 1 ? ['Check-in: Low', 'Connection: High'] : ['Check-in: Low', 'Flight: Low'],
        recommendationText: `Based on our analysis, this flight scores ${scoreFlight(flight)}/10. ${pros.length > cons.length ? 'It is a solid choice.' : 'Consider alternatives.'}`
    };
}
