import { Queue } from 'bullmq';
import connection from '@/lib/redis';

export const flightMonitorQueue = new Queue('flight-monitor', {
    connection,
    defaultJobOptions: {
        attempts: 3,
        backoff: {
            type: 'exponential',
            delay: 5000,
        },
        removeOnComplete: true,
        removeOnFail: 100, // Keep last 100 failed jobs for debugging
    },
});
