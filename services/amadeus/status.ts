// services/amadeus/status.ts

export interface FlightStatusResponse {
    flightNumber: string;
    departureDate: Date;
    status: 'ON_TIME' | 'DELAYED' | 'CANCELLED';
    delayMinutes: number;
    hasScheduleChange: boolean;
    newDepartureTime?: Date;
    newArrivalTime?: Date;
}

/**
 * MOCK: Check flight status via Amadeus (Simulated)
 */
export async function checkAmadeusFlightStatus(
    flightNumber: string,
    departureDate: Date
): Promise<FlightStatusResponse> {
    // Simulate API latency
    await new Promise(resolve => setTimeout(resolve, 500));

    // RANDOM SIMULATION LOGIC:
    // 10% chance of delay, 5% chance of schedule change, 1% chance of cancellation
    const rand = Math.random();

    let status: 'ON_TIME' | 'DELAYED' | 'CANCELLED' = 'ON_TIME';
    let delayMinutes = 0;
    let hasScheduleChange = false;

    // Simulate Delay
    if (rand > 0.90) {
        status = 'DELAYED';
        delayMinutes = Math.floor(Math.random() * 240); // 0-240 mins delay
    }

    // Simulate Cancellation
    if (rand > 0.99) {
        status = 'CANCELLED';
        delayMinutes = 0;
    }

    // Simulate Schedule Change (Time slot moved)
    if (rand > 0.85 && rand <= 0.90) {
        hasScheduleChange = true;
    }

    // DEBUG OVERRIDE: If flight number is 'TEST600' force >180 min delay
    if (flightNumber === 'TEST600') {
        status = 'DELAYED';
        delayMinutes = 190;
    }

    return {
        flightNumber,
        departureDate,
        status,
        delayMinutes,
        hasScheduleChange
    };
}
