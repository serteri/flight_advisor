// app/api/trips/monitor/route.ts
//
// Signed-in "Add booked trip". The browser sends { flightNumber, date, legKey, pnr }
// and nothing else is trusted: origin, destination and scheduled times come from
// the server's own FlightLookupCache entry (written by /api/flights/lookup), the
// same verified-leg flow /api/trips/track uses. No fresh cached lookup, a missing
// or unknown legKey: the request fails and nothing is saved.

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { auth } from '@/auth';
import { withFreemiumGate } from '@/lib/freemium/gate';
import { initializeTripMonitoring } from '@/lib/guardian/tripLifecycle';
import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { MAX_DAYS_AHEAD, validateFlightDate } from '@/lib/flights/flightDateRule';
import { getLookupCache } from '@/lib/flightData/formLookupStore';
import type { LookupCacheEntry } from '@/lib/flightData/formLookup';
import { normalizePnr, resolveMonitorSelection } from '@/lib/guardian/monitorSelection';

type MonitorPayload = {
    flightNumber?: string;
    date?: string;
    legKey?: string;
    pnr?: string;
};

const fieldError = (field: string, code: string, error: string) =>
    NextResponse.json({ error, field, code }, { status: 400 });

export async function POST(req: Request) {
    const session = await auth();
    if (!session?.user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const userId = session.user.id;
    if (!userId) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    const sessionUser = session.user as {
        isPremium?: boolean;
        plan?: string;
        subscriptionPlan?: string;
    };

    let body: MonitorPayload;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseFlightNumber(typeof body.flightNumber === 'string' ? body.flightNumber.trim() : '');
    if (!parsed) return fieldError('flightNumber', 'INVALID_FLIGHT', 'Invalid flight number format');

    const date = typeof body.date === 'string' ? body.date.trim() : '';
    const dateCheck = validateFlightDate(date);
    if (!dateCheck.ok) {
        const messages = {
            INVALID_DATE: 'Invalid date',
            DATE_PAST: 'Flight date is in the past',
            DATE_TOO_FAR: `Flight date is more than ${MAX_DAYS_AHEAD} days ahead`,
        } as const;
        return fieldError('date', dateCheck.code, messages[dateCheck.code]);
    }

    const pnr = normalizePnr(body.pnr);
    if (pnr === 'INVALID') return fieldError('pnr', 'INVALID_PNR', 'Invalid booking reference');

    let cache: LookupCacheEntry | null = null;
    try {
        cache = await getLookupCache(parsed.full, date);
    } catch (error) {
        console.error('[POST /api/trips/monitor] lookup cache unavailable:', error);
        return NextResponse.json({ error: 'Flight verification unavailable', code: 'SAVE_FAILED' }, { status: 503 });
    }

    const selection = resolveMonitorSelection({
        cache,
        date,
        departureDate: dateCheck.date,
        legKey: typeof body.legKey === 'string' ? body.legKey : null,
    });
    if (!selection.ok) {
        const messages = {
            FLIGHT_NOT_FOUND: 'We could not find this flight. Check the flight number and date.',
            INVALID_SEGMENT: 'The selected flight is no longer valid. Look up your flight again.',
        } as const;
        return fieldError(selection.code === 'FLIGHT_NOT_FOUND' ? 'flightNumber' : 'legKey', selection.code, messages[selection.code]);
    }
    const { segment: verified } = selection;

    try {
        return await withFreemiumGate(userId, 'monitored_trip', async () => {
            const trip = await prisma.monitoredTrip.create({
                data: {
                    userId,
                    pnr,
                    routeLabel: `${verified.origin} ➝ ${verified.destination}`,
                    originalPrice: 0,
                    currency: 'AUD',
                    ticketClass: 'ECONOMY',
                    nextCheckAt: new Date(),
                    // Leg resolved server-side: initializeTripMonitoring makes no second provider call.
                    flightVerifiedAt: new Date(),
                    snapshot: {
                        create: {
                            delayMinutes: 0,
                            status: 'scheduled',
                            dataQuality: 'UNKNOWN',
                            eu261Eligible: false,
                        },
                    },
                    segments: {
                        create: [{
                            segmentOrder: 0,
                            airlineCode: parsed.airlineCode,
                            flightNumber: parsed.number,
                            origin: verified.origin,
                            destination: verified.destination,
                            departureDate: dateCheck.date,
                            arrivalDate: verified.arrivalDate,
                            scheduledDepartureUtc: verified.scheduledDepartureUtc,
                            scheduledArrivalUtc: verified.scheduledArrivalUtc,
                        }],
                    },
                },
            });

            await initializeTripMonitoring(trip.id);

            return NextResponse.json({
                success: true,
                tripId: trip.id,
                flight: {
                    flightNumber: parsed.full,
                    origin: verified.origin,
                    destination: verified.destination,
                    date,
                },
            });
        }, {
            planHint: {
                isPremium: sessionUser.isPremium,
                plan: sessionUser.plan,
                subscriptionPlan: sessionUser.subscriptionPlan,
            },
        });
    } catch (error) {
        console.error('[TRIPS_MONITOR] Trip creation error', error);
        return NextResponse.json({ error: 'Could not start monitoring', code: 'SAVE_FAILED' }, { status: 500 });
    }
}
