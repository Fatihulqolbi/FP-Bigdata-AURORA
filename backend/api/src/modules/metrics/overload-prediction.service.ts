import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

export interface OverloadPrediction {
  tpsId: string;
  tpsCode: string;
  tpsName: string;
  timestamp: Date;
  currentVolumeKg: number;
  capacityKg: number;
  fillLevel: number;
  inflowRateKgPerHour: number;
  outflowRateKgPerHour: number;
  netRateKgPerHour: number;
  lambda: number;
  overloadProb24h: number;
  overloadProb48h: number;
  overloadProb72h: number;
  estimatedHoursToFull: number | null;
  estimatedFullAt: Date | null;
  riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

const RISK_THRESHOLDS = {
  CRITICAL: 0.8,
  HIGH: 0.5,
  MEDIUM: 0.2,
};

const HISTORY_WINDOW_HOURS = 6;

interface VolumeHistoryPoint {
  timestamp: Date;
  currentVolume: number;
  eventType: string;
}

async function getVolumeHistory(tpsId: string, hours: number): Promise<VolumeHistoryPoint[]> {
  const records = await prisma.wasteRiskIndex.findMany({
    where: {
      regionId: { contains: tpsId },
      timestamp: {
        gte: new Date(Date.now() - hours * 60 * 60 * 1000),
      },
    },
    orderBy: { timestamp: "asc" },
    select: { timestamp: true, avgFillLevel: true },
  });

  return records.map((r) => ({
    timestamp: r.timestamp,
    currentVolume: r.avgFillLevel,
    eventType: "SIMULATED",
  }));
}

async function calculateInflowRate(tpsId: string): Promise<number> {
  const tps = await prisma.tps.findUnique({
    where: { id: tpsId },
    select: { capacityKg: true, type: true, klasifikasiPengangkutan: true },
  });

  if (!tps) return 0;

  const baseRate = tps.capacityKg * 0.02;
  const hourOfDay = new Date().getHours();

  let diurnalMultiplier = 1.0;
  if (hourOfDay >= 6 && hourOfDay <= 8) {
    diurnalMultiplier = 2.5;
  } else if (hourOfDay >= 17 && hourOfDay <= 19) {
    diurnalMultiplier = 2.0;
  } else if (hourOfDay >= 0 && hourOfDay <= 5) {
    diurnalMultiplier = 0.3;
  }

  const typeMultiplier = tps.klasifikasiPengangkutan === "COMPACTOR" ? 1.5 : 1.0;

  return baseRate * diurnalMultiplier * typeMultiplier;
}

async function calculateOutflowRate(tpsId: string): Promise<number> {
  const trucks = await prisma.truck.findMany({
    where: {
      assignedTpsId: tpsId,
      status: { in: ["LOADING", "EN_ROUTE_TO_HUB"] },
    },
    select: { capacityKg: true, currentLoadKg: true },
  });

  if (trucks.length === 0) return 0;

  const avgCollectionTimeHours = 0.5;
  const totalCapacity = trucks.reduce((sum, t) => sum + t.capacityKg, 0);

  return totalCapacity / avgCollectionTimeHours;
}

export async function predictOverload(tpsId: string): Promise<OverloadPrediction | null> {
  const tps = await prisma.tps.findUnique({
    where: { id: tpsId },
    select: {
      id: true,
      code: true,
      name: true,
      currentVolume: true,
      capacityKg: true,
    },
  });

  if (!tps) {
    logger.warn(`[OVERLOAD] TPS not found: ${tpsId}`);
    return null;
  }

  const capacity = tps.capacityKg || 3500;
  const currentVolume = tps.currentVolume;
  const fillLevel = capacity > 0 ? currentVolume / capacity : 0;

  const rIn = await calculateInflowRate(tpsId);
  const rOut = await calculateOutflowRate(tpsId);
  const netRate = rIn - rOut;

  const remainingCapacity = capacity - currentVolume;

  let lambda = 0;
  let overloadProb24h = 0;
  let overloadProb48h = 0;
  let overloadProb72h = 0;
  let estimatedHoursToFull: number | null = null;
  let estimatedFullAt: Date | null = null;

  if (remainingCapacity <= 0) {
    overloadProb24h = 1.0;
    overloadProb48h = 1.0;
    overloadProb72h = 1.0;
    estimatedHoursToFull = 0;
    estimatedFullAt = new Date();
  } else if (netRate > 0) {
    lambda = netRate / remainingCapacity;

    overloadProb24h = 1 - Math.exp(-lambda * 24);
    overloadProb48h = 1 - Math.exp(-lambda * 48);
    overloadProb72h = 1 - Math.exp(-lambda * 72);

    estimatedHoursToFull = remainingCapacity / netRate;
    estimatedFullAt = new Date(Date.now() + estimatedHoursToFull * 60 * 60 * 1000);
  }

  let riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL" = "LOW";
  if (overloadProb24h >= RISK_THRESHOLDS.CRITICAL) {
    riskLevel = "CRITICAL";
  } else if (overloadProb24h >= RISK_THRESHOLDS.HIGH) {
    riskLevel = "HIGH";
  } else if (overloadProb24h >= RISK_THRESHOLDS.MEDIUM) {
    riskLevel = "MEDIUM";
  }

  const result: OverloadPrediction = {
    tpsId: tps.id,
    tpsCode: tps.code,
    tpsName: tps.name,
    timestamp: new Date(),
    currentVolumeKg: Math.round(currentVolume * 100) / 100,
    capacityKg: capacity,
    fillLevel: Math.round(fillLevel * 1000) / 1000,
    inflowRateKgPerHour: Math.round(rIn * 100) / 100,
    outflowRateKgPerHour: Math.round(rOut * 100) / 100,
    netRateKgPerHour: Math.round(netRate * 100) / 100,
    lambda: Math.round(lambda * 1000) / 1000,
    overloadProb24h: Math.round(overloadProb24h * 1000) / 1000,
    overloadProb48h: Math.round(overloadProb48h * 1000) / 1000,
    overloadProb72h: Math.round(overloadProb72h * 1000) / 1000,
    estimatedHoursToFull: estimatedHoursToFull ? Math.round(estimatedHoursToFull * 10) / 10 : null,
    estimatedFullAt,
    riskLevel,
  };

  await prisma.tpsOverloadPrediction.create({
    data: {
      tpsId: result.tpsId,
      tpsCode: result.tpsCode,
      tpsName: result.tpsName,
      timestamp: result.timestamp,
      currentVolumeKg: result.currentVolumeKg,
      capacityKg: result.capacityKg,
      fillLevel: result.fillLevel,
      inflowRateKgPerHour: result.inflowRateKgPerHour,
      outflowRateKgPerHour: result.outflowRateKgPerHour,
      netRateKgPerHour: result.netRateKgPerHour,
      lambda: result.lambda,
      overloadProb24h: result.overloadProb24h,
      overloadProb48h: result.overloadProb48h,
      overloadProb72h: result.overloadProb72h,
      estimatedHoursToFull: result.estimatedHoursToFull,
      estimatedFullAt: result.estimatedFullAt,
      riskLevel: result.riskLevel,
    },
  });

  return result;
}

export async function predictAllOverload(): Promise<OverloadPrediction[]> {
  const tpsList = await prisma.tps.findMany({
    where: { needsReview: false, status: { not: "NONAKTIF" } },
    select: { id: true },
  });

  const results: OverloadPrediction[] = [];

  for (const tps of tpsList) {
    const result = await predictOverload(tps.id);
    if (result) {
      results.push(result);
    }
  }

  logger.info(`[OVERLOAD] Calculated predictions for ${results.length} TPS`);
  return results;
}

export async function getCriticalOverloadPredictions(): Promise<OverloadPrediction[]> {
  const latest = await prisma.tpsOverloadPrediction.findMany({
    where: {
      riskLevel: { in: ["HIGH", "CRITICAL"] },
    },
    orderBy: { timestamp: "desc" },
  });

  const latestByTps = new Map<string, typeof latest[0]>();
  for (const record of latest) {
    if (!latestByTps.has(record.tpsId)) {
      latestByTps.set(record.tpsId, record);
    }
  }

  return Array.from(latestByTps.values())
    .sort((a, b) => b.overloadProb24h - a.overloadProb24h)
    .map((r) => ({
      tpsId: r.tpsId,
      tpsCode: r.tpsCode,
      tpsName: r.tpsName,
      timestamp: r.timestamp,
      currentVolumeKg: r.currentVolumeKg,
      capacityKg: r.capacityKg,
      fillLevel: r.fillLevel,
      inflowRateKgPerHour: r.inflowRateKgPerHour,
      outflowRateKgPerHour: r.outflowRateKgPerHour,
      netRateKgPerHour: r.netRateKgPerHour,
      lambda: r.lambda,
      overloadProb24h: r.overloadProb24h,
      overloadProb48h: r.overloadProb48h,
      overloadProb72h: r.overloadProb72h,
      estimatedHoursToFull: r.estimatedHoursToFull,
      estimatedFullAt: r.estimatedFullAt,
      riskLevel: r.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
    }));
}

export async function getOverloadPredictionByTps(tpsId: string): Promise<OverloadPrediction | null> {
  const latest = await prisma.tpsOverloadPrediction.findFirst({
    where: { tpsId },
    orderBy: { timestamp: "desc" },
  });

  if (!latest) {
    return predictOverload(tpsId);
  }

  return {
    tpsId: latest.tpsId,
    tpsCode: latest.tpsCode,
    tpsName: latest.tpsName,
    timestamp: latest.timestamp,
    currentVolumeKg: latest.currentVolumeKg,
    capacityKg: latest.capacityKg,
    fillLevel: latest.fillLevel,
    inflowRateKgPerHour: latest.inflowRateKgPerHour,
    outflowRateKgPerHour: latest.outflowRateKgPerHour,
    netRateKgPerHour: latest.netRateKgPerHour,
    lambda: latest.lambda,
    overloadProb24h: latest.overloadProb24h,
    overloadProb48h: latest.overloadProb48h,
    overloadProb72h: latest.overloadProb72h,
    estimatedHoursToFull: latest.estimatedHoursToFull,
    estimatedFullAt: latest.estimatedFullAt,
    riskLevel: latest.riskLevel as "LOW" | "MEDIUM" | "HIGH" | "CRITICAL",
  };
}
