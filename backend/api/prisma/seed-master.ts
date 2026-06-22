import { PrismaClient, Role, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
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

async function main() {
  console.log("=== AURORA Master Seed Started ===\n");

  const hash = await bcrypt.hash("password123", 4);

  // 1. Create Admin User
  console.log("1. Creating Users...");
  const admin = await prisma.user.create({
    data: {
      email: "admin@aurora.go.id",
      passwordHash: hash,
      role: "ADMIN" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "DLH Surabaya",
      contact: "031-xxxx",
    },
  });
  console.log("   Admin created:", admin.email);

  const tpsAdmin = await prisma.user.create({
    data: {
      email: "admin.tps@aurora.go.id",
      passwordHash: hash,
      role: "ADMIN_TPS" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "Admin TPS Surabaya",
      contact: "0815-xxxx-xxxx",
    },
  });
  console.log("   Admin TPS created:", tpsAdmin.email);

  const bank1 = await prisma.user.create({
    data: {
      email: "bank.bratang@aurora.go.id",
      passwordHash: hash,
      role: "BANK_SAMPAH" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "Bank Sampah Bratang",
      address: "Jl. Bratang Binangun, Surabaya",
      lat: -7.295,
      lng: 112.765,
      contact: "0812-xxxx-xxxx",
      sellerRating: 4.5,
    },
  });

  const bank2 = await prisma.user.create({
    data: {
      email: "bank.keputih@aurora.go.id",
      passwordHash: hash,
      role: "BANK_SAMPAH" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "Bank Sampah Keputih",
      address: "Jl. Keputih, Surabaya",
      lat: -7.282,
      lng: 112.795,
      contact: "0813-xxxx-xxxx",
      sellerRating: 4.2,
    },
  });

  const industry = await prisma.user.create({
    data: {
      email: "pt.daurulang@aurora.go.id",
      passwordHash: hash,
      role: "INDUSTRI" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "PT Daur Ulang Bersama",
      address: "Jl. Rungkut Industri, Surabaya",
      lat: -7.335,
      lng: 112.755,
      contact: "031-xxxx-yyyy",
    },
  });

  const warga = await prisma.user.create({
    data: {
      email: "warga@aurora.go.id",
      passwordHash: hash,
      role: "WARGA" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "Budi Santoso",
      address: "Jl. Ngagel, Surabaya",
      lat: -7.290,
      lng: 112.745,
      contact: "0857-xxxx-xxxx",
    },
  });

  console.log("   Users created: 6\n");

  // 2. Create Material Categories
  console.log("2. Creating Material Categories...");
  const categories = await Promise.all([
    prisma.materialCategory.create({
      data: { name: "Plastik PET", description: "Botol plastik bening", minPrice: 2000, maxPrice: 8000, gradeOptions: ["Bersih", "Kotor", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Plastik HDPE", description: "Botol plastik warna/susu", minPrice: 1500, maxPrice: 6000, gradeOptions: ["Bersih", "Kotor"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Kardus / Kertas", description: "Karton dan kertas bekas", minPrice: 500, maxPrice: 3000, gradeOptions: ["Bersih", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Logam", description: "Besi, aluminium, tembaga", minPrice: 3000, maxPrice: 50000, gradeOptions: ["Besi", "Aluminium", "Tembaga", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Organik", description: "Sampah sisa makanan & tanaman", minPrice: 200, maxPrice: 1500 },
    }),
    prisma.materialCategory.create({
      data: { name: "E-Waste", description: "Sampah elektronik", minPrice: 5000, maxPrice: 100000, gradeOptions: ["PCB", "Kabel", "Komponen"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Produk Daur Ulang", description: "Kerajinan hasil daur ulang", minPrice: 10000, maxPrice: 500000, isProduct: true },
    }),
  ]);
  console.log("   Categories created:", categories.length, "\n");

  // 3. Seed TPS from JSON
  console.log("3. Seeding TPS from JSON...");
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

  const raw = fs.readFileSync(jsonPath, "utf-8");
  const data: JsonData = JSON.parse(raw);

  const allRecords = data.result.records;
  const tpsRecords = allRecords.filter(
    (r) => isTps(r) && r.lat !== null && r.lng !== null && r.kapasitas > 0
  );
  const tps3rRecords = allRecords.filter(
    (r) =>
      isTps3r(r) &&
      !shouldRemoveTps3r(r.nama) &&
      r.lat !== null &&
      r.lng !== null
  );

  let tpsInserted = 0;
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
      tpsInserted++;
      if (tpsInserted % 50 === 0) console.log(`   Inserted ${tpsInserted}/${tpsRecords.length}`);
    } catch {
      console.log(`   Skipped duplicate: ${record.nama}`);
    }
  }
  console.log(`   TPS seeded: ${tpsInserted}\n`);

  // 4. Seed Facilities (TPS3R, PLTSa, DEPO)
  console.log("4. Seeding Facilities (TPS3R, PLTSa, DEPO)...");
  
  const FACILITIES = [
    {
      code: "PLTSa-BENOWO",
      name: "PLTSa Benowo",
      type: "PLTSa",
      kecamatan: "Benowo",
      lat: -7.234,
      lng: 112.620,
      capacityKg: 500_000,
      dailyCapacityKg: null,
      acceptsTypes: ["RESIDU"],
    },
    {
      code: "DEPO-UTAMA-DKP",
      name: "Depo Utama DKP",
      type: "DEPO",
      kecamatan: "Sawahan",
      lat: -7.2528236775706105,
      lng: 112.70581075397124,
      capacityKg: 0,
      dailyCapacityKg: null,
      acceptsTypes: [],
    },
    {
      code: "TPS3R-SUTOREJO",
      name: "Super Depo Sutorejo",
      type: "TPS3R",
      kecamatan: "Mulyorejo",
      lat: -7.258200635257379,
      lng: 112.79463584020006,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-JAMBANGAN",
      name: "PDU Jambangan",
      type: "TPS3R",
      kecamatan: "Jambangan",
      lat: -7.317395140750365,
      lng: 112.7167780349453,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-BRATANG",
      name: "TPS 3R Bratang",
      type: "TPS3R",
      kecamatan: "Gubeng",
      lat: -7.297019176678802,
      lng: 112.76134199631186,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-TAMBAKOSO",
      name: "TPS 3R Tambak Osowilangun",
      type: "TPS3R",
      kecamatan: "Benowo",
      lat: -7.218007331729817,
      lng: 112.66121751615624,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-TENGGILIS",
      name: "TPS 3R Tenggilis",
      type: "TPS3R",
      kecamatan: "Tenggilis Mejoyo",
      lat: -7.318604453582783,
      lng: 112.75122082104238,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-KEDUNGCOWEK",
      name: "TPS 3R Kedung Cowek",
      type: "TPS3R",
      kecamatan: "Kenjeran",
      lat: -7.216586534415317,
      lng: 112.77885520394545,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-GUNUNGANYAR",
      name: "TPS 3R Gunung Anyar",
      type: "TPS3R",
      kecamatan: "Gunung Anyar",
      lat: -7.3318725835281136,
      lng: 112.81533555332348,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-KARANGPILANG",
      name: "TPS 3R Karang Pilang",
      type: "TPS3R",
      kecamatan: "Karang Pilang",
      lat: -7.33967817789591,
      lng: 112.693680915167,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-WARUGUNUNG",
      name: "TPS 3R Waru Gunung",
      type: "TPS3R",
      kecamatan: "Karang Pilang",
      lat: -7.332807147906473,
      lng: 112.65990381393213,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-BANJARSUGIHAN",
      name: "TPS 3R Banjarsugihan",
      type: "TPS3R",
      kecamatan: "Tandes",
      lat: -7.255,
      lng: 112.665,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
    {
      code: "TPS3R-TAMBAKWEDI",
      name: "TPS 3R Tambak Wedi",
      type: "TPS3R",
      kecamatan: "Kenjeran",
      lat: -7.216473495540614,
      lng: 112.77716164549818,
      capacityKg: 50_000,
      dailyCapacityKg: 20_000,
      acceptsTypes: ["ORGANIK", "PLASTIK_PET", "KERTAS"],
    },
  ];

  for (const facility of FACILITIES) {
    await prisma.sortingHub.create({
      data: {
        code: facility.code,
        name: facility.name,
        type: facility.type,
        kecamatan: facility.kecamatan,
        lat: facility.lat,
        lng: facility.lng,
        capacityKg: facility.capacityKg,
        dailyCapacityKg: facility.dailyCapacityKg ?? null,
        currentLoadKg: 0,
        dailyIntakeKg: 0,
        acceptsTypes: facility.acceptsTypes,
      },
    });
  }
  console.log(`   Facilities seeded: ${FACILITIES.length}\n`);

  // 5. Seed Trucks (225 Total - DKRTH 2025)
  console.log("5. Seeding Trucks (225 Total)...");
  
  const TRUCK_TYPES = [
    { type: "COMPACTOR_10", name: "Compactor 10m³", capacityKg: 8000, volumeM3: 10, canCompact: true, count: 62 },
    { type: "COMPACTOR_6_5", name: "Compactor 6.5m³", capacityKg: 5200, volumeM3: 6.5, canCompact: true, count: 19 },
    { type: "DUMP_TRUCK", name: "Dump Truck 4-5m³", capacityKg: 5000, volumeM3: 5, canCompact: false, count: 26 },
    { type: "ARMROLL_14", name: "Arm Roll 14m³", capacityKg: 7000, volumeM3: 14, canCompact: false, count: 38 },
    { type: "ARMROLL_8", name: "Arm Roll 8m³", capacityKg: 4000, volumeM3: 8, canCompact: false, count: 5 },
    { type: "ARMROLL_6", name: "Arm Roll 6m³", capacityKg: 3000, volumeM3: 6, canCompact: false, count: 11 },
    { type: "PICK_UP", name: "Pick Up 1-2m³", capacityKg: 1000, volumeM3: 2, canCompact: false, count: 64 },
  ];

  let truckCount = 0;
  for (const truckType of TRUCK_TYPES) {
    for (let i = 1; i <= truckType.count; i++) {
      const numStr = String(i).padStart(3, "0");
      const code = `TRK-${truckType.type.replace("_", "-")}-${numStr}`;
      const name = `${truckType.name} #${i}`;
      
      await prisma.truck.create({
        data: {
          code: code,
          name: name,
          type: truckType.type,
          capacityKg: truckType.capacityKg,
          currentLoadKg: 0,
          status: "AVAILABLE",
          volumeM3: truckType.volumeM3,
          canCompact: truckType.canCompact,
        },
      });
      truckCount++;
    }
    console.log(`   ${truckType.name}: ${truckType.count} units`);
  }
  console.log(`   Total Trucks seeded: ${truckCount}\n`);

  console.log("=== AURORA Master Seed Complete! ===\n");
  console.log("Login credentials (all users password: password123):");
  console.log("  Admin:     admin@aurora.go.id");
  console.log("  Admin TPS: admin.tps@aurora.go.id");
  console.log("  Bank 1:    bank.bratang@aurora.go.id");
  console.log("  Bank 2:    bank.keputih@aurora.go.id");
  console.log("  Industry:  pt.daurulang@aurora.go.id");
  console.log("  Warga:     warga@aurora.go.id");
  console.log(`\nTPS: ${tpsInserted} | Facilities: ${FACILITIES.length} | Trucks: ${truckCount}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
