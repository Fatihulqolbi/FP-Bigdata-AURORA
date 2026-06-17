import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { z } from "zod";
import { getRoute, type Coordinate } from "./route.service.js";

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

function getNearestFacility(lat: number, lng: number, facilities: { id: string; name: string; lat: number; lng: number }[]) {
  if (facilities.length === 0) return null;
  return facilities.reduce((best, f) => {
    const d = haversineKm(lat, lng, f.lat, f.lng);
    const bestD = haversineKm(lat, lng, best.lat, best.lng);
    return d < bestD ? f : best;
  }, facilities[0]);
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
      data: { driverId: user.id },
    });

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
// Driver presses "Gas Berangkat" — find TPS + create route queue
export async function startRoute(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "AVAILABLE") {
      res.status(400).json({ error: "Truk tidak dalam status available" });
      return;
    }

    // 1 TPS = 1 truck enforcement
    const assignedTpsIds = new Set(
      (await prisma.truck.findMany({
        where: { status: { in: ["EN_ROUTE_TO_TPS", "LOADING"] }, assignedTpsId: { not: null } },
        select: { assignedTpsId: true },
      })).map((t) => t.assignedTpsId!)
    );

    const threshold = 0.5;
    const activeTps = await prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
    });
    const facilities = await prisma.sortingHub.findMany();

    const truckPos = isValidCoord(truck.lat, truck.lng)
      ? { lat: truck.lat!, lng: truck.lng! }
      : { lat: -7.2185, lng: 112.6258 };
    const candidates = activeTps
      .filter((t) => {
        const fill = t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0;
        const dist = haversineKm(truckPos.lat, truckPos.lng, t.lat, t.lng);
        const thresholdDist = dist < 3 ? 0.75 : 0.50;
        return fill >= thresholdDist && !assignedTpsIds.has(t.id);
      })
      .sort((a, b) => {
        const fa = a.capacityKg > 0 ? a.currentVolume / a.capacityKg : 0;
        const fb = b.capacityKg > 0 ? b.currentVolume / b.capacityKg : 0;
        return fb - fa;
      });

    const tps = candidates[0];
    if (!tps) { res.status(404).json({ error: "Tidak ada TPS yang perlu dijemput" }); return; }

    // Build route queue
    const nearestFac = getNearestFacility(tps.lat, tps.lng, facilities);
    const queue: RouteQueueItem[] = [
      { type: "TPS", tpsId: tps.id, tpsName: tps.name, tpsLat: tps.lat, tpsLng: tps.lng,
        collectedKg: Math.min(tps.currentVolume, truck.capacityKg), status: "active" },
    ];
    if (nearestFac) {
      queue.push({ type: "FACILITY", facilityId: nearestFac.id, facilityName: nearestFac.name,
        facilityLat: nearestFac.lat, facilityLng: nearestFac.lng, status: "pending" });
    }

    const route = await getRoute(truckPos, { lat: tps.lat, lng: tps.lng });
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
        assignedTpsId: tps.id,
        destinationLat: tps.lat,
        destinationLng: tps.lng,
        facilityId: nearestFac?.id,
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

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: { status: "LOADING", routeProgress: 1.0 },
    });

    res.json({ success: true, truck: updated });
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
      const facility = getNearestFacility(
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
      const nearestFac = getNearestFacility(lastLat, lastLng, facilities);
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
    const nearestFac = getNearestFacility(lastLat, lastLng, facilities);

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

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: { status: "UNLOADING", routeProgress: 1.0 },
    });

    res.json({ success: true, truck: updated });
  } catch (err: any) {
    console.error("[DRIVER] arriveAtHub error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/unload ---
export async function unloadAtHub(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk tidak ditemukan" }); return; }

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

    res.json({ success: true, truck: updated });
  } catch (err: any) {
    console.error("[DRIVER] unloadAtHub error:", err.message);
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
