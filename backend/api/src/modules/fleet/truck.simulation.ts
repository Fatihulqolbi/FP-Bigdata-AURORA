import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { getRoute, interpolateAlongRoute, checkOsrmHealth, type GeoJSONLineString, type Coordinate } from "./route.service.js";
import { broadcastFleetUpdate } from "./fleet.sse.js";
import { checkRouteTraffic } from "./traffic.service.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
const SIMULATION_INTERVAL_MS = 5000;
const TRUCK_SPEED_MS = 13.88; // 50 km/h in m/s
const MAX_PARALLEL_OSRM = 3;
const ASSIGN_BATCH_SIZE = 10;
const MAX_WAYPOINTS = 3;
const TRAFFIC_CHECK_INTERVAL_MS = 300000; // 5 minutes
let lastTrafficCheck = 0;

// Fill threshold: 75% for close (<5km), 50% for far (>=5km)
const FILL_THRESHOLD_CLOSE = 0.75;
const FILL_THRESHOLD_FAR = 0.50;
const CLOSE_DISTANCE_KM = 5;

// Fuel & Emission constants (Pertamina Dex)
const FUEL_PRICE = 24800; // Rp/liter
const FUEL_EFFICIENCY: Record<string, number> = {
  COMPACTOR: 8,    // km/liter
  DUMP_TRUCK: 6,   // km/liter
  ARM_ROLL: 7,     // km/liter
};
const CO2_PER_LITER = 2.68; // kg CO2/liter diesel

// Scoring weights
const W_FILL = 0.35;
const W_DISTANCE = 0.30;
const W_FUEL = 0.20;
const W_EMISSION = 0.15;

