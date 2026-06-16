import { Kafka, Producer, logLevel } from "kafkajs";
import { logger } from "../../utils/logger.js";

const TOPIC_TPS_VOLUME = "aurora_tps_volume";
const KAFKA_BROKERS = (process.env.KAFKA_BROKERS || "localhost:9092").split(",");

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

/**
 * Initialize Kafka producer and create topics if needed.
 * Gracefully degrades if Kafka is unavailable.
 */
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
    logger.warn("[KAFKA] Connection failed — TPS events will not be published to Kafka");
    logger.debug("[KAFKA] Error:", err);
    return false;
  }
}

export interface TpsVolumeEvent {
  timestamp: string;
  event_type: "PUBLIC_DISPOSAL" | "SCHEDULED_COLLECTION" | "TRUCK_COLLECTION" | "TRUCK_DELIVERY";
  tps_code: string;
  tps_name: string;
  kecamatan: string;
  kelurahan: string | null;
  type: string;
  waste_type: string;
  volume_change_kg: number;
  current_volume_kg: number;
  capacity_kg: number;
  fill_level: number;
  tps_status: string;
  truck_code?: string;
  facility_code?: string;
}

/**
 * Send a TPS volume event to Kafka.
 * Silently drops if Kafka is not connected.
 */
export async function sendTpsVolumeEvent(event: TpsVolumeEvent): Promise<void> {
  if (!connected || !producer) return;
  try {
    await producer.send({
      topic: TOPIC_TPS_VOLUME,
      messages: [
        {
          key: event.tps_code,
          value: JSON.stringify(event),
        },
      ],
    });
  } catch (err) {
    logger.debug("[KAFKA] Failed to send TPS volume event:", err);
  }
}

/**
 * Batch-send multiple events.
 */
export async function sendTpsVolumeEvents(events: TpsVolumeEvent[]): Promise<void> {
  if (!connected || !producer || events.length === 0) return;
  try {
    const messages = events.map((e) => ({
      key: e.tps_code,
      value: JSON.stringify(e),
    }));
    await producer.send({ topic: TOPIC_TPS_VOLUME, messages });
  } catch (err) {
    logger.debug("[KAFKA] Failed to send batch TPS events:", err);
  }
}

/**
 * Disconnect producer gracefully.
 */
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

export { TOPIC_TPS_VOLUME };
