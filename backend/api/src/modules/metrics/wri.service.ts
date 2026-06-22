import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const WRI_WEIGHTS = {
  alpha: 0.4,
  beta: 0.35,
  gamma: 0.25,
};

const ALERT_THRESHOLDS = {
  CRITICAL: 0.85,
  WARNING: 0.70,
};

export interface WRIResult {
  regionId: string;
  regionName: string;
  timestamp: Date;
  avgFillLevel: number;
  volumeTrend: number;
  populationDensity: number;
  wriValue: number;
  alertStatus: "NORMAL" | "WARNING" | "CRITICAL";
  recommendedAction: string | null;
}

export interface WRIHistoryPoint {
  timestamp: Date;
  wriValue: number;
  alertStatus: string;
}

async function getHistoricalVolume(regionId: string, since: Date): Promise<{ totalVolume: number; count: number } | null> {
  const tpsList = await prisma.tps.findMany({
    where: { kecamatan: regionId, needsReview: false, status: { not: "NONAKTIF" } },
    select: { currentVolume: true, capacityKg: true },
  });

  if (tpsList.length === 0) return null;

  const totalVolume = tpsList.reduce((sum, t) => sum + t.currentVolume, 0);
  return { totalVolume, count: tpsList.length };
}

export async function calculateWRI(regionId: string): Promise<WRIResult | null> {
  const tpsList = await prisma.tps.findMany({
    where: { kecamatan: regionId, needsReview: false, status: { not: "NONAKTIF" } },
    select: {
      id: true,
      code: true,
      name: true,
      currentVolume: true,
      capacityKg: true,
    },
  });

  if (tpsList.length === 0) {
    logger.warn(`[WRI] No TPS found for region: ${regionId}`);
    return null;
  }

  const totalVolume = tpsList.reduce((sum, t) => sum + t.currentVolume, 0);
  const totalCapacity = tpsList.reduce((sum, t) => sum + t.capacityKg, 0);
  const muFill = totalCapacity > 0 ? totalVolume / totalCapacity : 0;

  const sixHoursAgo = new Date(Date.now() - 6 * 60 * 60 * 1000);
  const historical = await getHistoricalVolume(regionId, sixHoursAgo);

  let deltaVTrend = 0;
  if (historical && historical.totalVolume > 0) {
    const previousAvg = historical.totalVolume / historical.count;
    const currentAvg = totalVolume / tpsList.length;
    deltaVTrend = (currentAvg - previousAvg) / previousAvg;
  }

  const popDensity = await prisma.regionalPopulationDensity.findUnique({
    where: { regionId },
  });

  const rhoDensity = popDensity?.densityMultiplier || 1.0;

  const wriValue =
    WRI_WEIGHTS.alpha * muFill +
    WRI_WEIGHTS.beta * Math.abs(deltaVTrend) +
    WRI_WEIGHTS.gamma * rhoDensity;

  let alertStatus: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  let recommendedAction: string | null = null;

  if (wriValue >= ALERT_THRESHOLDS.CRITICAL) {
    alertStatus = "CRITICAL";
    recommendedAction = "Deploy additional fleet immediately. Preemptive collection required.";
  } else if (wriValue >= ALERT_THRESHOLDS.WARNING) {
    alertStatus = "WARNING";
    recommendedAction = "Monitor closely. Consider increasing collection frequency.";
  }

  const result: WRIResult = {
    regionId,
    regionName: popDensity?.regionName || regionId,
    timestamp: new Date(),
    avgFillLevel: Math.round(muFill * 1000) / 1000,
    volumeTrend: Math.round(deltaVTrend * 1000) / 1000,
    populationDensity: rhoDensity,
    wriValue: Math.round(wriValue * 1000) / 1000,
    alertStatus,
    recommendedAction,
  };

  await prisma.wasteRiskIndex.create({
    data: {
      regionId,
      regionName: result.regionName,
      timestamp: result.timestamp,
      avgFillLevel: result.avgFillLevel,
      volumeTrend: result.volumeTrend,
      populationDensity: result.populationDensity,
      wriValue: result.wriValue,
      alpha: WRI_WEIGHTS.alpha,
      beta: WRI_WEIGHTS.beta,
      gamma: WRI_WEIGHTS.gamma,
      alertStatus: result.alertStatus,
      recommendedAction: result.recommendedAction,
    },
  });

  return result;
}

export async function calculateAllWRI(): Promise<WRIResult[]> {
  const regions = await prisma.regionalPopulationDensity.findMany({
    select: { regionId: true },
  });

  const results: WRIResult[] = [];

  for (const region of regions) {
    const result = await calculateWRI(region.regionId);
    if (result) {
      results.push(result);
    }
  }

  logger.info(`[WRI] Calculated WRI for ${results.length} regions`);
  return results;
}

export async function getWRIByRegion(regionId: string): Promise<WRIResult | null> {
  const latest = await prisma.wasteRiskIndex.findFirst({
    where: { regionId },
    orderBy: { timestamp: "desc" },
  });

  if (!latest) {
    return calculateWRI(regionId);
  }

  return {
    regionId: latest.regionId,
    regionName: latest.regionName,
    timestamp: latest.timestamp,
    avgFillLevel: latest.avgFillLevel,
    volumeTrend: latest.volumeTrend,
    populationDensity: latest.populationDensity,
    wriValue: latest.wriValue,
    alertStatus: latest.alertStatus as "NORMAL" | "WARNING" | "CRITICAL",
    recommendedAction: latest.recommendedAction,
  };
}

export async function getWRIHistory(regionId: string, hours: number = 24): Promise<WRIHistoryPoint[]> {
  const since = new Date(Date.now() - hours * 60 * 60 * 1000);

  const history = await prisma.wasteRiskIndex.findMany({
    where: {
      regionId,
      timestamp: { gte: since },
    },
    orderBy: { timestamp: "asc" },
    select: {
      timestamp: true,
      wriValue: true,
      alertStatus: true,
    },
  });

  return history.map((h) => ({
    timestamp: h.timestamp,
    wriValue: h.wriValue,
    alertStatus: h.alertStatus,
  }));
}

export async function getCriticalRegions(): Promise<WRIResult[]> {
  const critical = await prisma.wasteRiskIndex.findMany({
    where: {
      wriValue: { gte: ALERT_THRESHOLDS.WARNING },
    },
    orderBy: { wriValue: "desc" },
    distinct: ["regionId"],
  });

  const latestByRegion = new Map<string, typeof critical[0]>();
  for (const record of critical) {
    if (!latestByRegion.has(record.regionId)) {
      latestByRegion.set(record.regionId, record);
    }
  }

  return Array.from(latestByRegion.values()).map((r) => ({
    regionId: r.regionId,
    regionName: r.regionName,
    timestamp: r.timestamp,
    avgFillLevel: r.avgFillLevel,
    volumeTrend: r.volumeTrend,
    populationDensity: r.populationDensity,
    wriValue: r.wriValue,
    alertStatus: r.alertStatus as "NORMAL" | "WARNING" | "CRITICAL",
    recommendedAction: r.recommendedAction,
  }));
}
