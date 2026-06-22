import { PrismaClient } from "@prisma/client";
import * as fs from "fs";
import * as path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const prisma = new PrismaClient();

interface RawTpsRecord {
  _id: number;
  data_bulan: number;
  data_tahun: number;
  nama: string;
  id_tps: number;
  alamat: string;
  lat: number | null;
  lng: number | null;
  kecamatan: string;
  kelurahan: string | null;
  jenis_fasilitas: string;
  thn_bangun: number | null;
  klasifikasi_struktur: string;
  klasifikasi_pengangkutan: string;
  tahun: number | null;
  status: string;
  kapasitas: number;
  vol_masuk: number;
  vol_dikelola: number;
  volume_sampah_diolah: number;
  vol_diangkut: number;
  waktu_angkut: number;
}

interface RealTpsData {
  result: {
    records: RawTpsRecord[];
  };
}

function standardizeString(str: string | null): string {
  if (!str) return "";
  return str.toUpperCase().replace(/\s+/g, "").trim();
}

function standardizeKlasifikasiPengangkutan(raw: string | null): string {
  if (!raw) return "COMPACTOR";
  const normalized = raw.toUpperCase().trim();
  if (normalized.includes("ARMROLL") || normalized.includes("ARM ROLL")) {
    return "ARMROLL";
  }
  if (normalized.includes("COMPACTOR")) {
    return "COMPACTOR";
  }
  return "COMPACTOR";
}

function standardizeJenisFasilitas(raw: string | null): string {
  if (!raw) return "TPS";
  const normalized = standardizeString(raw);
  if (normalized.includes("TPS3R") || normalized === "TPS3R") {
    return "TPS3R";
  }
  if (normalized.includes("KOMPOS") || normalized.includes("COMPOSTING")) {
    return "RUMAH_KOMPOS";
  }
  return "TPS";
}

function isValidCoordinate(lat: number | null, lng: number | null): boolean {
  if (lat == null || lng == null) return false;
  if (isNaN(lat) || isNaN(lng)) return false;
  if (lat === 0 && lng === 0) return false;
  if (lat < -8 || lat > -6) return false;
  if (lng < 111 || lng > 114) return false;
  return true;
}

function generateSyntheticCode(idTps: number | null, index: number): string {
  if (idTps != null && idTps > 0) {
    return `TPS-${idTps}`;
  }
  return `TPS-EXT-${String(index).padStart(4, "0")}`;
}

function cleanKecamatan(raw: string | null): string {
  if (!raw) return "UNKNOWN";
  return raw.replace(/^Kec\.\s*/i, "").replace(/^Kecamatan\s*/i, "").trim();
}

function cleanKelurahan(raw: string | null): string | null {
  if (!raw) return null;
  return raw.replace(/^Kel\.\s*/i, "").replace(/^Kelurahan\s*/i, "").trim() || null;
}

async function geocodeAddress(alamat: string, kelurahan: string | null, kecamatan: string): Promise<{ lat: number; lng: number } | null> {
  const parts = [alamat, kelurahan, kecamatan, "Surabaya", "Indonesia"].filter(Boolean);
  const query = parts.join(", ");
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
  
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "AURORA-WasteManagement/1.0" },
    });
    const data = await res.json();
    if (data && data.length > 0) {
      return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
    }
  } catch (err) {
    console.warn(`Geocoding failed for: ${query}`);
  }
  return null;
}

