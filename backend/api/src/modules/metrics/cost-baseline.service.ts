import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const FUEL_PRICE_PER_LITER = 24800;
const FUEL_EFFICIENCY: Record<string, number> = {
  COMPACTOR_10: 8,
  COMPACTOR_6_5: 8,
  DUMP_TRUCK: 6,
  ARMROLL_14: 7,
  ARMROLL_8: 7,
  ARMROLL_6: 7,
  PICK_UP: 10,
};

export interface CostBaselineResult {
  periodStart: Date;
  periodEnd: Date;
  staticTotalDistanceKm: number;
  staticTotalFuelL: number;
  staticTotalCostRp: number;
  staticAvgKmPerTon: number;
  optimizedTotalDistanceKm: number;
  optimizedTotalFuelL: number;
  optimizedTotalCostRp: number;
  optimizedAvgKmPerTon: number;
  distanceSavedKm: number;
  fuelSavedL: number;
  costSavedRp: number;
  efficiencyGainPct: number;
  testGroupSize: number;
  controlGroupSize: number;
}

export interface RouteRecord {
  truckCode: string;
  truckType: string;
  optimizedDistanceKm: number;
  collectedKg: number;
  facilityId: string;
  timestamp: Date;
}

interface StaticRouteCalculation {
  distanceKm: number;
  fuelL: number;
  costRp: number;
}

function haversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

async function calculateStaticRoute(
  tpsLat: number,
  tpsLng: number,
  truckType: string
): Promise<StaticRouteCalculation> {
  const facilities = await prisma.sortingHub.findMany({
    where: { type: { in: ["PLTSa", "TPS3R"] } },
    select: { lat: true, lng: true, type: true },
  });

  if (facilities.length === 0) {
    return { distanceKm: 0, fuelL: 0, costRp: 0 };
  }

  let nearestFacility = facilities[0];
  let minDistance = haversineDistance(tpsLat, tpsLng, facilities[0].lat, facilities[0].lng);

  for (const f of facilities) {
    const dist = haversineDistance(tpsLat, tpsLng, f.lat, f.lng);
    if (dist < minDistance) {
      minDistance = dist;
      nearestFacility = f;
    }
  }

  const distanceKm = minDistance * 1.3;
  const fuelEff = FUEL_EFFICIENCY[truckType] || 7;
  const fuelL = distanceKm / fuelEff;
  const costRp = fuelL * FUEL_PRICE_PER_LITER;

  return { distanceKm, fuelL, costRp };
}

