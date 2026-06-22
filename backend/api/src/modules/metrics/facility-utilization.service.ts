import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

export interface FacilityUtilizationResult {
  facilityId: string;
  facilityCode: string;
  facilityName: string;
  facilityType: string;
  timestamp: Date;
  processed24hKg: number;
  inTransitKg: number;
  dailyCapacityKg: number;
  utilizationRate: number;
  status: "AVAILABLE" | "NEAR_CAPACITY" | "OVERLOADED";
  canAcceptMore: boolean;
  trucksEnRoute: number;
}

const UTILIZATION_THRESHOLDS = {
  OVERLOADED: 95,
  NEAR_CAPACITY: 80,
};

export async function calculateFacilityUtilization(facilityId: string): Promise<FacilityUtilizationResult | null> {
  const facility = await prisma.sortingHub.findUnique({
    where: { id: facilityId },
  });

  if (!facility) {
    logger.warn(`[UTILIZATION] Facility not found: ${facilityId}`);
    return null;
  }

  const trucksEnRoute = await prisma.truck.findMany({
    where: {
      facilityId: facilityId,
      status: { in: ["EN_ROUTE_TO_HUB", "UNLOADING"] },
    },
    select: { currentLoadKg: true },
  });

  const inTransitKg = trucksEnRoute.reduce((sum, t) => sum + (t.currentLoadKg || 0), 0);

  const processed24hKg = facility.dailyIntakeKg || 0;
  const dailyCapacityKg = facility.dailyCapacityKg || 0;

  const utilizationRate = dailyCapacityKg > 0
    ? ((processed24hKg + inTransitKg) / dailyCapacityKg) * 100
    : 0;

  let status: "AVAILABLE" | "NEAR_CAPACITY" | "OVERLOADED" = "AVAILABLE";
  let canAcceptMore = true;

  if (utilizationRate >= UTILIZATION_THRESHOLDS.OVERLOADED) {
    status = "OVERLOADED";
    canAcceptMore = false;
  } else if (utilizationRate >= UTILIZATION_THRESHOLDS.NEAR_CAPACITY) {
    status = "NEAR_CAPACITY";
  }

  const result: FacilityUtilizationResult = {
    facilityId: facility.id,
    facilityCode: facility.code,
    facilityName: facility.name,
    facilityType: facility.type,
    timestamp: new Date(),
    processed24hKg: Math.round(processed24hKg * 100) / 100,
    inTransitKg: Math.round(inTransitKg * 100) / 100,
    dailyCapacityKg,
    utilizationRate: Math.round(utilizationRate * 10) / 10,
    status,
    canAcceptMore,
    trucksEnRoute: trucksEnRoute.length,
  };

  await prisma.facilityUtilization.create({
    data: {
      facilityId: result.facilityId,
      facilityCode: result.facilityCode,
      facilityName: result.facilityName,
      timestamp: result.timestamp,
      processed24hKg: result.processed24hKg,
      inTransitKg: result.inTransitKg,
      dailyCapacityKg: result.dailyCapacityKg,
      utilizationRate: result.utilizationRate,
      status: result.status,
      canAcceptMore: result.canAcceptMore,
      trucksEnRoute: result.trucksEnRoute,
    },
  });

  return result;
}

export async function calculateAllFacilityUtilization(): Promise<FacilityUtilizationResult[]> {
  const facilities = await prisma.sortingHub.findMany({
    select: { id: true },
  });

  const results: FacilityUtilizationResult[] = [];

  for (const facility of facilities) {
    const result = await calculateFacilityUtilization(facility.id);
    if (result) {
      results.push(result);
    }
  }

  logger.info(`[UTILIZATION] Calculated utilization for ${results.length} facilities`);
  return results;
}

export async function getFacilityUtilization(facilityId: string): Promise<FacilityUtilizationResult | null> {
  const latest = await prisma.facilityUtilization.findFirst({
    where: { facilityId },
    orderBy: { timestamp: "desc" },
  });

  if (!latest) {
    return calculateFacilityUtilization(facilityId);
  }

  return {
    facilityId: latest.facilityId,
    facilityCode: latest.facilityCode,
    facilityName: latest.facilityName,
    facilityType: (await prisma.sortingHub.findUnique({ where: { id: facilityId } }))?.type || "UNKNOWN",
    timestamp: latest.timestamp,
    processed24hKg: latest.processed24hKg,
    inTransitKg: latest.inTransitKg,
    dailyCapacityKg: latest.dailyCapacityKg,
    utilizationRate: latest.utilizationRate,
    status: latest.status as "AVAILABLE" | "NEAR_CAPACITY" | "OVERLOADED",
    canAcceptMore: latest.canAcceptMore,
    trucksEnRoute: latest.trucksEnRoute,
  };
}

export async function getAllFacilityUtilization(): Promise<FacilityUtilizationResult[]> {
  const facilities = await prisma.sortingHub.findMany({
    select: { id: true, code: true, name: true, type: true },
  });

  const results: FacilityUtilizationResult[] = [];

  for (const facility of facilities) {
    const latest = await prisma.facilityUtilization.findFirst({
      where: { facilityId: facility.id },
      orderBy: { timestamp: "desc" },
    });

    if (latest) {
      results.push({
        facilityId: latest.facilityId,
        facilityCode: latest.facilityCode,
        facilityName: latest.facilityName,
        facilityType: facility.type,
        timestamp: latest.timestamp,
        processed24hKg: latest.processed24hKg,
        inTransitKg: latest.inTransitKg,
        dailyCapacityKg: latest.dailyCapacityKg,
        utilizationRate: latest.utilizationRate,
        status: latest.status as "AVAILABLE" | "NEAR_CAPACITY" | "OVERLOADED",
        canAcceptMore: latest.canAcceptMore,
        trucksEnRoute: latest.trucksEnRoute,
      });
    } else {
      // Calculate on-demand if no historical data exists
      const calculated = await calculateFacilityUtilization(facility.id);
      if (calculated) {
        results.push(calculated);
      }
    }
  }

  return results;
}

export async function getOverloadedFacilities(): Promise<FacilityUtilizationResult[]> {
  const all = await getAllFacilityUtilization();
  return all.filter((f) => f.status === "OVERLOADED" || f.status === "NEAR_CAPACITY");
}

export async function canFacilityAcceptLoad(facilityId: string, additionalKg: number): Promise<boolean> {
  const utilization = await getFacilityUtilization(facilityId);

  if (!utilization) return false;
  if (!utilization.canAcceptMore) return false;

  const projectedUtilization = utilization.dailyCapacityKg > 0
    ? ((utilization.processed24hKg + utilization.inTransitKg + additionalKg) / utilization.dailyCapacityKg) * 100
    : 0;

  return projectedUtilization < 120;
}

export async function getFacilityUtilizationHistory(facilityId: string, hours: number = 24): Promise<{
  timestamp: Date;
  utilizationRate: number;
  status: string;
}[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const history = await prisma.facilityUtilization.findMany({
    where: {
      facilityId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      utilizationRate: true,
      status: true,
    },
  });

  return history.map((h) => ({
    timestamp: h.timestamp,
    utilizationRate: h.utilizationRate,
    status: h.status,
  }));
}
