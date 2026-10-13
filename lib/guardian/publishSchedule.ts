// lib/guardian/publishSchedule.ts
//
// The daily QStash schedule that calls POST /api/guardian/publish-due. It is
// created out-of-band by scripts/setup-publish-schedule.ts, so production
// health needs a way to ask "does it exist, is it aimed at this deployment,
// is it running?". Read-only: this module never creates or changes a schedule.

import { Client } from '@upstash/qstash';

export const PUBLISH_SCHEDULE_ID = 'flightagent-publish-due';
export const PUBLISH_SCHEDULE_CRON = '0 3 * * *'; // 03:00 UTC daily

export type ScheduleHealth =
    | 'HEALTHY'
    | 'NOT_CONFIGURED'      // QSTASH_TOKEN / QSTASH_URL missing
    | 'UNREACHABLE'         // QStash API call failed
    | 'MISSING'             // reachable, but no schedule with PUBLISH_SCHEDULE_ID
    | 'PAUSED'
    | 'WRONG_DESTINATION'   // points somewhere other than this deployment's publish-due
    | 'WRONG_CRON';

export interface ScheduleLike {
    cron?: string;
    destination?: string;
    isPaused?: boolean;
}

export function expectedPublishDestination(appBaseUrl: string): string {
    return `${appBaseUrl.trim().replace(/\/+$/, '')}/api/guardian/publish-due`;
}

// Pure: the verdict on a fetched schedule (null = not found).
export function evaluateSchedule(schedule: ScheduleLike | null, expectedDestination: string): ScheduleHealth {
    if (!schedule) return 'MISSING';
    if (schedule.isPaused) return 'PAUSED';
    if (schedule.destination?.replace(/\/+$/, '') !== expectedDestination) return 'WRONG_DESTINATION';
    if (schedule.cron !== PUBLISH_SCHEDULE_CRON) return 'WRONG_CRON';
    return 'HEALTHY';
}

export interface ScheduleStatus {
    health: ScheduleHealth;
    tokenPresent: boolean;
    detail?: string;
}

export async function getPublishScheduleStatus(env: NodeJS.ProcessEnv = process.env): Promise<ScheduleStatus> {
    const token = env.QSTASH_TOKEN?.trim();
    const baseUrl = env.QSTASH_URL?.trim();
    const appBase = env.APP_BASE_URL?.trim();
    if (!token || !baseUrl || !appBase) {
        const missing = [!token && 'QSTASH_TOKEN', !baseUrl && 'QSTASH_URL', !appBase && 'APP_BASE_URL'].filter(Boolean);
        return { health: 'NOT_CONFIGURED', tokenPresent: Boolean(token), detail: `missing: ${missing.join(', ')}` };
    }

    const client = new Client({ token, baseUrl });
    let schedule: ScheduleLike | null;
    try {
        schedule = await client.schedules.get(PUBLISH_SCHEDULE_ID);
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : String(error);
        // QStash answers an unknown schedule id with 404; anything else is a reachability problem.
        if (/not ?found|404/i.test(message)) schedule = null;
        else return { health: 'UNREACHABLE', tokenPresent: true, detail: message.slice(0, 200) };
    }
    return { health: evaluateSchedule(schedule, expectedPublishDestination(appBase)), tokenPresent: true };
}
