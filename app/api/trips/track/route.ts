import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const FLIGHT_NUMBER_REGEX = /^([A-Za-z]{2,3})\s*(\d{1,4}[A-Za-z]?)$/;

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

    try {
        const user = await prisma.user.upsert({
            where: { email },
            update: {},
            create: { email },
        });

        const now = new Date();
        const trip = await prisma.monitoredTrip.create({
            data: {
                userId: user.id,
                routeLabel: `Flight ${airlineCode}${flightDigits}`,
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
                        origin: 'UNK',
                        destination: 'UNK',
                        departureDate,
                        arrivalDate: departureDate,
                    }],
                },
            },
        });

        return NextResponse.json({ id: trip.id }, { status: 201 });
    } catch (error) {
        console.error('[POST /api/trips/track] Failed to create trip:', error);
        return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
    }
}
