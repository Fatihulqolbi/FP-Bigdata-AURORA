import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
const SIMULATION_INTERVAL_MS = 30000; // every 30 seconds

/**
 * Simulates incoming waste data for all TPS (mimics Kafka consumer).
 * Updates currentVolume with smooth random walk constrained by capacity.
 */
async function tick() {
  try {
    const all = await prisma.tps.findMany({ select: { id: true, capacity: true, currentVolume: true } });
    if (all.length === 0) return;

    const updates = all.map((t: { id: string; capacity: number; currentVolume: number }) => {
      const delta = (Math.random() - 0.45) * t.capacity * 0.05; // slight upward bias
      let newVol = t.currentVolume + delta;
      if (newVol < 0) newVol = 0;
      if (newVol > t.capacity * 1.1) newVol = t.capacity * 1.05;
      const newStatus = newVol >= t.capacity * 0.9 ? "PENUH" : newVol >= t.capacity * 0.7 ? "WASPADA" : "AKTIF";
      return prisma.tps.update({
        where: { id: t.id },
        data: { currentVolume: Math.round(newVol * 100) / 100, status: newStatus },
      });
    });

    await Promise.all(updates);
    logger.debug(`[TPS-SIM] Updated ${all.length} TPS volumes`);
  } catch (err) {
    logger.error("[TPS-SIM] Simulation tick failed:", err);
  }
}

export function startTpsSimulation() {
  if (intervalId) return;
  logger.info("[TPS-SIM] Volume simulation started (every 30s)");
  tick(); // initial tick
  intervalId = setInterval(tick, SIMULATION_INTERVAL_MS);
}

export function stopTpsSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[TPS-SIM] Volume simulation stopped");
  }
}
