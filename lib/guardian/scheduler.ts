// lib/guardian/scheduler.ts
//
// Publishes/cancels delayed QStash deliveries for trip checkpoints. Every
// planned checkpoint is persisted as a ScheduledTripCheck row first, so the
// schedule is visible and cancellable even when publishing fails.
//
// Publishing is gated by lib/guardian/qstashPolicy.ts (Vercel production or
// QSTASH_FORCE_LIVE=true). Outside that, the row is kept SCHEDULED without a
// messageId and can be triggered by hand. Where publishing is allowed but
// QSTASH_TOKEN is missing, the row is marked FAILED and logged as an error —
// nothing is silently dropped.

import { Client } from '@upstash/qstash';
import { prisma } from '@/lib/prisma';
import { appUrl } from '@/lib/config/runtimeEnv';
import type { PlannedCheck } from '@/lib/guardian/checkpoints';
import { isQStashPublishAllowed } from '@/lib/guardian/qstashPolicy';

let cachedClient: Client | null | undefined;

// Null outside Vercel production: no publish and no QStash cancel calls.
function getQStashClient(): Client | null {
    if (!isQStashPublishAllowed()) return null;
    if (cachedClient !== undefined) return cachedClient;
    const token = process.env.QSTASH_TOKEN;
    // baseUrl explicit: the SDK would silently fall back to the default region if
    // QSTASH_URL were missing; it is required by the production fail-fast check.
    cachedClient = token ? new Client({ token, baseUrl: process.env.QSTASH_URL }) : null;
    return cachedClient;
}

export type PublishDecision = 'PUBLISH' | 'STORE_UNPUBLISHED' | 'FAIL_NO_TOKEN';

export function publishDecision(input: { publishAllowed: boolean; hasToken: boolean }): PublishDecision {
    if (!input.publishAllowed) return 'STORE_UNPUBLISHED';
    return input.hasToken ? 'PUBLISH' : 'FAIL_NO_TOKEN';
}

export function checkEndpointUrl(tripId: string, checkId: string): string {
    return appUrl(`/api/guardian/check?tripId=${encodeURIComponent(tripId)}&checkId=${encodeURIComponent(checkId)}`);
}

export async function scheduleTripChecks(tripId: string, checks: PlannedCheck[]): Promise<void> {
    const client = getQStashClient();

    for (const check of checks) {
        const row = await prisma.scheduledTripCheck.create({
            data: { tripId, kind: check.kind, runAt: check.runAt },
        });

        const decision = publishDecision({ publishAllowed: isQStashPublishAllowed(), hasToken: Boolean(client) });
        if (decision !== 'PUBLISH' || !client) {
            if (decision === 'STORE_UNPUBLISHED') {
                console.log(`[Scheduler] MOCK (not Vercel production): ${check.kind} for trip ${tripId} stored but not published (check ${row.id})`);
            } else {
                console.error(`[Scheduler] QSTASH_TOKEN missing — ${check.kind} for trip ${tripId} could not be scheduled`);
                await prisma.scheduledTripCheck.update({
                    where: { id: row.id },
                    data: { status: 'FAILED', error: 'QSTASH_TOKEN is not set' },
                });
            }
            continue;
        }

        try {
            const response = await client.publishJSON({
                url: checkEndpointUrl(tripId, row.id),
                body: { tripId, checkId: row.id, kind: check.kind },
                notBefore: Math.floor(check.runAt.getTime() / 1000),
                deduplicationId: row.id,
                retries: 3,
            });
            const messageId = 'messageId' in response ? response.messageId : null;
            await prisma.scheduledTripCheck.update({ where: { id: row.id }, data: { messageId } });
        } catch (error: any) {
            const message = error?.message || 'QStash publish failed';
            console.error(`[Scheduler] Failed to publish ${check.kind} for trip ${tripId}: ${message}`);
            await prisma.scheduledTripCheck.update({
                where: { id: row.id },
                data: { status: 'FAILED', error: message.slice(0, 500) },
            });
        }
    }
}

// Cancels future SCHEDULED checks (optionally only some kinds) both in QStash
// and in the database. Returns how many rows were cancelled.
export async function cancelPendingChecks(
    tripId: string,
    options: { kinds?: string[]; excludeCheckId?: string } = {},
): Promise<number> {
    const pending = await prisma.scheduledTripCheck.findMany({
        where: {
            tripId,
            status: 'SCHEDULED',
            ...(options.kinds ? { kind: { in: options.kinds } } : {}),
            ...(options.excludeCheckId ? { id: { not: options.excludeCheckId } } : {}),
        },
    });

    const client = getQStashClient();
    for (const check of pending) {
        if (client && check.messageId) {
            try {
                await client.messages.cancel(check.messageId);
            } catch (error: any) {
                // Already delivered or expired messages cannot be cancelled; the
                // handler ignores non-SCHEDULED rows, so this is safe to log only.
                console.warn(`[Scheduler] Could not cancel QStash message ${check.messageId}: ${error?.message || error}`);
            }
        }
    }

    if (pending.length === 0) return 0;
    const result = await prisma.scheduledTripCheck.updateMany({
        where: { id: { in: pending.map((c) => c.id) }, status: 'SCHEDULED' },
        data: { status: 'CANCELLED' },
    });
    return result.count;
}
