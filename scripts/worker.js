
require('dotenv').config();
const { Worker } = require('bullmq');
const IORedis = require('ioredis');
const { PrismaClient } = require('@prisma/client');

const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
const connection = new IORedis(redisUrl, {
    maxRetriesPerRequest: null
});

const prisma = new PrismaClient();

// Mocking the engine logic here since we can't easily import TS files in raw JS without build
// In a real prod setup, we'd build the TS files.
const checkDisruptionPro = (trip, flightData) => {
    if (flightData.delayMinutes > 180) {
        return {
            type: 'DISRUPTION_MONEY',
            severity: 'MONEY',
            title: '💰 Confirmed Compensation Rights',
            message: `Delay > 3 hours. Entitled to compensation.`,
            actionLabel: 'Open Claim File',
            potentialValue: '600€',
        };
    }
    return null;
};

const checkUpgradeAvailability = (trip, flightData) => {
    const upgradePrice = flightData.businessUpgradePrice || 250;
    const target = trip.targetUpgradePrice || 300;
    if (upgradePrice <= target) {
        return {
            type: 'UPGRADE_OPPORTUNITY',
            severity: 'MONEY',
            title: '🥂 Business Upgrade Deal',
            message: `Business Class upgrade available for ${upgradePrice} ${trip.currency}.`,
            actionLabel: 'Upgrade Now',
            potentialValue: 'Business Class',
        };
    }
    return null;
}

async function fetchRealTimeData(trip) {
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    return {
        status: 'DELAYED',
        delayMinutes: 200,
        delayReasonCode: 'AIRLINE_OPERATIONS',
        currentPrice: 1100,
        businessUpgradePrice: 150,
        seatMap: { userSeat: '24A', neighborSeatStatus: 'OCCUPIED', betterSeatsAvailable: ['15A', '15B', '15C'] }
    };
}

console.log("🚀 JS Worker Starting...");

const worker = new Worker('flight-monitor', async (job) => {
    const { tripId } = job.data;
    console.log(`🤖 JS Worker processing trip: ${tripId}`);

    const trip = await prisma.monitoredTrip.findUnique({ where: { id: tripId } });
    if (!trip) throw new Error("Trip not found!");

    const flightData = await fetchRealTimeData(trip);
    const alerts = [];

    if (trip.watchDelay) {
        const alert = checkDisruptionPro(trip, flightData);
        if (alert) alerts.push(alert);
    }

    if (trip.watchUpgrade) {
        const alert = checkUpgradeAvailability(trip, flightData);
        if (alert) alerts.push(alert);
    }

    if (alerts.length > 0) {
        console.log(`🚨 ${alerts.length} ALERTS FOUND!`);
        for (const alert of alerts) {
            await prisma.guardianAlert.create({
                data: {
                    tripId: trip.id,
                    type: alert.type,
                    severity: alert.severity,
                    title: alert.title,
                    message: alert.message,
                    potentialValue: alert.potentialValue,
                    actionLabel: alert.actionLabel
                }
            });
        }
    }

    await prisma.monitoredTrip.update({
        where: { id: tripId },
        data: { lastCheckedAt: new Date(), nextCheckAt: new Date(Date.now() + 60 * 60 * 1000) }
    });

}, { connection });

worker.on('completed', job => {
    console.log(`✅ Job ${job.id} completed!`);
});

worker.on('failed', (job, err) => {
    console.error(`❌ Job ${job?.id} failed: ${err.message}`);
});
