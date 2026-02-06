// lib/guardian-logic.ts
import { TrackedFlight, FlightAnalysis } from '@/types/guardian';

/**
 * Canavar Analiz Motoru
 * Her uçuşu 6 farklı Canavar modülünden geçirir ve sonuçları döner
 */
export function analyzeFlightStatus(flight: TrackedFlight): FlightAnalysis {
    // 1. Schedule Change Detection
    const scheduleChangeMinutes = Math.abs(
        new Date(flight.departureTime).getTime() -
        new Date(flight.originalDepartureTime).getTime()
    ) / 60000;

    // 2. Disruption Hunter (180+ min = €600 kompanzasyon)
    const isDisrupted = flight.delayMinutes >= 180;

    // EU 261 Compensation calculation
    let compensationAmount = 0;
    if (isDisrupted) {
        // Distance-based (simplified - would need actual distance)
        compensationAmount = 600; // Max compensation
    }

    // 3. Schedule Guardian (15+ min değişim)
    const hasScheduleChange = scheduleChangeMinutes >= 15;

    // 4. Upgrade Sniper (Business/Economy ratio ≤ 1.5)
    const isSniperAlert = flight.currentBusinessPrice
        ? (flight.currentBusinessPrice / flight.pricePaid <= 1.5)
        : false;

    // 5. Junior Guardian (Çocuk yolcu + 60+ min rötar)
    const isJuniorAtRisk = (flight.passengers?.some(p => p.age < 12) && flight.delayMinutes > 60) || false;

    return {
        isDisrupted,
        hasScheduleChange,
        isSniperAlert,
        isJuniorAtRisk,
        compensationAmount,
        scheduleChangeMinutes
    };
}

/**
 * Dashboard istatistiklerini hesaplar
 */
export function calculateDashboardStats(flights: TrackedFlight[]): {
    totalFlights: number;
    disruptedFlights: number;
    potentialCompensation: number;
    activeAlerts: number;
    juniorPassengers: number;
} {
    const disruptedFlights = flights.filter(f => f.delayMinutes >= 180);
    const potentialCompensation = disruptedFlights.length * 600; // €600 per disrupted flight

    const activeAlerts = flights.filter(f => {
        const analysis = analyzeFlightStatus(f);
        return analysis.isDisrupted || analysis.hasScheduleChange || analysis.isSniperAlert;
    }).length;

    const juniorPassengers = flights.reduce((count, f) => {
        return count + (f.passengers?.filter(p => p.age < 12).length || 0);
    }, 0);

    return {
        totalFlights: flights.length,
        disruptedFlights: disruptedFlights.length,
        potentialCompensation,
        activeAlerts,
        juniorPassengers
    };
}