async function main() {
  console.log("=== TPS DATA CLEANSING & IMPORT SCRIPT ===\n");
  
  const dataPath = path.resolve(__dirname, "../../../../dashboard/src/data/real-tps-data-fixed.json");
  console.log(`Reading data from: ${dataPath}`);
  
  const rawData: RealTpsData = JSON.parse(fs.readFileSync(dataPath, "utf-8"));
  const records = rawData.result.records;
  
  console.log(`Total records found: ${records.length}\n`);
  
  const validRecords = records.filter((r) => {
    if (!r.nama || r.nama.trim() === "") return false;
    if (r.status && r.status.toLowerCase() !== "aktif") return false;
    return true;
  });
  
  console.log(`Records after status filter: ${validRecords.length}`);
  
  const recordsWithCoords = validRecords.filter((r) => isValidCoordinate(r.lat, r.lng));
  const recordsWithoutCoords = validRecords.filter((r) => !isValidCoordinate(r.lat, r.lng));
  
  console.log(`Records with valid coordinates: ${recordsWithCoords.length}`);
  console.log(`Records needing geocoding: ${recordsWithoutCoords.length}\n`);
  
  console.log("Dropping existing TPS data...");
  await prisma.tps.deleteMany({});
  console.log("Existing TPS data dropped.\n");
  
  const stats = {
    total: 0,
    imported: 0,
    geocoded: 0,
    failed: 0,
    errors: [] as string[],
  };
  
  console.log("Processing records...\n");
  
  for (let i = 0; i < validRecords.length; i++) {
    const r = validRecords[i];
    stats.total++;
    
    try {
      let lat = r.lat;
      let lng = r.lng;
      
      if (!isValidCoordinate(lat, lng)) {
        const geocoded = await geocodeAddress(r.alamat, r.kelurahan, r.kecamatan);
        if (geocoded) {
          lat = geocoded.lat;
          lng = geocoded.lng;
          stats.geocoded++;
          console.log(`  [${i + 1}/${validRecords.length}] Geocoded: ${r.nama}`);
        } else {
          lat = -7.25 + (Math.random() * 0.1 - 0.05);
          lng = 112.73 + (Math.random() * 0.05 - 0.025);
          console.log(`  [${i + 1}/${validRecords.length}] Fallback coords for: ${r.nama}`);
        }
        await new Promise((resolve) => setTimeout(resolve, 300));
      }
      
      const code = generateSyntheticCode(r.id_tps, i);
      const kecamatan = cleanKecamatan(r.kecamatan);
      const kelurahan = cleanKelurahan(r.kelurahan);
      const klasifikasiPengangkutan = standardizeKlasifikasiPengangkutan(r.klasifikasi_pengangkutan);
      const jenisFasilitas = standardizeJenisFasilitas(r.jenis_fasilitas);
      
      const kapasitasM3 = r.kapasitas || 8;
      const capacityKg = kapasitasM3 * 250;
      
      const volMasukM3 = r.vol_masuk || kapasitasM3;
      const volDikelolaM3 = r.vol_dikelola || volMasukM3;
      const volDiangkutM3 = r.vol_diangkut || volMasukM3;
      const estimasiBeratKg = volMasukM3 * 200;
      
      const truckType = klasifikasiPengangkutan === "ARMROLL" ? "ARMROLL" : "COMPACTOR";
      
      await prisma.tps.create({
        data: {
          code,
          name: r.nama.trim(),
          kecamatan,
          kelurahan,
          lat: lat!,
          lng: lng!,
          capacityKg,
          fillThreshold: 0.9,
          currentVolume: 0,
          status: "AKTIF",
          type: truckType,
          schedule: [],
          needsReview: false,
          source: "CKAN_SURABAYA",
          rawAddress: r.alamat,
          confidence: isValidCoordinate(r.lat, r.lng) ? 0.95 : 0.6,
          volMasukM3,
          volDikelolaM3,
          volDiangkutM3,
          estimasiBeratKg,
          isJalanProtokol: false,
          klasifikasiPengangkutan,
          jenisFasilitas,
        },
      });
      
      stats.imported++;
      
      if (stats.imported % 50 === 0) {
        console.log(`  Progress: ${stats.imported}/${validRecords.length} records imported`);
      }
    } catch (err: any) {
      stats.failed++;
      stats.errors.push(`${r.nama}: ${err.message}`);
      console.error(`  ERROR: ${r.nama} - ${err.message}`);
    }
  }
  
  console.log("\n=== IMPORT SUMMARY ===");
  console.log(`Total processed: ${stats.total}`);
  console.log(`Successfully imported: ${stats.imported}`);
  console.log(`Geocoded: ${stats.geocoded}`);
  console.log(`Failed: ${stats.failed}`);
  
  if (stats.errors.length > 0 && stats.errors.length <= 10) {
    console.log("\nErrors:");
    stats.errors.forEach((e) => console.log(`  - ${e}`));
  }
  
  const finalCount = await prisma.tps.count();
  console.log(`\nFinal TPS count in database: ${finalCount}`);
  
  await prisma.$disconnect();
  console.log("\n=== DONE ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
