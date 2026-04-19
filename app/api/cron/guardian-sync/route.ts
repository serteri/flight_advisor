/**
 * @deprecated
 * Legacy cron alias. Active runtime cron entry is /api/cron/guardian (see vercel.json).
 * Kept for backward compatibility with old external triggers.
 */
import { NextResponse } from 'next/server';
import { processFlightMonitoring } from '@/workers/guardianWorker';

export async function GET(request: Request) {
    // Security check: Verify Vercel Cron Header (optional but recommended)
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) { ... }

    console.log("⏱️ Cron Job Triggered: Guardian Sync");

    // Auto-run the worker
    const result = await processFlightMonitoring();

    return NextResponse.json(result);
}
