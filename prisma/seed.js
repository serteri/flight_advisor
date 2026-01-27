const { PrismaClient } = require('@prisma/client');
require('dotenv').config();
const airports = require('airports');

const prisma = new PrismaClient();

// Major hubs to prioritize (Rank 1.0)
const MAJOR_HUBS = [
    'LHR', 'JFK', 'DXB', 'HND', 'HKG', 'SIN', 'AMS', 'ICN', 'CDG', 'FRA',
    'IST', 'BKK', 'SFO', 'LAX', 'ORD', 'DFW', 'ATL', 'PEK', 'PVG', 'SYD',
    'MEL', 'BNE', 'AKL', 'YYZ', 'YVR', 'MUC', 'ZRH', 'MAD', 'BCN', 'FCO'
];

async function main() {
    console.log('Start seeding airports...');

    let count = 0;

    // Filter relevant airports
    const validAirports = airports.filter(a =>
        a.iata &&
        a.iata.length === 3 &&
        a.name &&
        // Exclude noise
        !a.name.toLowerCase().includes('heliport') &&
        !a.name.toLowerCase().includes('seaplane') &&
        !a.name.toLowerCase().includes('station') &&
        a.type !== 'closed'
    );

    console.log(`Found ${validAirports.length} valid airports to process.`);

    // Process in chunks to avoid memory issues
    const CHUNK_SIZE = 100;

    for (let i = 0; i < validAirports.length; i += CHUNK_SIZE) {
        const chunk = validAirports.slice(i, i + CHUNK_SIZE);

        await Promise.all(chunk.map(async (airport) => {
            // Determine Rank & Type
            let ranking = 99.9;
            let type = 'DOMESTIC'; // Default

            // 1. Major Hubs
            if (MAJOR_HUBS.includes(airport.iata)) {
                ranking = 1.0;
                type = 'INTERNATIONAL';
            }
            // 2. Large Airports (from library data)
            else if (airport.size === 'large') {
                ranking = 2.0;
                type = 'INTERNATIONAL';
            }
            // 3. Medium Airports
            else if (airport.size === 'medium') {
                ranking = 3.0;
                type = 'REGIONAL';
            }
            // 4. Default / Small
            else {
                ranking = 4.0;
                type = 'DOMESTIC';
            }

            // Specific Fixes (e.g. Archerfield vs Brisbane)
            if (airport.iata === 'BNE') {
                ranking = 1.0;
                type = 'INTERNATIONAL';
            }
            if (airport.iata === 'ACF') { // Archerfield
                ranking = 50.0; // Push to bottom
                type = 'DOMESTIC';
            }

            try {
                await prisma.airport.upsert({
                    where: { iata: airport.iata },
                    update: {
                        name: airport.name,
                        city: airport.city || airport.name, // Fallback if city missing in lib
                        country: airport.iso, // Lib uses 'iso', schema uses 'country'
                        ranking,
                        type
                    },
                    create: {
                        iata: airport.iata,
                        name: airport.name,
                        city: airport.city || airport.name,
                        country: airport.iso,
                        ranking,
                        type
                    }
                });
            } catch (e) {
                console.warn(`Skipping ${airport.iata}: ${e.message}`);
            }
        }));

        count += chunk.length;
        if (count % 1000 === 0) {
            console.log(`Processed ${count} airports...`);
        }
    }

    console.log(`Seeding finished. total processed: ${count}`);
}

main()
    .catch((e) => {
        console.error(e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
