import { FlightForScoring } from "@/lib/flightScoreEngine";

export async function searchSkyscannerFlights(
    _origin: string,
    _destination: string,
    _date: string,
): Promise<FlightForScoring[]> {
    return [];
}
