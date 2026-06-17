import { prisma } from "../../config/db.js";
import type { Truck } from "@prisma/client";
import { getRoute, type Coordinate } from "./route.service.js";

interface FleetStatusResult {
  totalTrucks: number;
  activeTrucks: number;
  idleTrucks: number;
  tpsActive: number;
  tpsCritical: number;
  totalWasteToday: number;
  trucks: Truck[];
}

interface AssignTruckInput {
  truckId: string;
  tpsId: string;
}

export async function getFleetStatus(): Promise<FleetStatusResult> {
  const [trucks, tpsCounts] = await Promise.all([
    prisma.truck.findMany({ orderBy: { code: "asc" } }),
    prisma.tps.count({ where: { status: { not: "NONAKTIF" }, needsReview: false } }),
  ]);

  const criticalCount = await prisma.tps.count({
    where: {
      status: "PENUH",
      needsReview: false,
    },
  });

  const activeTrucks = trucks.filter(
    (t) =>
      t.status === "EN_ROUTE_TO_TPS" ||
      t.status === "LOADING" ||
      t.status === "EN_ROUTE_TO_HUB" ||
      t.status === "UNLOADING"
  ).length;
  const idleTrucks = trucks.filter((t) => t.status === "AVAILABLE").length;

  // Sum currentLoad for total waste in transit
  const totalWasteToday = trucks.reduce((sum, t) => sum + (t.currentLoadKg || 0), 0) / 1000; // tons

  return {
    totalTrucks: trucks.length,
    activeTrucks,
    idleTrucks,
    tpsActive: tpsCounts,
    tpsCritical: criticalCount,
    totalWasteToday: Math.round(totalWasteToday * 10) / 10,
    trucks,
  };
}

export async function getTruckById(id: string) {
  return prisma.truck.findUnique({ where: { id } });
}

export async function getTrucks(filter?: {
  status?: string;
  type?: string;
  facilityId?: string;
}) {
  const where: any = {};
  if (filter?.status) where.status = filter.status;
  if (filter?.type) where.type = filter.type;
  if (filter?.facilityId) where.facilityId = filter.facilityId;
  return prisma.truck.findMany({
    where,
    orderBy: { code: "asc" },
  });
}

export async function updateTruckLocation(
  id: string,
  data: { lat: number; lng: number; heading?: number }
) {
  const truck = await prisma.truck.findUnique({ where: { id } });
  if (!truck) throw new Error("Truck not found");

  return prisma.truck.update({
    where: { id },
    data: {
      lat: data.lat,
      lng: data.lng,
      heading: data.heading ?? truck.heading,
      updatedAt: new Date(),
    },
  });
}

export async function assignTruck(input: AssignTruckInput) {
  const [truck, tps] = await Promise.all([
    prisma.truck.findUnique({ where: { id: input.truckId } }),
    prisma.tps.findUnique({ where: { id: input.tpsId } }),
  ]);

  if (!truck) throw new Error("Truck not found");
  if (!tps) throw new Error("TPS not found");
  if (truck.status !== "AVAILABLE") throw new Error("Truck is not available");

  return prisma.truck.update({
    where: { id: input.truckId },
    data: {
      status: "EN_ROUTE_TO_TPS",
      assignedTpsId: input.tpsId,
      destinationLat: tps.lat,
      destinationLng: tps.lng,
      routeProgress: 0,
      updatedAt: new Date(),
    },
  });
}

// --- Task Suggestions ---

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export interface AvailableTruck {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  currentLoadKg: number;
  lat: number | null;
  lng: number | null;
  currentStatus: string;
  etaMinutes: number | null;
}

export interface TaskSuggestion {
  tps: {
    id: string;
    code: string;
    name: string;
    kecamatan: string;
    lat: number;
    lng: number;
    currentVolume: number;
    capacityKg: number;
    fillPct: number;
    status: string;
  };
  recommendedTruck: (AvailableTruck & { distanceKm: number; score: number }) | null;
  priority: "KRITIS" | "TINGGI" | "SEDANG";
}

