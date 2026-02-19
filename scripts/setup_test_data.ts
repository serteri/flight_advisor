import { prisma } from "@/lib/prisma";

async function setupTestData() {
    console.log("🔧 Setting up test data...");
    
    try {
        // 1. Create test user (ELITE tier)
        const user = await prisma.user.upsert({
            where: { email: "test.elite@guardian.io" },
            update: {},
            create: {
                email: "test.elite@guardian.io",
                name: "Test Elite User",
                subscriptionPlan: "ELITE",
                notificationTone: "STANDARD",
                phoneNumber: "+905559999999",
                telegramId: "123456789",
                emailVerified: new Date(),
                isPremium: true,
            }
        });
        console.log("✅ Test user created:", user.email);

        // 2. Create test monitored trip
        const trip = await prisma.monitoredTrip.upsert({
            where: { id: "test-trip-001" },
            update: {},
            create: {
                id: "test-trip-001",
                userId: user.id,
                pnr: "ABC123",
                routeLabel: "IST → JFK",
                originalPrice: 450.00,
                currency: "USD",
                ticketClass: "ECONOMY",
                fareBasis: "LOW_COST",
                isRefundable: false,
                status: "ACTIVE",
                checkFrequency: 15, // Check every 15 minutes
                nextCheckAt: new Date(),
                lastCheckedAt: null,
                segments: {
                    create: {
                        airlineCode: "TK",
                        flightNumber: "TEST600", // Will trigger >180min delay in mock
                        origin: "IST",
                        destination: "JFK",
                        departureDate: new Date(Date.now() + 2 * 24 * 60 * 60 * 1000), // 2 days from now
                        arrivalDate: new Date(Date.now() + 2.5 * 24 * 60 * 60 * 1000), // +0.5 days for 12h flight
                        cabinClass: "ECONOMY"
                    }
                }
            },
            include: { segments: true }
        });
        console.log("✅ Test monitored trip created:", trip.pnr);

        // 3. Create test user PRO (for comparison)
        const proUser = await prisma.user.upsert({
            where: { email: "test.pro@guardian.io" },
            update: {},
            create: {
                email: "test.pro@guardian.io",
                name: "Test Pro User",
                subscriptionPlan: "PRO",
                notificationTone: "JUNIOR_GUARDIAN",
                phoneNumber: null,
                emailVerified: new Date(),
                isPremium: true,
            }
        });
        console.log("✅ Test PRO user created:", proUser.email);

        console.log("\n🎯 Test data ready! Now run:");
        console.log("   npx tsx workers/guardianWorker.ts");
        console.log("\n📊 View in Prisma Studio:");
        console.log("   npx prisma studio");
    } catch (error) {
        console.error("❌ Error setting up test data:", error);
    } finally {
        await prisma.$disconnect();
    }
}

setupTestData();
