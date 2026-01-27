
import { PrismaClient } from '@prisma/client';
import { collectPriceSnapshot } from '../lib/priceCollector';

const prisma = new PrismaClient();

async function main() {
    console.log("Verifying Flight Scoring Logic...");

    // Check Env
    if (!process.env.GOOGLE_API_KEY && !process.env.GEMINI_API_KEY) {
        console.warn("⚠️ No Google/Gemini API Key found in env. Scoring will fallback to default.");
    }

    // 1. Find a test route or create one
    let route = await prisma.route.findFirst({
        where: { active: true }
    });

    if (!route) {
        console.log("No active route found. Creating a temporary one...");
        const user = await prisma.user.findFirst();
        if (!user) {
            console.error("No user found to attach route to.");
            return;
        }

        // Crate dummy route: IST -> LHR for tomorrow
        const tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);

        route = await prisma.route.create({
            data: {
                userId: user.id,
                originCode: "IST",
                destinationCode: "LHR",
                startDate: tomorrow,
                cabin: "ECONOMY",
                active: true
            }
        });
        console.log("Created temp route:", route.id);
    } else {
        console.log(`Using existing route: ${route.originCode} -> ${route.destinationCode}`);
    }

    // 2. Trigger Collection
    console.log("Triggering price collection...");
    const snapshot = await collectPriceSnapshot(route.id);

    // 3. Inspect Result
    if (snapshot) {
        console.log("\n✅ Snapshot Collected!");
        console.log("--------------------------------");
        console.log(`Snapshot ID: ${snapshot.id}`);
        console.log(`Price: ${snapshot.amount} ${snapshot.currency}`);
        console.log(`Provider/Airline: ${snapshot.provider}`);
        console.log(`Score: ${snapshot.score ?? 'N/A'}`);
        console.log(`Explanation: ${snapshot.explanation ?? 'N/A'}`);
        console.log(`Duration: ${snapshot.duration} mins`);
        console.log(`Stops: ${snapshot.stops}`);
        console.log("--------------------------------");

        if (snapshot.score) {
            console.log("SUCCESS: Scoring logic is working.");
        } else {
            console.log("WARNING: Score is missing. Check LLM logs.");
        }
    } else {
        console.error("❌ Failed to collect snapshot.");
    }
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
