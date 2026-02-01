
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
    console.log("🔍 Finding user...");
    const user = await prisma.user.findFirst();

    if (!user) {
        console.error("❌ No user found. Please login at least once to create a user record.");
        return;
    }

    console.log(`✅ Found user: ${user.email} (${user.id})`);
    console.log("✈️ Creating demo trip: BNE -> IST (Multi-Leg)...");

    const trip = await prisma.monitoredTrip.create({
        data: {
            userId: user.id,
            pnr: "DEMO123",
            routeLabel: "Brisbane (BNE) ➝ Istanbul (IST)",
            originalPrice: 1540.50,
            currency: "AUD",
            ticketClass: "ECONOMY",
            status: "ACTIVE",
            nextCheckAt: new Date(),
            segments: {
                create: [
                    {
                        segmentOrder: 0,
                        airlineCode: "SQ",
                        flightNumber: "236",
                        origin: "BNE",
                        destination: "SIN",
                        departureDate: new Date("2026-03-10T14:30:00"),
                        arrivalDate: new Date("2026-03-10T20:45:00"),
                        aircraftType: "77W",
                        userSeat: "24A"
                    },
                    {
                        segmentOrder: 1,
                        airlineCode: "TK",
                        flightNumber: "55",
                        origin: "SIN",
                        destination: "IST",
                        departureDate: new Date("2026-03-10T23:30:00"),
                        arrivalDate: new Date("2026-03-11T06:10:00"),
                        aircraftType: "359",
                        userSeat: "12F"
                    }
                ]
            }
        }
    });

    console.log(`🎉 Demo trip created! ID: ${trip.id}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
