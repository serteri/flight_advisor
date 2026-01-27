import { prisma } from "../lib/prisma";

async function main() {
    const flights = await prisma.watchedFlight.findMany({
        where: { status: 'ACTIVE' }
    });

    console.log(`Found ${flights.length} active flights.`);

    flights.forEach(f => {
        const timeAgo = Math.floor((new Date().getTime() - new Date(f.lastChecked || 0).getTime()) / 1000);
        console.log(`Flight ${f.flightNumber} (${f.origin}-${f.destination}): Price ${f.currentPrice} ${f.currency}. Last Checked: ${timeAgo}s ago.`);
    });
}

main();
