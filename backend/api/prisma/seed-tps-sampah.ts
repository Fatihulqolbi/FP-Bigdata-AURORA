import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface TpsJsonRecord {
  no: number;
  name: string;
  address: string;
  kecamatan: string;
  kelurahan: string;
  tps_type: string;
  unit_count: number;
  capacity_m3: number;
  capacity_kg: number;
  status: string;
  used_query?: string;
  lat: number | null;
  lng: number | null;
  confidence: number;
  needs_review: boolean;
  geocoded_address?: string;
}

function generateSchedule(tpsType: string): any[] {
  if (tpsType === "COMPACTOR") {
    return [
      { start: "06:00", end: "08:00", probability: 0.4, weightKgMin: 0.15, weightKgMax: 0.35 },
      { start: "12:00", end: "14:00", probability: 0.3, weightKgMin: 0.10, weightKgMax: 0.25 },
      { start: "18:00", end: "20:00", probability: 0.4, weightKgMin: 0.15, weightKgMax: 0.35 },
    ];
  }
  return [
    { start: "06:00", end: "09:00", probability: 0.5, weightKgMin: 0.05, weightKgMax: 0.15 },
    { start: "12:00", end: "14:00", probability: 0.4, weightKgMin: 0.05, weightKgMax: 0.15 },
    { start: "17:00", end: "21:00", probability: 0.5, weightKgMin: 0.05, weightKgMax: 0.15 },
  ];
}

function generateCode(kecamatan: string, index: number): string {
  const prefix = kecamatan.substring(0, 3).toUpperCase();
  const num = String(index).padStart(3, "0");
  return `TPS-${prefix}-${num}`;
}

async function main() {
  const jsonPath = path.resolve(__dirname, "data", "tps_sampah_surabaya.json");
  console.log("Reading JSON from:", jsonPath);

  const rows: TpsJsonRecord[] = JSON.parse(fs.readFileSync(jsonPath, "utf-8"));
  console.log(`Parsed ${rows.length} TPS entries from JSON`);

  await prisma.tps.deleteMany({});
  console.log("Cleared existing TPS data");

  const batchSize = 50;
  const kecamatanCounters: Record<string, number> = {};
  let inserted = 0;

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map((row) => {
      const capacityKg = row.capacity_kg || 0;

      kecamatanCounters[row.kecamatan] = (kecamatanCounters[row.kecamatan] || 0) + 1;
      const kcIdx = kecamatanCounters[row.kecamatan];

      return {
        code: generateCode(row.kecamatan, kcIdx),
        name: row.name,
        kecamatan: row.kecamatan,
        kelurahan: row.kelurahan || null,
        lat: row.lat ?? -7.2504,
        lng: row.lng ?? 112.7688,
        capacityKg: capacityKg,
        fillThreshold: 0.9,
        currentVolume: capacityKg > 0 ? Math.round(Math.random() * capacityKg * 0.3) : 0,
        status: row.status === "AKTIF" ? "AKTIF" : "NONAKTIF",
        type: row.tps_type === "COMPACTOR" ? "COMPACTOR" : "TPS_BIASA",
        schedule: generateSchedule(row.tps_type),
        needsReview: row.needs_review,
        source: "PDF",
        rawAddress: row.address,
        confidence: row.confidence,
      };
    });

    await prisma.tps.createMany({ data: batch });
    inserted += batch.length;
    console.log(`Inserted ${inserted}/${rows.length}`);
  }

  console.log(`\nDone! ${inserted} TPS sampah entries seeded.`);
  console.log(`Active: ${rows.filter((r) => r.status === "AKTIF").length}`);
  console.log(`Needs review: ${rows.filter((r) => r.needs_review).length}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
