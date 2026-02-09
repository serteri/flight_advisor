import { FlightResult } from '@/types/hybridFlight';

export function scoreFlight(flight: FlightResult): number {
    let score = 10;

    // 1. Price Factor (Lower price is better, but not linear)
    if (flight.price > 1000) score -= 1;
    if (flight.price > 1500) score -= 2;

    // 2. Duration & Stops
    if (flight.duration > 1000) score -= 1;
    if (flight.duration > 1500) score -= 2;
    score -= (flight.stops * 1.5);

    // 3. Comfort & Amenities
    if (flight.seatComfortScore && flight.seatComfortScore > 8) score += 0.5;
    if (flight.wifi) score += 0.5;
    if (flight.entertainment) score += 0.5;
    if (flight.power) score += 0.3;
    if (flight.meal === 'included') score += 0.5;
    if (flight.aircraftAge && flight.aircraftAge < 5) score += 0.5; // Newer planes are better

    // 4. Layout Penalty (e.g. 3-4-3 is crowded)
    if (flight.layout === '3-4-3') score -= 0.5;

    // 5. Risk Factors
    if (flight.delayRisk === 'high') score -= 2;
    if (flight.delayRisk === 'medium') score -= 1;

    return Math.max(1, Math.min(10, Number(score.toFixed(1)))); // Minimum 1, Max 10
}

export function generateInsights(flight: FlightResult): { pros: string[], cons: string[], stressMap: string[], recommendationText: string } {
    const pros: string[] = [];
    const cons: string[] = [];

    // Pros
    if (flight.price < 800) pros.push('Great Price');
    if (flight.stops === 0) pros.push('Direct Flight');
    if (flight.wifi) pros.push('Wi-Fi Available');
    if (flight.entertainment) pros.push('In-flight Entertainment');
    if (flight.meal === 'included') pros.push('Meal Included');
    if (flight.power) pros.push('USB/Power Ports');
    if (flight.aircraftAge && flight.aircraftAge < 5) pros.push('Modern Aircraft');
    if (flight.seatComfortScore && flight.seatComfortScore > 8) pros.push('High Seat Comfort');
    if (flight.layout === '2-4-2') pros.push('Good Layout (2-4-2)');

    // Cons
    if (flight.stops > 1) cons.push('Multiple Stops');
    if (flight.delayRisk === 'high') cons.push('High Delay Risk');
    if (flight.duration > 1200) cons.push('Long Duration');
    if (!flight.wifi) cons.push('No Wi-Fi');
    if (flight.meal === 'paid') cons.push('Meal Not Included');
    if (flight.layout === '3-4-3') cons.push('Crowded Layout (3-4-3)');

    // Recommendation Text Generation
    let sentiment = "average";
    if (scoreFlight(flight) > 8) sentiment = "excellent";
    if (scoreFlight(flight) < 5) sentiment = "poor";

    let recommendationText = "";
    if (sentiment === "excellent") {
        recommendationText = `This is a top-tier choice. With a score of ${scoreFlight(flight)}, it balances price and comfort perfectly. ${flight.entertainment ? "Enjoy the movies!" : ""}`;
    } else if (sentiment === "poor") {
        recommendationText = `This flight has a low score (${scoreFlight(flight)}) due to likely delays or poor amenities. Consider paying a bit more for a better experience.`;
    } else {
        recommendationText = `A solid option (${scoreFlight(flight)}/10). It gets you there, but lacks some premium amenities.`;
    }

    return {
        pros,
        cons,
        stressMap: flight.stops > 1 ? ['Check-in: Low', 'Connection: High', 'Arrival: Medium'] : ['Check-in: Low', 'Flight: Low', 'Arrival: Low'],
        recommendationText
    };
}
