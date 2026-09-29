
import { NextResponse } from 'next/server';
import { getCurrentUserId } from '@/lib/auth/currentUser';
import { validateAndFetchPNR } from '@/services/flight/booking';
import { getRealFlightDetails } from '@/services/flight/schedule';

export async function POST(req: Request) {
    // Paid Amadeus quota (and, for PNR lookups, booking data): signed-in users only.
    const userId = await getCurrentUserId();
    if (!userId) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const body = await req.json();
        const { pnr, surname, flightNumber, carrierCode, date } = body;

        // Mode 1: PNR Validation
        if (pnr) {
            const result = await validateAndFetchPNR(pnr, surname);

            // MOCK OVERRIDE FOR DEMO (If API fails or explicit demo PNR used)
            if (!result.isValid && pnr.startsWith('TEST')) {
                return NextResponse.json({
                    isValid: true,
                    flight: {
                        pnr: pnr,
                        airline: 'TK',
                        flightNumber: '1984',
                        origin: 'IST',
                        destination: 'LHR',
                        date: new Date().toISOString().split('T')[0]
                    }
                });
            }

            return NextResponse.json({
                isValid: result.isValid,
                flight: result.isValid ? result : null,
                error: result.error
            });
        }

        // Mode 2: Flight Schedule Lookup (Alternative)
        if (flightNumber && carrierCode && date) {
            const flight = await getRealFlightDetails(carrierCode, flightNumber, date);
            return NextResponse.json({
                found: !!flight,
                flight
            });
        }

        return NextResponse.json({ error: 'Invalid Parameters' }, { status: 400 });

    } catch (error) {
        console.error("Validation API Error:", error);
        return NextResponse.json({ error: 'Server Error' }, { status: 500 });
    }
}
