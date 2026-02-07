import { Queue } from 'bullmq';
import connection from '@/lib/redis';

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