function truckEtaMinutes(truck: { status: string; routeProgress: number | null; routeDuration: number | null }): number | null {
  if (truck.status !== "EN_ROUTE_TO_HUB") return null;
  const progress = truck.routeProgress ?? 0;
  const duration = truck.routeDuration ?? 0;
  if (duration <= 0) return null;
  return Math.max(1, Math.ceil(((1 - progress) * duration) / 60));
}

export async function getTaskSuggestions(): Promise<{ suggestions: TaskSuggestion[]; availableTrucks: AvailableTruck[] }> {
  const [tpsList, allTrucks] = await Promise.all([
    prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" }, currentVolume: { gt: 0 } },
      orderBy: { currentVolume: "desc" },
    }),
    prisma.truck.findMany({
      orderBy: { code: "asc" },
    }),
  ]);

  // TPS yang sudah punya truk menuju (EN_ROUTE_TO_TPS atau LOADING)
  const assignedTpsIds = new Set(
    allTrucks
      .filter((t) => (t.status === "EN_ROUTE_TO_TPS" || t.status === "LOADING") && t.assignedTpsId)
      .map((t) => t.assignedTpsId!)
  );

  // Candidate trucks: AVAILABLE + EN_ROUTE_TO_HUB (returning) + truk dengan kapasitas tersisa
  const candidateTrucks = allTrucks.filter((t) => {
    if (t.status === "AVAILABLE") return true;
    if (t.status === "EN_ROUTE_TO_HUB") return true;
    // Truk dengan kapasitas tersisa (muatan < 50% kapasitas)
    if (t.currentLoadKg < t.capacityKg * 0.5 && t.status !== "LOADING") return true;
    return false;
  });

  // Only TPS with fill >= 40%, exclude already-assigned, cap at 12
  const candidates = tpsList
    .map((t) => ({ ...t, fillPct: t.capacityKg > 0 ? (t.currentVolume / t.capacityKg) * 100 : 0 }))
    .filter((t) => t.fillPct >= 40 && !assignedTpsIds.has(t.id))
    .sort((a, b) => b.fillPct - a.fillPct)
    .slice(0, 12);

  // Track which trucks are already "used" by a suggestion to avoid double-recommending
  const usedTruckIds = new Set<string>();

  const suggestions: TaskSuggestion[] = candidates.map((tps) => {
    let bestTruck: (AvailableTruck & { distanceKm: number; score: number }) | null = null;
    let bestScore = -1;

    for (const truck of candidateTrucks) {
      if (usedTruckIds.has(truck.id)) continue;
      const distKm = truck.lat != null && truck.lng != null
        ? haversineKm(truck.lat, truck.lng, tps.lat, tps.lng)
        : 50;
      const eta = truckEtaMinutes(truck);
      const fillScore = tps.fillPct / 100;
      const distScore = distKm > 0 ? Math.min(1, 5 / distKm) : 0;
      // Penalize trucks that are still returning — higher ETA = lower score
      const etaScore = eta != null ? Math.min(1, 10 / (eta + 1)) : 1.0;
      const score = fillScore * 0.45 + distScore * 0.35 + etaScore * 0.20;
      if (score > bestScore) {
        bestScore = score;
        bestTruck = {
          id: truck.id, code: truck.code, type: truck.type,
          capacityKg: truck.capacityKg, currentLoadKg: truck.currentLoadKg,
          lat: truck.lat, lng: truck.lng,
          currentStatus: truck.status,
          etaMinutes: eta,
          distanceKm: Math.round(distKm * 10) / 10,
          score: Math.round(score * 100) / 100,
        };
      }
    }

    if (bestTruck) usedTruckIds.add(bestTruck.id);

    const priority: "KRITIS" | "TINGGI" | "SEDANG" =
      tps.fillPct >= 90 ? "KRITIS" : tps.fillPct >= 70 ? "TINGGI" : "SEDANG";

    return {
      tps: {
        id: tps.id, code: tps.code, name: tps.name, kecamatan: tps.kecamatan,
        lat: tps.lat, lng: tps.lng,
        currentVolume: Math.round(tps.currentVolume),
        capacityKg: tps.capacityKg,
        fillPct: Math.round(tps.fillPct),
        status: tps.status,
      },
      recommendedTruck: bestTruck,
      priority,
    };
  });

  return {
    suggestions,
    availableTrucks: candidateTrucks.map((t) => ({
      id: t.id, code: t.code, type: t.type,
      capacityKg: t.capacityKg, currentLoadKg: t.currentLoadKg,
      lat: t.lat, lng: t.lng,
      currentStatus: t.status,
      etaMinutes: truckEtaMinutes(t),
    })),
  };
}

