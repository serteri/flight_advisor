import { PrismaClient } from "@prisma/client";
import fs from "fs";
import csv from "csv-parser";
import path from "path";

const prisma = new PrismaClient();

interface AirportRow {
  code: string;
  name: string;
  isMajor: boolean;
}

async function main() {
  const csvPath = path.join(process.cwd(), "data", "airports.csv");
  console.log(`Reading airports from ${csvPath}...`);

  // ── 1. Read all rows into memory ──────────────────────────────────────────
  const airports = await new Promise<AirportRow[]>((resolve, reject) => {
    const rows: AirportRow[] = [];

    fs.createReadStream(csvPath)
      .pipe(csv())
      .on("data", (data) => {
        const type = (data.type || data.airport_type || "") as string;
        const iataCode = (data.iata_code || "").trim();

        // Must have IATA code and be a commercial airport
        if (!iataCode) return;
        if (type !== "large_airport" && type !== "medium_airport") return;

        rows.push({
          code: iataCode,
          name: data.name || iataCode,
          isMajor: type === "large_airport",
        });
      })
      .on("end", () => resolve(rows))
      .on("error", reject);
  });

  console.log(`Found ${airports.length} airports. Bulk inserting...`);

  // ── 2. Single createMany — skips rows whose code already exists ───────────
  const result = await prisma.airport.createMany({
    data: airports,
    skipDuplicates: true,
  });

  console.log(`✅ Inserted ${result.count} new airports (${airports.length - result.count} already existed).`);
  await prisma.$disconnect();
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
