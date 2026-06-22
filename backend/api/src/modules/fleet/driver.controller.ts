import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { z } from "zod";
import { getRoute, type Coordinate } from "./route.service.js";
import * as facilityService from "../facility/facility.service.js";
import { logger } from "../../utils/logger.js";

// Helpers
function isValidCoord(lat: number | null, lng: number | null): boolean {
  return lat != null && lng != null && !isNaN(lat) && !isNaN(lng) && !(lat === 0 && lng === 0);
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

interface FacilityInfo {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type?: string;
  dailyCapacityKg?: number | null;
  dailyIntakeKg?: number;
}

/**
 * Smart facility selection with enhanced logic:
 * 1. Prefer nearby TPS3R (< 5km) with available capacity
 * 2. If truck near Benowo, check if TPS3R around Benowo is empty → go there first
 * 3. If all nearby TPS3R full → PLTSa Benowo
 * 4. Fallback to PLTSa if no TPS3R available
 */
function findBestFacility(lat: number, lng: number, facilities: FacilityInfo[], driverId?: string, truckLoad?: number): FacilityInfo | null {
  if (facilities.length === 0) return null;

  const NEARBY_RADIUS_KM = 5;
  const BENOWO_CENTER = { lat: -7.2185, lng: 112.6258 };
  const BENOWO_RADIUS_KM = 10;

  const ranked = facilities
    .filter((f) => isValidCoord(f.lat, f.lng))
    .map((f) => ({
      ...f,
      distKm: haversineKm(lat, lng, f.lat, f.lng),
      distFromBenowo: haversineKm(BENOWO_CENTER.lat, BENOWO_CENTER.lng, f.lat, f.lng),
    }))
    .sort((a, b) => a.distKm - b.distKm);

  const pltsa = ranked.find((f) => f.type === "PLTSa");
  const pltsaDist = pltsa ? pltsa.distKm : Infinity;

  // Check if truck is near Benowo area
  const truckNearBenowo = haversineKm(lat, lng, BENOWO_CENTER.lat, BENOWO_CENTER.lng) <= BENOWO_RADIUS_KM;

  // 1. Find nearby TPS3R with available capacity (< 120%)
  const nearbyTps3r = ranked.filter((f) => {
    if (f.type !== "TPS3R") return false;
    const dailyCap = f.dailyCapacityKg ?? 50000;
    const intake = f.dailyIntakeKg ?? 0;
    const hasCapacity = intake < dailyCap * 1.2;
    const isNearby = f.distKm <= NEARBY_RADIUS_KM;
    return hasCapacity && isNearby;
  });

  if (nearbyTps3r.length > 0) {
    const selected = nearbyTps3r[0];
    if (driverId) {
      logger.info(`[DRIVER] ${driverId} → facility ${selected.name} (TPS3R nearby, ${selected.distKm.toFixed(1)}km, intake: ${((selected.dailyIntakeKg ?? 0) / 1000).toFixed(1)}t / ${((selected.dailyCapacityKg ?? 50000) / 1000).toFixed(0)}t)`);
    }
    return selected;
  }

  // 2. If truck near Benowo, check if TPS3R around Benowo is empty (low intake)
  if (truckNearBenowo) {
    const tps3rNearBenowo = ranked.filter((f) => {
      if (f.type !== "TPS3R") return false;
      const dailyCap = f.dailyCapacityKg ?? 50000;
      const intake = f.dailyIntakeKg ?? 0;
      const isNearBenowo = f.distFromBenowo <= BENOWO_RADIUS_KM;
      const hasLowIntake = intake < dailyCap * 0.5; // Less than 50% full
      return isNearBenowo && hasLowIntake;
    });

    if (tps3rNearBenowo.length > 0) {
      const selected = tps3rNearBenowo[0];
      if (driverId) {
        logger.info(`[DRIVER] ${driverId} → facility ${selected.name} (TPS3R near Benowo, low intake, ${selected.distKm.toFixed(1)}km)`);
      }
      return selected;
    }
  }

  // 3. Check any TPS3R within 2x distance of PLTSa
  const tps3rAvailable = ranked.filter((f) => {
    if (f.type !== "TPS3R") return false;
    const dailyCap = f.dailyCapacityKg ?? 50000;
    const intake = f.dailyIntakeKg ?? 0;
    return intake < dailyCap * 1.2;
  });

  if (tps3rAvailable.length > 0 && tps3rAvailable[0].distKm <= pltsaDist * 2) {
    const selected = tps3rAvailable[0];
    if (driverId) {
      logger.info(`[DRIVER] ${driverId} → facility ${selected.name} (TPS3R within 2x PLTSa distance, ${selected.distKm.toFixed(1)}km)`);
    }
    return selected;
  }

  // 4. Fallback: PLTSa (always available)
  if (pltsa) {
    if (driverId) {
      logger.info(`[DRIVER] ${driverId} → facility ${pltsa.name} (PLTSa fallback, ${pltsa.distKm.toFixed(1)}km, all nearby TPS3R full or too far)`);
    }
    return pltsa;
  }

  // Last resort: any facility
  const fallback = ranked[0];
  if (driverId && fallback) {
    logger.info(`[DRIVER] ${driverId} → facility ${fallback.name} (${fallback.type}, last resort)`);
  }
  return fallback;
}

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

// --- GET /api/fleet/driver/available-trucks ---
export async function getAvailableTrucks(req: AuthRequest, res: Response) {
  try {
    const trucks = await prisma.truck.findMany({
      where: {
        status: "AVAILABLE",
        OR: [{ driverId: null }, { driverId: { isSet: false } }],
      },
      orderBy: { code: "asc" },
      select: {
        id: true, code: true, name: true, type: true,
        capacityKg: true, currentLoadKg: true,
        lat: true, lng: true, status: true,
      },
    });
    res.json(trucks);
  } catch (err: any) {
    console.error("[DRIVER] getAvailableTrucks error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- GET /api/fleet/driver/me ---
export async function getDriverInfo(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });

    res.json({
      user: { id: user.id, name: user.name, email: user.email, role: user.role },
      truck: truck ? {
        id: truck.id, code: truck.code, type: truck.type, status: truck.status,
        capacityKg: truck.capacityKg, currentLoadKg: truck.currentLoadKg,
        lat: truck.lat, lng: truck.lng, heading: truck.heading,
      } : null,
    });
  } catch (err: any) {
    console.error("[DRIVER] getDriverInfo error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/claim ---
export async function claimTruck(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const existing = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (existing) {
      res.json({ success: true, truck: existing, message: "Truk sudah di-assign" });
      return;
    }

    const { truckId } = req.body || {};

    let available;
    if (truckId) {
      available = await prisma.truck.findFirst({
        where: {
          id: truckId as string,
          status: "AVAILABLE",
          OR: [{ driverId: null }, { driverId: { isSet: false } }],
        },
      });
      if (!available) {
        res.status(404).json({ error: "Truk tidak tersedia atau sudah di-assign" });
        return;
      }
    } else {
      available = await prisma.truck.findFirst({
        where: {
          status: "AVAILABLE",
          OR: [{ driverId: null }, { driverId: { isSet: false } }],
        },
        orderBy: { code: "asc" },
      });
      if (!available) {
        res.status(404).json({ error: "Tidak ada truk tersedia" });
        return;
      }
    }

    const truck = await prisma.truck.update({
      where: { id: available.id },
      data: { driverId: user.id, status: "ASSIGNED" },
    });

    logger.info(`[DRIVER] ${user.name} claimed truck ${truck.code}`);
    res.json({ success: true, truck });
  } catch (err: any) {
    console.error("[DRIVER] claimTruck error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/release ---
export async function releaseTruck(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Tidak ada truk di-assign" }); return; }
    if (truck.status !== "AVAILABLE") {
      res.status(400).json({ error: "Truk masih dalam perjalanan, tidak bisa dilepas" });
      return;
    }

    await prisma.truck.update({ where: { id: truck.id }, data: { driverId: null } });
    res.json({ success: true, message: "Truk dilepas" });
  } catch (err: any) {
    console.error("[DRIVER] releaseTruck error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- GET /api/fleet/driver/assignment ---
export async function getAssignment(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }

    const routeQueue = ((truck.routeQueue as unknown) as RouteQueueItem[]) || [];
    const activeLeg = routeQueue[truck.routeLegIndex] || null;
    const pendingLegs = routeQueue.filter((l) => l.status === "pending");
    const doneLegs = routeQueue.filter((l) => l.status === "done");

    // Get facility info
    const facility = truck.facilityId ? await prisma.sortingHub.findUnique({ where: { id: truck.facilityId } }) : null;

    // Compute waypoints from routeQueue (backward compatibility)
    const tpsLegs = routeQueue.filter((l) => l.type === "TPS" && l.tpsId);
    const tpsIds = tpsLegs.map((l) => l.tpsId!);
    const tpsList = tpsIds.length > 0 ? await prisma.tps.findMany({ where: { id: { in: tpsIds } } }) : [];
    const tpsMap = new Map(tpsList.map((t) => [t.id, t]));

    const waypoints = tpsLegs.map((l) => ({
      tpsId: l.tpsId!,
      tpsName: l.tpsName || "",
      tpsLat: l.tpsLat || 0,
      tpsLng: l.tpsLng || 0,
      collectedKg: l.collectedKg || 0,
      tpsCurrentVolume: tpsMap.get(l.tpsId!)?.currentVolume || 0,
      tpsCapacity: tpsMap.get(l.tpsId!)?.capacityKg || 0,
      status: l.status,
    }));

    res.json({
      truck: {
        id: truck.id, code: truck.code, type: truck.type, status: truck.status,
        capacityKg: truck.capacityKg, currentLoadKg: truck.currentLoadKg,
        lat: truck.lat, lng: truck.lng, heading: truck.heading,
      },
      route: {
        geometry: truck.route,
        distance: truck.routeDistance,
        duration: truck.routeDuration,
        progress: truck.routeProgress,
      },
      routeQueue,
      activeLeg,
      pendingLegs,
      doneLegs,
      waypoints, // backward compatibility
      facility: facility ? { id: facility.id, name: facility.name, lat: facility.lat, lng: facility.lng } : null,
    });
  } catch (err: any) {
    console.error("[DRIVER] getAssignment error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/start ---
// Driver presses "Gas Berangkat" — build multi-TPS route queue with smart facility selection
export async function startRoute(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "AVAILABLE" && truck.status !== "ASSIGNED") {
      res.status(400).json({ error: `Truk tidak dalam status available (status: ${truck.status})` });
      return;
    }

    // 1 TPS = 1 truck enforcement
    const assignedTpsIds = new Set(
      (await prisma.truck.findMany({
        where: { status: { in: ["EN_ROUTE_TO_TPS", "LOADING"] }, assignedTpsId: { not: null } },
        select: { assignedTpsId: true },
      })).map((t) => t.assignedTpsId!)
    );

    const activeTps = await prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
    });
    const facilities = await prisma.sortingHub.findMany();

    const truckPos = isValidCoord(truck.lat, truck.lng)
      ? { lat: truck.lat!, lng: truck.lng! }
      : { lat: -7.2185, lng: 112.6258 };

    // Build route queue
    const queue: RouteQueueItem[] = [];
    let remaining = truck.capacityKg;
    let currentPos = truckPos;
    const visited = new Set<string>();

    // PRIORITY 1: Use assigned task if exists (admin already dispatched)
    if (truck.assignedTpsId) {
      const assignedTps = await prisma.tps.findUnique({ where: { id: truck.assignedTpsId } });
      if (assignedTps && assignedTps.status !== "NONAKTIF" && assignedTps.currentVolume > 0) {
        const collect = Math.min(assignedTps.currentVolume, remaining);
        queue.push({
          type: "TPS", tpsId: assignedTps.id, tpsName: assignedTps.name,
          tpsLat: assignedTps.lat, tpsLng: assignedTps.lng,
          collectedKg: Math.round(collect * 100) / 100,
          status: "active",
        });
        visited.add(assignedTps.id);
        assignedTpsIds.add(assignedTps.id);
        remaining -= collect;
        currentPos = { lat: assignedTps.lat, lng: assignedTps.lng };
        logger.info(`[DRIVER] ${truck.code} using assigned task: ${assignedTps.name}`);
      }
    }

    // PRIORITY 2: Auto-search additional TPS if capacity available (multi-TPS)
    const CLOSE_DISTANCE_KM = 3;
    const FILL_THRESHOLD_CLOSE = 0.75;
    const FILL_THRESHOLD_FAR = 0.50;
    const MAX_ROUTE_QUEUE = 5;

    const scoreTps = (tps: { fill: number; distanceKm: number }, truckType: string): number => {
      const FUEL_EFF: Record<string, number> = { COMPACTOR: 8, DUMP_TRUCK: 6, ARM_ROLL: 7 };
      const fuelEff = FUEL_EFF[truckType] || 7;
      const fuelCost = (tps.distanceKm / fuelEff) * 24800;
      const emission = (tps.distanceKm / fuelEff) * 2.68;
      const fillScore = tps.fill;
      const distScore = tps.distanceKm > 0 ? Math.min(1, 3 / tps.distanceKm) : 0;
      const fuelScore = fuelCost > 0 ? Math.min(1, 30000 / fuelCost) : 1;
      const emScore = emission > 0 ? Math.min(1, 5 / emission) : 1;
      return fillScore * 0.40 + distScore * 0.35 + fuelScore * 0.15 + emScore * 0.10;
    };

    const scoredTps = activeTps
      .filter((t) => isValidCoord(t.lat, t.lng))
      .filter((t) => !assignedTpsIds.has(t.id) && !visited.has(t.id))
      .map((t) => {
        const fill = t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0;
        const distanceKm = haversineKm(currentPos.lat, currentPos.lng, t.lat, t.lng);
        const score = scoreTps({ fill, distanceKm }, truck.type);
        return { ...t, fill, distanceKm, score };
      })
      .filter((t) => {
        const threshold = t.distanceKm < CLOSE_DISTANCE_KM ? FILL_THRESHOLD_CLOSE : FILL_THRESHOLD_FAR;
        return t.fill >= threshold && t.currentVolume > 0;
      })
      .sort((a, b) => b.score - a.score);

    // Add more TPS if capacity available (nearest-neighbor chaining)
    while (queue.length < MAX_ROUTE_QUEUE && remaining > 0 && scoredTps.length > 0) {
      const next = scoredTps
        .filter((t) => !visited.has(t.id) && t.currentVolume > 0)
        .map((t) => ({ ...t, distFromCurrent: haversineKm(currentPos.lat, currentPos.lng, t.lat, t.lng) }))
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
        status: queue.length === 0 ? "active" : "pending",
      });
      visited.add(next.id);
      assignedTpsIds.add(next.id);
      remaining -= collect;
      currentPos = { lat: next.lat, lng: next.lng };
    }

    if (queue.length === 0) { res.status(404).json({ error: "Tidak ada TPS yang perlu dijemput" }); return; }

    const first = queue[0];

    // Pick more TPS (nearest-neighbor chaining)
    while (queue.length < MAX_ROUTE_QUEUE && remaining > 0) {
      const next = scoredTps
        .filter((t) => !visited.has(t.id) && t.currentVolume > 0)
        .map((t) => ({ ...t, distFromCurrent: haversineKm(currentPos.lat, currentPos.lng, t.lat, t.lng) }))
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
      assignedTpsIds.add(next.id);
      remaining -= collect;
      currentPos = { lat: next.lat, lng: next.lng };
    }

    // Add facility as last leg — use smart selection (TPS3R if closer + capacity, else PLTSa)
    const lastStop = queue[queue.length - 1];
    const facility = findBestFacility(lastStop.tpsLat!, lastStop.tpsLng!, facilities, user.id);
    if (facility) {
      queue.push({
        type: "FACILITY", facilityId: facility.id, facilityName: facility.name,
        facilityLat: facility.lat, facilityLng: facility.lng,
        status: "pending",
      });
    }

    // Build route to first TPS
    const route = await getRoute(truckPos, { lat: first.tpsLat!, lng: first.tpsLng! });
    const heading = route.geometry.coordinates.length >= 2
      ? Math.atan2(
          route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
          route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
        ) * 180 / Math.PI
      : 0;

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: "EN_ROUTE_TO_TPS",
        assignedTpsId: first.tpsId,
        destinationLat: first.tpsLat,
        destinationLng: first.tpsLng,
        facilityId: facility?.id,
        route: route.geometry as any,
        routeProgress: 0,
        routeDistance: route.distance,
        routeDuration: route.duration,
        routeQueue: queue as any,
        routeLegIndex: 0,
        heading: heading < 0 ? heading + 360 : heading,
        currentLoadKg: 0,
      },
    });

    logger.info(`[DRIVER] ${truck.code} started multi-TPS route: ${queue.filter(l => l.type === "TPS").length} TPS stops + 1 facility`);
    res.json({ success: true, truck: updated, queue });
  } catch (err: any) {
    console.error("[DRIVER] startRoute error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/arrive ---
export async function arriveAtTps(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "EN_ROUTE_TO_TPS") {
      res.status(400).json({ error: "Truk tidak sedang menuju TPS" });
      return;
    }

    // Get current leg from routeQueue to find expected collect amount
    const queue = (truck.routeQueue as unknown as RouteQueueItem[]) || [];
    const activeLeg = queue.find((l) => l.status === "active");
    const collectedKg = activeLeg?.collectedKg || 0;

    // Calculate loading duration based on collected weight
    // Formula: (collectedKg / 5000) * 60 seconds (5 ton per minute)
    // Min 30s, Max 600s (10 min)
    const loadingDuration = Math.max(30, Math.min(600, Math.round((collectedKg / 5000) * 60)));

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: { 
        status: "LOADING", 
        routeProgress: 1.0,
      },
    });

    logger.info(`[DRIVER] ${truck.code} arrived at TPS, loading ${collectedKg}kg, estimated duration: ${loadingDuration}s`);
    res.json({ success: true, truck: updated, loadingDuration, collectedKg });
  } catch (err: any) {
    console.error("[DRIVER] arriveAtTps error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/loading ---
export async function startLoading(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }

    res.json({ success: true, message: "Loading dimulai" });
  } catch (err: any) {
    console.error("[DRIVER] startLoading error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- HELPER: Find next TPS in queue or nearby TPS ---
async function findNextTps(truck: any, queue: RouteQueueItem[], truckPos: { lat: number; lng: number }): Promise<RouteQueueItem | null> {
  // Check if there's pending TPS in queue
  const pendingTps = queue.filter((l) => l.type === "TPS" && l.status === "pending");
  if (pendingTps.length > 0) {
    logger.info(`[DRIVER] ${truck.code} has ${pendingTps.length} pending TPS in queue`);
    return pendingTps[0];
  }

  // If no pending TPS in queue, check if truck can carry more
  const remaining = truck.capacityKg - truck.currentLoadKg;
  if (remaining <= 500) {
    logger.info(`[DRIVER] ${truck.code} truck near capacity (${truck.currentLoadKg}/${truck.capacityKg}kg), go to facility`);
    return null;
  }

  // Find nearby TPS (5km radius) that truck can still carry
  const assignedTpsIds = new Set(
    queue.filter((l) => l.type === "TPS" && l.tpsId).map((l) => l.tpsId!)
  );

  const activeTps = await prisma.tps.findMany({
    where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
  });

  const nearby = activeTps
    .filter((t) => !assignedTpsIds.has(t.id) && isValidCoord(t.lat, t.lng))
    .map((t) => ({
      ...t,
      distKm: haversineKm(truckPos.lat, truckPos.lng, t.lat, t.lng),
      fill: t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0,
    }))
    .filter((t) => t.distKm <= 5)
    .sort((a, b) => b.fill - a.fill);

  if (nearby.length > 0) {
    const selected = nearby[0];
    const collect = Math.min(selected.currentVolume, remaining);
    logger.info(`[DRIVER] ${truck.code} found nearby TPS: ${selected.name} (${selected.distKm.toFixed(1)}km, can collect ${collect}kg)`);
    return {
      type: "TPS",
      tpsId: selected.id,
      tpsName: selected.name,
      tpsLat: selected.lat,
      tpsLng: selected.lng,
      collectedKg: collect,
      status: "pending",
    };
  }

  logger.info(`[DRIVER] ${truck.code} no nearby TPS found, go to facility`);
  return null;
}

// --- POST /api/fleet/driver/complete ---
// Driver finishes loading — collect waste, find next TPS or go to facility
export async function completeLoading(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "LOADING") {
      res.status(400).json({ error: `Truk tidak dalam status loading (status: ${truck.status})` });
      return;
    }

    const queue = ((truck.routeQueue as unknown) as RouteQueueItem[]) || [];
    const currentLeg = queue[truck.routeLegIndex];

    // If no route queue or invalid leg, try to find current TPS from assignedTpsId
    let currentTpsId: string | null = null;
    let collectedKg = 0;

    if (currentLeg && currentLeg.type === "TPS" && currentLeg.tpsId) {
      currentTpsId = currentLeg.tpsId;
      collectedKg = currentLeg.collectedKg || 0;
    } else if (truck.assignedTpsId) {
      // Fallback: use assignedTpsId
      currentTpsId = truck.assignedTpsId;
      collectedKg = truck.currentLoadKg || 0;
    }

    if (!currentTpsId) {
      // No TPS info — just advance to facility or reset
      const facilities = await prisma.sortingHub.findMany();
      const facility = findBestFacility(
        isValidCoord(truck.lat, truck.lng) ? truck.lat! : -7.2185,
        isValidCoord(truck.lat, truck.lng) ? truck.lng! : 112.6258,
        facilities
      );
      if (facility) {
        const route = await getRoute(
          { lat: isValidCoord(truck.lat, truck.lng) ? truck.lat! : -7.2185, lng: isValidCoord(truck.lat, truck.lng) ? truck.lng! : 112.6258 },
          { lat: facility.lat, lng: facility.lng }
        );
        const updated = await prisma.truck.update({
          where: { id: truck.id },
          data: {
            status: "EN_ROUTE_TO_HUB", facilityId: facility.id,
            destinationLat: facility.lat, destinationLng: facility.lng,
            route: route.geometry as any, routeProgress: 0,
            routeDistance: route.distance, routeDuration: route.duration,
            routeQueue: null, routeLegIndex: 0,
          },
        });
        res.json({ success: true, truck: updated });
      } else {
        const updated = await prisma.truck.update({
          where: { id: truck.id },
          data: { status: "AVAILABLE", route: null, routeProgress: 0, routeQueue: null, routeLegIndex: 0, assignedTpsId: null, currentLoadKg: 0 },
        });
        res.json({ success: true, truck: updated });
      }
      return;
    }

    // Collect waste from TPS
    const tps = await prisma.tps.findUnique({ where: { id: currentTpsId } });
    if (tps) {
      const collected = Math.min(tps.currentVolume, collectedKg);
      await prisma.tps.update({
        where: { id: currentTpsId },
        data: { currentVolume: Math.max(0, tps.currentVolume - collected) },
      });
      truck.currentLoadKg += collected;
    }

    // Mark current leg as done
    if (currentLeg) {
      queue[truck.routeLegIndex].status = "done";
    }

    // Smart multi-stop: find nearby TPS if truck has capacity
    const remaining = truck.capacityKg - truck.currentLoadKg;
    const facilities = await prisma.sortingHub.findMany();

    if (remaining > 500) {
      const assignedTpsIds = new Set(
        (await prisma.truck.findMany({
          where: { status: { in: ["EN_ROUTE_TO_TPS", "LOADING"] }, assignedTpsId: { not: null } },
          select: { assignedTpsId: true },
        })).map((t) => t.assignedTpsId!)
      );
      for (const leg of queue) {
        if (leg.tpsId) assignedTpsIds.add(leg.tpsId);
      }

    const truckPos = isValidCoord(truck.lat, truck.lng)
      ? { lat: truck.lat!, lng: truck.lng! }
      : { lat: -7.2185, lng: 112.6258 };
      const activeTps = await prisma.tps.findMany({
        where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
      });

      const nearbyFull = activeTps
        .map((t) => ({
          ...t,
          fill: t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0,
          dist: haversineKm(truckPos.lat, truckPos.lng, t.lat, t.lng),
        }))
        .filter((t) => t.dist <= 3 && t.fill >= 0.75 && !assignedTpsIds.has(t.id))
        .sort((a, b) => b.fill - a.fill);

      if (nearbyFull.length > 0) {
        const nextTps = nearbyFull[0];
        const collect = Math.min(nextTps.currentVolume, remaining);
        const insertIdx = (truck.routeLegIndex || 0) + 1;
        queue.splice(insertIdx, 0, {
          type: "TPS", tpsId: nextTps.id, tpsName: nextTps.name,
          tpsLat: nextTps.lat, tpsLng: nextTps.lng,
          collectedKg: Math.round(collect * 100) / 100,
          status: "pending",
        });
      }
    }

    // Ensure facility leg exists
    const hasFacility = queue.some((l) => l.type === "FACILITY");
    if (!hasFacility) {
      const lastStop = queue[queue.length - 1];
      const lastLat = lastStop?.tpsLat || (isValidCoord(truck.lat, truck.lng) ? truck.lat! : -7.2185);
      const lastLng = lastStop?.tpsLng || truck.lng || 112.6258;
      const nearestFac = findBestFacility(lastLat, lastLng, facilities, user.id);
      if (nearestFac) {
        queue.push({
          type: "FACILITY", facilityId: nearestFac.id, facilityName: nearestFac.name,
          facilityLat: nearestFac.lat, facilityLng: nearestFac.lng, status: "pending",
        });
      }
    }

    // Advance to next leg
    const nextIdx = queue.findIndex((l, i) => i > (truck.routeLegIndex || 0) && l.status === "pending");
    if (nextIdx === -1) {
      const updated = await prisma.truck.update({
        where: { id: truck.id },
        data: {
          status: "AVAILABLE",
          route: null, routeProgress: 0, routeDistance: null, routeDuration: null,
          routeQueue: null, routeLegIndex: 0,
          assignedTpsId: null, destinationLat: null, destinationLng: null,
          facilityId: null, currentLoadKg: 0, heading: 0,
        },
      });
      res.json({ success: true, truck: updated, nextLeg: null });
      return;
    }

    const nextLeg = queue[nextIdx];
    nextLeg.status = "active";
    const origin = { lat: truck.lat || -7.2185, lng: truck.lng || 112.6258 };
    const dest = nextLeg.type === "TPS"
      ? { lat: nextLeg.tpsLat!, lng: nextLeg.tpsLng! }
      : { lat: nextLeg.facilityLat!, lng: nextLeg.facilityLng! };
    const route = await getRoute(origin, dest);

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: nextLeg.type === "TPS" ? "EN_ROUTE_TO_TPS" : "EN_ROUTE_TO_HUB",
        assignedTpsId: nextLeg.type === "TPS" ? nextLeg.tpsId! : null,
        destinationLat: dest.lat,
        destinationLng: dest.lng,
        facilityId: nextLeg.type === "FACILITY" ? nextLeg.facilityId! : null,
        route: route.geometry as any,
        routeProgress: 0,
        routeDistance: route.distance,
        routeDuration: route.duration,
        routeQueue: queue as any,
        routeLegIndex: nextIdx,
        currentLoadKg: truck.currentLoadKg,
      },
    });

    res.json({ success: true, truck: updated, nextLeg });
  } catch (err: any) {
    console.error("[DRIVER] completeLoading error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/auto-advance ---
export async function autoAdvance(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }
    if (truck.status !== "LOADING") {
      res.status(400).json({ error: "Truk tidak dalam status loading" });
      return;
    }

    // Same logic as completeLoading
    const queue = ((truck.routeQueue as unknown) as RouteQueueItem[]) || [];
    const currentLeg = queue[truck.routeLegIndex];
    if (!currentLeg || currentLeg.type !== "TPS" || !currentLeg.tpsId) {
      res.status(400).json({ error: "Tidak ada TPS aktif" }); return;
    }

    const tps = await prisma.tps.findUnique({ where: { id: currentLeg.tpsId } });
    if (tps) {
      const collected = Math.min(tps.currentVolume, currentLeg.collectedKg || 0);
      await prisma.tps.update({
        where: { id: currentLeg.tpsId },
        data: { currentVolume: Math.max(0, tps.currentVolume - collected) },
      });
      truck.currentLoadKg += collected;
    }

    queue[truck.routeLegIndex].status = "done";

    // Find nearest facility
    const facilities = await prisma.sortingHub.findMany();
    const lastStop = queue[queue.length - 1];
    const lastLat = lastStop?.tpsLat || (isValidCoord(truck.lat, truck.lng) ? truck.lat! : -7.2185);
    const lastLng = lastStop.tpsLng || truck.lng || 112.6258;
    const nearestFac = findBestFacility(lastLat, lastLng, facilities, user.id);

    if (nearestFac) {
    const origin = { lat: isValidCoord(truck.lat, truck.lng) ? truck.lat! : -7.2185, lng: isValidCoord(truck.lat, truck.lng) ? truck.lng! : 112.6258 };
      const route = await getRoute(origin, { lat: nearestFac.lat, lng: nearestFac.lng });

      const updated = await prisma.truck.update({
        where: { id: truck.id },
        data: {
          status: "EN_ROUTE_TO_HUB",
          facilityId: nearestFac.id,
          destinationLat: nearestFac.lat,
          destinationLng: nearestFac.lng,
          route: route.geometry as any,
          routeProgress: 0,
          routeDistance: route.distance,
          routeDuration: route.duration,
          routeQueue: queue as any,
          routeLegIndex: queue.length - 1,
          currentLoadKg: truck.currentLoadKg,
        },
      });
      res.json({ success: true, truck: updated });
    } else {
      res.json({ success: true, truck, message: "No facility found" });
    }
  } catch (err: any) {
    console.error("[DRIVER] autoAdvance error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/arrive-hub ---
export async function arriveAtHub(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "EN_ROUTE_TO_HUB") {
      res.status(400).json({ error: "Truk tidak sedang menuju fasilitas" });
      return;
    }

    // Calculate unloading duration: 2-3 minutes base, +1 min per 10 ton
    // Formula: 120s base + (currentLoadKg / 10000) * 60s, max 600s
    const baseUnloadTime = 120;
    const unloadingDuration = Math.min(600, Math.round(baseUnloadTime + (truck.currentLoadKg / 10000) * 60));

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: { status: "UNLOADING", routeProgress: 1.0 },
    });

    logger.info(`[DRIVER] ${truck.code} arrived at facility, unloading ${truck.currentLoadKg}kg, estimated duration: ${unloadingDuration}s`);
    res.json({ success: true, truck: updated, unloadingDuration, currentLoadKg: truck.currentLoadKg });
  } catch (err: any) {
    console.error("[DRIVER] arriveAtHub error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/unload ---
// Driver finishes unloading at facility, routes to nearest depot
export async function unloadAtHub(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }

    // Update facility intake if truck has load and facility assigned
    if (truck.facilityId && truck.currentLoadKg > 0) {
      await facilityService.addIntake(truck.facilityId, truck.currentLoadKg);
      logger.info(`[DRIVER] ${truck.code} unloaded ${Math.round(truck.currentLoadKg)} kg at facility`);
    }

    // Fetch depots from database
    const depots = await prisma.sortingHub.findMany({ where: { type: "DEPOT" } });
    
    // Fallback to hardcoded if no depots in DB
    const DEPOTS = depots.length > 0 
      ? depots.map((d) => ({ name: d.name, lat: d.lat, lng: d.lng }))
      : [
          { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
          { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
          { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
          { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
        ];

    // Find nearest depot
    const truckPos = isValidCoord(truck.lat, truck.lng)
      ? { lat: truck.lat!, lng: truck.lng! }
      : { lat: -7.2185, lng: 112.6258 };

    const nearestDepot = DEPOTS.reduce((best, d) => {
      const bestDist = haversineKm(truckPos.lat, truckPos.lng, best.lat, best.lng);
      const dist = haversineKm(truckPos.lat, truckPos.lng, d.lat, d.lng);
      return dist < bestDist ? d : best;
    }, DEPOTS[0]);

    // Get route to nearest depot
    const route = await getRoute(truckPos, { lat: nearestDepot.lat, lng: nearestDepot.lng });
    const heading = route.geometry.coordinates.length >= 2
      ? Math.atan2(
          route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
          route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
        ) * 180 / Math.PI
      : 0;

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: "EN_ROUTE_TO_DEPOT",
        route: route.geometry as any,
        routeProgress: 0,
        routeDistance: route.distance,
        routeDuration: route.duration,
        destinationLat: nearestDepot.lat,
        destinationLng: nearestDepot.lng,
        heading: heading < 0 ? heading + 360 : heading,
        routeQueue: null,
        routeLegIndex: 0,
        assignedTpsId: null,
        facilityId: null,
        currentLoadKg: 0,
      },
    });

    logger.info(`[DRIVER] ${truck.code} routing to nearest depot (${nearestDepot.name})`);
    res.json({ success: true, truck: updated, depot: nearestDepot });
  } catch (err: any) {
    console.error("[DRIVER] unloadAtHub error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/arrive-depot ---
// Driver arrives at depot, status = AVAILABLE
export async function arriveAtDepot(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }
    if (truck.status !== "EN_ROUTE_TO_DEPOT") {
      res.status(400).json({ error: "Truk tidak sedang menuju depot" });
      return;
    }

    const updated = await prisma.truck.update({
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
      },
    });

    logger.info(`[DRIVER] ${truck.code} arrived at depot, status AVAILABLE`);
    res.json({ success: true, truck: updated });
  } catch (err: any) {
    console.error("[DRIVER] arriveAtDepot error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/generate-backup-code ---
// Generate backup code for manual arrival verification (admin/hub use)
export async function generateBackupCode(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }

    // Generate unique alphanumeric code (6 characters)
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
    let code = "";
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        backupCode: code,
        backupCodeGeneratedAt: new Date(),
      },
    });

    logger.info(`[DRIVER] ${truck.code} generated backup code: ${code}`);
    res.json({ success: true, backupCode: code, generatedAt: updated.backupCodeGeneratedAt });
  } catch (err: any) {
    console.error("[DRIVER] generateBackupCode error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/backup-arrive ---
// Manual arrival verification using backup code (when GPS fails)
export async function backupArrive(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const { backupCode } = req.body;
    if (!backupCode || typeof backupCode !== "string") {
      res.status(400).json({ error: "backupCode required" });
      return;
    }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }

    // Verify backup code
    if (truck.backupCode !== backupCode.toUpperCase()) {
      res.status(400).json({ error: "Kode backup tidak valid" });
      return;
    }

    // Check if code is expired (24 hours)
    const CODE_EXPIRY_HOURS = 24;
    const generatedAt = truck.backupCodeGeneratedAt;
    if (generatedAt) {
      const hoursSinceGenerated = (Date.now() - generatedAt.getTime()) / (1000 * 60 * 60);
      if (hoursSinceGenerated > CODE_EXPIRY_HOURS) {
        res.status(400).json({ error: "Kode backup sudah kedaluwarsa" });
        return;
      }
    }

    // Set status based on current status
    let newStatus: string;
    if (truck.status === "EN_ROUTE_TO_TPS") {
      newStatus = "LOADING";
    } else if (truck.status === "EN_ROUTE_TO_HUB") {
      newStatus = "UNLOADING";
    } else if (truck.status === "EN_ROUTE_TO_DEPOT") {
      newStatus = "AVAILABLE";
    } else {
      res.status(400).json({ error: `Tidak bisa menggunakan backup arrive di status ${truck.status}` });
      return;
    }

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: newStatus,
        routeProgress: 1.0,
        backupCode: null,
        backupCodeGeneratedAt: null,
      },
    });

    logger.info(`[DRIVER] ${truck.code} used backup code to arrive, status: ${newStatus}`);
    res.json({ success: true, truck: updated, message: `Status diubah ke ${newStatus}` });
  } catch (err: any) {
    console.error("[DRIVER] backupArrive error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/admin-insert ---
// Admin inserts a new TPS into truck's route queue
export async function adminInsert(req: AuthRequest, res: Response) {
  try {
    const { truckId, tpsId } = req.body;
    if (!truckId || !tpsId) {
      res.status(400).json({ error: "truckId and tpsId required" });
      return;
    }

    const truck = await prisma.truck.findUnique({ where: { id: truckId } });
    if (!truck) { res.status(404).json({ error: "Truck not found" }); return; }
    if (truck.status === "AVAILABLE") {
      res.status(400).json({ error: "Truk belum dalam perjalanan" });
      return;
    }

    const tps = await prisma.tps.findUnique({ where: { id: tpsId } });
    if (!tps) { res.status(404).json({ error: "TPS not found" }); return; }

    // 1 TPS = 1 truck check
    const alreadyAssigned = await prisma.truck.count({
      where: {
        OR: [
          { status: "EN_ROUTE_TO_TPS", assignedTpsId: tpsId },
          { status: "LOADING", assignedTpsId: tpsId },
        ],
      },
    });
    if (alreadyAssigned > 0) {
      res.status(400).json({ error: "TPS sudah ditugaskan ke truk lain" });
      return;
    }

    const queue = ((truck.routeQueue as unknown) as RouteQueueItem[]) || [];
    const currentIdx = truck.routeLegIndex;

    // Insert TPS leg after current active leg, before any facility legs
    const newLeg: RouteQueueItem = {
      type: "TPS", tpsId: tps.id, tpsName: tps.name,
      tpsLat: tps.lat, tpsLng: tps.lng,
      collectedKg: Math.min(tps.currentVolume, truck.capacityKg - truck.currentLoadKg),
      status: "pending",
    };

    // Find insert position: after current, before facility
    let insertIdx = currentIdx + 1;
    while (insertIdx < queue.length && queue[insertIdx].type === "TPS") {
      insertIdx++;
    }
    queue.splice(insertIdx, 0, newLeg);

    const updated = await prisma.truck.update({
      where: { id: truckId },
      data: { routeQueue: queue as any },
    });

    console.log(`[ADMIN] Inserted TPS ${tps.name} into ${truck.code} route at position ${insertIdx}`);
    res.json({ success: true, truck: updated, insertedAt: insertIdx });
  } catch (err: any) {
    console.error("[DRIVER] adminInsert error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}
