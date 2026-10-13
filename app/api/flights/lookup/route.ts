// app/api/flights/lookup/route.ts
//
// POST { flightNumber, date } → the provider's legs for the sign-up form's
// "find my flight" step. Anonymous; protected by the per-IP limit, the 6-hour
// cache and the quota policy in lib/flightData/formLookup.ts. Provider trouble
// never turns into an error response: it answers 200 { status: 'SKIPPED' } and
// the form carries on as before.

import { NextResponse } from 'next/server';
import { parseFlightNumber } from '@/lib/flights/flightNumber';
import { MAX_DAYS_AHEAD, validateFlightDate } from '@/lib/flights/flightDateRule';
import { clientIpFromHeaders, hashRequestIp } from '@/lib/guardian/trackRateLimit';
import { runFormLookup } from '@/lib/flightData/formLookup';
import { prismaFormLookupDeps } from '@/lib/flightData/formLookupStore';
import { airlineDisplayName } from '@/lib/flights/legFormat';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
    let body: { flightNumber?: string; date?: string };
    try {
        body = await req.json();
    } catch {
        return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = parseFlightNumber((body.flightNumber || '').trim());
    if (!parsed) return NextResponse.json({ error: 'Invalid flight number format', field: 'flightNumber', code: 'INVALID_FLIGHT' }, { status: 400 });

    const date = (body.date || '').trim();
    const dateCheck = validateFlightDate(date);
    if (!dateCheck.ok) {
        const messages = {
            INVALID_DATE: 'Invalid date',
            DATE_PAST: 'Flight date is in the past',
            DATE_TOO_FAR: `Flight date is more than ${MAX_DAYS_AHEAD} days ahead`,
        } as const;
        return NextResponse.json({ error: messages[dateCheck.code], field: 'date', code: dateCheck.code }, { status: 400 });
    }

    const ipHash = hashRequestIp(clientIpFromHeaders(req.headers), process.env.NEXTAUTH_SECRET || process.env.AUTH_SECRET);

    let result;
    try {
        result = await runFormLookup({ flightNumber: parsed.full, date, ipHash }, prismaFormLookupDeps);
    } catch (error) {
        // Database trouble (cache/attempt tables): the lookup is optional, the form must still work.
        console.error('[POST /api/flights/lookup] failed:', error);
        return NextResponse.json({ status: 'SKIPPED', reason: 'UNAVAILABLE' });
    }

    if (result.status === 'RATE_LIMITED') {
        return NextResponse.json({ status: 'RATE_LIMITED' }, { status: 429, headers: { 'Retry-After': '3600' } });
    }
    if (result.status === 'FOUND') {
        return NextResponse.json({
            status: 'FOUND',
            options: result.options.map((o) => ({ ...o, airlineName: airlineDisplayName(o.airlineCode ?? parsed.airlineCode, o.airlineName) })),
        });
    }
    return NextResponse.json(result);
}
