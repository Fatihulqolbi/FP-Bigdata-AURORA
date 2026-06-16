import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

const ANALYTICS_ENGINE_URL = process.env.ANALYTICS_ENGINE_URL || "http://localhost:4001";

async function fetchFromEngine(endpoint: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${ANALYTICS_ENGINE_URL}${endpoint}`, { signal: controller.signal });
    clearTimeout(timeout);
    if (res.ok) return res.json();
    return null;
  } catch {
    return null;
  }
}

export async function getTpsSummary() {
  // Try analytics engine first
  const fromEngine = await fetchFromEngine("/summary/overview");
  if (fromEngine && !fromEngine.error && fromEngine.status !== "waiting_for_data") {
    return { source: "hdfs", ...fromEngine };
  }

  // Fallback: aggregate from MongoDB
  const all = await prisma.tps.findMany({
    where: { needsReview: false },
  });

  const active = all.filter((t) => t.status !== "NONAKTIF");
  const byKecamatan: Record<string, { total: number; current: number; capacity: number; count: number }> = {};

  for (const t of active) {
    if (!byKecamatan[t.kecamatan]) {
      byKecamatan[t.kecamatan] = { total: 0, current: 0, capacity: 0, count: 0 };
    }
    byKecamatan[t.kecamatan].current += t.currentVolume;
    byKecamatan[t.kecamatan].capacity += t.capacityKg;
    byKecamatan[t.kecamatan].count++;
  }

  return {
    source: "mongodb",
    total_tps: all.length,
    active_tps: active.length,
    needs_review: all.filter((t) => t.needsReview).length,
    critical: active.filter((t) => t.status === "PENUH").length,
    waspada: active.filter((t) => t.status === "WASPADA").length,
    total_capacity_kg: active.reduce((s, t) => s + t.capacityKg, 0),
    total_volume_kg: active.reduce((s, t) => s + t.currentVolume, 0),
    avg_fill_level: active.length > 0
      ? active.reduce((s, t) => s + (t.capacityKg > 0 ? t.currentVolume / t.capacityKg : 0), 0) / active.length
      : 0,
    by_kecamatan: Object.entries(byKecamatan).map(([name, data]) => ({
      kecamatan: name,
      count: data.count,
      current_kg: Math.round(data.current * 100) / 100,
      capacity_kg: Math.round(data.capacity * 100) / 100,
    })),
  };
}

export async function getCriticalTps() {
  const critical = await prisma.tps.findMany({
    where: { status: "PENUH", needsReview: false },
    orderBy: { currentVolume: "desc" },
    take: 20,
  });
  return critical.map((t) => ({
    code: t.code,
    name: t.name,
    kecamatan: t.kecamatan,
    lat: t.lat,
    lng: t.lng,
    fill_level: t.capacityKg > 0 ? Math.round((t.currentVolume / t.capacityKg) * 1000) / 1000 : 0,
    current_kg: Math.round(t.currentVolume * 100) / 100,
    capacity_kg: t.capacityKg,
    status: t.status,
    type: t.type,
  }));
}

export async function getFleetStats() {
  const trucks = await prisma.truck.findMany({ select: { type: true, status: true } });
  const byType: Record<string, { total: number; active: number }> = {};
  for (const t of trucks) {
    if (!byType[t.type]) byType[t.type] = { total: 0, active: 0 };
    byType[t.type].total++;
    if (t.status !== "AVAILABLE") byType[t.type].active++;
  }
  return {
    total: trucks.length,
    active: trucks.filter((t) => t.status !== "AVAILABLE").length,
    available: trucks.filter((t) => t.status === "AVAILABLE").length,
    byType,
  };
}

export async function getWasteTypeDistribution() {
  // Waste type distribution is derived from simulation, stored via Kafka/Spark.
  // Fallback: simulate distribution based on TPS types
  const all = await prisma.tps.findMany({
    where: { needsReview: false, status: { not: "NONAKTIF" } },
  });

  const biasaCount = all.filter((t) => t.type === "TPS_BIASA").length;
  const compactorCount = all.filter((t) => t.type === "COMPACTOR").length;

  // Approximate distribution based on typical Surabaya waste composition
  return {
    source: "simulated",
    data: [
      { waste_type: "ORGANIK", percentage: 52, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.52) },
      { waste_type: "PLASTIK_PET", percentage: 18, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.18) },
      { waste_type: "KERTAS", percentage: 14, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.14) },
      { waste_type: "LOGAM", percentage: 8, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.08) },
      { waste_type: "RESIDU", percentage: 5, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.05) },
      { waste_type: "E_WASTE", percentage: 3, approx_kg: Math.round(all.reduce((s, t) => s + t.currentVolume, 0) * 0.03) },
    ],
    tps_biasa_count: biasaCount,
    tps_compactor_count: compactorCount,
  };
}
