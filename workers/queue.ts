import { Queue } from 'bullmq';
import connection from '@/lib/redis';

// TODO(cleanup): This legacy BullMQ queue path is still used by
// app/api/cron/update-prices and app/api/guardian/monitor.
// Remove only after those routes migrate off Redis queue jobs.

// Safe Queue Initialization
export const flightMonitorQueue = connection
    ? new Queue('flight-monitor', {
        connection,
        defaultJobOptions: {
            attempts: 3,
            backoff: {
                type: 'exponential',
                delay: 5000,
            },
            removeOnComplete: true,
            removeOnFail: 100,
        },
    })
    : null as any; // Cast as any/null if disabled

export const addFlightCheckJob = async (tripId: string, priority: number = 2) => {
    if (!flightMonitorQueue) {
        console.warn("⚠️ Redis Queue is disabled. Skipping 'addFlightCheckJob'.");
        return;
    }
    await flightMonitorQueue.add('check-price', { flightId: tripId }, {
        priority,
        jobId: `check-${tripId}-${Date.now()}` // Prevent duplicates in short window
    });
};
