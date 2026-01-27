const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
    const flights = await prisma.watchedFlight.findMany({
        take: 10,
        select: {
            id: true,
            airline: true,
            flightNumber: true,
            origin: true,
            destination: true
        }
    });

    console.log("Found " + flights.length + " flights:");
    flights.forEach((f: any) => {
        console.log(`- ${f.airline} (Flight: ${f.flightNumber})`);
    });
}

main()
    .catch(e => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
