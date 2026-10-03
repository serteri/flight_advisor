// lib/flightData/mock.ts
//
// Scenario mocks for AeroDataBox, used everywhere except Vercel production
// (see client.ts). Fixtures are real-schema AeroDataBox payloads recorded on
// FIXTURE_BASE_DATE and shifted onto the requested flight date.
//
//   XX1000  on time (FRA→MAD)            XX1300  cancelled (MUC→FCO)
//   XX1180  arrives 185 min late (CDG→JFK) XX1999  route unknown
//   XX1240  arrives 245 min late (CDG→JFK) U21234  digit IATA code, intra-EU (BER→FCO)
//   XX404   flight does not exist (empty provider response → NOT_FOUND)
//   anything else → the on-time scenario with the requested flight number.

import XX1000 from './__fixtures__/XX1000.json';
import XX1180 from './__fixtures__/XX1180.json';
import XX1240 from './__fixtures__/XX1240.json';
import XX1300 from './__fixtures__/XX1300.json';
import XX1999 from './__fixtures__/XX1999.json';
import U21234 from './__fixtures__/U21234.json';
import type { AdbFlight } from './aerodatabox';

export const FIXTURE_BASE_DATE = '2026-01-15';

const SCENARIOS: Record<string, AdbFlight[]> = {
    XX1000: XX1000 as AdbFlight[],
    XX1180: XX1180 as AdbFlight[],
    XX1240: XX1240 as AdbFlight[],
    XX1300: XX1300 as AdbFlight[],
    XX1999: XX1999 as AdbFlight[],
    // Flight that does not exist: the provider returns no flights (live: 204/empty).
    XX404: [],
    U21234: U21234 as AdbFlight[],
};

export const MOCK_SCENARIO_FLIGHT_NUMBERS = Object.keys(SCENARIOS);

// Returns the raw AeroDataBox payload for a scenario, shifted to `date`.
export function getMockAeroDataBoxPayload(flightNumber: string, date: string): AdbFlight[] {
    const key = flightNumber.toUpperCase();
    const scenario = SCENARIOS[key];

    let json = JSON.stringify(scenario ?? SCENARIOS.XX1000);
    if (/^\d{4}-\d{2}-\d{2}$/.test(date)) {
        json = json.split(FIXTURE_BASE_DATE).join(date);
    }

    const payload = JSON.parse(json) as AdbFlight[];
    if (!scenario) {
        // Default scenario: keep the on-time data but report the requested number.
        const airlineIata = key.slice(0, 2);
        for (const flight of payload) {
            flight.number = `${airlineIata} ${key.slice(2)}`;
            flight.airline = { name: 'Mock Air', iata: airlineIata };
        }
    }
    return payload;
}
