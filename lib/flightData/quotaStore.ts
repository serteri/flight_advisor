// lib/flightData/quotaStore.ts
//
// Persists monthly AeroDataBox usage (ApiQuotaState) and emails the admin once
// per threshold (80/95/100 %) per month. Only live provider calls are counted;
// mocked calls never touch the quota.

import { prisma } from '@/lib/prisma';
import { deliverViaResend } from '@/lib/email/sender';
import {
    computeUsageRatio,
    getMonthlyCallCapacity,
    getQuotaConfig,
    getQuotaLevel,
    parseRateLimitHeaders,
    reachedThreshold,
    type QuotaLevel,
} from '@/lib/flightData/quotaPolicy';

const PROVIDER = 'AERODATABOX';

export const currentQuotaPeriod = (now = new Date()): string =>
    `${now.getUTCFullYear()}-${String(now.getUTCMonth() + 1).padStart(2, '0')}`;

export interface QuotaStatus {
    period: string;
    ratio: number;
    level: QuotaLevel;
    callsUsed: number;
    unitsUsed: number;
    headerKind: string | null;
}

export async function getQuotaStatus(now = new Date()): Promise<QuotaStatus> {
    const config = getQuotaConfig();
    const period = currentQuotaPeriod(now);
    const state = await prisma.apiQuotaState.findUnique({
        where: { provider_period: { provider: PROVIDER, period } },
    });

    const ratio = computeUsageRatio(
        {
            unitsUsed: state?.unitsUsed ?? 0,
            headerLimit: state?.headerLimit,
            headerRemaining: state?.headerRemaining,
        },
        config,
    );

    return {
        period,
        ratio,
        level: getQuotaLevel(ratio),
        callsUsed: state?.callsUsed ?? 0,
        unitsUsed: state?.unitsUsed ?? 0,
        headerKind: state?.headerKind ?? null,
    };
}

// Records one live provider call and the rate-limit headers it returned.
export async function recordProviderCall(headers: Headers | null, now = new Date()): Promise<QuotaStatus> {
    const config = getQuotaConfig();
    const period = currentQuotaPeriod(now);
    const rate = headers ? parseRateLimitHeaders(headers) : null;

    await prisma.apiQuotaState.upsert({
        where: { provider_period: { provider: PROVIDER, period } },
        create: {
            provider: PROVIDER,
            period,
            callsUsed: 1,
            unitsUsed: config.unitsPerCall,
            headerLimit: rate?.limit ?? null,
            headerRemaining: rate?.remaining ?? null,
            headerKind: rate?.kind ?? null,
        },
        update: {
            callsUsed: { increment: 1 },
            unitsUsed: { increment: config.unitsPerCall },
            ...(rate ? { headerLimit: rate.limit, headerRemaining: rate.remaining, headerKind: rate.kind } : {}),
        },
    });

    const status = await getQuotaStatus(now);
    await maybeAlertAdmin(status);
    return status;
}

// Emails ADMIN_EMAIL the first time each threshold is crossed in a period.
// The conditional updateMany makes the send exactly-once across concurrent calls.
async function maybeAlertAdmin(status: QuotaStatus): Promise<void> {
    const threshold = reachedThreshold(status.ratio);
    if (threshold === 0) return;

    const claimed = await prisma.apiQuotaState.updateMany({
        where: { provider: PROVIDER, period: status.period, lastAlertThreshold: { lt: threshold } },
        data: { lastAlertThreshold: threshold },
    });
    if (claimed.count === 0) return;

    const percent = Math.round(status.ratio * 100);
    const capacity = getMonthlyCallCapacity(getQuotaConfig());
    const effect =
        status.level === 'EXHAUSTED'
            ? 'All flight-data calls are now blocked until the quota resets.'
            : status.level === 'CRITICAL'
                ? 'Only departure and arrival +4h checks will run.'
                : 'Departure −24h checks are now skipped.';

    const subject = `[FlightAgent] AeroDataBox quota at ${percent}% (${status.period})`;
    const text = [
        `AeroDataBox usage for ${status.period} reached the ${threshold}% threshold (${percent}%).`,
        `Calls this month: ${status.callsUsed} (configured capacity: ${capacity} calls).`,
        `Source of usage figure: ${status.headerKind ? `RapidAPI "${status.headerKind}" headers` : 'internal counter'}.`,
        effect,
    ].join('\n');

    console.error(`[Quota] ${subject} — ${effect}`);

    const adminEmail = process.env.ADMIN_EMAIL?.trim();
    if (!adminEmail) {
        console.error('[Quota] ADMIN_EMAIL is not set — threshold alert could not be emailed');
        return;
    }

    const result = await deliverViaResend('quota-alert', {
        to: adminEmail,
        subject,
        html: `<pre style="font-family:monospace">${text}</pre>`,
        text,
    });
    if (!result.success) {
        console.error(`[Quota] Failed to email threshold alert: ${result.error}`);
    }
}
