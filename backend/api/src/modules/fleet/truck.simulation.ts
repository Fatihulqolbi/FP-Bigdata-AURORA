import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { getRoute, interpolateAlongRoute, checkOsrmHealth, type GeoJSONLineString, type Coordinate } from "./route.service.js";
import { broadcastFleetUpdate } from "./fleet.sse.js";
import { checkRouteTraffic } from "./traffic.service.js";
import { getCriticalTps } from "./tps-alert.service.js";
import * as facilityService from "../facility/facility.service.js";
import {
  initKafka,
  publishFleetGpsBatch,
  publishFacilityTelemetryBatch,
  FleetGpsEvent,
  FacilityTelemetryEvent,
  isKafkaConnected,
} from "../metrics/kafka.producer.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
const SIMULATION_INTERVAL_MS = 5000;
const TRUCK_SPEED_MS = 13.88;
const ASSIGN_BATCH_SIZE = 10;
const TRAFFIC_CHECK_INTERVAL_MS = 300000;
let lastTrafficCheck = 0;
let kafkaReady = false;

// Scoring thresholds
const FILL_THRESHOLD_CLOSE = 0.75;
const FILL_THRESHOLD_FAR = 0.50;
const CLOSE_DISTANCE_KM = 3; // 3km radius for "close"
const MAX_ROUTE_QUEUE = 5;   // Max TPS stops in route queue

// Fuel & Emission
const FUEL_PRICE = 24800;
const FUEL_EFF: Record<string, number> = { COMPACTOR: 8, DUMP_TRUCK: 6, ARM_ROLL: 7 };
const CO2_PER_LITER = 2.68;

// Scoring weights
const W_FILL = 0.40;
const W_DIST = 0.35;
const W_FUEL = 0.15;
const W_EMIT = 0.10;

// Depots cache (fetched from DB)
let depotsCache: { name: string; lat: number; lng: number }[] | null = null;
let depotsCacheTime = 0;
const DEPOTS_CACHE_TTL = 60000; // 1 minute

