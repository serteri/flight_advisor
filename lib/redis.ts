
// lib/redis.ts
import IORedis from 'ioredis';

const connection = new IORedis(process.env.REDIS_URL || 'redis://localhost:6379', {
    maxRetriesPerRequest: null, // BullMQ için zorunlu ayar
});

export default connection;
