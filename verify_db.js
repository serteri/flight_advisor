const { PrismaClient } = require('@prisma/client');
require('dotenv').config();

const prisma = new PrismaClient();

async function main() {
    try {
        const bne = await prisma.airport.findFirst({
            where: {
                OR: [
                    { iata: 'BNE' },
                    { city: { contains: 'Brisbane', mode: 'insensitive' } }
                ]
            }
        });
        console.log('Found BNE:', bne);

        const count = await prisma.airport.count();
        console.log('Total Airports:', count);
    } catch (e) {
        console.error('DB Error:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
