/**
 * Seed script: Add IST ↔ BNE round-trip itinerary as tracked flights.
 * Run: node scripts/seed-ist-bne-itinerary.js
 *
 * Itinerary (Google Flights):
 *   Outbound  TK54 IST→SIN + SQ245 SIN→BNE  (Tue 10 Jun 2026)
 *   Inbound   SQ246 BNE→SIN + TK55 SIN→IST  (Wed 15 Jul 2026)
 *   Passengers: 1 adult + 1 child  |  Economy  |  AUD 3 500  |  30 kg baggage
 */

const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

// ─── helpers ──────────────────────────────────────────────────────────────────
function diffMinutes(startIso, endIso) {
    return Math.round((new Date(endIso) - new Date(startIso)) / 60_000);
}

// ─── shared score snapshot ────────────────────────────────────────────────────
const scoreSnapshot = {
    recommendation: 'WATCH',
    confidence: 72,
    primaryReason: 'User-pasted itinerary — price tracking active, real-time data pending.',
    positiveFactor: 'Direct connection via Singapore on full-service carriers.',
    negativeFactor: 'Round-trip pricing split is estimated (50/50).',
    missingFactor: 'Live fare comparison not yet available for this route combination.',
    actionHint: 'Monitor for price drops over the next 2–4 weeks.',
    dataSourceType: 'USER_PASTED_ITINERARY',
    realTimeDataAvailable: false,
};

// ─── outbound ─────────────────────────────────────────────────────────────────
const outboundSegments = [
    {
        from: 'IST',
        to: 'SIN',
        carrier: 'TK',
        carrierName: 'Turkish Airlines',
        flightNumber: 'TK54',
        aircraft: 'Boeing 777-300ER',
        departure: '2026-06-10T02:00:00+03:00',
        arrival: '2026-06-10T17:45:00+08:00',
        duration: diffMinutes('2026-06-10T02:00:00+03:00', '2026-06-10T17:45:00+08:00'),
    },
    {
        from: 'SIN',
        to: 'BNE',
        carrier: 'SQ',
        carrierName: 'Singapore Airlines',
        flightNumber: 'SQ245',
        aircraft: 'Airbus A350-900',
        departure: '2026-06-10T20:10:00+08:00',
        arrival: '2026-06-11T05:55:00+10:00',
        duration: diffMinutes('2026-06-10T20:10:00+08:00', '2026-06-11T05:55:00+10:00'),
    },
];

const outboundLayovers = [
    {
        airport: 'SIN',
        city: 'Singapore',
        duration: diffMinutes('2026-06-10T17:45:00+08:00', '2026-06-10T20:10:00+08:00'),
    },
];

const outboundTotalMinutes =
    outboundSegments.reduce((sum, s) => sum + s.duration, 0) +
    outboundLayovers.reduce((sum, l) => sum + l.duration, 0);

// ─── inbound ──────────────────────────────────────────────────────────────────
const inboundSegments = [
    {
        from: 'BNE',
        to: 'SIN',
        carrier: 'SQ',
        carrierName: 'Singapore Airlines',
        flightNumber: 'SQ246',
        aircraft: 'Airbus A350-900',
        departure: '2026-07-15T23:50:00+10:00',
        arrival: '2026-07-16T05:45:00+08:00',
        duration: diffMinutes('2026-07-15T23:50:00+10:00', '2026-07-16T05:45:00+08:00'),
    },
    {
        from: 'SIN',
        to: 'IST',
        carrier: 'TK',
        carrierName: 'Turkish Airlines',
        flightNumber: 'TK55',
        aircraft: 'Boeing 777-300ER',
        departure: '2026-07-16T08:15:00+08:00',
        arrival: '2026-07-16T14:10:00+03:00',
        duration: diffMinutes('2026-07-16T08:15:00+08:00', '2026-07-16T14:10:00+03:00'),
    },
];

const inboundLayovers = [
    {
        airport: 'SIN',
        city: 'Singapore',
        duration: diffMinutes('2026-07-16T05:45:00+08:00', '2026-07-16T08:15:00+08:00'),
    },
];

const inboundTotalMinutes =
    inboundSegments.reduce((sum, s) => sum + s.duration, 0) +
    inboundLayovers.reduce((sum, l) => sum + l.duration, 0);

