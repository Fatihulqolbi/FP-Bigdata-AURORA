import { useEffect, useState, useCallback } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, PieChart, Pie, Cell } from "recharts";
import { TrendingUp } from "lucide-react";
import { MapContainer, TileLayer, Marker, Tooltip, Popup } from "react-leaflet";
import L from "leaflet";
import WeatherCard from "./WeatherCard";
import PredictionTable from "./PredictionTable";
import MetricsDashboard from "../components/MetricsDashboard";
import type { TpsNode, TruckSim } from "./types";
import { monitoringApi, type ServiceStatus, type PipelineStats, type PipelineEvent, type FleetStats } from "../api/monitoringApi";

// Icons
const tpsIcon = new L.DivIcon({
  html: `<div style="background-color: #fde047; width: 8px; height: 8px; border-radius: 50%; border: 1px solid #450a0a;"></div>`,
  className: "tps-marker",
});

const tps3rIcon = new L.DivIcon({
  html: `<div style="background-color: #d946ef; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 5px #d946ef;"></div>`,
  className: "tps3r-marker",
});

const pltsaIcon = new L.DivIcon({
  html: `<div style="background-color: #ef4444; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #ef4444; position: relative;">
           <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; border-radius: 50%; border: 2px solid #ef4444; animation: pulse 2s infinite;"></div>
         </div>`,
  className: "pltsa-marker",
});

const depoIcon = new L.DivIcon({
  html: `<div style="background-color: #f97316; width: 20px; height: 20px; border-radius: 4px; border: 3px solid white; box-shadow: 0 0 10px #f97316;"></div>`,
  className: "depo-marker",
});

const getTruckImageIcon = (type: string, angle: number) => {
  let imgUrl = "/Referensi/3.png";
  if (type === "Arm Roll") imgUrl = "/Referensi/1.png";
  else if (type === "Dump Truck") imgUrl = "/Referensi/2.png";

  return new L.DivIcon({
    html: `<div style="width: 52px; height: 38px; display: flex; align-items: center; justify-content: center;">
             <img src="${imgUrl}" style="width: 48px; height: 34px; object-fit: contain; transform: rotate(${angle + 180}deg); transition: transform 0.5s ease-in-out; filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));" />
           </div>`,
    className: "truck-marker-custom",
    iconSize: [52, 38],
    iconAnchor: [26, 19],
  });
};

