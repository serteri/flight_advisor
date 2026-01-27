// scripts/start-worker.ts
import { config } from 'dotenv';
config(); // Load env vars

// Import worker code effectively starting it
import '@/workers/processor';

// Keep process alive
console.log("Worker is running. Press Ctrl+C to exit.");

process.on('SIGTERM', async () => {
    console.log('SIGTERM signal received: closing queues');
    process.exit(0);
});
