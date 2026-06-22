import { Kafka, Producer, logLevel } from "kafkajs";
import { logger } from "../../utils/logger.js";

const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

export const TOPICS = {
  WASTE_GENERATION: "topic_waste_generation",
  TPS_TELEMETRY: "topic_tps_telemetry",
  FLEET_GPS: "topic_fleet_gps",
  FACILITY_TELEMETRY: "topic_facility_telemetry",
  WRI_METRICS: "topic_wri_metrics",
  OVERLOAD_PREDICTIONS: "topic_overload_predictions",
} as const;

let producer: Producer | null = null;
let connected = false;

const kafka = new Kafka({
  clientId: "aurora-api",
  brokers: KAFKA_BROKERS,
  logLevel: logLevel.WARN,
  retry: {
    initialRetryTime: 1000,
    retries: 3,
  },
});

export async function initKafka(): Promise<boolean> {
  if (connected) return true;
  try {
    producer = kafka.producer({ allowAutoTopicCreation: true });
    await producer.connect();
    connected = true;
    logger.info(`[KAFKA] Producer connected to ${KAFKA_BROKERS.join(",")}`);
    return true;
  } catch (err) {
    connected = false;
    producer = null;
    logger.warn("[KAFKA] Connection failed — events will not be published");
    logger.debug("[KAFKA] Error:", err);
    return false;
  }
}

export interface WasteGenerationEvent {
  event_time: string;
  region_id: string;
  region_name: string;
  population_multiplier: number;
  generated_volume_kg: number;
  waste_fraction: "ORGANIC" | "PLASTIC" | "PAPER" | "METAL" | "RESIDUE";
}

export interface TpsTelemetryEvent {
  event_time: string;
  event_type: "PUBLIC_DISPOSAL" | "SCHEDULED_COLLECTION" | "TRUCK_COLLECTION" | "EVENT_SPIKE";
  tps_id: string;
  tps_code: string;
  tps_name: string;
  kecamatan: string;
  kelurahan: string | null;
  max_capacity_kg: number;
  current_load_kg: number;
  fill_ratio: number;
  waste_type: string;
  volume_change_kg: number;
  event_multiplier: number;
}

export interface FleetGpsEvent {
  event_time: string;
  truck_id: string;
  truck_code: string;
  truck_type: string;
  lat: number;
  lon: number;
  current_payload_kg: number;
  max_capacity_kg: number;
  operational_status: "IDLE" | "TRANSIT_TO_TPS" | "COLLECTING" | "TRANSIT_TO_FACILITY" | "DUMPING";
  volume_m3: number;
}

export interface FacilityTelemetryEvent {
  event_time: string;
  facility_id: string;
  facility_code: string;
  facility_name: string;
  facility_type: string;
  daily_intake_kg: number;
  daily_capacity_kg: number;
  utilization_rate: number;
  trucks_en_route: number;
  can_accept_more: boolean;
}

export interface WriMetricEvent {
  event_time: string;
  region_id: string;
  region_name: string;
  wri_value: number;
  mu_fill: number;
  delta_v_trend: number;
  rho_density: number;
  alert_status: "NORMAL" | "WARNING" | "CRITICAL";
}

export interface OverloadPredictionEvent {
  event_time: string;
  tps_id: string;
  tps_code: string;
  tps_name: string;
  lambda: number;
  overload_prob_24h: number;
  overload_prob_48h: number;
  overload_prob_72h: number;
  estimated_hours_to_full: number | null;
  risk_level: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

async function publishToTopic(topic: string, key: string, value: object): Promise<void> {
  if (!connected || !producer) return;
  try {
    await producer.send({
      topic,
      messages: [{ key, value: JSON.stringify(value) }],
    });
  } catch (err) {
    logger.debug(`[KAFKA] Failed to send to ${topic}:`, err);
  }
}

async function publishBatchToTopic(topic: string, messages: { key: string; value: object }[]): Promise<void> {
  if (!connected || !producer || messages.length === 0) return;
  try {
    await producer.send({
      topic,
      messages: messages.map((m) => ({ key: m.key, value: JSON.stringify(m.value) })),
    });
  } catch (err) {
    logger.debug(`[KAFKA] Failed to send batch to ${topic}:`, err);
  }
}

export async function publishWasteGeneration(event: WasteGenerationEvent): Promise<void> {
  await publishToTopic(TOPICS.WASTE_GENERATION, event.region_id, event);
}

export async function publishWasteGenerationBatch(events: WasteGenerationEvent[]): Promise<void> {
  await publishBatchToTopic(
    TOPICS.WASTE_GENERATION,
    events.map((e) => ({ key: e.region_id, value: e }))
  );
}

export async function publishTpsTelemetry(event: TpsTelemetryEvent): Promise<void> {
  await publishToTopic(TOPICS.TPS_TELEMETRY, event.tps_code, event);
}

export async function publishTpsTelemetryBatch(events: TpsTelemetryEvent[]): Promise<void> {
  await publishBatchToTopic(
    TOPICS.TPS_TELEMETRY,
    events.map((e) => ({ key: e.tps_code, value: e }))
  );
}

export async function publishFleetGps(event: FleetGpsEvent): Promise<void> {
  await publishToTopic(TOPICS.FLEET_GPS, event.truck_code, event);
}

export async function publishFleetGpsBatch(events: FleetGpsEvent[]): Promise<void> {
  await publishBatchToTopic(
    TOPICS.FLEET_GPS,
    events.map((e) => ({ key: e.truck_code, value: e }))
  );
}

export async function publishFacilityTelemetry(event: FacilityTelemetryEvent): Promise<void> {
  await publishToTopic(TOPICS.FACILITY_TELEMETRY, event.facility_code, event);
}

export async function publishFacilityTelemetryBatch(events: FacilityTelemetryEvent[]): Promise<void> {
  await publishBatchToTopic(
    TOPICS.FACILITY_TELEMETRY,
    events.map((e) => ({ key: e.facility_code, value: e }))
  );
}

export async function publishWriMetric(event: WriMetricEvent): Promise<void> {
  await publishToTopic(TOPICS.WRI_METRICS, event.region_id, event);
}

export async function publishOverloadPrediction(event: OverloadPredictionEvent): Promise<void> {
  await publishToTopic(TOPICS.OVERLOAD_PREDICTIONS, event.tps_code, event);
}

export async function shutdownKafka(): Promise<void> {
  if (producer) {
    try {
      await producer.disconnect();
      logger.info("[KAFKA] Producer disconnected");
    } catch {
      // ignore
    }
  }
  connected = false;
  producer = null;
}

export function isKafkaConnected(): boolean {
  return connected;
}
