import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

export const TPS_WARNING_THRESHOLD = 0.80;
export const TPS_CRITICAL_THRESHOLD = 0.95;

export interface CriticalTps {
  id: string;
  code: string;
  name: string;
  kecamatan: string;
  lat: number;
  lng: number;
  currentVolume: number;
  capacityKg: number;
  fillPct: number;
  alertLevel: "WARNING" | "CRITICAL";
}

export async function getCriticalTps(): Promise<CriticalTps[]> {
  const tpsList = await prisma.tps.findMany({
    where: {
      needsReview: false,
      status: { not: "NONAKTIF" },
      currentVolume: { gt: 0 },
    },
  });

  const critical = tpsList
    .map((t) => {
      const fillPct = t.capacityKg > 0 ? (t.currentVolume / t.capacityKg) * 100 : 0;
      let alertLevel: "WARNING" | "CRITICAL" | null = null;
      if (fillPct >= TPS_CRITICAL_THRESHOLD * 100) alertLevel = "CRITICAL";
      else if (fillPct >= TPS_WARNING_THRESHOLD * 100) alertLevel = "WARNING";
      return { ...t, fillPct: Math.round(fillPct * 10) / 10, alertLevel };
    })
    .filter((t): t is typeof t & { alertLevel: "WARNING" | "CRITICAL" } => t.alertLevel !== null)
    .sort((a, b) => b.fillPct - a.fillPct)
    .map((t) => ({
      id: t.id,
      code: t.code,
      name: t.name,
      kecamatan: t.kecamatan,
      lat: t.lat,
      lng: t.lng,
      currentVolume: Math.round(t.currentVolume),
      capacityKg: t.capacityKg,
      fillPct: t.fillPct,
      alertLevel: t.alertLevel,
    }));

  return critical;
}

export async function getCriticalTpsCount(): Promise<{ warning: number; critical: number; total: number }> {
  const all = await getCriticalTps();
  const warning = all.filter((t) => t.alertLevel === "WARNING").length;
  const critical = all.filter((t) => t.alertLevel === "CRITICAL").length;
  return { warning, critical, total: all.length };
}