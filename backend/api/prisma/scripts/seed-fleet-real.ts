import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const FLEET_DATA = [
  { type: "COMPACTOR_10", count: 62, volumeM3: 10, capacityKg: 16000, canCompact: true },
  { type: "COMPACTOR_6_5", count: 19, volumeM3: 6.5, capacityKg: 10400, canCompact: true },
  { type: "DUMP_TRUCK", count: 26, volumeM3: 4.5, capacityKg: 12500, canCompact: false },
  { type: "ARMROLL_14", count: 38, volumeM3: 14, capacityKg: 23300, canCompact: false },
  { type: "ARMROLL_8", count: 5, volumeM3: 8, capacityKg: 13300, canCompact: false },
  { type: "ARMROLL_6", count: 11, volumeM3: 6, capacityKg: 10000, canCompact: false },
  { type: "PICK_UP", count: 79, volumeM3: 1.5, capacityKg: 2500, canCompact: false },
];

const DEPOT_LOCATIONS = [
  { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
  { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
];

async function main() {
  console.log("=== FLEET SEED SCRIPT - DLH SURABAYA 2025 (225 Units) ===\n");
  
  const existingCount = await prisma.truck.count();
  console.log(`Existing trucks in database: ${existingCount}`);
  
  if (existingCount > 0) {
    console.log("Dropping existing trucks...");
    await prisma.truck.deleteMany({});
    console.log("Existing trucks dropped.\n");
  }
  
  let totalCreated = 0;
  let truckIndex = 1;
  
  for (const fleetType of FLEET_DATA) {
    console.log(`Creating ${fleetType.count} ${fleetType.type} trucks...`);
    
    for (let i = 1; i <= fleetType.count; i++) {
      const code = generateTruckCode(fleetType.type, i);
      const name = generateTruckName(fleetType.type, i);
      const depot = DEPOT_LOCATIONS[truckIndex % DEPOT_LOCATIONS.length];
      
      await prisma.truck.create({
        data: {
          code,
          name,
          type: fleetType.type,
          capacityKg: fleetType.capacityKg,
          volumeM3: fleetType.volumeM3,
          canCompact: fleetType.canCompact,
          currentLoadKg: 0,
          status: "AVAILABLE",
          lat: depot.lat + (Math.random() * 0.01 - 0.005),
          lng: depot.lng + (Math.random() * 0.01 - 0.005),
          heading: 0,
          maxTpsPerRoute: fleetType.type === "PICK_UP" ? 6 : 4,
          isJalanProtokol: fleetType.type === "PICK_UP",
        },
      });
      
      totalCreated++;
      truckIndex++;
    }
  }
  
  console.log(`\n=== FLEET SUMMARY ===`);
  console.log(`Total trucks created: ${totalCreated}`);
  
  const byType = await prisma.truck.groupBy({
    by: ["type"],
    _count: true,
  });
  
  console.log("\nTrucks by type:");
  for (const row of byType) {
    console.log(`  ${row.type}: ${row._count}`);
  }
  
  const finalCount = await prisma.truck.count();
  console.log(`\nFinal truck count in database: ${finalCount}`);
  
  await prisma.$disconnect();
  console.log("\n=== DONE ===");
}

function generateTruckCode(type: string, index: number): string {
  const prefixes: Record<string, string> = {
    COMPACTOR_10: "C10",
    COMPACTOR_6_5: "C65",
    DUMP_TRUCK: "DMP",
    ARMROLL_14: "A14",
    ARMROLL_8: "A08",
    ARMROLL_6: "A06",
    PICK_UP: "PKU",
  };
  const prefix = prefixes[type] || type.substring(0, 3).toUpperCase();
  const num = String(index).padStart(3, "0");
  return `${prefix}-${num}`;
}

function generateTruckName(type: string, index: number): string {
  const names: Record<string, string> = {
    COMPACTOR_10: "Compactor 10m³",
    COMPACTOR_6_5: "Compactor 6.5m³",
    DUMP_TRUCK: "Dump Truck",
    ARMROLL_14: "Armroll 14m³",
    ARMROLL_8: "Armroll 8m³",
    ARMROLL_6: "Armroll 6m³",
    PICK_UP: "Pick Up",
  };
  return `${names[type] || type} #${index}`;
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
