import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const trucks = await prisma.truck.findMany({ select: { status: true, code: true } });
  const counts: Record<string, number> = {};
  trucks.forEach((t) => {
    counts[t.status] = (counts[t.status] || 0) + 1;
  });
  console.log("Truck status distribution:", counts);

  // Reset all non-AVAILABLE trucks that don't have drivers
  const result = await prisma.truck.updateMany({
    where: {
      status: { in: ["UNLOADING", "LOADING", "EN_ROUTE_TO_TPS", "EN_ROUTE_TO_HUB", "EN_ROUTE_TO_DEPOT"] },
      driverId: null,
    },
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
  console.log(`Reset ${result.count} stuck trucks to AVAILABLE`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