// 4 depot locations
const DEPOTS = [
  { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
  { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
  { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
  { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
];

function haversine(p1: Coordinate, p2: Coordinate): number {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) *
      Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface TpsInfo {
  id: string;
  code: string;
  name: string;
  lat: number;
  lng: number;
  currentVolume: number;
  capacityKg: number;
  status: string;
  type: string;
}

interface SimulationTruck {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  currentLoadKg: number;
  status: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  driverId: string | null;
  assignedTpsId: string | null;
  facilityId: string | null;
  route: any;
  routeProgress: number;
  routeDistance: number | null;
  routeDuration: number | null;
  destinationLat: number | null;
  destinationLng: number | null;
  routeWaypoints: any;
}

interface WaypointStop {
  tpsId: string;
  tpsName: string;
  tpsLat: number;
  tpsLng: number;
  collectedKg: number;
}

function getFillThreshold(distanceKm: number): number {
  return distanceKm < CLOSE_DISTANCE_KM ? FILL_THRESHOLD_CLOSE : FILL_THRESHOLD_FAR;
}

function getFuelEfficiency(truckType: string): number {
  return FUEL_EFFICIENCY[truckType] || 7;
}

/**
 * Calculate multi-criteria score for a TPS candidate.
 * Higher score = better candidate.
 */
function scoreTps(
  tps: { fill: number; distanceKm: number; currentVolume: number },
  truckType: string
): number {
  const fuelEff = getFuelEfficiency(truckType);
  const fuelCost = (tps.distanceKm / fuelEff) * FUEL_PRICE;
  const emission = (tps.distanceKm / fuelEff) * CO2_PER_LITER;

  // Normalize: fill is 0-1, distance/fuel/emission need inverse normalization
  const fillScore = tps.fill;
  const distScore = tps.distanceKm > 0 ? Math.min(1, 5 / tps.distanceKm) : 0; // 5km = score 1.0
  const fuelScore = fuelCost > 0 ? Math.min(1, 50000 / fuelCost) : 0; // Rp50k = score 1.0
  const emScore = emission > 0 ? Math.min(1, 10 / emission) : 1; // 10kg CO2 = score 1.0

  return (fillScore * W_FILL) + (distScore * W_DISTANCE) + (fuelScore * W_FUEL) + (emScore * W_EMISSION);
}

/**
 * Find nearest depot to a given position.
 */
function nearestDepot(pos: Coordinate): (typeof DEPOTS)[number] {
  return DEPOTS.reduce((best, depot) => {
    const d = haversine(pos, { lat: depot.lat, lng: depot.lng });
    return d < haversine(pos, { lat: best.lat, lng: best.lng }) ? depot : best;
  }, DEPOTS[0]);
}

/**
 * Build multi-stop route for a truck with smart scoring.
 * Picks TPS stops based on multi-criteria score (fill, distance, fuel, emission).
 * Returns null if no qualifying TPS found.
 */
async function buildMultiStopRoute(
  truck: SimulationTruck,
  tpsList: TpsInfo[],
  facilities: { id: string; lat: number; lng: number }[],
  usedTpsCounts: Map<string, number>
): Promise<{
  route: Awaited<ReturnType<typeof getRoute>>;
  waypoints: WaypointStop[];
  facilityId: string;
  stats: { fuelLiters: number; fuelCost: number; co2Kg: number; totalDistanceKm: number };
} | null> {
  // Find nearest depot to truck (or default)
  const truckPos: Coordinate = truck.lat != null && truck.lng != null
    ? { lat: truck.lat, lng: truck.lng }
    : DEPOTS[0];

  // Filter valid TPS and calculate scores
  const scoredTps = [...tpsList]
    .filter((t) => t.lat != null && t.lng != null && !isNaN(t.lat) && !isNaN(t.lng) && !(t.lat === 0 && t.lng === 0))
    .map((t) => {
      const fill = t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0;
      const distanceKm = haversine(truckPos, { lat: t.lat, lng: t.lng }) / 1000;
      const score = scoreTps({ fill, distanceKm, currentVolume: t.currentVolume }, truck.type);
      return { ...t, fill, distanceKm, score };
    })
    .filter((t) => {
      const threshold = getFillThreshold(t.distanceKm);
      const usedCount = usedTpsCounts.get(t.id) || 0;
      const maxTrucks = t.currentVolume > truck.capacityKg ? 2 : 1;
      return t.fill >= threshold && t.currentVolume > 0 && usedCount < maxTrucks;
    })
    .sort((a, b) => b.score - a.score);

  if (scoredTps.length === 0) return null;

  // Pick stops with nearest-neighbor chaining (greedy TSP)
  const stops: WaypointStop[] = [];
  let remainingCapacity = truck.capacityKg;
  const visitedIds = new Set<string>();
  let currentPos = truckPos;

  // First stop: highest score
  const firstTps = scoredTps[0];
  const firstCollected = Math.min(firstTps.currentVolume, remainingCapacity);
  if (firstCollected <= 0) return null;

  stops.push({
    tpsId: firstTps.id,
    tpsName: firstTps.name,
    tpsLat: firstTps.lat,
    tpsLng: firstTps.lng,
    collectedKg: Math.round(firstCollected * 100) / 100,
  });
  visitedIds.add(firstTps.id);
  remainingCapacity -= firstCollected;
  currentPos = { lat: firstTps.lat, lng: firstTps.lng };
  usedTpsCounts.set(firstTps.id, (usedTpsCounts.get(firstTps.id) || 0) + 1);

  // Subsequent stops: nearest high-score TPS to current position
  while (stops.length < MAX_WAYPOINTS && remainingCapacity > 0) {
    const candidates = scoredTps
      .filter((t) => !visitedIds.has(t.id) && t.currentVolume > 0)
      .map((t) => ({
        ...t,
        distFromCurrent: haversine(currentPos, { lat: t.lat, lng: t.lng }) / 1000,
      }))
      .sort((a, b) => {
        // Weighted: score + proximity bonus
        const aScore = a.score * 0.6 + (Math.min(1, 3 / (a.distFromCurrent + 0.1)) * 0.4);
        const bScore = b.score * 0.6 + (Math.min(1, 3 / (b.distFromCurrent + 0.1)) * 0.4);
        return bScore - aScore;
      });

    if (candidates.length === 0) break;

    const next = candidates[0];
    const collected = Math.min(next.currentVolume, remainingCapacity);
    if (collected <= 0) break;

    stops.push({
      tpsId: next.id,
      tpsName: next.name,
      tpsLat: next.lat,
      tpsLng: next.lng,
      collectedKg: Math.round(collected * 100) / 100,
    });
    visitedIds.add(next.id);
    remainingCapacity -= collected;
    currentPos = { lat: next.lat, lng: next.lng };
    usedTpsCounts.set(next.id, (usedTpsCounts.get(next.id) || 0) + 1);
  }

  if (stops.length === 0) return null;

  // Find nearest facility to last stop
  const lastStop = stops[stops.length - 1];
  const nearestFacility = facilities.reduce((best, f) => {
    const d = haversine({ lat: lastStop.tpsLat, lng: lastStop.tpsLng }, { lat: f.lat, lng: f.lng });
    const bestD = haversine({ lat: lastStop.tpsLat, lng: lastStop.tpsLng }, { lat: best.lat, lng: best.lng });
    return d < bestD ? f : best;
  }, facilities[0]);

  // Find nearest depot to first TPS (for route origin)
  const depot = nearestDepot({ lat: stops[0].tpsLat, lng: stops[0].tpsLng });
  const routeOrigin: Coordinate = truck.lat != null && truck.lng != null
    ? { lat: truck.lat, lng: truck.lng }
    : { lat: depot.lat, lng: depot.lng };

  // Build OSRM route: origin → tps_a → tps_b → ... → facility
  const routeDest: Coordinate = { lat: nearestFacility.lat, lng: nearestFacility.lng };
  const routeWaypoints: Coordinate[] = stops.map((s) => ({ lat: s.tpsLat, lng: s.tpsLng }));

  const route = await getRoute(routeOrigin, routeDest, routeWaypoints);

  // Calculate route stats
  const totalDistanceKm = route.distance / 1000;
  const fuelEff = getFuelEfficiency(truck.type);
  const fuelLiters = totalDistanceKm / fuelEff;
  const fuelCost = Math.round(fuelLiters * FUEL_PRICE);
  const co2Kg = Math.round(fuelLiters * CO2_PER_LITER * 100) / 100;

  return {
    route,
    waypoints: stops,
    facilityId: nearestFacility.id,
    stats: { fuelLiters: Math.round(fuelLiters * 100) / 100, fuelCost, co2Kg, totalDistanceKm: Math.round(totalDistanceKm * 10) / 10 },
  };
}

async function tick() {
  try {
    const trucks = await prisma.truck.findMany() as SimulationTruck[];
    if (trucks.length === 0) return;

    const facilities = await prisma.sortingHub.findMany();
    const activeTps = await prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" } },
    });

    const updates: Promise<any>[] = [];
    const changedTruckIds: string[] = [];

    // --- Phase 1: Move trucks (fast, no OSRM calls) ---
    for (const truck of trucks) {
      if (truck.status === "EN_ROUTE_TO_TPS" && truck.route) {
        const geo = truck.route as unknown as GeoJSONLineString;
        const dist = (truck.routeDistance || geo.coordinates.length * 10);
        const step = SIMULATION_INTERVAL_MS / 1000 / (dist / TRUCK_SPEED_MS);
        const newProgress = Math.min(1, truck.routeProgress + step);
        const { position, heading } = interpolateAlongRoute(geo, newProgress);

        if (newProgress >= 1) {
          // Arrived at TPS — check if there are more waypoints
          const waypoints = (truck.routeWaypoints as WaypointStop[]) || [];
          const currentWpIdx = waypoints.findIndex(
            (wp) => Math.abs(wp.tpsLat - position[1]) < 0.001 && Math.abs(wp.tpsLng - position[0]) < 0.001
          );

          if (currentWpIdx >= 0 && currentWpIdx < waypoints.length - 1) {
            // More waypoints to visit — collect at current TPS, continue to next
            const wp = waypoints[currentWpIdx];
            const tps = activeTps.find((t) => t.id === wp.tpsId);
            if (tps) {
              const newVol = Math.max(0, tps.currentVolume - wp.collectedKg);
              await prisma.tps.update({
                where: { id: wp.tpsId },
                data: { currentVolume: Math.round(newVol * 100) / 100 },
              });
            }
            // Mark this waypoint as visited (set collectedKg to 0)
            const updatedWps = waypoints.map((w, i) => i === currentWpIdx ? { ...w, collectedKg: 0 } : w);

            // Continue to next waypoint — build route from current pos to next stops + facility
            const remainingWps = updatedWps.filter((w) => w.collectedKg > 0);
            const facility = facilities.find((f) => f.id === truck.facilityId) || facilities[0];

            if (remainingWps.length > 0 && facility) {
              const nextDest: Coordinate = { lat: facility.lat, lng: facility.lng };
              const nextWaypoints: Coordinate[] = remainingWps.map((w) => ({ lat: w.tpsLat, lng: w.tpsLng }));
              try {
                const nextRoute = await getRoute({ lat: position[1], lng: position[0] }, nextDest, nextWaypoints);
                updates.push(
                  prisma.truck.update({
                    where: { id: truck.id },
                    data: {
                      lat: position[1], lng: position[0], heading,
                      route: nextRoute.geometry as any,
                      routeProgress: 0,
                      routeDistance: nextRoute.distance,
                      routeDuration: nextRoute.duration,
                      routeWaypoints: updatedWps as any,
                      currentLoadKg: truck.currentLoadKg + wp.collectedKg,
                    },
                  })
                );
              } catch {
                // OSRM failed — go directly to facility
                updates.push(
                  prisma.truck.update({
                    where: { id: truck.id },
                    data: {
                      status: "EN_ROUTE_TO_HUB", lat: position[1], lng: position[0], heading,
                      routeWaypoints: updatedWps as any,
                      currentLoadKg: truck.currentLoadKg + wp.collectedKg,
                    },
                  })
                );
              }
            } else {
              // No more waypoints — head to facility
              if (facility) {
                try {
                  const returnRoute = await getRoute({ lat: position[1], lng: position[0] }, { lat: facility.lat, lng: facility.lng });
                  updates.push(
                    prisma.truck.update({
                      where: { id: truck.id },
                      data: {
                        status: "EN_ROUTE_TO_HUB", lat: position[1], lng: position[0], heading,
                        route: returnRoute.geometry as any,
                        routeProgress: 0, routeDistance: returnRoute.distance, routeDuration: returnRoute.duration,
                        routeWaypoints: updatedWps as any,
                        currentLoadKg: truck.currentLoadKg + wp.collectedKg,
                      },
                    })
                  );
                } catch {
                  updates.push(
                    prisma.truck.update({
                      where: { id: truck.id },
                      data: { status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0, assignedTpsId: null, route: null, routeProgress: 0, routeWaypoints: null, currentLoadKg: 0 },
                    })
                  );
                }
              } else {
                updates.push(
                  prisma.truck.update({
                    where: { id: truck.id },
                    data: { status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0, assignedTpsId: null, route: null, routeProgress: 0, routeWaypoints: null, currentLoadKg: 0 },
                  })
                );
              }
            }
          } else {
            // Last waypoint (or no waypoints) — collect and head to facility
            const wp = waypoints[currentWpIdx >= 0 ? currentWpIdx : 0];
            if (wp) {
              const tps = activeTps.find((t) => t.id === wp.tpsId);
              if (tps) {
                const newVol = Math.max(0, tps.currentVolume - wp.collectedKg);
                await prisma.tps.update({
                  where: { id: wp.tpsId },
                  data: { currentVolume: Math.round(newVol * 100) / 100 },
                });
              }
            }

            const facility = facilities.find((f) => f.id === truck.facilityId) || facilities[0];
            if (facility) {
              try {
                const returnRoute = await getRoute({ lat: position[1], lng: position[0] }, { lat: facility.lat, lng: facility.lng });
                updates.push(
                  prisma.truck.update({
                    where: { id: truck.id },
                    data: {
                      status: "EN_ROUTE_TO_HUB", lat: position[1], lng: position[0], heading,
                      route: returnRoute.geometry as any,
                      routeProgress: 0, routeDistance: returnRoute.distance, routeDuration: returnRoute.duration,
                      routeWaypoints: null,
                      currentLoadKg: truck.currentLoadKg + (wp?.collectedKg || 0),
                    },
                  })
                );
              } catch {
                updates.push(
                  prisma.truck.update({
                    where: { id: truck.id },
                    data: { status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0, assignedTpsId: null, route: null, routeProgress: 0, routeWaypoints: null, currentLoadKg: 0 },
                  })
                );
              }
            } else {
              updates.push(
                prisma.truck.update({
                  where: { id: truck.id },
                  data: { status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0, assignedTpsId: null, route: null, routeProgress: 0, routeWaypoints: null, currentLoadKg: 0 },
                })
              );
            }
          }
        } else {
          // Still moving
          updates.push(
            prisma.truck.update({
              where: { id: truck.id },
              data: { lat: position[1], lng: position[0], heading, routeProgress: newProgress },
            })
          );
        }
        changedTruckIds.push(truck.id);

      } else if (truck.status === "EN_ROUTE_TO_HUB" && truck.route) {
        const geo = truck.route as unknown as GeoJSONLineString;
        const dist = (truck.routeDistance || geo.coordinates.length * 10);
        const step = SIMULATION_INTERVAL_MS / 1000 / (dist / TRUCK_SPEED_MS);
        const newProgress = Math.min(1, truck.routeProgress + step);
        const { position, heading } = interpolateAlongRoute(geo, newProgress);

        if (newProgress >= 1) {
          updates.push(
            prisma.truck.update({
              where: { id: truck.id },
              data: { status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0, assignedTpsId: null, destinationLat: null, destinationLng: null, route: null, routeProgress: 0, routeDistance: null, routeDuration: null, routeWaypoints: null, currentLoadKg: 0 },
            })
          );
        } else {
          updates.push(
            prisma.truck.update({
              where: { id: truck.id },
              data: { lat: position[1], lng: position[0], heading, routeProgress: newProgress },
            })
          );
        }
        changedTruckIds.push(truck.id);
      }
    }

    await Promise.all(updates);

    // --- Phase 1.5: Traffic check (every 5 minutes) ---
    const now = Date.now();
    if (now - lastTrafficCheck > TRAFFIC_CHECK_INTERVAL_MS) {
      lastTrafficCheck = now;
      const enRouteTrucks = trucks.filter((t) => t.status === "EN_ROUTE_TO_TPS" && t.route);
      if (enRouteTrucks.length > 0) {
        // Sample 3 trucks for traffic check (to stay within TomTom rate limits)
        const sample = enRouteTrucks.slice(0, 3);
        for (const truck of sample) {
          try {
            const geo = truck.route as unknown as GeoJSONLineString;
            if (!geo?.coordinates?.length) continue;
            const traffic = await checkRouteTraffic(geo.coordinates, 3);
            if (traffic.avgCongestion < 0.5) {
              logger.warn(`[TRAFFIC] ${truck.code} route congested: avg=${traffic.avgCongestion.toFixed(2)} worst=${traffic.worstCongestion.toFixed(2)}`);
            } else {
              logger.debug(`[TRAFFIC] ${truck.code} route clear: avg=${traffic.avgCongestion.toFixed(2)}`);
            }
          } catch {
            // Ignore traffic check errors
          }
        }
      }
    }

    // --- Phase 2: Assign AVAILABLE trucks with multi-TPS routes ---
    // Exclude driver-claimed trucks (driverId set) from auto-assignment
    const availableTrucks = trucks.filter((t) => t.status === "AVAILABLE" && !t.driverId);
    if (availableTrucks.length > 0) {
      // Count trucks already en-route per TPS (from previous ticks)
      const assignedCounts = new Map<string, number>();
      for (const t of trucks) {
        if (t.status === "EN_ROUTE_TO_TPS" && t.assignedTpsId) {
          assignedCounts.set(t.assignedTpsId, (assignedCounts.get(t.assignedTpsId) || 0) + 1);
        }
      }

      const batchLimit = Math.min(availableTrucks.length, ASSIGN_BATCH_SIZE);
      const batch = availableTrucks.slice(0, batchLimit);

      // Build routes sequentially so assignedCounts is updated between trucks
      const routeResults: { truck: SimulationTruck; result: Awaited<ReturnType<typeof buildMultiStopRoute>> }[] = [];
      for (const truck of batch) {
        try {
          const result = await buildMultiStopRoute(truck, activeTps, facilities, assignedCounts);
          if (result) {
            // Mark TPS as assigned so next truck won't pick the same one
            for (const wp of result.waypoints) {
              assignedCounts.set(wp.tpsId, (assignedCounts.get(wp.tpsId) || 0) + 1);
            }
          }
          routeResults.push({ truck, result });
        } catch {
          routeResults.push({ truck, result: null });
        }
      }

      const assignUpdates: Promise<any>[] = [];

      for (const { truck, result } of routeResults) {
        if (!result) continue;

        const { route, waypoints, facilityId, stats } = result;
        const heading = route.geometry.coordinates.length >= 2
          ? Math.atan2(
              route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
              route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
            ) * 180 / Math.PI
          : 0;

        const firstTps = activeTps.find((t) => t.id === waypoints[0].tpsId);

        assignUpdates.push(
          prisma.truck.update({
            where: { id: truck.id },
            data: {
              status: "EN_ROUTE_TO_TPS",
              assignedTpsId: waypoints[0].tpsId,
              destinationLat: firstTps?.lat,
              destinationLng: firstTps?.lng,
              facilityId,
              route: route.geometry as any,
              routeProgress: 0,
              routeDistance: route.distance,
              routeDuration: route.duration,
              routeWaypoints: waypoints as any,
              heading: heading < 0 ? heading + 360 : heading,
              currentLoadKg: 0,
            },
          })
        );

        logger.debug(`[ROUTE] ${truck.code} → ${waypoints.map((w) => w.tpsName).join(" → ")} | ${stats.totalDistanceKm}km | Rp${stats.fuelCost.toLocaleString()} | ${stats.co2Kg}kg CO2`);
      }

      if (assignUpdates.length > 0) {
        await Promise.all(assignUpdates);
        logger.debug(`[FLEET-SIM] Assigned ${assignUpdates.length} trucks with multi-TPS routes`);
      }
    }

    // --- Phase 3: Broadcast to SSE clients ---
    const allChangedIds = [...new Set([...changedTruckIds, ...trucks.filter((t) => t.status !== "AVAILABLE").map((t) => t.id)])];
    if (allChangedIds.length > 0) {
      const changedTrucks = await prisma.truck.findMany({
        where: { id: { in: allChangedIds } },
      });
      const criticalTpsList = activeTps
        .filter((t) => t.status === "PENUH")
        .map((t) => ({ id: t.id, code: t.code, name: t.name, fill: t.capacityKg > 0 ? (t.currentVolume / t.capacityKg * 100).toFixed(0) : 0 }));

      broadcastFleetUpdate({
        type: "tick",
        trucks: changedTrucks,
        criticalTps: criticalTpsList,
        timestamp: new Date().toISOString(),
      });
    }

    logger.debug(`[FLEET-SIM] Moved ${changedTruckIds.length} trucks, ${availableTrucks.length} available`);
  } catch (err) {
    logger.error("[FLEET-SIM] Simulation tick failed:", err);
  }
}

export async function startTruckSimulation() {
  if (intervalId) return;

  // Health check OSRM on startup
  await checkOsrmHealth();

  logger.info("[FLEET-SIM] Truck simulation started (every 5s, multi-TPS mode)");
  tick();
  intervalId = setInterval(tick, SIMULATION_INTERVAL_MS);
}

export function stopTruckSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[FLEET-SIM] Truck simulation stopped");
  }
}
