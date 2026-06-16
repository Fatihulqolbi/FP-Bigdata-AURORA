import { prisma } from "../../config/db.js";
import net from "net";

const KAFKA_BROKER = process.env.KAFKA_BROKERS || "localhost:9092";
const ANALYTICS_ENGINE_URL = process.env.ANALYTICS_ENGINE_URL || "http://localhost:4001";
const OSRM_BASE_URL = process.env.OSRM_BASE_URL || "https://router.project-osrm.org";

interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  details: string;
  lastCheck: string;
}

// TCP connection check for Kafka
function checkTcp(host: string, port: number, timeoutMs: number = 3000): Promise<boolean> {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const timer = setTimeout(() => {
      socket.destroy();
      resolve(false);
    }, timeoutMs);

    socket.connect(port, host, () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(true);
    });

    socket.on("error", () => {
      clearTimeout(timer);
      socket.destroy();
      resolve(false);
    });
  });
}

export async function getPipelineStatus(): Promise<ServiceStatus[]> {
  const now = new Date().toISOString();
  const services: ServiceStatus[] = [];

  // Kafka - TCP connection check
  const kafkaHost = KAFKA_BROKER.split(",")[0].split(":")[0];
  const kafkaPort = parseInt(KAFKA_BROKER.split(",")[0].split(":")[1] || "9092");
  const kafkaOk = await checkTcp(kafkaHost, kafkaPort);
  services.push({
    name: "Kafka Broker",
    status: kafkaOk ? "online" : "offline",
    details: KAFKA_BROKER,
    lastCheck: now,
  });

  // Spark Master - HTTP check
  try {
    const sparkRes = await fetch("http://localhost:8080", { signal: AbortSignal.timeout(3000) });
    services.push({ name: "Spark Master", status: sparkRes.ok ? "online" : "degraded", details: "localhost:8080", lastCheck: now });
  } catch {
    services.push({ name: "Spark Master", status: "offline", details: "localhost:8080", lastCheck: now });
  }

  // HDFS Namenode - HTTP check
  try {
    const hdfsRes = await fetch("http://localhost:9870", { signal: AbortSignal.timeout(3000) });
    services.push({ name: "HDFS Namenode", status: hdfsRes.ok ? "online" : "degraded", details: "localhost:9870", lastCheck: now });
  } catch {
    services.push({ name: "HDFS Namenode", status: "offline", details: "localhost:9870", lastCheck: now });
  }

  // OSRM Routing
  try {
    const osrmRes = await fetch(`${OSRM_BASE_URL}/route/v1/driving/112.620,-7.234;112.768,-7.250?overview=false`, { signal: AbortSignal.timeout(5000) });
    services.push({ name: "OSRM Routing", status: osrmRes.ok ? "online" : "degraded", details: OSRM_BASE_URL, lastCheck: now });
  } catch {
    services.push({ name: "OSRM Routing", status: "offline", details: OSRM_BASE_URL, lastCheck: now });
  }

  // Analytics Engine - optional service
  try {
    const analyticsRes = await fetch(`${ANALYTICS_ENGINE_URL}/health`, { signal: AbortSignal.timeout(2000) });
    services.push({ name: "Analytics Engine", status: analyticsRes.ok ? "online" : "degraded", details: ANALYTICS_ENGINE_URL, lastCheck: now });
  } catch {
    services.push({ name: "Analytics Engine", status: "offline", details: `${ANALYTICS_ENGINE_URL} (opsional)`, lastCheck: now });
  }

  // MongoDB
  try {
    await prisma.$runCommandRaw({ ping: 1 });
    services.push({ name: "MongoDB", status: "online", details: "localhost:27017", lastCheck: now });
  } catch {
    services.push({ name: "MongoDB", status: "offline", details: "localhost:27017", lastCheck: now });
  }

  return services;
}

export async function getPipelineStats() {
  const [totalTps, activeTps, criticalTps, totalTrucks, activeTrucks, totalUsers] = await Promise.all([
    prisma.tps.count({ where: { needsReview: false } }),
    prisma.tps.count({ where: { needsReview: false, status: "AKTIF" } }),
    prisma.tps.count({ where: { needsReview: false, status: "PENUH" } }),
    prisma.truck.count(),
    prisma.truck.count({ where: { status: { not: "AVAILABLE" } } }),
    prisma.user.count(),
  ]);

  const totalVolume = await prisma.tps.aggregate({
    where: { needsReview: false },
    _sum: { currentVolume: true, capacityKg: true },
  });

  return {
    tps: { total: totalTps, active: activeTps, critical: criticalTps },
    trucks: { total: totalTrucks, active: activeTrucks },
    users: totalUsers,
    volume: {
      current: Math.round((totalVolume._sum.currentVolume || 0) / 1000 * 10) / 10,
      capacity: Math.round((totalVolume._sum.capacityKg || 0) / 1000 * 10) / 10,
      fillPercent: totalVolume._sum.capacityKg ? Math.round((totalVolume._sum.currentVolume || 0) / totalVolume._sum.capacityKg * 100) : 0,
    },
  };
}

export async function getRecentEvents(limit: number = 50) {
  const tpsList = await prisma.tps.findMany({
    where: { needsReview: false },
    orderBy: { updatedAt: "desc" },
    take: limit,
    select: {
      id: true, code: true, name: true, kecamatan: true,
      currentVolume: true, capacityKg: true, status: true,
      type: true, updatedAt: true,
    },
  });

  return tpsList.map((tps) => ({
    timestamp: tps.updatedAt.toISOString(),
    source: "TPS Simulation",
    event: `Volume update: ${tps.name}`,
    details: {
      code: tps.code,
      kecamatan: tps.kecamatan,
      volume: Math.round(tps.currentVolume),
      capacity: Math.round(tps.capacityKg),
      fill: tps.capacityKg > 0 ? Math.round(tps.currentVolume / tps.capacityKg * 100) : 0,
      status: tps.status,
      type: tps.type,
    },
  }));
}

export async function getHDFSFiles(path: string = "/aurora") {
  try {
    const url = `http://localhost:9870/webhdfs/v1${path}?op=LISTSTATUS&user.name=root`;
    const res = await fetch(url, { signal: AbortSignal.timeout(5000) });
    if (!res.ok) throw new Error(`HDFS WebHDFS returned ${res.status}`);
    const data = await res.json() as any;
    const files = data.FileStatuses?.FileStatus || [];
    return files.map((f: any) => ({
      name: f.pathSuffix,
      path: `${path}/${f.pathSuffix}`.replace(/\/+/g, "/"),
      type: f.type,
      size: f.length || 0,
      modified: new Date(f.modificationTime).toISOString(),
      permission: f.permission,
    }));
  } catch {
    // Return known HDFS structure as fallback
    return [
      { name: "raw", path: "/aurora/raw", type: "DIRECTORY", size: 0, modified: new Date().toISOString(), permission: "777" },
      { name: "aggregated", path: "/aurora/aggregated", type: "DIRECTORY", size: 0, modified: new Date().toISOString(), permission: "777" },
      { name: "checkpoints", path: "/aurora/checkpoints", type: "DIRECTORY", size: 0, modified: new Date().toISOString(), permission: "777" },
    ];
  }
}
