// app/api/guardian/publish-due/route.ts
//
// Daily QStash schedule target (scripts/setup-publish-schedule.ts creates the
// schedule). Publishes the unpublished checkpoints that have entered the 6-day
// QStash delay window. Signed with the QStash keys like /api/guardian/check.
// Idempotent: safe to call any number of times.

import { NextResponse } from 'next/server';
import { isQStashAuthorized } from '@/lib/guardian/qstashAuth';
import { publishDueScheduledChecks } from '@/lib/guardian/scheduler';
import { assertRequiredRuntimeEnv } from '@/lib/config/runtimeEnv';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
    const rawBody = await request.text();
    if (!(await isQStashAuthorized(request, rawBody, 'PublishDue'))) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        assertRequiredRuntimeEnv('publish-due');
        const summary = await publishDueScheduledChecks();
        console.log('[PublishDue] run complete', summary);
        // 200 even when some rows failed: they are recorded as FAILED with the
        // reason, and a QStash retry would not change a rejected publish.
        return NextResponse.json(summary);
    } catch (error: any) {
        console.error('[PublishDue] Unexpected failure:', error);
        return NextResponse.json({ error: error?.message || 'Unexpected error' }, { status: 500 });
    }
}
