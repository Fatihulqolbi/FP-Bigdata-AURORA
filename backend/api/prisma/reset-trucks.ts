import { PrismaClient } from "@prisma/client";
const p = new PrismaClient();

const DEPOTS = [
  { lat: -7.2185017137913645, lng: 112.6258223434186 },
  { lat: -7.278405714355262, lng: 112.76320233999931 },
  { lat: -7.2100, lng: 112.7300 },
  { lat: -7.3000, lng: 112.7300 },
];

async function main() {
  const trucks = await p.truck.findMany();
  let idx = 0;
  for (const t of trucks) {
    const depot = DEPOTS[idx % DEPOTS.length];
    await p.truck.update({
      where: { id: t.id },
      data: {
        status: "AVAILABLE",
        lat: depot.lat,
        lng: depot.lng,
        heading: 0,
        route: null,
        routeProgress: 0,
        routeDistance: null,
        routeDuration: null,
        routeWaypoints: null,
        assignedTpsId: null,
        destinationLat: null,
        destinationLng: null,
        currentLoadKg: 0,
      },
    });
    idx++;
  }
  console.log("Reset", trucks.length, "trucks to depots with null routes");
  await p.$disconnect();
}

main().catch(console.error);
