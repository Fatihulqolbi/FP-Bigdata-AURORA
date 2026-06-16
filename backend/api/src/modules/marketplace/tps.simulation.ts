import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import { initKafka, sendTpsVolumeEvents, shutdownKafka, TpsVolumeEvent, TOPIC_TPS_VOLUME } from "./tps.kafka.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
const SIMULATION_INTERVAL_MS = 60000;
let kafkaReady = false;

function randomWasteType(type: string): string {
  // Approximate waste composition per TPS type
  if (type === "COMPACTOR") {
    const r = Math.random();
    if (r < 0.45) return "RESIDU";
    if (r < 0.70) return "PLASTIK_PET";
    if (r < 0.85) return "ORGANIK";
    if (r < 0.95) return "KERTAS";
    return "LOGAM";
  }
  // TPS Biasa
  const r = Math.random();
  if (r < 0.50) return "ORGANIK";
  if (r < 0.75) return "PLASTIK_PET";
  if (r < 0.90) return "KERTAS";
  if (r < 0.97) return "LOGAM";
  return "E_WASTE";
}

async function tick() {
  try {
    const all = await prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" } },
      select: {
        id: true, code: true, name: true, kecamatan: true, kelurahan: true,
        capacityKg: true, currentVolume: true, type: true, schedule: true, status: true,
      },
    });
    if (all.length === 0) return;

    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    const events: TpsVolumeEvent[] = [];

    const updates = all.map((t: any) => {
      const capacity = t.capacityKg || 3500;

      // 1. Public disposal baseline
      const baseRate = t.type === "COMPACTOR" ? 0.0005 : 0.002;
      const baseDelta = Math.random() * baseRate * capacity;
      let volumeChange = baseDelta;

      // 2. Scheduled collection spike
      let hasScheduledSpike = false;
      const schedule = Array.isArray(t.schedule) ? t.schedule : [];
      for (const window of schedule) {
        const [startH, startM] = (window.start || "00:00").split(":").map(Number);
        const [endH, endM] = (window.end || "00:00").split(":").map(Number);
        const start = startH * 60 + startM;
        const end = endH * 60 + endM;
        if (currentTime >= start && currentTime <= end && Math.random() < (window.probability || 0.3)) {
          const minPct = window.weightKgMin || 0.05;
          const maxPct = window.weightKgMax || 0.15;
          volumeChange += (minPct + Math.random() * (maxPct - minPct)) * capacity;
          hasScheduledSpike = true;
        }
      }

      // 3. Collection: if volume > 90% capacity, simulate truck collection (large decrease)
      let eventType: TpsVolumeEvent["event_type"] = hasScheduledSpike ? "SCHEDULED_COLLECTION" : "PUBLIC_DISPOSAL";
      if (t.currentVolume >= capacity * 0.9 && Math.random() < 0.3) {
        const collectedFraction = 0.7 + Math.random() * 0.25; // 70-95% collected
        volumeChange = -t.currentVolume * collectedFraction;
        eventType = "TRUCK_COLLECTION";
      }

      let newVol = t.currentVolume + volumeChange;
      if (newVol < 0) newVol = 0;
      if (newVol > capacity * 1.1) newVol = capacity * 1.05;

      const fillLevel = newVol / capacity;
      let newStatus = "AKTIF";
      if (fillLevel >= 0.9) newStatus = "PENUH";
      else if (fillLevel >= 0.7) newStatus = "WASPADA";

      // Build Kafka event
      events.push({
        timestamp: now.toISOString(),
        event_type: eventType,
        tps_code: t.code,
        tps_name: t.name,
        kecamatan: t.kecamatan,
        kelurahan: t.kelurahan || null,
        type: t.type,
        waste_type: randomWasteType(t.type),
        volume_change_kg: Math.round(volumeChange * 100) / 100,
        current_volume_kg: Math.round(newVol * 100) / 100,
        capacity_kg: capacity,
        fill_level: Math.round(fillLevel * 1000) / 1000,
        tps_status: newStatus,
      });

      return prisma.tps.update({
        where: { id: t.id },
        data: {
          currentVolume: Math.round(newVol * 100) / 100,
          status: newStatus,
        },
      });
    });

    await Promise.all(updates);

    // Publish all events to Kafka
    if (kafkaReady && events.length > 0) {
      sendTpsVolumeEvents(events).catch(() => {});
    }

    logger.debug(`[TPS-SIM] Updated ${all.length} TPS volumes, ${events.length} Kafka events`);
  } catch (err) {
    logger.error("[TPS-SIM] Simulation tick failed:", err);
  }
}

export async function startTpsSimulation() {
  if (intervalId) return;

  // Try to connect to Kafka (non-blocking)
  kafkaReady = await initKafka();
  if (kafkaReady) {
    logger.info(`[TPS-SIM] Kafka ready — publishing to topic ${TOPIC_TPS_VOLUME}`);
  }

  logger.info("[TPS-SIM] Volume simulation started (every 60s)");
  tick();
  intervalId = setInterval(tick, SIMULATION_INTERVAL_MS);
}

export async function stopTpsSimulation() {
  if (intervalId) {
    clearInterval(intervalId);
    intervalId = null;
    logger.info("[TPS-SIM] Volume simulation stopped");
  }
  await shutdownKafka();
}
