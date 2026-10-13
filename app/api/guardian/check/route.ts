// app/api/guardian/check/route.ts
//
// QStash delivery target for one planned trip checkpoint.
// POST /api/guardian/check?tripId=…&checkId=…  (body: { tripId, checkId, kind })
//
// Security: the Upstash-Signature header is verified with the QStash signing
// keys. Unsigned requests are accepted only in local development
// (NODE_ENV=development) so checks can be triggered by hand.
//
// Responses: 2xx for every business outcome (done/skipped/failed) so QStash
// does not retry and spend another provider call; 503 only when another
// worker holds the trip lease (safe to retry); 500 on unexpected errors.

import { NextResponse } from 'next/server';
import { isQStashAuthorized } from '@/lib/guardian/qstashAuth';
import { processTripCheck } from '@/workers/guardianWorker';
import { processPendingAlertRetries } from '@/services/notifications/alertRetryWorker';
import { expireDueAlertEvents } from '@/lib/alertLifecycle';
import { retriedFromHeader } from '@/lib/guardian/failureClass';
import { assertRequiredRuntimeEnv } from '@/lib/config/runtimeEnv';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const rawBody = await request.text();

    if (!(await isQStashAuthorized(request, rawBody, 'GuardianCheck'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const url = new URL(request.url);
    let body: { tripId?: string; checkId?: string } = {};
    try {
        body = rawBody ? JSON.parse(rawBody) : {};
    } catch {
        // Query parameters are authoritative; a malformed body is not fatal.
    }

    const tripId = url.searchParams.get('tripId') || body.tripId;
    const checkId = url.searchParams.get('checkId') || body.checkId || null;
    if (!tripId) {
        return NextResponse.json({ error: 'tripId is required' }, { status: 400 });
    }

    try {
        assertRequiredRuntimeEnv('guardian-check');
        const outcome = await processTripCheck(tripId, checkId, new Date(), retriedFromHeader(request.headers.get('upstash-retried')));

        // Housekeeping previously run by the removed polling cron. DB-only,
        // no provider calls.
        const [retries, expired] = await Promise.all([
            processPendingAlertRetries(),
            expireDueAlertEvents(),
        ]);

        const status = outcome.status === 'RETRY' ? 503 : 200;
        return NextResponse.json({ tripId, checkId, outcome, retries, expired: expired.count }, { status });
    } catch (error: any) {
        console.error(`[GuardianCheck] Unexpected failure for trip ${tripId} (check ${checkId}):`, error);
        return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
    }
}
