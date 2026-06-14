import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import * as readline from "readline";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

function generateCode(kecamatan: string, index: number): string {
  const prefix = kecamatan.substring(0, 3).toUpperCase();
  const num = String(index).padStart(3, "0");
  return `TPS-${prefix}-${num}`;
}

interface CsvRow {
  id: number;
  name: string;
  kecamatan: string;
  kelurahan: string;
  lat: number;
  lng: number;
  capacity: number;
}

async function main() {
  const csvPath = path.resolve(__dirname, "..", "..", "..", "dashboard", "public", "dataset_tps_surabaya.csv");
  console.log("Reading CSV from:", csvPath);

  const stream = fs.createReadStream(csvPath, "utf-8");
  const rl = readline.createInterface({ input: stream });

  const rows: CsvRow[] = [];
  let header = true;
  for await (const line of rl) {
    if (header) { header = false; continue; }
    const parts = line.split(",");
    if (parts.length < 7) continue;
    rows.push({
      id: parseInt(parts[0]),
      name: parts[1],
      kecamatan: parts[2],
      kelurahan: parts[3],
      lat: parseFloat(parts[4]),
      lng: parseFloat(parts[5]),
      capacity: parseFloat(parts[6]),
    });
  }
  console.log(`Parsed ${rows.length} TPS entries from CSV`);

  // Delete existing TPS data (except demo data if needed)
  await prisma.tps.deleteMany({});
  console.log("Cleared existing TPS data");

  // Batched insert (50 at a time)
  const batchSize = 50;
  const kecamatanCounters: Record<string, number> = {};
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => {
      kecamatanCounters[row.kecamatan] = (kecamatanCounters[row.kecamatan] || 0) + 1;
      const kcIdx = kecamatanCounters[row.kecamatan];

      return {
        code: generateCode(row.kecamatan, kcIdx),
        name: row.name,
        kecamatan: row.kecamatan,
        kelurahan: row.kelurahan || null,
        lat: row.lat,
        lng: row.lng,
        capacity: row.capacity,
        currentVolume: Math.round(Math.random() * row.capacity * 0.4),
      };
    });

    await prisma.tps.createMany({ data: batch });
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${rows.length}`);
  }

  console.log(`\nDone! ${inserted} TPS entries seeded.`);
  await prisma.$disconnect();
}

main().catch((e) => { console.error(e); process.exit(1); });
