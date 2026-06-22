import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const SCHEDULED_EVENTS = [
  {
    eventId: "EVT-001",
    eventName: "TAHUN_BARU",
    month: 12,
    day: 31,
    dayOfWeek: null,
    targetKecamatan: "ALL",
    targetKelurahan: null,
    volumeMultiplier: 3.5,
    locations: [
      "Taman Surya",
      "Jalan Gubernur Suryo",
      "Jalan Tunjungan",
      "Taman Bungkul",
      "Tugu Pahlawan",
      "Korem Kertomenanggal",
      "Kembang Jepun",
      "Jembatan Suroboyo",
      "Bundaran Cito",
      "Jalan Darmo",
    ],
  },
  {
    eventId: "EVT-002",
    eventName: "CFD_PARADE_BUDAYA",
    month: 5,
    day: null,
    dayOfWeek: 0,
    targetKecamatan: "Wonokromo",
    targetKelurahan: "Darmo",
    volumeMultiplier: 4.0,
    locations: ["Taman Bungkul", "Tugu Pahlawan"],
  },
  {
    eventId: "EVT-003",
    eventName: "CFD_RUTIN",
    month: null,
    day: null,
    dayOfWeek: 0,
    targetKecamatan: "Wonokromo",
    targetKelurahan: "Darmo",
    volumeMultiplier: 2.5,
    locations: ["Taman Bungkul", "Tugu Pahlawan"],
  },
  {
    eventId: "EVT-004",
    eventName: "KERJA_BAKTI_MASSAL",
    month: 8,
    day: 18,
    dayOfWeek: null,
    targetKecamatan: "ALL",
    targetKelurahan: null,
    volumeMultiplier: 1.8,
    locations: [],
  },
  {
    eventId: "EVT-005",
    eventName: "FESTIVAL_RUJAK_ULEG",
    month: 5,
    day: 17,
    dayOfWeek: null,
    targetKecamatan: "Gunung Anyar",
    targetKelurahan: null,
    volumeMultiplier: 2.0,
    locations: ["Surabaya Expo Center (SBEC)"],
  },
  {
    eventId: "EVT-006",
    eventName: "FESTIVAL_CAHAYA",
    month: 5,
    day: null,
    dayOfWeek: null,
    targetKecamatan: "ALL",
    targetKelurahan: null,
    volumeMultiplier: 1.5,
    locations: ["Taman Surabaya"],
  },
];

const POPULATION_DENSITY_DATA = [
  { kecamatan: "Tegalsari", population: 85000, areaKm2: 4.5 },
  { kecamatan: "Wonokromo", population: 92000, areaKm2: 5.2 },
  { kecamatan: "Tandes", population: 78000, areaKm2: 8.3 },
  { kecamatan: "Benowo", population: 65000, areaKm2: 12.5 },
  { kecamatan: "Pakal", population: 45000, areaKm2: 15.2 },
  { kecamatan: "Sambikerep", population: 72000, areaKm2: 7.8 },
  { kecamatan: "Lakarsantri", population: 88000, areaKm2: 9.1 },
  { kecamatan: "Sukomanunggal", population: 95000, areaKm2: 6.5 },
  { kecamatan: "Asemrowo", population: 58000, areaKm2: 4.2 },
  { kecamatan: "Sawahan", population: 82000, areaKm2: 5.8 },
  { kecamatan: "Gubeng", population: 105000, areaKm2: 4.1 },
  { kecamatan: "Genteng", population: 68000, areaKm2: 3.2 },
  { kecamatan: "Tambaksari", population: 78000, areaKm2: 6.9 },
  { kecamatan: "Simokerto", population: 55000, areaKm2: 3.5 },
  { kecamatan: "Kenjeran", population: 62000, areaKm2: 11.2 },
  { kecamatan: "Bulak", population: 48000, areaKm2: 8.5 },
  { kecamatan: "Krembangan", population: 72000, areaKm2: 5.6 },
  { kecamatan: "Semampir", population: 85000, areaKm2: 4.8 },
  { kecamatan: "Pabean Cantian", population: 52000, areaKm2: 3.1 },
  { kecamatan: "Jemur Wonosari", population: 68000, areaKm2: 7.4 },
  { kecamatan: "Mulyorejo", population: 76000, areaKm2: 6.2 },
  { kecamatan: "Rungkut", population: 88000, areaKm2: 9.5 },
  { kecamatan: "Gunung Anyar", population: 54000, areaKm2: 8.8 },
  { kecamatan: "Sukolilo", population: 92000, areaKm2: 10.2 },
  { kecamatan: "Geligenti", population: 45000, areaKm2: 7.5 },
  { kecamatan: "Wiyung", population: 58000, areaKm2: 11.3 },
  { kecamatan: "Karangpilang", population: 62000, areaKm2: 9.8 },
  { kecamatan: "Jambangan", population: 54000, areaKm2: 5.4 },
  { kecamatan: "Gayungan", population: 48000, areaKm2: 4.9 },
  { kecamatan: "Wonocolo", population: 72000, areaKm2: 7.1 },
  { kecamatan: "Tenggilis Mejoyo", population: 65000, areaKm2: 8.6 },
];

async function main() {
  console.log("=== EVENT CALENDAR & POPULATION DENSITY SEED ===\n");
  
  console.log("Seeding scheduled events...");
  await prisma.scheduledEvent.deleteMany({});
  
  for (const event of SCHEDULED_EVENTS) {
    await prisma.scheduledEvent.create({ data: event });
    console.log(`  Created: ${event.eventName} (${event.volumeMultiplier}x multiplier)`);
  }
  
  const eventCount = await prisma.scheduledEvent.count();
  console.log(`\nTotal events: ${eventCount}\n`);
  
  console.log("Seeding population density data...");
  await prisma.regionalPopulationDensity.deleteMany({});
  
  for (const region of POPULATION_DENSITY_DATA) {
    const densityPerKm2 = region.population / region.areaKm2;
    const densityMultiplier = Math.min(1.5, densityPerKm2 / 10000);
    
    await prisma.regionalPopulationDensity.create({
      data: {
        regionId: region.kecamatan,
        regionName: `Kecamatan ${region.kecamatan}`,
        kecamatan: region.kecamatan,
        population: region.population,
        areaKm2: region.areaKm2,
        densityPerKm2,
        wasteGenKgPerCapitaPerDay: 0.7,
        densityMultiplier,
      },
    });
  }
  
  const densityCount = await prisma.regionalPopulationDensity.count();
  console.log(`Total regions: ${densityCount}\n`);
  
  console.log("=== SUMMARY ===");
  console.log(`Events: ${eventCount}`);
  console.log(`Regions: ${densityCount}`);
  console.log("\n=== DONE ===");
  
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