export async function calculateCostBaseline(
  periodStart: Date,
  periodEnd: Date
): Promise<CostBaselineResult> {
  const trucks = await prisma.truck.findMany({
    where: {
      updatedAt: {
        gte: periodStart,
        lte: periodEnd,
      },
    },
    select: {
      id: true,
      code: true,
      type: true,
      routeDistance: true,
      currentLoadKg: true,
      facilityId: true,
      updatedAt: true,
    },
  });

  if (trucks.length === 0) {
    logger.warn("[COST] No truck activity in period");
    return {
      periodStart,
      periodEnd,
      staticTotalDistanceKm: 0,
      staticTotalFuelL: 0,
      staticTotalCostRp: 0,
      staticAvgKmPerTon: 0,
      optimizedTotalDistanceKm: 0,
      optimizedTotalFuelL: 0,
      optimizedTotalCostRp: 0,
      optimizedAvgKmPerTon: 0,
      distanceSavedKm: 0,
      fuelSavedL: 0,
      costSavedRp: 0,
      efficiencyGainPct: 0,
      testGroupSize: 0,
      controlGroupSize: 0,
    };
  }

  let staticTotalDistanceKm = 0;
  let staticTotalFuelL = 0;
  let staticTotalCostRp = 0;
  let optimizedTotalDistanceKm = 0;
  let optimizedTotalFuelL = 0;
  let optimizedTotalCostRp = 0;
  let totalCollectedKg = 0;

  const tpsCoordinates = await prisma.tps.findMany({
    where: { needsReview: false, status: { not: "NONAKTIF" } },
    select: { lat: true, lng: true },
  });

  const avgTpsLat = tpsCoordinates.length > 0
    ? tpsCoordinates.reduce((sum, t) => sum + t.lat, 0) / tpsCoordinates.length
    : -7.25;
  const avgTpsLng = tpsCoordinates.length > 0
    ? tpsCoordinates.reduce((sum, t) => sum + t.lng, 0) / tpsCoordinates.length
    : 112.73;

  for (const truck of trucks) {
    const fuelEff = FUEL_EFFICIENCY[truck.type] || 7;
    const staticRoute = await calculateStaticRoute(
      avgTpsLat,
      avgTpsLng,
      truck.type
    );

    staticTotalDistanceKm += staticRoute.distanceKm;
    staticTotalFuelL += staticRoute.fuelL;
    staticTotalCostRp += staticRoute.costRp;

    const optimizedDist = (truck.routeDistance || 0) / 1000;
    const optimizedFuel = optimizedDist / fuelEff;
    const optimizedCost = optimizedFuel * FUEL_PRICE_PER_LITER;

    optimizedTotalDistanceKm += optimizedDist;
    optimizedTotalFuelL += optimizedFuel;
    optimizedTotalCostRp += optimizedCost;

    totalCollectedKg += truck.currentLoadKg || 0;
  }

  const staticAvgKmPerTon = totalCollectedKg > 0
    ? staticTotalDistanceKm / (totalCollectedKg / 1000)
    : 0;
  const optimizedAvgKmPerTon = totalCollectedKg > 0
    ? optimizedTotalDistanceKm / (totalCollectedKg / 1000)
    : 0;

  const distanceSavedKm = staticTotalDistanceKm - optimizedTotalDistanceKm;
  const fuelSavedL = staticTotalFuelL - optimizedTotalFuelL;
  const costSavedRp = staticTotalCostRp - optimizedTotalCostRp;

  const efficiencyGainPct = staticTotalCostRp > 0
    ? ((staticTotalCostRp - optimizedTotalCostRp) / staticTotalCostRp) * 100
    : 0;

  const result: CostBaselineResult = {
    periodStart,
    periodEnd,
    staticTotalDistanceKm: Math.round(staticTotalDistanceKm * 100) / 100,
    staticTotalFuelL: Math.round(staticTotalFuelL * 100) / 100,
    staticTotalCostRp: Math.round(staticTotalCostRp),
    staticAvgKmPerTon: Math.round(staticAvgKmPerTon * 100) / 100,
    optimizedTotalDistanceKm: Math.round(optimizedTotalDistanceKm * 100) / 100,
    optimizedTotalFuelL: Math.round(optimizedTotalFuelL * 100) / 100,
    optimizedTotalCostRp: Math.round(optimizedTotalCostRp),
    optimizedAvgKmPerTon: Math.round(optimizedAvgKmPerTon * 100) / 100,
    distanceSavedKm: Math.round(distanceSavedKm * 100) / 100,
    fuelSavedL: Math.round(fuelSavedL * 100) / 100,
    costSavedRp: Math.round(costSavedRp),
    efficiencyGainPct: Math.round(efficiencyGainPct * 10) / 10,
    testGroupSize: trucks.length,
    controlGroupSize: 0,
  };

  await prisma.costOptimizationBaseline.create({
    data: {
      ...result,
      statisticalSignificance: 0,
    },
  });

  logger.info(
    `[COST] Baseline calculated: saved ${result.costSavedRp.toLocaleString()} Rp (${result.efficiencyGainPct}% efficiency)`
  );

  return result;
}

export async function getLatestCostBaseline(): Promise<CostBaselineResult | null> {
  const latest = await prisma.costOptimizationBaseline.findFirst({
    orderBy: { periodEnd: "desc" },
  });

  return latest
    ? {
        periodStart: latest.periodStart,
        periodEnd: latest.periodEnd,
        staticTotalDistanceKm: latest.staticTotalDistanceKm,
        staticTotalFuelL: latest.staticTotalFuelL,
        staticTotalCostRp: latest.staticTotalCostRp,
        staticAvgKmPerTon: latest.staticAvgKmPerTon,
        optimizedTotalDistanceKm: latest.optimizedTotalDistanceKm,
        optimizedTotalFuelL: latest.optimizedTotalFuelL,
        optimizedTotalCostRp: latest.optimizedTotalCostRp,
        optimizedAvgKmPerTon: latest.optimizedAvgKmPerTon,
        distanceSavedKm: latest.distanceSavedKm,
        fuelSavedL: latest.fuelSavedL,
        costSavedRp: latest.costSavedRp,
        efficiencyGainPct: latest.efficiencyGainPct,
        testGroupSize: latest.testGroupSize,
        controlGroupSize: latest.controlGroupSize,
      }
    : null;
}

export async function getCostBaselineHistory(limit: number = 30): Promise<CostBaselineResult[]> {
  const history = await prisma.costOptimizationBaseline.findMany({
    orderBy: { periodEnd: "desc" },
    take: limit,
  });

  return history.map((h) => ({
    periodStart: h.periodStart,
    periodEnd: h.periodEnd,
    staticTotalDistanceKm: h.staticTotalDistanceKm,
    staticTotalFuelL: h.staticTotalFuelL,
    staticTotalCostRp: h.staticTotalCostRp,
    staticAvgKmPerTon: h.staticAvgKmPerTon,
    optimizedTotalDistanceKm: h.optimizedTotalDistanceKm,
    optimizedTotalFuelL: h.optimizedTotalFuelL,
    optimizedTotalCostRp: h.optimizedTotalCostRp,
    optimizedAvgKmPerTon: h.optimizedAvgKmPerTon,
    distanceSavedKm: h.distanceSavedKm,
    fuelSavedL: h.fuelSavedL,
    costSavedRp: h.costSavedRp,
    efficiencyGainPct: h.efficiencyGainPct,
    testGroupSize: h.testGroupSize,
    controlGroupSize: h.controlGroupSize,
  }));
}
