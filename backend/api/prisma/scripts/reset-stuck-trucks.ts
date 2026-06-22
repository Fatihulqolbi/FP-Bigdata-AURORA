import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const result = await prisma.truck.updateMany({
    where: { status: "UNLOADING" },
    data: {
      status: "AVAILABLE",
      route: null,
      routeProgress: 0,
      routeDistance: null,
      routeDuration: null,
      destinationLat: null,
      destinationLng: null,
      routeQueue: null,
      routeLegIndex: 0,
      assignedTpsId: null,
      facilityId: null,
      currentLoadKg: 0,
    },
  });
  console.log(`Reset ${result.count} UNLOADING trucks to AVAILABLE`);

  const loading = await prisma.truck.updateMany({
    where: { status: "LOADING" },
    data: {
      status: "AVAILABLE",
      route: null,
      routeProgress: 0,
      routeDistance: null,
      routeDuration: null,
      destinationLat: null,
      destinationLng: null,
      routeQueue: null,
      routeLegIndex: 0,
      assignedTpsId: null,
      currentLoadKg: 0,
    },
  });
  console.log(`Reset ${loading.count} LOADING trucks to AVAILABLE`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
