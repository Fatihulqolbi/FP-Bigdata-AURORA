import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { z } from "zod";
import { getRoute, type Coordinate } from "./route.service.js";

// --- GET /api/fleet/driver/me ---
export async function getDriverInfo(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Find truck assigned to this driver
    const truck = await prisma.truck.findFirst({
      where: { driverId: user.id },
    });

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
// Driver claims an available truck
export async function claimTruck(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    // Check if driver already has a truck
    const existing = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (existing) {
      res.json({ success: true, truck: existing, message: "Truk sudah di-assign" });
      return;
    }

    // Find an available truck at any depot
    // Use OR to handle both explicit null and absent (unset) driverId field in MongoDB
    const available = await prisma.truck.findFirst({
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

    // Assign truck to driver
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
// Driver releases truck back to pool
export async function releaseTruck(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Tidak ada truk di-assign" }); return; }

    // Only release if truck is idle
    if (truck.status !== "AVAILABLE") {
      res.status(400).json({ error: "Truk masih dalam perjalanan, tidak bisa dilepas" });
      return;
    }

    await prisma.truck.update({
      where: { id: truck.id },
      data: { driverId: null },
    });

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

    const waypoints = (truck.routeWaypoints as any[]) || [];
    const activeWps = waypoints.filter((w: any) => w.collectedKg > 0);

    // Get TPS info for waypoints
    const tpsIds = activeWps.map((w: any) => w.tpsId);
    const tpsList = tpsIds.length > 0 ? await prisma.tps.findMany({ where: { id: { in: tpsIds } } }) : [];
    const tpsMap = new Map(tpsList.map((t) => [t.id, t]));

    // Get facility info
    const facility = truck.facilityId ? await prisma.sortingHub.findUnique({ where: { id: truck.facilityId } }) : null;

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
      waypoints: activeWps.map((w: any) => ({
        tpsId: w.tpsId,
        tpsName: w.tpsName,
        tpsLat: w.tpsLat,
        tpsLng: w.tpsLng,
        collectedKg: w.collectedKg,
        tpsCurrentVolume: tpsMap.get(w.tpsId)?.currentVolume || 0,
        tpsCapacity: tpsMap.get(w.tpsId)?.capacityKg || 0,
      })),
      facility: facility ? { id: facility.id, name: facility.name, lat: facility.lat, lng: facility.lng } : null,
    });
  } catch (err: any) {
    console.error("[DRIVER] getAssignment error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- POST /api/fleet/driver/start ---
export async function startRoute(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "ASSIGNED" && truck.status !== "AVAILABLE") {
      res.status(400).json({ error: "Truk tidak dalam status yang sesuai" });
      return;
    }

    // Find best TPS to collect
    const tps = await prisma.tps.findFirst({
      where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
      orderBy: { currentVolume: "desc" },
    });
    if (!tps) { res.status(404).json({ error: "Tidak ada TPS yang perlu dijemput" }); return; }

    const origin: Coordinate = truck.lat && truck.lng ? { lat: truck.lat, lng: truck.lng } : { lat: -7.2185, lng: 112.6258 };
    const dest: Coordinate = { lat: tps.lat, lng: tps.lng };
    const route = await getRoute(origin, dest);
    const heading = route.geometry.coordinates.length >= 2
      ? Math.atan2(route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0], route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]) * 180 / Math.PI
      : 0;

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: "EN_ROUTE_TO_TPS",
        assignedTpsId: tps.id,
        destinationLat: tps.lat,
        destinationLng: tps.lng,
        route: route.geometry as any,
        routeProgress: 0,
        routeDistance: route.distance,
        routeDuration: route.duration,
        routeWaypoints: [{ tpsId: tps.id, tpsName: tps.name, tpsLat: tps.lat, tpsLng: tps.lng, collectedKg: Math.min(tps.currentVolume, truck.capacityKg) }] as any,
        heading: heading < 0 ? heading + 360 : heading,
        currentLoadKg: 0,
      },
    });

    res.json({ success: true, truck: updated });
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
export async function completeLoading(req: AuthRequest, res: Response) {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.user!.userId } });
    if (!user) { res.status(404).json({ error: "User not found" }); return; }

    const truck = await prisma.truck.findFirst({ where: { driverId: user.id } });
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }
    if (truck.status !== "LOADING") {
      res.status(400).json({ error: "Truk tidak dalam status loading" });
      return;
    }

    const waypoints = (truck.routeWaypoints as any[]) || [];
    const currentWp = waypoints.find((w: any) => w.collectedKg > 0);
    if (!currentWp) { res.status(400).json({ error: "Tidak ada waypoint aktif" }); return; }

    // Collect waste from TPS
    const tps = await prisma.tps.findUnique({ where: { id: currentWp.tpsId } });
    if (tps) {
      const collected = Math.min(tps.currentVolume, currentWp.collectedKg);
      await prisma.tps.update({
        where: { id: currentWp.tpsId },
        data: { currentVolume: Math.max(0, tps.currentVolume - collected) },
      });
    }

    // Mark waypoint as visited
    const updatedWps = waypoints.map((w: any) => w.tpsId === currentWp.tpsId ? { ...w, collectedKg: 0 } : w);
    const remainingWps = updatedWps.filter((w: any) => w.collectedKg > 0);

    if (remainingWps.length > 0) {
      // Route to next TPS
      const nextWp = remainingWps[0];
      const origin: Coordinate = truck.lat && truck.lng ? { lat: truck.lat, lng: truck.lng } : { lat: currentWp.tpsLat, lng: currentWp.tpsLng };
      const dest: Coordinate = { lat: nextWp.tpsLat, lng: nextWp.tpsLng };
      const route = await getRoute(origin, dest);

      const updated = await prisma.truck.update({
        where: { id: truck.id },
        data: {
          status: "EN_ROUTE_TO_TPS",
          assignedTpsId: nextWp.tpsId,
          destinationLat: nextWp.tpsLat,
          destinationLng: nextWp.tpsLng,
          route: route.geometry as any,
          routeProgress: 0,
          routeDistance: route.distance,
          routeDuration: route.duration,
          routeWaypoints: updatedWps as any,
          currentLoadKg: truck.currentLoadKg + (currentWp.collectedKg || 0),
        },
      });

      res.json({ success: true, nextRoute: true, truck: updated, nextTps: nextWp });
    } else {
      // No more TPS → go to facility
      const facility = await prisma.sortingHub.findFirst({ where: { type: "PLTSa" } });
      if (!facility) { res.status(500).json({ error: "Fasilitas tidak ditemukan" }); return; }

      const origin: Coordinate = truck.lat && truck.lng ? { lat: truck.lat, lng: truck.lng } : { lat: currentWp.tpsLat, lng: currentWp.tpsLng };
      const dest: Coordinate = { lat: facility.lat, lng: facility.lng };
      const route = await getRoute(origin, dest);

      const updated = await prisma.truck.update({
        where: { id: truck.id },
        data: {
          status: "EN_ROUTE_TO_HUB",
          facilityId: facility.id,
          destinationLat: facility.lat,
          destinationLng: facility.lng,
          route: route.geometry as any,
          routeProgress: 0,
          routeDistance: route.distance,
          routeDuration: route.duration,
          routeWaypoints: null,
          currentLoadKg: truck.currentLoadKg + (currentWp.collectedKg || 0),
        },
      });

      res.json({ success: true, nextRoute: false, truck: updated, facility: { name: facility.name, lat: facility.lat, lng: facility.lng } });
    }
  } catch (err: any) {
    console.error("[DRIVER] completeLoading error:", err.message);
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
    if (!truck) { res.status(404).json({ error: "Truk belum di-assign" }); return; }

    const updated = await prisma.truck.update({
      where: { id: truck.id },
      data: {
        status: "AVAILABLE",
        route: null,
        routeProgress: 0,
        routeDistance: null,
        routeDuration: null,
        routeWaypoints: null,
        assignedTpsId: null,
        destinationLat: null,
        destinationLng: null,
        facilityId: null,
        currentLoadKg: 0,
        heading: 0,
      },
    });

    res.json({ success: true, truck: updated });
  } catch (err: any) {
    console.error("[DRIVER] unloadAtHub error:", err.message);
    res.status(500).json({ error: "Internal server error" });
  }
}
