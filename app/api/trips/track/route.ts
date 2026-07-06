import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { getFlightRoute } from '@/lib/api/aviationstack';
import { sendWelcomeEmail } from '@/lib/email/sender';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FLIGHT_NUMBER_REGEX = /^([A-Za-z]{2,3})\s*(\d{1,4}[A-Za-z]?)$/;
const TOKEN_TTL_MS = 15 * 60 * 1000;

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

    const flightNumber = (body.flightNumber || '').trim().toUpperCase();
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

    const flightMatch = flightNumber.match(FLIGHT_NUMBER_REGEX);
    if (!flightMatch) {
        return NextResponse.json({ error: 'Invalid flight number format' }, { status: 400 });
    }
    const [, airlineCode, flightDigits] = flightMatch;

    const departureDate = new Date(date);
    if (Number.isNaN(departureDate.getTime())) {
        return NextResponse.json({ error: 'Invalid date' }, { status: 400 });
    }

    const fullFlightNumber = `${airlineCode}${flightDigits}`;

    try {
        let originIata = 'UNK';
        let destinationIata = 'UNK';

        const cachedRoute = await prisma.flightRouteCache.findUnique({
            where: { flightNumber: fullFlightNumber },
        });

        if (cachedRoute) {
            originIata = cachedRoute.originIata;
            destinationIata = cachedRoute.destinationIata;
        } else {
            const route = await getFlightRoute(fullFlightNumber);
            if (!('error' in route)) {
                originIata = route.originIata;
                destinationIata = route.destinationIata;

                await prisma.flightRouteCache.create({
                    data: {
                        flightNumber: fullFlightNumber,
                        originIata,
                        destinationIata,
                    },
                });
            } else {
                console.warn(`[POST /api/trips/track] Could not resolve route for ${fullFlightNumber}: ${route.message}`);
            }
        }

        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email },
        });

        const now = new Date();
        const trip = await prisma.monitoredTrip.create({
            data: {
                userId: user.id,
                routeLabel: originIata !== 'UNK' && destinationIata !== 'UNK'
                    ? `${originIata} ➝ ${destinationIata}`
                    : `Flight ${fullFlightNumber}`,
                originalPrice: 0,
                currency: 'AUD',
                ticketClass: 'UNKNOWN',
                subscriberEmail: email,
                consentGiven: consent,
                status: 'ACTIVE',
                nextCheckAt: now,
                segments: {
                    create: [{
                        segmentOrder: 0,
                        airlineCode,
                        flightNumber: flightDigits,
                        origin: originIata,
                        destination: destinationIata,
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
            console.warn(`[POST /api/trips/track] Welcome email failed for trip ${trip.id}: ${emailResult.error}`);
        }

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
