import { prisma } from "../../config/db.js";
import { logger } from "../../utils/logger.js";
import {
  initKafka,
  publishTpsTelemetryBatch,
  publishWasteGenerationBatch,
  shutdownKafka,
  TpsTelemetryEvent,
  WasteGenerationEvent,
  TOPICS,
  isKafkaConnected,
} from "../metrics/kafka.producer.js";

let intervalId: ReturnType<typeof setInterval> | null = null;
const SIMULATION_INTERVAL_MS = 60000;
let kafkaReady = false;

const WASTE_FRACTIONS = ["ORGANIC", "PLASTIC", "PAPER", "METAL", "RESIDUE"] as const;
const WASTE_COMPOSITION = {
  ORGANIC: 0.52,
  PLASTIC: 0.168,
  PAPER: 0.14,
  METAL: 0.08,
  RESIDUE: 0.05,
};

function randomWasteType(): string {
  const r = Math.random();
  if (r < 0.52) return "ORGANIC";
  if (r < 0.688) return "PLASTIC";
  if (r < 0.828) return "PAPER";
  if (r < 0.908) return "METAL";
  return "RESIDU";
}

function gaussianRandom(mean: number, stdDev: number): number {
  const u1 = Math.random();
  const u2 = Math.random();
  const z0 = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  return z0 * stdDev + mean;
}

async function getEventMultiplier(kecamatan: string, currentTime: Date): Promise<number> {
  const dayOfWeek = currentTime.getDay();
  const month = currentTime.getMonth() + 1;
  const dayOfMonth = currentTime.getDate();

  const events = await prisma.scheduledEvent.findMany({
    where: {
      OR: [
        { month, day: dayOfMonth },
        { dayOfWeek },
      ],
    },
  });

  let maxMultiplier = 1.0;
  for (const event of events) {
    if (event.targetKecamatan === "ALL" || event.targetKecamatan === kecamatan) {
      if (event.volumeMultiplier > maxMultiplier) {
        maxMultiplier = event.volumeMultiplier;
      }
    }
  }
  return maxMultiplier;
}

function calculateDiurnalVolume(currentHour: number, baseVolume: number, eventMultiplier: number): number {
  const offset1 = 6;
  const amplitude = baseVolume * 0.3;
  const surge1 = amplitude * Math.sin((2 * Math.PI * (currentHour - offset1)) / 24);
  
  const offset2 = 17;
  const surge2 = (amplitude * 0.6) * Math.sin((2 * Math.PI * (currentHour - offset2)) / 24);
  
  const noise = gaussianRandom(0, baseVolume * 0.05);
  
  return Math.max(0, (baseVolume + surge1 + surge2 + noise) * eventMultiplier);
}

async function tick() {
  try {
    const all = await prisma.tps.findMany({
      where: { needsReview: false, status: { not: "NONAKTIF" } },
      select: {
        id: true,
        code: true,
        name: true,
        kecamatan: true,
        kelurahan: true,
        capacityKg: true,
        currentVolume: true,
        type: true,
        klasifikasiPengangkutan: true,
        volMasukM3: true,
      },
    });

    if (all.length === 0) return;

    const now = new Date();
    const currentHour = now.getHours();
    const tpsEvents: TpsTelemetryEvent[] = [];
    const wasteGenEvents: WasteGenerationEvent[] = [];
    const kecamatanData: Map<string, { totalGenerated: number; tpsCount: number }> = new Map();

    const updates = [];

    for (const t of all) {
      const capacity = t.capacityKg || 3500;
      const kecamatan = t.kecamatan || "UNKNOWN";
      
      const eventMultiplier = await getEventMultiplier(kecamatan, now);
      
      const baseVolume = capacity * 0.002;
      const volumeChange = calculateDiurnalVolume(currentHour, baseVolume, eventMultiplier);

      let newVol = t.currentVolume + volumeChange;
      if (newVol < 0) newVol = 0;
      if (newVol > capacity * 1.1) newVol = capacity * 1.05;

      const fillLevel = newVol / capacity;
      let newStatus = "AKTIF";
      if (fillLevel >= 0.9) newStatus = "PENUH";
      else if (fillLevel >= 0.7) newStatus = "WASPADA";

      const eventType =
        eventMultiplier > 2.0 ? "EVENT_SPIKE" : "PUBLIC_DISPOSAL";

      tpsEvents.push({
        event_time: now.toISOString(),
        event_type: eventType,
        tps_id: t.id,
        tps_code: t.code,
        tps_name: t.name,
        kecamatan,
        kelurahan: t.kelurahan || null,
        max_capacity_kg: capacity,
        current_load_kg: Math.round(newVol * 100) / 100,
        fill_ratio: Math.round(fillLevel * 1000) / 1000,
        waste_type: randomWasteType(),
        volume_change_kg: Math.round(volumeChange * 100) / 100,
        event_multiplier: eventMultiplier,
      });

      if (!kecamatanData.has(kecamatan)) {
        kecamatanData.set(kecamatan, { totalGenerated: 0, tpsCount: 0 });
      }
      const kd = kecamatanData.get(kecamatan)!;
      kd.totalGenerated += volumeChange;
      kd.tpsCount++;

      updates.push(
        prisma.tps.update({
          where: { id: t.id },
          data: {
            currentVolume: Math.round(newVol * 100) / 100,
            status: newStatus,
          },
        })
      );
    }

    await Promise.all(updates);

    for (const [regionId, data] of kecamatanData) {
      const popDensity = await prisma.regionalPopulationDensity.findUnique({
        where: { regionId },
      });

      const popMultiplier = popDensity?.densityMultiplier || 1.0;
      const dailyWastePerCapita = popDensity?.wasteGenKgPerCapitaPerDay || 0.7;

      for (const fraction of WASTE_FRACTIONS) {
        wasteGenEvents.push({
          event_time: now.toISOString(),
          region_id: regionId,
          region_name: popDensity?.regionName || regionId,
          population_multiplier: popMultiplier,
          generated_volume_kg: Math.round(data.totalGenerated * WASTE_COMPOSITION[fraction] * 100) / 100,
          waste_fraction: fraction,
        });
      }
    }

    if (kafkaReady && isKafkaConnected()) {
      if (tpsEvents.length > 0) {
        publishTpsTelemetryBatch(tpsEvents).catch(() => {});
      }
      if (wasteGenEvents.length > 0) {
        publishWasteGenerationBatch(wasteGenEvents).catch(() => {});
      }
    }

    logger.debug(
      `[TPS-SIM] Updated ${all.length} TPS, ${tpsEvents.length} telemetry events, ${wasteGenEvents.length} generation events`
    );
  } catch (err) {
    logger.error("[TPS-SIM] Simulation tick failed:", err);
  }
}

export async function startTpsSimulation() {
  if (intervalId) return;

  kafkaReady = await initKafka();
  if (kafkaReady) {
    logger.info(`[TPS-SIM] Kafka ready — publishing to topics: ${Object.values(TOPICS).join(", ")}`);
  }

  logger.info("[TPS-SIM] Volume simulation started (every 60s, diurnal pattern + event calendar)");
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
