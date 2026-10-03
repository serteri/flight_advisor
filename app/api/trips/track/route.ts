import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import { prisma } from '@/lib/prisma';
import { sendWelcomeEmail } from '@/lib/email/sender';
import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { MAX_DAYS_AHEAD, validateFlightDate } from '@/lib/flights/flightDateRule';
import { isEmailDeliveryReady } from '@/lib/featureFlags';
import {
    TRACK_RATE_WINDOW_MS,
    clientIpFromHeaders,
    evaluateTrackRateLimit,
    hashRequestIp,
} from '@/lib/guardian/trackRateLimit';

const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
// The link doubles as the opt-in confirmation, so it must survive until the
// subscriber actually opens their inbox.
const TOKEN_TTL_MS = 24 * 60 * 60 * 1000;

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

    // Field-specific errors: { error, field, code } so the form can show the
    // message under the right input (codes map to i18n keys there).
    const fieldError = (field: 'flightNumber' | 'date' | 'email' | 'consent', code: string, error: string) =>
        NextResponse.json({ error, field, code }, { status: 400 });

    const parsedFlight = parseFlightNumber(flightNumber);
    if (!parsedFlight) return fieldError('flightNumber', 'INVALID_FLIGHT', 'Invalid flight number format');
    const { airlineCode, number: flightDigits, full: fullFlightNumber } = parsedFlight;

    const dateCheck = validateFlightDate(date);
    if (!dateCheck.ok) {
        const messages = {
            INVALID_DATE: 'Invalid date',
            DATE_PAST: 'Flight date is in the past',
            DATE_TOO_FAR: `Flight date is more than ${MAX_DAYS_AHEAD} days ahead`,
        } as const;
        return fieldError('date', dateCheck.code, messages[dateCheck.code]);
    }
    const departureDate = dateCheck.date;

    if (!EMAIL_REGEX.test(email)) return fieldError('email', 'INVALID_EMAIL', 'Invalid email address');
    if (!consent) return fieldError('consent', 'CONSENT_REQUIRED', 'Consent is required to start tracking');

    const requestIpHash = hashRequestIp(
        clientIpFromHeaders(req.headers),
        process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET,
    );

    try {
        const windowStart = new Date(Date.now() - TRACK_RATE_WINDOW_MS);
        const [emailRecent, ipRecent] = await Promise.all([
            prisma.monitoredTrip.count({ where: { subscriberEmail: email, createdAt: { gte: windowStart } } }),
            requestIpHash
                ? prisma.monitoredTrip.count({ where: { requestIpHash, createdAt: { gte: windowStart } } })
                : Promise.resolve(null),
        ]);
        const rate = evaluateTrackRateLimit({ emailRecent, ipRecent });
        if (!rate.allowed) {
            console.warn(`[POST /api/trips/track] Rate limited (${rate.reason})`);
            return NextResponse.json(
                { error: 'Too many requests. Please try again later.' },
                { status: 429, headers: { 'Retry-After': String(TRACK_RATE_WINDOW_MS / 1000) } },
            );
        }

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
                requestIpHash,
                // Double opt-in: monitoring starts when the emailed link is opened.
                status: 'PENDING_CONFIRMATION',
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

        // Waitlist mode (sending domain not verified yet): keep the sign-up as
        // PENDING_CONFIRMATION, create no token, attempt no email.
        // scripts/send-pending-confirmations.ts emails them once delivery is on.
        if (!isEmailDeliveryReady()) {
            return NextResponse.json({ id: trip.id, pendingConfirmation: true, waitlist: true }, { status: 201 });
        }

        const token = randomBytes(32).toString('hex');
        await prisma.loginToken.create({
            data: {
                identifier: email,
                token,
                expiresAt: new Date(Date.now() + TOKEN_TTL_MS),
            },
        });

        const tripRedirectPath = `/dashboard/guardian/${trip.id}`;
        const emailResult = await sendWelcomeEmail(email, token, fullFlightNumber, tripRedirectPath);
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

        const responsePayload: { id: string; pendingConfirmation: true; devMagicLoginUrl?: string } = {
            id: trip.id,
            pendingConfirmation: true,
        };
        if (process.env.NODE_ENV !== 'production' && emailResult.previewUrl) {
            responsePayload.devMagicLoginUrl = emailResult.previewUrl;
        }

        return NextResponse.json(responsePayload, { status: 201 });
    } catch (error) {
        console.error('[POST /api/trips/track] Failed to create trip:', error);
        return NextResponse.json({ error: 'Failed to create trip' }, { status: 500 });
    }
}