// ─── main ─────────────────────────────────────────────────────────────────────
async function main() {
    // Resolve user — prefer first user; script can be re-run safely
    const user = await prisma.user.findFirst({ orderBy: { createdAt: 'asc' } });
    const userId = user?.id ?? null;
    console.log(userId ? `Using user: ${user.email} (${userId})` : 'No user found — inserting without userId');

    const now = new Date().toISOString();

    // ── outbound ──────────────────────────────────────────────────────────────
    const outbound = await prisma.watchedFlight.create({
        data: {
            userId,
            flightNumber: 'TK54 +1',
            airline: 'Turkish Airlines +1',
            origin: 'IST',
            destination: 'BNE',
            departureDate: new Date('2026-06-10T02:00:00+03:00'),
            initialPrice: 1750,
            currentPrice: 1750,
            currency: 'AUD',
            priceHistory: [
                {
                    date: now,
                    price: 1750,
                    source: 'user_paste',
                    trackingType: 'ITINERARY_CANDIDATE',
                    scoreSnapshot,
                    trackingState: {
                        status: 'ACTIVE',
                        waitingForNextSnapshot: true,
                        limitedData: true,
                        realTimeDataUnavailable: true,
                        importantChanged: false,
                        note: 'Outbound leg of IST↔BNE round trip. 1 adult + 1 child. 30 kg checked baggage.',
                    },
                },
            ],
            status: 'ACTIVE',
            lastChecked: new Date(),
            totalDuration: outboundTotalMinutes,
            stops: 1,
            segments: outboundSegments,
            layovers: outboundLayovers,
            baggageWeight: 30,
            cabin: 'ECONOMY',
        },
    });

    // ── inbound ───────────────────────────────────────────────────────────────
    const inbound = await prisma.watchedFlight.create({
        data: {
            userId,
            flightNumber: 'SQ246 +1',
            airline: 'Singapore Airlines +1',
            origin: 'BNE',
            destination: 'IST',
            departureDate: new Date('2026-07-15T23:50:00+10:00'),
            initialPrice: 1750,
            currentPrice: 1750,
            currency: 'AUD',
            priceHistory: [
                {
                    date: now,
                    price: 1750,
                    source: 'user_paste',
                    trackingType: 'ITINERARY_CANDIDATE',
                    scoreSnapshot,
                    trackingState: {
                        status: 'ACTIVE',
                        waitingForNextSnapshot: true,
                        limitedData: true,
                        realTimeDataUnavailable: true,
                        importantChanged: false,
                        note: 'Return leg of IST↔BNE round trip. 1 adult + 1 child. 30 kg checked baggage.',
                    },
                },
            ],
            status: 'ACTIVE',
            lastChecked: new Date(),
            totalDuration: inboundTotalMinutes,
            stops: 1,
            segments: inboundSegments,
            layovers: inboundLayovers,
            baggageWeight: 30,
            cabin: 'ECONOMY',
        },
    });

    console.log('\n✅ Itinerary tracked successfully!\n');
    console.log('  Outbound ID :', outbound.id);
    console.log('  Route       : IST → BNE  (TK54 + SQ245)');
    console.log('  Departure   : Tue 10 Jun 2026 02:00 (IST local)');
    console.log(`  Duration    : ${Math.floor(outboundTotalMinutes / 60)}h ${outboundTotalMinutes % 60}m`);
    console.log('  Layover     : SIN', outboundLayovers[0].duration + 'm');

    console.log('\n  Inbound ID  :', inbound.id);
    console.log('  Route       : BNE → IST  (SQ246 + TK55)');
    console.log('  Departure   : Wed 15 Jul 2026 23:50 (BNE local)');
    console.log(`  Duration    : ${Math.floor(inboundTotalMinutes / 60)}h ${inboundTotalMinutes % 60}m`);
    console.log('  Layover     : SIN', inboundLayovers[0].duration + 'm');

    console.log('\n  Price       : AUD 1 750 per leg (AUD 3 500 total round trip)');
    console.log('  Cabin       : Economy  |  Baggage: 30 kg  |  Pax: 1 adult + 1 child\n');
}

main()
    .catch((e) => {
        console.error('❌ Seed failed:', e);
        process.exit(1);
    })
    .finally(() => prisma.$disconnect());
