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
import { Receiver } from '@upstash/qstash';
import { processTripCheck } from '@/workers/guardianWorker';
import { processPendingAlertRetries } from '@/services/notifications/alertRetryWorker';
import { expireDueAlertEvents } from '@/lib/alertLifecycle';
import { assertRequiredRuntimeEnv } from '@/lib/config/runtimeEnv';

export const dynamic = 'force-dynamic';

async function isAuthorized(request: Request, rawBody: string): Promise<boolean> {
    const signature = request.headers.get('upstash-signature');
    const currentSigningKey = process.env.QSTASH_CURRENT_SIGNING_KEY;
    const nextSigningKey = process.env.QSTASH_NEXT_SIGNING_KEY;

    if (!signature) {
        if (process.env.NODE_ENV === 'development') {
            console.warn('[GuardianCheck] DEV: accepting unsigned request');
            return true;
        }
        return false;
    }

    if (!currentSigningKey || !nextSigningKey) {
        console.error('[GuardianCheck] QSTASH_CURRENT_SIGNING_KEY / QSTASH_NEXT_SIGNING_KEY not configured');
        return false;
    }

    try {
        const receiver = new Receiver({ currentSigningKey, nextSigningKey });
        return await receiver.verify({ signature, body: rawBody });
    } catch (error: any) {
        console.warn(`[GuardianCheck] Signature verification failed: ${error?.message || error}`);
        return false;
    }
}

export async function POST(request: Request) {
    const rawBody = await request.text();

    if (!(await isAuthorized(request, rawBody))) {
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
        const outcome = await processTripCheck(tripId, checkId);

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
