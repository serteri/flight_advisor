// workers/flightMonitor.ts
import { Queue, Worker } from 'bullmq';
import { prisma } from '../lib/prisma'; // Adjust import path as needed
import { checkAmadeusPrice, checkFlightAwareStatus } from '../services/api'; // Using the API layer we created

// Redis Connection (Legacy - Disabled for Vercel Build)
// const redisConnection = {
//     host: process.env.REDIS_HOST || 'localhost',
//     port: parseInt(process.env.REDIS_PORT || '6379'),
// };

// 1. JOB QUEUE
// export const flightQueue = new Queue('flight-monitoring', { connection: redisConnection });
export const flightQueue = null; // Disabling for now to fix build

// 2. WORKER LOGIC
// Note: In a real app, this runs in a separate process.
// 2. WORKER LOGIC
// Note: In a real app, this runs in a separate process.
// export const flightWorker = new Worker('flight-monitoring', async (job) => {
//    ...
// }, { connection: redisConnection });
export const flightWorker = null;

// 3. SCHEDULER (Simulated for this file, normally a Cron/Separate script)
// 3. SCHEDULER (Simulated for this file, normally a Cron/Separate script)
export async function runScheduler() {
    console.log("⏰ Scheduler started...");
    // Disabled in Vercel Static Build
    console.log("Redis queue disabled for static build.");
}
