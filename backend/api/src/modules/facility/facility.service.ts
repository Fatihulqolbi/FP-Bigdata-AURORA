import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

// Alert thresholds
export const WARNING_THRESHOLD = 0.80;
export const CRITICAL_THRESHOLD = 0.95;

export interface FacilityWithProgress {
  id: string;
  code: string;
  name: string;
  type: string;
  kecamatan: string | null;
  lat: number;
  lng: number;
  capacityKg: number;
  currentLoadKg: number;
  dailyCapacityKg: number | null;
  dailyIntakeKg: number;
  intakePct: number | null;
  loadPct: number;
  alertStatus: "NORMAL" | "WARNING" | "CRITICAL";
  acceptsTypes: string[];
}

function computeFacilityProgress(f: {
  id: string;
  code: string;
  name: string;
  type: string;
  kecamatan: string | null;
  lat: number;
  lng: number;
  capacityKg: number;
  currentLoadKg: number;
  dailyCapacityKg: number | null;
  dailyIntakeKg: number;
  acceptsTypes: string[];
}): FacilityWithProgress {
  const loadPct = f.capacityKg > 0 ? (f.currentLoadKg / f.capacityKg) * 100 : 0;
  const intakePct = f.dailyCapacityKg != null && f.dailyCapacityKg > 0
    ? (f.dailyIntakeKg / f.dailyCapacityKg) * 100
    : null;

  let alertStatus: "NORMAL" | "WARNING" | "CRITICAL" = "NORMAL";
  if (intakePct != null) {
    if (intakePct >= CRITICAL_THRESHOLD * 100) alertStatus = "CRITICAL";
    else if (intakePct >= WARNING_THRESHOLD * 100) alertStatus = "WARNING";
  }

  return {
    id: f.id,
    code: f.code,
    name: f.name,
    type: f.type,
    kecamatan: f.kecamatan,
    lat: f.lat,
    lng: f.lng,
    capacityKg: f.capacityKg,
    currentLoadKg: f.currentLoadKg,
    dailyCapacityKg: f.dailyCapacityKg,
    dailyIntakeKg: f.dailyIntakeKg,
    intakePct: intakePct != null ? Math.round(intakePct * 10) / 10 : null,
    loadPct: Math.round(loadPct * 10) / 10,
    alertStatus,
    acceptsTypes: f.acceptsTypes,
  };
}

export async function getAllFacilities(): Promise<FacilityWithProgress[]> {
  const facilities = await prisma.sortingHub.findMany({
    orderBy: [{ type: "asc" }, { name: "asc" }],
  });
  return facilities.map(computeFacilityProgress);
}

export async function getFacilityById(id: string): Promise<FacilityWithProgress | null> {
  const f = await prisma.sortingHub.findUnique({ where: { id } });
  if (!f) return null;
  return computeFacilityProgress(f);
}

export async function updateDailyCapacity(
  id: string,
  dailyCapacityKg: number | null
): Promise<FacilityWithProgress> {
  const existing = await prisma.sortingHub.findUnique({ where: { id } });
  if (!existing) throw new Error("Facility not found");

  if (dailyCapacityKg !== null && dailyCapacityKg < 0) {
    throw new Error("dailyCapacityKg must be >= 0 or null (unlimited)");
  }

  const updated = await prisma.sortingHub.update({
    where: { id },
    data: { dailyCapacityKg },
  });

  logger.info(`[FACILITY] ${updated.name} dailyCapacityKg set to ${dailyCapacityKg ?? "unlimited"} by admin`);
  return computeFacilityProgress(updated);
}

export async function resetIntake(id: string): Promise<FacilityWithProgress> {
  const existing = await prisma.sortingHub.findUnique({ where: { id } });
  if (!existing) throw new Error("Facility not found");

  const updated = await prisma.sortingHub.update({
    where: { id },
    data: {
      dailyIntakeKg: 0,
      lastIntakeReset: new Date(),
    },
  });

  logger.info(`[FACILITY] ${updated.name} dailyIntakeKg reset to 0 by admin`);
  return computeFacilityProgress(updated);
}

export async function addIntake(id: string, amountKg: number): Promise<FacilityWithProgress | null> {
  if (amountKg <= 0) return null;

  const existing = await prisma.sortingHub.findUnique({ where: { id } });
  if (!existing) return null;

  const newIntake = (existing.dailyIntakeKg || 0) + amountKg;
  const newLoad = existing.currentLoadKg + amountKg;

  const updated = await prisma.sortingHub.update({
    where: { id },
    data: {
      dailyIntakeKg: newIntake,
      currentLoadKg: newLoad,
    },
  });

  const progress = computeFacilityProgress(updated);
  if (progress.alertStatus === "CRITICAL") {
    logger.warn(`[FACILITY] ${updated.name} reached CRITICAL intake: ${progress.intakePct}%`);
  } else if (progress.alertStatus === "WARNING") {
    logger.warn(`[FACILITY] ${updated.name} reached WARNING intake: ${progress.intakePct}%`);
  }

  return progress;
}

export interface FacilityAlert {
  id: string;
  code: string;
  name: string;
  type: string;
  intakePct: number | null;
  alertStatus: "WARNING" | "CRITICAL";
  dailyCapacityKg: number | null;
  dailyIntakeKg: number;
}

export async function getFacilityAlerts(): Promise<FacilityAlert[]> {
  const facilities = await getAllFacilities();
  return facilities
    .filter((f) => f.alertStatus === "WARNING" || f.alertStatus === "CRITICAL")
    .map((f) => ({
      id: f.id,
      code: f.code,
      name: f.name,
      type: f.type,
      intakePct: f.intakePct,
      alertStatus: f.alertStatus as "WARNING" | "CRITICAL",
      dailyCapacityKg: f.dailyCapacityKg,
      dailyIntakeKg: f.dailyIntakeKg,
    }));
}

export async function isFacilityAvailable(id: string): Promise<boolean> {
  const f = await prisma.sortingHub.findUnique({ where: { id } });
  if (!f) return false;
  if (f.type === "PLTSa") return true;
  if (f.dailyCapacityKg == null) return true;
  const intake = f.dailyIntakeKg || 0;
  return intake < f.dailyCapacityKg * 1.2;
}