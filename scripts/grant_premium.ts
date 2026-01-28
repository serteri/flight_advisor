
import { prisma } from "@/lib/prisma";

async function main() {
    // Get the specific user
    const user = await prisma.user.findUnique({
        where: { email: 'serteri@gmail.com' }
    });

    if (!user) {
        console.log("No user found.");
        return;
    }

    console.log(`Found user: ${user.email} (${user.name})`);

    // Update to Premium
    await prisma.user.update({
        where: { id: user.id },
        data: {
            isPremium: true,
            stripeSubscriptionId: "sub_mock_" + Math.random().toString(36).substring(7),
            stripePriceId: "price_mock_pro",
            stripeCurrentPeriodEnd: new Date(new Date().setFullYear(new Date().getFullYear() + 1)), // 1 year from now
        }
    });

    console.log(`✅ User ${user.email} is now PREMIUM (Mocked)!`);
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
