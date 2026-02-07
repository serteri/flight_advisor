
// lib/redis.ts
import IORedis from 'ioredis';

// Redis Connection Strategy:
// 1. If REDIS_URL is present, use it.
// 2. If valid host/port are present, use them.
// 3. Otherwise, return null (prevent build-time connection errors)

const getRedisConnection = () => {
    if (process.env.REDIS_URL) {
        return new IORedis(process.env.REDIS_URL, { maxRetriesPerRequest: null });
    }
    // Only connect to localhost if explicitly enabled (avoid Vercel build errors)
    if (process.env.ENABLE_LOCAL_REDIS === 'true') {
        return new IORedis({ host: 'localhost', port: 6379, maxRetriesPerRequest: null });
    }
    return null;
};

const connection = getRedisConnection();

export default connection;
