import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface TpsRecord {
  _id: number;
  nama: string;
  id_tps: number | null;
  alamat: string;
  lat: number | null;
  lng: number | null;
  kecamatan: string;
  kelurahan: string;
  jenis_fasilitas: string;
  klasifikasi_struktur: string;
  klasifikasi_pengangkutan: string;
  status: string;
  kapasitas: number;
  vol_masuk: number;
  vol_dikelola: number;
  volume_sampah_diolah: number;
  vol_diangkut: number | null;
  waktu_angkut: number | null;
}

interface JsonData {
  result: {
    records: TpsRecord[];
    total: number;
  };
}

const REMOVED_TPS3R = [
  "JANTI",
  "BERBEK",
  "DESA WADUGASRI",
  "WADUGASRI",
  "NGINGAS",
  "TAMBAKSAWAH",
  "TAMBAKREJO WARU",
  "TAMBAKREJO WARU",
];

function shouldRemoveTps3r(nama: string): boolean {
  const upperNama = nama.toUpperCase();
  return REMOVED_TPS3R.some((removed) => upperNama.includes(removed));
}

function isTps3r(record: TpsRecord): boolean {
  const nama = record.nama.toUpperCase();
  const jenis = record.jenis_fasilitas?.toUpperCase() || "";
  const klasifikasi = record.klasifikasi_struktur?.toUpperCase() || "";
  
  return (
    jenis.includes("TPS 3R") ||
    jenis.includes("TPS3R") ||
    klasifikasi.includes("TPS 3R") ||
    klasifikasi.includes("TPS3R") ||
    nama.includes("TPS 3R") ||
    nama.includes("TPS3R")
  );
}

function isTps(record: TpsRecord): boolean {
  const jenis = record.jenis_fasilitas?.toUpperCase() || "";
  const klasifikasi = record.klasifikasi_struktur?.toUpperCase() || "";
  
  return (
    (jenis === "TPS" || jenis.includes("TPS")) &&
    !isTps3r(record) &&
    !jenis.includes("PLTSA") &&
    !jenis.includes("RUMAH KOMPOS") &&
    !jenis.includes("RUKOM")
  );
}

function generateCode(kecamatan: string, index: number): string {
  const cleanKec = kecamatan.replace("Kec. ", "").replace("Kec.", "").trim();
  const prefix = cleanKec.substring(0, 3).toUpperCase();
  const num = String(index).padStart(3, "0");
  return `TPS-${prefix}-${num}`;
}

async function main() {
  const jsonPath = path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "dashboard",
    "src",
    "data",
    "real-tps-data-fixed.json"
  );
  console.log("Reading JSON from:", jsonPath);

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: JsonData = JSON.parse(raw);

  const allRecords = data.result.records;
  console.log(`Total records in JSON: ${allRecords.length}`);

  const tpsRecords = allRecords.filter(
    (r) => isTps(r) && r.lat !== null && r.lng !== null && r.kapasitas > 0
  );
  console.log(`TPS records with valid coords: ${tpsRecords.length}`);

  const tps3rRecords = allRecords.filter(
    (r) =>
      isTps3r(r) &&
      !shouldRemoveTps3r(r.nama) &&
      r.lat !== null &&
      r.lng !== null
  );
  console.log(`TPS3R records (after removal): ${tps3rRecords.length}`);

  await prisma.tps.deleteMany({});
  console.log("Cleared existing TPS data");

  let inserted = 0;

  for (let i = 0; i < tpsRecords.length; i++) {
    const record = tpsRecords[i];
    const kecName = record.kecamatan.replace("Kec. ", "").replace("Kec.", "").trim();
    const kelName = record.kelurahan?.replace("Kel. ", "").replace("Kel.", "").trim() || "";

    const capacity = record.kapasitas || 14;
    const currentVolume = Math.min(
      capacity,
      Math.round((record.vol_masuk || capacity * 0.4) * 10) / 10
    );

    const code = `TPS-${String(record._id).padStart(3, "0")}`;

    try {
      await prisma.tps.create({
        data: {
          code: code,
          name: record.nama,
          kecamatan: kecName,
          kelurahan: kelName || null,
          lat: record.lat!,
          lng: record.lng!,
          capacityKg: capacity * 1000,
          currentVolume: currentVolume * 1000,
          status: "AKTIF",
          needsReview: false,
          verifiedAt: new Date(),
        },
      });
      inserted++;
      if (inserted % 50 === 0) {
        console.log(`Inserted ${inserted}/${tpsRecords.length}`);
      }
    } catch (e) {
      console.log(`Skipped duplicate: ${record.nama}`);
    }
  }

  console.log(`\nDone! ${inserted} TPS entries seeded from JSON.`);
  console.log(`TPS3R facilities found: ${tps3rRecords.map((r) => r.nama).join(", ")}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