async function getDepots(): Promise<{ name: string; lat: number; lng: number }[]> {
  const now = Date.now();
  if (depotsCache && (now - depotsCacheTime) < DEPOTS_CACHE_TTL) {
    return depotsCache;
  }
  
  try {
    const dbDepots = await prisma.sortingHub.findMany({ where: { type: "DEPOT" } });
    if (dbDepots.length > 0) {
      depotsCache = dbDepots.map((d) => ({ name: d.name, lat: d.lat, lng: d.lng }));
      depotsCacheTime = now;
      return depotsCache!;
    }
  } catch (e) {
    logger.warn("[DEPOTS] Failed to fetch from DB, using fallback");
  }
  
  // Fallback hardcoded
  return [
    { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
    { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
    { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
    { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
  ];
}

// --- Interfaces ---
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
  routeQueue: any;
  routeLegIndex: number;
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

// --- Helpers ---

function haversine(p1: Coordinate, p2: Coordinate): number {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(p1.lat * Math.PI / 180) * Math.cos(p2.lat * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function haversineKm(p1: Coordinate, p2: Coordinate): number {
  return haversine(p1, p2) / 1000;
}

function scoreTps(tps: { fill: number; distanceKm: number }, truckType: string): number {
  const fuelEff = FUEL_EFF[truckType] || 7;
  const fuelCost = (tps.distanceKm / fuelEff) * FUEL_PRICE;
  const emission = (tps.distanceKm / fuelEff) * CO2_PER_LITER;
  const fillScore = tps.fill;
  const distScore = tps.distanceKm > 0 ? Math.min(1, 3 / tps.distanceKm) : 0;
  const fuelScore = fuelCost > 0 ? Math.min(1, 30000 / fuelCost) : 1;
  const emScore = emission > 0 ? Math.min(1, 5 / emission) : 1;
  return fillScore * W_FILL + distScore * W_DIST + fuelScore * W_FUEL + emScore * W_EMIT;
}

async function nearestDepot(pos: Coordinate) {
  const depots = await getDepots();
  return depots.reduce((best, d) => {
    return haversineKm(pos, d) < haversineKm(pos, best) ? d : best;
  }, depots[0]);
}

function nearestFacility(pos: Coordinate, facilities: { id: string; name?: string; lat: number; lng: number }[]) {
  if (facilities.length === 0) return null;
  return facilities.reduce((best, f) => {
    return haversineKm(pos, { lat: f.lat, lng: f.lng }) < haversineKm(pos, { lat: best.lat, lng: best.lng }) ? f : best;
  }, facilities[0]);
}

interface FacilityWithCapacity {
  id: string;
  name?: string;
  lat: number;
  lng: number;
  type?: string;
  dailyCapacityKg?: number | null;
  dailyIntakeKg?: number;
}

/**
 * Find best facility for a truck considering:
 * 1. TPS3R closer than PLTSa AND has daily capacity (max 120%)
 * 2. Otherwise → PLTSa Benowo
 */
function findBestFacility(truckPos: Coordinate, facilities: FacilityWithCapacity[], truckCode?: string): FacilityWithCapacity | null {
  if (facilities.length === 0) return null;

  const ranked = facilities
    .filter((f) => isValidCoord(f.lat, f.lng))
    .map((f) => ({
      ...f,
      distKm: haversineKm(truckPos, { lat: f.lat, lng: f.lng }),
    }))
    .sort((a, b) => a.distKm - b.distKm);

  // TPS3R terdekat yang punya kapasitas (max 120%)
  const tps3rAvailable = ranked.filter((f) => {
    if (f.type !== "TPS3R") return false;
    const dailyCap = f.dailyCapacityKg ?? 50000; // Default 50 ton/day if not set
    const intake = f.dailyIntakeKg ?? 0;
    return intake < dailyCap * 1.2; // 120% overload
  });

  // Prefer TPS3R if available and within 2x distance of PLTSa
  if (tps3rAvailable.length > 0) {
    const pltsa = ranked.find((f) => f.type === "PLTSa");
    const tps3rDist = tps3rAvailable[0].distKm;
    const pltsaDist = pltsa ? pltsa.distKm : Infinity;

    // TPS3R within 2x distance of PLTSa, or no PLTSa available
    if (tps3rDist <= pltsaDist * 2 || !pltsa) {
      const selected = tps3rAvailable[0];
      if (truckCode) {
        logger.debug(`[FACILITY] ${truckCode} → ${selected.name} (TPS3R, ${selected.distKm.toFixed(1)}km, intake: ${((selected.dailyIntakeKg ?? 0) / 1000).toFixed(1)}t / ${((selected.dailyCapacityKg ?? 50000) / 1000).toFixed(0)}t)`);
      }
      return selected;
    }
  }

  // Fallback: PLTSa (always available)
  const fallback = ranked.find((f) => f.type === "PLTSa") || ranked[0];
  if (truckCode && fallback) {
    logger.debug(`[FACILITY] ${truckCode} → ${fallback.name} (${fallback.type}, ${fallback.distKm.toFixed(1)}km, fallback)`);
  }
  return fallback;
}

// --- Route Queue Interfaces ---

interface RouteQueueItem {
  type: "TPS" | "FACILITY";
  tpsId?: string;
  tpsName?: string;
  tpsLat?: number;
  tpsLng?: number;
  facilityId?: string;
  facilityName?: string;
  facilityLat?: number;
  facilityLng?: number;
  collectedKg?: number;
  status: "pending" | "active" | "done";
}

// --- Core Route Queue Functions ---

function isValidCoord(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0);
}

/**
 * Build initial route queue for a truck: [TPS1, TPS2, ..., Facility]
 * Only builds queue with TPS that pass fill threshold + 1 TPS = 1 truck enforcement.
 */
async function buildRouteQueue(
  truck: SimulationTruck,
  tpsList: TpsInfo[],
  facilities: { id: string; name?: string; lat: number; lng: number }[],
  assignedTpsIds: Set<string>
): Promise<RouteQueueItem[] | null> {
  const depots = await getDepots();
  const truckPos: Coordinate = isValidCoord(truck.lat, truck.lng)
    ? { lat: truck.lat!, lng: truck.lng! }
    : depots[0];

  // Filter valid TPS with fill threshold + 1 TPS = 1 truck
  const scoredTps = tpsList
    .filter((t) => isValidCoord(t.lat, t.lng))
    .filter((t) => !assignedTpsIds.has(t.id)) // strict 1 TPS = 1 truck
    .map((t) => {
      const fill = t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0;
      const distanceKm = haversineKm(truckPos, { lat: t.lat, lng: t.lng });
      const score = scoreTps({ fill, distanceKm }, truck.type);
      return { ...t, fill, distanceKm, score };
    })
    .filter((t) => {
      const threshold = t.distanceKm < CLOSE_DISTANCE_KM ? FILL_THRESHOLD_CLOSE : FILL_THRESHOLD_FAR;
      return t.fill >= threshold && t.currentVolume > 0;
    })
    .sort((a, b) => b.score - a.score);

  if (scoredTps.length === 0) return null;

  // Greedy nearest-neighbor chaining
  const queue: RouteQueueItem[] = [];
  let remaining = truck.capacityKg;
  let currentPos = truckPos;
  const visited = new Set<string>();

  // Pick first TPS (highest score)
  const first = scoredTps[0];
  const firstCollect = Math.min(first.currentVolume, remaining);
  if (firstCollect <= 0) return null;

  queue.push({
    type: "TPS", tpsId: first.id, tpsName: first.name,
    tpsLat: first.lat, tpsLng: first.lng,
    collectedKg: Math.round(firstCollect * 100) / 100,
    status: "pending",
  });
  visited.add(first.id);
  remaining -= firstCollect;
  currentPos = { lat: first.lat, lng: first.lng };

  // Pick more TPS (nearest-neighbor chaining)
  while (queue.length < MAX_ROUTE_QUEUE && remaining > 0) {
    const next = scoredTps
      .filter((t) => !visited.has(t.id) && t.currentVolume > 0)
      .map((t) => ({ ...t, distFromCurrent: haversineKm(currentPos, { lat: t.lat, lng: t.lng }) }))
      .sort((a, b) => {
        const aS = a.score * 0.6 + (Math.min(1, 2 / (a.distFromCurrent + 0.1)) * 0.4);
        const bS = b.score * 0.6 + (Math.min(1, 2 / (b.distFromCurrent + 0.1)) * 0.4);
        return bS - aS;
      })[0];

    if (!next) break;
    const collect = Math.min(next.currentVolume, remaining);
    if (collect <= 0) break;

    queue.push({
      type: "TPS", tpsId: next.id, tpsName: next.name,
      tpsLat: next.lat, tpsLng: next.lng,
      collectedKg: Math.round(collect * 100) / 100,
      status: "pending",
    });
    visited.add(next.id);
    remaining -= collect;
    currentPos = { lat: next.lat, lng: next.lng };
  }

  // Add facility as last leg — use smart selection (TPS3R if closer + capacity, else PLTSa)
  const lastStop = queue[queue.length - 1];
  const facility = findBestFacility({ lat: lastStop.tpsLat!, lng: lastStop.tpsLng! }, facilities, truck.code);
  if (facility) {
    queue.push({
      type: "FACILITY", facilityId: facility.id, facilityName: facility.name,
      facilityLat: facility.lat, facilityLng: facility.lng,
      status: "pending",
    });
  }

  return queue.length > 0 ? queue : null;
}

/**
 * Advance to next leg in route queue.
 * Returns updated truck data or null if no more legs.
 */
async function advanceToNextLeg(truck: SimulationTruck): Promise<{
  status: string;
  route: any;
  routeProgress: number;
  routeDistance: number;
  routeDuration: number;
  assignedTpsId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  facilityId: string | null;
  routeLegIndex: number;
  routeQueue: any;
} | null> {
  const queue = (truck.routeQueue as RouteQueueItem[]) || [];
  const currentIdx = truck.routeLegIndex;

  // Mark current leg as done
  if (currentIdx < queue.length) {
    queue[currentIdx].status = "done";
  }

  // Find next pending leg
  const nextIdx = queue.findIndex((item, i) => i > currentIdx && item.status === "pending");
  if (nextIdx === -1) return null; // No more legs

  // Mark next leg as active
  queue[nextIdx].status = "active";
  const nextLeg = queue[nextIdx];

  const depots = await getDepots();
  const origin: Coordinate = isValidCoord(truck.lat, truck.lng)
    ? { lat: truck.lat!, lng: truck.lng! }
    : depots[0];

  let dest: Coordinate;
  let assignedTpsId: string | null = null;
  let destinationLat: number | null = null;
  let destinationLng: number | null = null;
  let facilityId: string | null = null;

  if (nextLeg.type === "TPS") {
    dest = { lat: nextLeg.tpsLat!, lng: nextLeg.tpsLng! };
    assignedTpsId = nextLeg.tpsId!;
    destinationLat = nextLeg.tpsLat!;
    destinationLng = nextLeg.tpsLng!;
  } else {
    dest = { lat: nextLeg.facilityLat!, lng: nextLeg.facilityLng! };
    facilityId = nextLeg.facilityId!;
    destinationLat = nextLeg.facilityLat!;
    destinationLng = nextLeg.facilityLng!;
  }

  const route = await getRoute(origin, dest);

  const status = nextLeg.type === "TPS" ? "EN_ROUTE_TO_TPS" : "EN_ROUTE_TO_HUB";

  return {
    status,
    route: route.geometry as any,
    routeProgress: 0,
    routeDistance: route.distance,
    routeDuration: route.duration,
    assignedTpsId,
    destinationLat,
    destinationLng,
    facilityId,
    routeLegIndex: nextIdx,
    routeQueue: queue as any,
  };
}

/**
 * Insert a new TPS leg into the truck's route queue (admin insert).
 * Inserts after current active leg. Does NOT re-route.
 */
async function insertLeg(
  truckId: string,
  tpsId: string,
  tpsName: string,
  tpsLat: number,
  tpsLng: number,
  collectedKg: number
) {
  const truck = await prisma.truck.findUnique({ where: { id: truckId } });
  if (!truck) throw new Error("Truck not found");

  const queue = ((truck.routeQueue as unknown) as RouteQueueItem[]) || [];
  const currentIdx = truck.routeLegIndex;

  // Insert after current leg
  const newLeg: RouteQueueItem = {
    type: "TPS", tpsId, tpsName, tpsLat, tpsLng, collectedKg, status: "pending",
  };

  // Find position to insert (after current, before next facility)
  let insertIdx = currentIdx + 1;
  // Don't insert after a facility leg
  while (insertIdx < queue.length && queue[insertIdx].type === "FACILITY") {
    insertIdx--;
  }
  queue.splice(insertIdx, 0, newLeg);

  // Recalculate remaining legs
  const updatedQueue = queue;

  return prisma.truck.update({
    where: { id: truckId },
    data: { routeQueue: updatedQueue as any },
  });
}

// --- TPS Info Interface ---
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

// --- Main Tick ---
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

    // ── Phase 1: Move trucks ──────────────────────────────────────────────
    for (const truck of trucks) {
      // ── EN_ROUTE_TO_TPS, EN_ROUTE_TO_HUB, or EN_ROUTE_TO_DEPOT: move along route ─────────
      if ((truck.status === "EN_ROUTE_TO_TPS" || truck.status === "EN_ROUTE_TO_HUB" || truck.status === "EN_ROUTE_TO_DEPOT") && truck.route) {
        const geo = truck.route as unknown as GeoJSONLineString;
        const dist = truck.routeDistance || geo.coordinates.length * 10;
        const step = SIMULATION_INTERVAL_MS / 1000 / (dist / TRUCK_SPEED_MS);
        const newProgress = Math.min(1, truck.routeProgress + step);
        const { position, heading } = interpolateAlongRoute(geo, newProgress);

        if (newProgress >= 1) {
          // ── Arrived at destination ─────────────────────────────────────
          const currentLeg = ((truck.routeQueue as unknown) as RouteQueueItem[] | null)?.[truck.routeLegIndex];

          if (truck.driverId) {
            // Driver-driven: set LOADING, wait for driver
            updates.push(
              prisma.truck.update({
                where: { id: truck.id },
                data: {
                  status: "LOADING",
                  lat: position[1],
                  lng: position[0],
                  heading,
                  routeProgress: 1.0,
                },
              })
            );
            changedTruckIds.push(truck.id);
          } else {
            // Autonomous: auto-collect + advance
            if (currentLeg?.type === "TPS" && currentLeg.tpsId) {
              const tps = activeTps.find((t) => t.id === currentLeg.tpsId);
              if (tps) {
                const collected = Math.min(tps.currentVolume, currentLeg.collectedKg || 0);
                await prisma.tps.update({
                  where: { id: currentLeg.tpsId },
                  data: { currentVolume: Math.max(0, tps.currentVolume - collected) },
                });
                truck.currentLoadKg += collected;
              }
            }

            // Advance to next leg
            const nextLeg = await advanceToNextLeg(truck);
            if (nextLeg) {
              updates.push(
                prisma.truck.update({
                  where: { id: truck.id },
                  data: {
                    ...nextLeg,
                    lat: position[1],
                    lng: position[0],
                    heading,
                    currentLoadKg: truck.currentLoadKg,
                  },
                })
              );
            } else {
              // No more legs → AVAILABLE
              updates.push(
                prisma.truck.update({
                  where: { id: truck.id },
                  data: {
                    status: "AVAILABLE", lat: position[1], lng: position[0], heading: 0,
                    assignedTpsId: null, destinationLat: null, destinationLng: null,
                    route: null, routeProgress: 0, routeDistance: null, routeDuration: null,
                    routeWaypoints: null, routeQueue: null, routeLegIndex: 0,
                    facilityId: null, currentLoadKg: 0,
                  },
                })
              );
            }
          }
          changedTruckIds.push(truck.id);
        } else {
          // Still moving - check proximity auto-arrive (200m radius)
          const PROXIMITY_RADIUS_M = 200;
          const destLat = truck.destinationLat;
          const destLng = truck.destinationLng;
          let autoArrive = false;

          if (destLat && destLng) {
            const distToDest = haversine(
              { lat: position[1], lng: position[0] },
              { lat: destLat, lng: destLng }
            );
            if (distToDest <= PROXIMITY_RADIUS_M) {
              autoArrive = true;
              logger.debug(`[FLEET-SIM] ${truck.code} within ${PROXIMITY_RADIUS_M}m of destination, auto-arrive`);
            }
          }

          if (autoArrive && truck.driverId && truck.status === "EN_ROUTE_TO_TPS") {
            // Driver-driven truck within proximity → auto LOADING
            updates.push(
              prisma.truck.update({
                where: { id: truck.id },
                data: {
                  status: "LOADING",
                  lat: destLat!,
                  lng: destLng!,
                  heading,
                  routeProgress: 0.95,
                },
              })
            );
          } else if (autoArrive && truck.status === "EN_ROUTE_TO_HUB") {
            // Arrived at facility → UNLOADING
            updates.push(
              prisma.truck.update({
                where: { id: truck.id },
                data: {
                  status: "UNLOADING",
                  lat: destLat!,
                  lng: destLng!,
                  heading,
                  routeProgress: 1.0,
                },
              })
            );
          } else if (autoArrive && truck.status === "EN_ROUTE_TO_DEPOT") {
            // Arrived at depot → AVAILABLE
            updates.push(
              prisma.truck.update({
                where: { id: truck.id },
                data: {
                  status: "AVAILABLE",
                  lat: destLat!,
                  lng: destLng!,
                  heading: 0,
                  route: null,
                  routeProgress: 0,
                  routeDistance: null,
                  routeDuration: null,
                  destinationLat: null,
                  destinationLng: null,
                },
              })
            );
          } else {
            // Normal movement update
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
    }

    await Promise.all(updates);

    // ── Phase 1.5: Auto-complete UNLOADING for autonomous trucks ────────────────────
    const unloadingTrucks = trucks.filter((t) => t.status === "UNLOADING" && !t.driverId);
    for (const truck of unloadingTrucks) {
      // Update facility intake
      if (truck.facilityId && truck.currentLoadKg > 0) {
        try {
          await facilityService.addIntake(truck.facilityId, truck.currentLoadKg);
          logger.info(`[SIM] ${truck.code} auto-unloaded ${Math.round(truck.currentLoadKg)} kg at facility`);
        } catch (e) {
          logger.warn(`[SIM] Failed to update facility intake for ${truck.code}`);
        }
      }

      // Find nearest depot and route there
      const truckPos = isValidCoord(truck.lat, truck.lng)
        ? { lat: truck.lat!, lng: truck.lng! }
        : { lat: -7.2185, lng: 112.6258 };
      const nearest = await nearestDepot(truckPos);

      try {
        const route = await getRoute(truckPos, nearest);
        const heading = route.geometry.coordinates.length >= 2
          ? Math.atan2(
              route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
              route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
            ) * 180 / Math.PI
          : 0;

        updates.push(
          prisma.truck.update({
            where: { id: truck.id },
            data: {
              status: "EN_ROUTE_TO_DEPOT",
              route: route.geometry as any,
              routeProgress: 0,
              routeDistance: route.distance,
              routeDuration: route.duration,
              destinationLat: nearest.lat,
              destinationLng: nearest.lng,
              heading: heading < 0 ? heading + 360 : heading,
              routeQueue: null,
              routeLegIndex: 0,
              assignedTpsId: null,
              facilityId: null,
              currentLoadKg: 0,
            },
          })
        );
        changedTruckIds.push(truck.id);
      } catch (e) {
        // Fallback: just reset to AVAILABLE at current location
        updates.push(
          prisma.truck.update({
            where: { id: truck.id },
            data: {
              status: "AVAILABLE",
              route: null,
              routeProgress: 0,
              routeDistance: null,
              routeDuration: null,
              destinationLat: null,
              destinationLng: null,
              heading: 0,
              routeQueue: null,
              routeLegIndex: 0,
              assignedTpsId: null,
              facilityId: null,
              currentLoadKg: 0,
            },
          })
        );
        changedTruckIds.push(truck.id);
      }
    }

    await Promise.all(updates);

    // ── Phase 1.6: Traffic check (every 5 minutes) ────────────────────
    const now = Date.now();
    if (now - lastTrafficCheck > TRAFFIC_CHECK_INTERVAL_MS) {
      lastTrafficCheck = now;
      const enRoute = trucks.filter((t) => t.status === "EN_ROUTE_TO_TPS" && t.route);
      const sample = enRoute.slice(0, 3);
      for (const truck of sample) {
        try {
          const geo = truck.route as unknown as GeoJSONLineString;
          if (!geo?.coordinates?.length) continue;
          const traffic = await checkRouteTraffic(geo.coordinates, 2);
          if (traffic.avgCongestion < 0.5) {
            logger.warn(`[TRAFFIC] ${truck.code} congested: avg=${traffic.avgCongestion.toFixed(2)}`);
          }
        } catch { /* ignore */ }
      }
    }

    // ── Phase 2: Assign AVAILABLE trucks (auto, no driver) ───────────
    const autoTrucks = trucks.filter((t) => t.status === "AVAILABLE" && !t.driverId);
    if (autoTrucks.length > 0) {
      // 1 TPS = 1 truck enforcement
      const assignedTpsIds = new Set(
        trucks
          .filter((t) => (t.status === "EN_ROUTE_TO_TPS" || t.status === "LOADING") && t.assignedTpsId)
          .map((t) => t.assignedTpsId!)
      );

      const batchLimit = Math.min(autoTrucks.length, ASSIGN_BATCH_SIZE);
      const batch = autoTrucks.slice(0, batchLimit);

      const routeResults: { truck: SimulationTruck; queue: RouteQueueItem[] }[] = [];
      for (const truck of batch) {
        const queue = await buildRouteQueue(truck, activeTps, facilities, assignedTpsIds);
        if (queue) {
          // Mark TPS as assigned
          for (const leg of queue) {
            if (leg.type === "TPS" && leg.tpsId) {
              assignedTpsIds.add(leg.tpsId);
            }
          }
          routeResults.push({ truck, queue });
        }
      }

      const assignUpdates: Promise<any>[] = [];
      const depots = await getDepots();
      for (const { truck, queue } of routeResults) {
        // Build route to first leg only
        const firstLeg = queue[0];
        const origin: Coordinate = truck.lat != null && truck.lng != null
          ? { lat: truck.lat, lng: truck.lng }
          : depots[0];
        const dest: Coordinate = firstLeg.type === "TPS"
          ? { lat: firstLeg.tpsLat!, lng: firstLeg.tpsLng! }
          : { lat: firstLeg.facilityLat!, lng: firstLeg.facilityLng! };

        try {
          const route = await getRoute(origin, dest);
          const heading = route.geometry.coordinates.length >= 2
            ? Math.atan2(
                route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
                route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
              ) * 180 / Math.PI
            : 0;

          const tpsId = firstLeg.type === "TPS" ? firstLeg.tpsId! : null;
          const destLat = firstLeg.type === "TPS" ? firstLeg.tpsLat! : firstLeg.facilityLat!;
          const destLng = firstLeg.type === "TPS" ? firstLeg.tpsLng! : firstLeg.facilityLng!;
          const facId = firstLeg.type === "FACILITY" ? firstLeg.facilityId! : null;

          assignUpdates.push(
            prisma.truck.update({
              where: { id: truck.id },
              data: {
                status: firstLeg.type === "TPS" ? "EN_ROUTE_TO_TPS" : "EN_ROUTE_TO_HUB",
                assignedTpsId: tpsId,
                destinationLat: destLat,
                destinationLng: destLng,
                facilityId: facId,
                route: route.geometry as any,
                routeProgress: 0,
                routeDistance: route.distance,
                routeDuration: route.duration,
                routeQueue: queue as any,
                routeLegIndex: 0,
                heading: heading < 0 ? heading + 360 : heading,
                currentLoadKg: 0,
              },
            })
          );

          // Mark first leg as active
          queue[0].status = "active";

          const legDesc = queue
            .filter((l) => l.type === "TPS")
            .map((l) => l.tpsName)
            .join(" → ");
          logger.debug(`[ROUTE] ${truck.code} → ${legDesc || "Hub"} | ${queue.length - 1} TPS`);
        } catch {
          // OSRM failed — skip
        }
      }

      if (assignUpdates.length > 0) {
        await Promise.all(assignUpdates);
        logger.debug(`[FLEET-SIM] Assigned ${assignUpdates.length} trucks`);
      }
    }

    // ── Phase 3: Broadcast ────────────────────────────────────────────
    const allChangedIds = [
      ...new Set([
        ...changedTruckIds,
        ...trucks.filter((t) => t.status !== "AVAILABLE").map((t) => t.id),
      ]),
    ];
    if (allChangedIds.length > 0) {
      const changedTrucks = await prisma.truck.findMany({
        where: { id: { in: allChangedIds } },
      });
      const criticalTps = await getCriticalTps();
      broadcastFleetUpdate({
        type: "tick",
        trucks: changedTrucks,
        criticalTps: criticalTps,
        timestamp: new Date().toISOString(),
      });
    }

    logger.debug(`[FLEET-SIM] Moved ${changedTruckIds.length} trucks, ${autoTrucks.length} auto-available`);
    
    if (kafkaReady && isKafkaConnected()) {
      const gpsEvents: FleetGpsEvent[] = [];
      const allActiveTrucks = await prisma.truck.findMany({
        where: { status: { not: "AVAILABLE" } },
        select: {
          id: true,
          code: true,
          type: true,
          capacityKg: true,
          currentLoadKg: true,
          lat: true,
          lng: true,
          status: true,
          volumeM3: true,
        },
      });
      
      const now = new Date();
      for (const truck of allActiveTrucks) {
        if (truck.lat != null && truck.lng != null) {
          let opStatus: FleetGpsEvent["operational_status"] = "IDLE";
          if (truck.status === "EN_ROUTE_TO_TPS") opStatus = "TRANSIT_TO_TPS";
          else if (truck.status === "LOADING") opStatus = "COLLECTING";
          else if (truck.status === "EN_ROUTE_TO_HUB") opStatus = "TRANSIT_TO_FACILITY";
          else if (truck.status === "UNLOADING") opStatus = "DUMPING";
          else if (truck.status === "EN_ROUTE_TO_DEPOT") opStatus = "TRANSIT_TO_FACILITY";
          
          gpsEvents.push({
            event_time: now.toISOString(),
            truck_id: truck.id,
            truck_code: truck.code,
            truck_type: truck.type,
            lat: truck.lat,
            lon: truck.lng,
            current_payload_kg: truck.currentLoadKg,
            max_capacity_kg: truck.capacityKg,
            operational_status: opStatus,
            volume_m3: truck.volumeM3 || 0,
          });
        }
      }
      
      if (gpsEvents.length > 0) {
        publishFleetGpsBatch(gpsEvents).catch(() => {});
      }
      
      const facilities = await prisma.sortingHub.findMany();
      const facilityEvents: FacilityTelemetryEvent[] = [];
      
      for (const fac of facilities) {
        const trucksEnRoute = allActiveTrucks.filter(
          (t) => t.status === "EN_ROUTE_TO_HUB" || t.status === "UNLOADING"
        ).length;
        
        const utilizationRate = fac.dailyCapacityKg && fac.dailyCapacityKg > 0
          ? (fac.dailyIntakeKg / fac.dailyCapacityKg) * 100
          : 0;
        
        facilityEvents.push({
          event_time: now.toISOString(),
          facility_id: fac.id,
          facility_code: fac.code,
          facility_name: fac.name,
          facility_type: fac.type,
          daily_intake_kg: fac.dailyIntakeKg,
          daily_capacity_kg: fac.dailyCapacityKg || 0,
          utilization_rate: Math.round(utilizationRate * 10) / 10,
          trucks_en_route: trucksEnRoute,
          can_accept_more: !fac.dailyCapacityKg || utilizationRate < 95,
        });
      }
      
      if (facilityEvents.length > 0) {
        publishFacilityTelemetryBatch(facilityEvents).catch(() => {});
      }
    }
  } catch (err) {
    logger.error("[FLEET-SIM] Tick failed:", err);
  }
}

export async function startTruckSimulation() {
  if (intervalId) return;
  await checkOsrmHealth();
  
  kafkaReady = await initKafka();
  if (kafkaReady) {
    logger.info("[FLEET-SIM] Kafka ready — publishing fleet GPS & facility telemetry");
  }
  
  logger.info("[FLEET-SIM] Truck simulation started (route queue mode)");
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