const tps3rData = [
  { id: 1, name: "Super Depo Sutorejo", pos: [-7.258200635257379, 112.79463584020006] as [number, number], volume: 1427.46, organik: 620.5, kertas: 85.3, plastik: 91.2, bahanLain: 54.1, jumlahDaurUlang: 230.6, jumlahTerolah: 691.03, residu: 736.43 },
  { id: 2, name: "PDU Jambangan", pos: [-7.317395140750365, 112.7167780349453] as [number, number], volume: 2003.66, organik: 870.2, kertas: 120.4, plastik: 145.3, bahanLain: 78.2, jumlahDaurUlang: 343.9, jumlahTerolah: 1370.41, residu: 633.25 },
  { id: 3, name: "TPS 3R Bratang", pos: [-7.297019176678802, 112.76134199631186] as [number, number], volume: 850.14, organik: 369.3, kertas: 51.2, plastik: 61.8, bahanLain: 33.4, jumlahDaurUlang: 146.4, jumlahTerolah: 470.38, residu: 379.76 },
  { id: 4, name: "TPS 3R Tambak Osowilangun", pos: [-7.218007331729817, 112.66121751615624] as [number, number], volume: 1175.04, organik: 510.2, kertas: 70.5, plastik: 85.1, bahanLain: 46.0, jumlahDaurUlang: 201.6, jumlahTerolah: 466.03, residu: 709.01 },
  { id: 5, name: "TPS 3R Tenggilis", pos: [-7.318604453582783, 112.75122082104238] as [number, number], volume: 614.89, organik: 267.0, kertas: 36.9, plastik: 44.6, bahanLain: 24.1, jumlahDaurUlang: 105.6, jumlahTerolah: 390.44, residu: 224.45 },
  { id: 6, name: "TPS 3R Kedung Cowek", pos: [-7.216586534415317, 112.77885520394545] as [number, number], volume: 675.51, organik: 293.5, kertas: 40.5, plastik: 49.0, bahanLain: 26.5, jumlahDaurUlang: 116.0, jumlahTerolah: 349.17, residu: 326.34 },
  { id: 7, name: "TPS 3R Gunung Anyar", pos: [-7.3318725835281136, 112.81533555332348] as [number, number], volume: 256.99, organik: 111.6, kertas: 15.4, plastik: 18.6, bahanLain: 10.1, jumlahDaurUlang: 44.1, jumlahTerolah: 135.36, residu: 121.63 },
  { id: 8, name: "TPS 3R Karang Pilang", pos: [-7.33967817789591, 112.693680915167] as [number, number], volume: 0, organik: 0, kertas: 0, plastik: 0, bahanLain: 0, jumlahDaurUlang: 0, jumlahTerolah: 0, residu: 0 },
  { id: 9, name: "TPS 3R Waru Gunung", pos: [-7.332807147906473, 112.65990381393213] as [number, number], volume: 2421.12, organik: 1051.7, kertas: 145.3, plastik: 175.5, bahanLain: 94.9, jumlahDaurUlang: 415.7, jumlahTerolah: 1139.32, residu: 1281.80 },
  { id: 10, name: "TPS 3R Banjarsugihan", pos: [-7.255, 112.665] as [number, number], volume: 0, organik: 0, kertas: 0, plastik: 0, bahanLain: 0, jumlahDaurUlang: 0, jumlahTerolah: 0, residu: 0 },
];

const capaianData = [
  { name: "Penanganan Sampah", value: 91.71, color: "#0ea5e9" },
  { name: "Pengurangan Sampah", value: 7.43, color: "#eab308" },
  { name: "Terbuang", value: 0.86, color: "#ef4444" },
];

const jenisSampahData = [
  { name: "Sisa Makanan", value: 55.5, color: "#3b82f6" },
  { name: "Plastik", value: 22.0, color: "#22c55e" },
  { name: "Kayu/Ranting", value: 9.4, color: "#ef4444" },
  { name: "Lainnya", value: 13.1, color: "#8b5cf6" },
];

const sumberSampahData = [
  { name: "Rumah Tangga", value: 85.2, color: "#3b82f6" },
  { name: "Pasar Tradisional", value: 7.2, color: "#f59e0b" },
  { name: "Lainnya", value: 7.6, color: "#8b5cf6" },
];

// Build resource-flow time-series from total TPS volume (in Ton)
function buildResourceFlow(tpsTotalKg: number) {
  const hour = new Date().getHours();
  const slots = [6, 8, 10, 12, 14, 16, 18, 20];
  const baseTons = Math.round(tpsTotalKg / 1000);
  
  return slots.map((slotH) => {
    if (slotH > hour) return { time: `${String(slotH).padStart(2, "0")}:00` };
    
    const hoursSinceStart = Math.max(0, slotH - 6);
    const hoursElapsed = Math.max(1, Math.min(hour - 6, 14));
    const progress = Math.min(1, hoursSinceStart / hoursElapsed);
    
    const tpsVolume = Math.round(baseTons * (0.6 + 0.4 * progress));
    const hubVolume = Math.round(tpsVolume * 0.65);
    const pltsaVolume = Math.round(tpsVolume * 0.45);
    
    return {
      time: `${String(slotH).padStart(2, "0")}:00`,
      tps: tpsVolume,
      hub: hubVolume,
      pltsa: pltsaVolume,
    };
  });
}

// Map service name to single-char icon
function serviceIcon(name: string) {
  if (name.includes("Kafka")) return "K";
  if (name.includes("Spark")) return "S";
  if (name.includes("HDFS")) return "H";
  if (name.includes("OSRM")) return "O";
  if (name.includes("Analytics")) return "A";
  if (name.includes("MongoDB")) return "M";
  return name[0];
}