export async function dispatchManual(truckId: string, tpsId: string) {
  const [truck, tps] = await Promise.all([
    prisma.truck.findUnique({ where: { id: truckId } }),
    prisma.tps.findUnique({ where: { id: tpsId } }),
  ]);

  if (!truck) throw new Error("Truck not found");
  if (!tps) throw new Error("TPS not found");

  const facility = await prisma.sortingHub.findFirst({ orderBy: { currentLoadKg: "asc" } });
  if (!facility) throw new Error("No facility available");

  const collectedKg = Math.min(tps.currentVolume, truck.capacityKg - truck.currentLoadKg);
  if (collectedKg <= 0) throw new Error("Truk sudah penuh");

  // If truck is AVAILABLE — create new route with TPS as first stop
  if (truck.status === "AVAILABLE") {
    const BENOWO: Coordinate = { lat: -7.2185017137913645, lng: 112.6258223434186 };
    const origin: Coordinate = truck.lat != null && truck.lng != null
      ? { lat: truck.lat, lng: truck.lng }
      : BENOWO;
    const dest: Coordinate = { lat: facility.lat, lng: facility.lng };

    const route = await getRoute(origin, dest, [{ lat: tps.lat, lng: tps.lng }]);

    const heading = route.geometry.coordinates.length >= 2
      ? Math.atan2(
          route.geometry.coordinates[1][0] - route.geometry.coordinates[0][0],
          route.geometry.coordinates[1][1] - route.geometry.coordinates[0][1]
        ) * 180 / Math.PI
      : 0;

    return prisma.truck.update({
      where: { id: truckId },
      data: {
        status: "EN_ROUTE_TO_TPS",
        assignedTpsId: tps.id,
        destinationLat: tps.lat,
        destinationLng: tps.lng,
        facilityId: facility.id,
        route: route.geometry as any,
        routeProgress: 0,
        routeDistance: route.distance,
        routeDuration: route.duration,
        routeWaypoints: [{ tpsId: tps.id, tpsName: tps.name, tpsLat: tps.lat, tpsLng: tps.lng, collectedKg }] as any,
        heading: heading < 0 ? heading + 360 : heading,
        currentLoadKg: 0,
      },
    });
  }

  // If truck is already en-route — add TPS as additional waypoint
  if (truck.status === "EN_ROUTE_TO_TPS" || truck.status === "LOADING") {
    const existingWaypoints = (truck.routeWaypoints as any[]) || [];

    // Check if TPS already in waypoints
    const alreadyAssigned = existingWaypoints.some((w: any) => w.tpsId === tps.id);
    if (alreadyAssigned) throw new Error("TPS sudah ada dalam rute");

    // Add new waypoint
    const newWaypoint = {
      tpsId: tps.id,
      tpsName: tps.name,
      tpsLat: tps.lat,
      tpsLng: tps.lng,
      collectedKg,
    };
    const updatedWaypoints = [...existingWaypoints, newWaypoint];

    // Rebuild route with all waypoints
    const origin: Coordinate = truck.lat != null && truck.lng != null
      ? { lat: truck.lat, lng: truck.lng }
      : { lat: -7.2185017137913645, lng: 112.6258223434186 };
    const dest: Coordinate = { lat: facility.lat, lng: facility.lng };
    const waypoints: Coordinate[] = updatedWaypoints
      .filter((w: any) => w.collectedKg > 0)
      .map((w: any) => ({ lat: w.tpsLat, lng: w.tpsLng }));

    const route = await getRoute(origin, dest, waypoints);

    return prisma.truck.update({
      where: { id: truckId },
      data: {
        route: route.geometry as any,
        routeDistance: route.distance,
        routeDuration: route.duration,
        routeWaypoints: updatedWaypoints as any,
      },
    });
  }

  throw new Error("Truk tidak dalam status yang sesuai");
}
