import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/sender';
import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { initializeTripMonitoring } from '@/lib/guardian/tripLifecycle';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;
const DAY_MS = 24 * 60 * 60 * 1000;

type TrackTripPayload = {
    flightNumber?: string;
    date?: string;
    email?: string;
    consent?: boolean;
};

export async function POST(req: Request) {
    let body: TrackTripPayload;
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const flightNumber = (body.flightNumber || '').trim();
    const date = (body.date || '').trim();
    const email = (body.email || '').trim().toLowerCase();
    const consent = body.consent === true;

    if (!flightNumber || !date || !email) {
        return NextResponse.json({ error: 'flightNumber, date, and email are required' }, { status: 400 });
    }

    if (!EMAIL_REGEX.test(email)) {
        return NextResponse.json({ error: 'Invalid email address' }, { status: 400 });
    }

    if (!consent) {
        return NextResponse.json({ error: 'Consent is required to start tracking' }, { status: 400 });
    }

    const parsedFlight = parseFlightNumber(flightNumber);
    if (!parsedFlight) {
        return NextResponse.json({ error: 'Invalid flight number format' }, { status: 400 });
    }
    const { airlineCode, number: flightDigits, full: fullFlightNumber } = parsedFlight;

    const departureDate = DATE_REGEX.test(date) ? new Date(`${date}T00:00:00.000Z`) : new Date(NaN);
    if (Number.isNaN(departureDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }
    // One day of slack for travellers in timezones ahead of UTC.
    if (departureDate.getTime() < Date.now() - DAY_MS) {
        return NextResponse.json({ error: 'Flight date is in the past' }, { status: 400 });
    }

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email },
        });

        // Route and schedule are resolved by the registration lookup in
        // initializeTripMonitoring; until then the route is UNK.
        const now = new Date();
        const trip = await prisma.monitoredTrip.create({
            data: {
                userId: user.id,
                routeLabel: `Flight ${fullFlightNumber}`,
                originalPrice: 0,
                currency: 'AUD',
                ticketClass: 'UNKNOWN',
                subscriberEmail: email,
                consentGiven: consent,
                status: 'ACTIVE',
                routeUnknown: true,
                nextCheckAt: now,
                segments: {
                    create: [{
                        segmentOrder: 0,
                        airlineCode,
                        flightNumber: flightDigits,
                        origin: 'UNK',
                        destination: 'UNK',
                        departureDate,
                        arrivalDate: departureDate,
                    }],
                },
            },
        });

        const token = randomBytes(32).toString('hex');
        await prisma.loginToken.create({
            data: {
                identifier: email,
                token,
                expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
            },
        });

        const claimRedirectPath = `/claim-process/${trip.id}`;
        const emailResult = await sendWelcomeEmail(email, token, fullFlightNumber, claimRedirectPath);
        if (!emailResult.success) {
            const emailError = emailResult.error || 'Unknown email delivery failure';
            console.error(`[POST /api/trips/track] Welcome email failed for trip ${trip.id}: ${emailError}`);
            await Promise.all([
                prisma.monitoredTrip.update({
                    where: { id: trip.id },
                    data: { lastEmailError: emailError, lastEmailErrorAt: new Date() },
                }),
                prisma.loginToken.update({ where: { token }, data: { emailError } }),
            ]);
            return NextResponse.json(
                { error: 'We could not send the confirmation email. Please check the address and try again.' },
                { status: 502 },
            );
        }

        await initializeTripMonitoring(trip.id, now);

        const responsePayload: { id: string; devMagicLoginUrl?: string } = { id: trip.id };
        if (process.env.NODE_ENV !== 'production' && emailResult.previewUrl) {
            responsePayload.devMagicLoginUrl = emailResult.previewUrl;
        }

        return NextResponse.json(responsePayload, { status: 201 });
    } catch (error) {
        console.error('[POST /api/trips/track] Failed to create trip:', error);
        return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
    }
}