function relativeTime(iso: string) {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 1000);
  if (diff < 60) return "Just now";
  if (diff < 3600) return `${Math.floor(diff / 60)} min ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

interface RealtimeDashboardProps {
  tpsNodes: TpsNode[];
  trucks: TruckSim[];
  liveTonnage: number;
  showCompactor: boolean;
  showDumpTruck: boolean;
  showArmRoll: boolean;
}

export default function RealtimeDashboard({
  tpsNodes,
  trucks,
  liveTonnage,
  showCompactor,
  showDumpTruck,
  showArmRoll,
}: RealtimeDashboardProps) {
  const filteredTrucks = trucks.filter((truck) => {
    if (truck.type === "Compactor") return showCompactor;
    if (truck.type === "Dump Truck") return showDumpTruck;
    if (truck.type === "Arm Roll") return showArmRoll;
    return true;
  });

  // Live data state
  const [pipelineStatus, setPipelineStatus] = useState<ServiceStatus[]>([]);
  const [pipelineStats, setPipelineStats] = useState<PipelineStats | null>(null);
  const [pipelineEvents, setPipelineEvents] = useState<PipelineEvent[]>([]);
  const [fleetStats, setFleetStats] = useState<FleetStats | null>(null);
  const [lastRefresh, setLastRefresh] = useState<Date>(new Date());

  const fetchLiveData = useCallback(async () => {
    try {
      const [status, stats, events, fleet] = await Promise.allSettled([
        monitoringApi.getPipelineStatus(),
        monitoringApi.getPipelineStats(),
        monitoringApi.getPipelineEvents(8),
        monitoringApi.getFleetStats(),
      ]);
      if (status.status === "fulfilled") setPipelineStatus(status.value);
      if (stats.status === "fulfilled") setPipelineStats(stats.value);
      if (events.status === "fulfilled") setPipelineEvents(events.value);
      if (fleet.status === "fulfilled") setFleetStats(fleet.value);
      setLastRefresh(new Date());
    } catch {
      // silent fail — keep existing data
    }
  }, []);

  useEffect(() => {
    fetchLiveData();
    const interval = setInterval(fetchLiveData, 30000);
    return () => clearInterval(interval);
  }, [fetchLiveData]);

  // Derive truck type pie data from live fleet stats
  const truckTypePie = fleetStats
    ? [
        { name: "Compactor", value: fleetStats.byType["COMPACTOR"]?.total ?? 0, color: "#3b82f6" },
        { name: "Dump Truck", value: fleetStats.byType["DUMP_TRUCK"]?.total ?? 0, color: "#f59e0b" },
        { name: "Arm Roll", value: fleetStats.byType["ARM_ROLL"]?.total ?? 0, color: "#10b981" },
      ]
    : [
        { name: "Compactor", value: 21, color: "#3b82f6" },
        { name: "Dump Truck", value: 30, color: "#f59e0b" },
        { name: "Arm Roll", value: 101, color: "#10b981" },
      ];

  const totalTrucks = fleetStats?.total ?? 152;

  // Resource flow from live volume
  const dataFlow =
    pipelineStats
      ? buildResourceFlow(pipelineStats.volume.current * 1000)
      : buildResourceFlow(0);

  // Activities from pipeline status + recent events
  const liveActivities: { id: string; title: string; time: string; icon: string; status: "success" | "warning" }[] = [
    ...pipelineStatus.map((s) => ({
      id: s.name,
      title: `${s.name}: ${s.status === "online" ? "Online" : s.status === "degraded" ? "Degraded" : "Offline"}`,
      time: relativeTime(s.lastCheck),
      icon: serviceIcon(s.name),
      status: (s.status === "online" ? "success" : "warning") as "success" | "warning",
    })),
    ...pipelineEvents.slice(0, Math.max(0, 4 - pipelineStatus.length)).map((e) => ({
      id: e.details.code + e.timestamp,
      title: `TPS ${e.details.code}: ${e.details.fill}% penuh (${e.details.status})`,
      time: relativeTime(e.timestamp),
      icon: "T",
      status: (e.details.status === "PENUH" ? "warning" : "success") as "success" | "warning",
    })),
  ];

  const activitiesDisplay =
    liveActivities.length > 0
      ? liveActivities
      : [
          { id: "1", title: "Kafka Stream: Menunggu koneksi...", time: "Just now", icon: "K", status: "warning" as const },
          { id: "2", title: "Spark Master: Menunggu koneksi...", time: "Just now", icon: "S", status: "warning" as const },
          { id: "3", title: "HDFS Namenode: Menunggu koneksi...", time: "Just now", icon: "H", status: "warning" as const },
          { id: "4", title: "MongoDB: Menunggu koneksi...", time: "Just now", icon: "M", status: "warning" as const },
        ];

  const kafkaOnline = pipelineStatus.find((s) => s.name.includes("Kafka"))?.status === "online";
  const pipelineOverallStatus = pipelineStatus.length === 0 ? "loading" : kafkaOnline ? "active" : "degraded";

  return (
    <>
      <PredictionTable data={tpsNodes} />

      <div className="stats-grid">
        <WeatherCard />
        <div className="stat-card glass-panel" style={{ padding: "20px" }}>
          <div className="stat-header">
            <span>Total Timbulan Hari Ini</span>
          </div>
          <div className="stat-value" style={{ fontSize: "28px" }}>
            {liveTonnage.toLocaleString()}{" "}
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Ton</span>
          </div>
          <div className="stat-change change-positive" style={{ marginTop: "auto" }}>
            <TrendingUp size={16} /> +2.4% dari kemarin
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: "20px" }}>
          <div className="stat-header">
            <span>Total TPS Tersebar</span>
          </div>
          <div className="stat-value text-gradient" style={{ fontSize: "28px" }}>
            {pipelineStats ? pipelineStats.tps.total : tpsNodes.length}{" "}
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Lokasi</span>
          </div>
          <div className="stat-change" style={{ marginTop: "auto", color: "var(--text-secondary)", fontSize: "13px" }}>
            {pipelineStats
              ? `Kritis: ${pipelineStats.tps.critical} | Aktif: ${pipelineStats.tps.active}`
              : "Surabaya mencakup 10 TPS3R Aktif"}
          </div>
        </div>

        <div className="stat-card glass-panel" style={{ padding: "20px" }}>
          <div className="stat-header">
            <span>Total Truk Aktif (DKRTH)</span>
          </div>
          <div className="stat-value" style={{ fontSize: "28px" }}>
            {totalTrucks}{" "}
            <span style={{ fontSize: "14px", color: "var(--text-secondary)" }}>Unit</span>
          </div>
          <div className="stat-change" style={{ marginTop: "auto", color: "var(--text-secondary)", fontSize: "13px" }}>
            {fleetStats
              ? `Bertugas: ${fleetStats.active} | Tersedia: ${fleetStats.available}`
              : "Arm Roll, Compactor, & Dump Truck"}
          </div>
        </div>
      </div>

      <div className="charts-grid">
        <div className="chart-card glass-panel">
          <div className="chart-title" style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            Resource Flow (TPS → Hub Sortir → PLTSa Benowo)
            {pipelineStats && (
              <span style={{ marginLeft: "auto", fontSize: "11px", color: "var(--text-secondary)" }}>
                Live • {new Date(lastRefresh).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}
              </span>
            )}
          </div>
          <div style={{ height: "300px", width: "100%" }}>
            <ResponsiveContainer width="99%" height="100%">
              <AreaChart data={dataFlow} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorTps" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#f59e0b" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#f59e0b" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorHub" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPltsa" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="time" stroke="var(--text-secondary)" />
                <YAxis stroke="var(--text-secondary)" unit=" Ton" />
                <RechartsTooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-dark)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                  }}
                  formatter={(value: number) => [`${value} Ton`]}
                />
                <Area type="monotone" dataKey="tps" name="TPS (Akumulasi)" stroke="#f59e0b" fillOpacity={1} fill="url(#colorTps)" />
                <Area type="monotone" dataKey="hub" name="Hub Sortir" stroke="#3b82f6" fillOpacity={1} fill="url(#colorHub)" />
                <Area type="monotone" dataKey="pltsa" name="PLTSa Benowo" stroke="#10b981" fillOpacity={1} fill="url(#colorPltsa)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="chart-card glass-panel">
          <div className="chart-title">Armada Pengangkut Sampah (DKRTH 2025)</div>
          <div style={{ height: "220px", width: "100%", display: "flex", justifyContent: "center" }}>
            <ResponsiveContainer width="99%" height="100%">
              <PieChart>
                <Pie
                  data={truckTypePie}
                  cx="50%"
                  cy="50%"
                  innerRadius={38}
                  outerRadius={60}
                  paddingAngle={5}
                  dataKey="value"
                  isAnimationActive={false}
                >
                  {truckTypePie.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <RechartsTooltip
                  contentStyle={{ backgroundColor: "var(--bg-dark)", border: "none", borderRadius: "8px" }}
                  formatter={(value: number, name: string) => [`${value} unit`, name]}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div style={{ display: "flex", justifyContent: "center", marginTop: "16px", gap: "20px", flexWrap: "wrap" }}>
            {truckTypePie.map((item, index) => (
              <div key={index} style={{ textAlign: "center", display: "flex", alignItems: "center", gap: "8px" }}>
                <div style={{ width: "12px", height: "12px", borderRadius: "50%", backgroundColor: item.color }}></div>
                <span style={{ fontSize: "12px", color: "var(--text-primary)" }}>{item.name}: {item.value} unit</span>
              </div>
            ))}
          </div>
          <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-secondary)", marginTop: "16px" }}>
            Total: {totalTrucks} unit | Sumber: Dinas Kebersihan dan Pertamanan, 2025
          </div>
        </div>
      </div>

      <MetricsDashboard />

      <div className="glass-panel" style={{ padding: "24px", marginTop: "24px", marginBottom: "24px" }}>
        <h3 style={{ fontSize: "18px", marginBottom: "4px", color: "var(--text-primary)" }}>
          Data Timbulan & Komposisi Sampah (Surabaya 2024)
        </h3>
        <p style={{ fontSize: "12px", color: "var(--text-secondary)", marginBottom: "20px" }}>
          Sumber: https://sipsn.kemenlh.go.id/, 2025
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "24px" }}>
          <div className="chart-card glass-panel" style={{ background: "rgba(255,255,255,0.02)", padding: "16px" }}>
            <div className="chart-title" style={{ fontSize: "14px", textAlign: "center" }}>Capaian Pengelolaan</div>
            <div style={{ height: "180px" }}>
              <ResponsiveContainer width="99%" height="100%">
                <PieChart>
                  <Pie data={capaianData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                    {capaianData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-dark)", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-primary)", fontWeight: "bold" }}>
              Timbulan Sampah: 660.946 Ton/Tahun
            </div>
          </div>

          <div className="chart-card glass-panel" style={{ background: "rgba(255,255,255,0.02)", padding: "16px" }}>
            <div className="chart-title" style={{ fontSize: "14px", textAlign: "center" }}>Komposisi Berdasarkan Jenis</div>
            <div style={{ height: "180px" }}>
              <ResponsiveContainer width="99%" height="100%">
                <PieChart>
                  <Pie data={jenisSampahData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                    {jenisSampahData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-dark)", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-secondary)" }}>Mayoritas Sisa Makanan (55.5%)</div>
          </div>

          <div className="chart-card glass-panel" style={{ background: "rgba(255,255,255,0.02)", padding: "16px" }}>
            <div className="chart-title" style={{ fontSize: "14px", textAlign: "center" }}>Komposisi Berdasarkan Sumber</div>
            <div style={{ height: "180px" }}>
              <ResponsiveContainer width="99%" height="100%">
                <PieChart>
                  <Pie data={sumberSampahData} cx="50%" cy="50%" outerRadius={55} dataKey="value" label={({ value }) => `${value}%`} labelLine={false} isAnimationActive={false}>
                    {sumberSampahData.map((entry, index) => (<Cell key={`cell-${index}`} fill={entry.color} />))}
                  </Pie>
                  <RechartsTooltip contentStyle={{ backgroundColor: "var(--bg-dark)", border: "none", borderRadius: "8px", fontSize: "12px" }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div style={{ textAlign: "center", fontSize: "12px", color: "var(--text-secondary)" }}>Mayoritas Rumah Tangga (85.2%)</div>
          </div>
        </div>
      </div>

      <div className="charts-grid" style={{ gridTemplateColumns: "1fr 1fr" }}>
        <div className="chart-card glass-panel">
          <div className="chart-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span>Live Data Pipeline (Kafka & Spark)</span>
            <span
              style={{
                fontSize: "12px",
                padding: "2px 8px",
                borderRadius: "10px",
                background:
                  pipelineOverallStatus === "active"
                    ? "rgba(16,185,129,0.15)"
                    : pipelineOverallStatus === "degraded"
                    ? "rgba(245,158,11,0.15)"
                    : "rgba(100,100,100,0.15)",
                color:
                  pipelineOverallStatus === "active"
                    ? "var(--accent-green)"
                    : pipelineOverallStatus === "degraded"
                    ? "#f59e0b"
                    : "var(--text-secondary)",
              }}
            >
              {pipelineOverallStatus === "active" ? "Active" : pipelineOverallStatus === "degraded" ? "Degraded" : "Loading..."}
            </span>
          </div>
          <div className="recent-activity">
            {activitiesDisplay.map((activity) => (
              <div key={activity.id} className="activity-item">
                <div
                  className="activity-icon"
                  style={{
                    background: activity.status === "success" ? "rgba(16, 185, 129, 0.2)" : "rgba(245, 158, 11, 0.2)",
                  }}
                >
                  {activity.icon}
                </div>
                <div className="activity-details">
                  <div className="activity-title">{activity.title}</div>
                  <div className="activity-time">{activity.time}</div>
                </div>
                <div className={`activity-status status-${activity.status}`}>
                  {activity.status === "success" ? "OK" : "Warn"}
                </div>
              </div>
            ))}
          </div>
          {pipelineStats && (
            <div style={{ marginTop: "12px", padding: "10px", background: "rgba(255,255,255,0.03)", borderRadius: "8px", fontSize: "12px", color: "var(--text-secondary)", display: "flex", gap: "16px", flexWrap: "wrap" }}>
              <span>Volume TPS: <b style={{ color: "var(--text-primary)" }}>{pipelineStats.volume.current} Ton</b></span>
              <span>Kapasitas: <b style={{ color: "var(--text-primary)" }}>{pipelineStats.volume.capacity} Ton</b></span>
              <span>Terisi: <b style={{ color: pipelineStats.volume.fillPercent > 70 ? "#ef4444" : "#f59e0b" }}>{pipelineStats.volume.fillPercent}%</b></span>
              <span style={{ marginLeft: "auto" }}>Refresh: {lastRefresh.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}</span>
            </div>
          )}
        </div>

        <div
          className="chart-card glass-panel"
          style={{ padding: "24px 24px 24px 24px", display: "flex", flexDirection: "column" }}
        >
          <div
            className="chart-title"
            style={{ marginBottom: "16px", display: "flex", alignItems: "center", gap: "8px" }}
          >
            Peta Persebaran {pipelineStats ? pipelineStats.tps.total : tpsNodes.length} TPS & 10 TPS3R (Surabaya)
            <span
              className="status-success"
              style={{ fontSize: "12px", padding: "2px 8px", borderRadius: "10px", marginLeft: "auto" }}
            >
              Live Map Tracking
            </span>
          </div>
          <div style={{ display: "flex", gap: "16px", marginBottom: "12px", fontSize: "12px", flexWrap: "wrap" }}>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#ef4444", border: "1px solid white" }}></div> PLTSa Benowo
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "50%", background: "#fde047", border: "1px solid #450a0a" }}></div> TPS ({pipelineStats ? pipelineStats.tps.total : tpsNodes.length})
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#f97316" }}></div> Depo Utama DKP
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#3b82f6" }}></div> Compactor ({truckTypePie[0].value})
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#f59e0b" }}></div> Dump Truck ({truckTypePie[1].value})
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
              <div style={{ width: "10px", height: "10px", borderRadius: "3px", background: "#10b981" }}></div> Arm Roll ({truckTypePie[2].value})
            </div>
          </div>
          <div className="map-container" style={{ padding: 0, border: "none", flex: 1, minHeight: "300px" }}>
            <MapContainer
              center={[-7.2504, 112.7688]}
              zoom={12}
              minZoom={12}
              maxBounds={[
                [-7.3500, 112.5500],
                [-7.1500, 112.8500],
              ]}
              maxBoundsViscosity={1.0}
              style={{ height: "100%", width: "100%", borderRadius: "12px" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              {tpsNodes.map((tps) => (
                <Marker key={`tps-${tps.id}`} position={tps.pos} icon={tpsIcon}>
                  <Tooltip direction="top" offset={L.point(0, -10)} opacity={1}>
                    <div style={{ textAlign: "center" }}>
                      <strong style={{ color: "#000" }}>{tps.tps}</strong>
                      <br />
                      <span style={{ fontSize: "11px", color: "#666" }}>
                        Vol: {tps.volume} / {tps.capacity} Ton
                      </span>
                    </div>
                  </Tooltip>
                </Marker>
              ))}
              {tps3rData.map((tps3r) => (
                <Marker key={`tps3r-${tps3r.id}`} position={tps3r.pos} icon={tps3rIcon}>
                  <Popup>{tps3r.name} - {tps3r.volume} Ton/Hari</Popup>
                </Marker>
              ))}
              <Marker position={[-7.234, 112.620]} icon={pltsaIcon} zIndexOffset={1000}>
                <Tooltip direction="top" offset={L.point(0, -15)} opacity={1} permanent>
                  <div style={{ textAlign: "center" }}>
                    <strong style={{ color: "#ef4444", fontSize: "14px" }}>PLTSa Benowo</strong>
                    <br />
                    <span style={{ fontSize: "11px", color: "#666" }}>Pusat Pengolahan Utama</span>
                  </div>
                </Tooltip>
              </Marker>
              <Marker position={[-7.2528236775706105, 112.70581075397124]} icon={depoIcon} zIndexOffset={900}>
                <Tooltip direction="top" offset={L.point(0, -10)} opacity={1}>
                  <div style={{ textAlign: "center" }}>
                    <strong style={{ color: "#f97316", fontSize: "12px" }}>Depo Utama DKP</strong>
                    <br />
                    <span style={{ fontSize: "10px", color: "#666" }}>Armada & Rute Pengangkutan</span>
                  </div>
                </Tooltip>
              </Marker>
              {filteredTrucks.map((truck) => (
                <Marker key={`truck-${truck.id}`} position={truck.pos} icon={getTruckImageIcon(truck.type, truck.angle)}>
                  <Popup>
                    <div style={{ fontSize: "12px", color: "#000" }}>
                      <strong>Truk {truck.id} ({truck.type})</strong>
                      <br />
                      <span>
                        Status:{" "}
                        {truck.state === "to_tps"
                          ? "Menuju TPS"
                          : truck.state === "to_benowo"
                            ? "Kembali ke Benowo"
                            : "Idle"}
                      </span>
                      <br />
                      <span>Kapasitas: {truck.capacity} Ton</span>
                    </div>
                  </Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </div>
    </>
  );
}
