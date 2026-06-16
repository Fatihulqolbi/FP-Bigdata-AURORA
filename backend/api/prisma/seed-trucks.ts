import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// 4 depot locations in Surabaya
const GARAGES = [
  { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
  { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
  { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
  { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
];

interface TruckSpec {
  type: string;
  capacityKg: number;
  count: number;
}

const TRUCK_SPECS: TruckSpec[] = [
  { type: "COMPACTOR", capacityKg: 16000, count: 21 },
  { type: "DUMP_TRUCK", capacityKg: 20000, count: 30 },
  { type: "ARM_ROLL", capacityKg: 10000, count: 101 },
];

function generateTruckCode(type: string, index: number): string {
  const prefix = type.replace("_", "")[0]; // C, D, A
  return `TRK-${prefix}-${String(index).padStart(3, "0")}`;
}

async function main() {
  await prisma.truck.deleteMany({});
  console.log("Cleared existing truck data");

  let total = 0;
  for (const spec of TRUCK_SPECS) {
    for (let i = 1; i <= spec.count; i++) {
      const garage = GARAGES[total % GARAGES.length];
      await prisma.truck.create({
        data: {
          code: generateTruckCode(spec.type, i),
          name: `${spec.type.replace("_", " ")} ${i}`,
          type: spec.type,
          capacityKg: spec.capacityKg,
          currentLoadKg: 0,
          status: "AVAILABLE",
          lat: garage.lat,
          lng: garage.lng,
        },
      });
      total++;
    }
    console.log(`Created ${spec.count} ${spec.type} trucks`);
  }

  console.log(`\nDone! ${total} trucks seeded.`);
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
