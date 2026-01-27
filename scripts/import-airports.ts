import { PrismaClient } from "@prisma/client";
import fs from "fs";
import csv from "csv-parser";
import path from "path";

const prisma = new PrismaClient();

async function main() {
    const results: any[] = [];
    const csvPath = path.join(process.cwd(), "data", "airports.csv");

    console.log(`Reading airports from ${csvPath}...`);

    fs.createReadStream(csvPath)
        .pipe(csv())
        .on("data", (data) => {
            // Include both large_airport AND medium_airport for Skyscanner-like coverage
            // This gives us ~2000+ airports instead of ~300
            const type = data.type || data.airport_type || "";
            const iataCode = data.iata_code || "";

            // Must have IATA code to be useful for flight search
            if (!iataCode || iataCode.trim() === "") return;

            // Include large and medium airports (commercial airports)
            if (type === "large_airport" || type === "medium_airport") {
                results.push({
                    ...data,
                    isMajor: type === "large_airport" // Mark large airports as major
                });
            }
        })
        .on("end", async () => {
            console.log(`Found ${results.length} airports with IATA codes. Importing...`);

            let imported = 0;
            let skipped = 0;

            for (const row of results) {
                try {
                    const cityName = row.municipality || row.name || "Unknown City";
                    const countryCode = row.iso_country || "XX";
                    const iataCode = row.iata_code?.trim();

                    if (!iataCode) {
                        skipped++;
                        continue;
                    }

                    // Find or create city
                    let city = await prisma.city.findFirst({
                        where: {
                            name: cityName,
                            country: countryCode
                        }
                    });

                    if (!city) {
                        city = await prisma.city.create({
                            data: {
                                name: cityName,
                                country: countryCode,
                            },
                        });
                    }

                    // Create airport linked to city (avoid duplicates)
                    const existingAirport = await prisma.airport.findFirst({
                        where: { code: iataCode }
                    });

                    if (!existingAirport) {
                        await prisma.airport.create({
                            data: {
                                cityId: city.id,
                                code: iataCode,
                                name: row.name,
                                isMajor: row.isMajor === true || row.isMajor === "true",
                            },
                        });
                        imported++;
                    } else {
                        skipped++;
                    }
                } catch (error) {
                    console.error(`Error importing ${row.iata_code}:`, error);
                    skipped++;
                }
            }

            console.log(`✅ Imported ${imported} airports, skipped ${skipped} (already exist or invalid)`);
            console.log("Airport import complete!");
            await prisma.$disconnect();
            process.exit(0);
        });
}

main();
