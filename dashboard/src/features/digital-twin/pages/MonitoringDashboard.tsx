import { useState, useEffect } from "react";
import { Activity, MapPin, Truck, Server } from "lucide-react";
import { tps as tpsApi } from "../../marketplace/api/marketplaceApi";

interface TpsRecord {
  id: string;
  code: string;
  name: string;
  kecamatan: string;
  lat: number;
  lng: number;
  capacityKg: number;
  currentVolume: number;
  status: string;
  type: string;
  needsReview: boolean;
}

export default function MonitoringDashboard() {
  const [records, setRecords] = useState<TpsRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const res = await tpsApi.list({ limit: "300" });
        setRecords(res.tps || []);
      } catch {
        // ignore
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const active = records.filter((r) => !r.needsReview && r.status !== "NONAKTIF");
  const critical = active.filter((r) => r.status === "PENUH" || r.status === "WASPADA");
  const full = active.filter((r) => r.status === "PENUH");

  return (
    <div style={{ animation: "fadeIn 0.5s ease-in-out", display: "flex", flexDirection: "column", gap: "20px" }}>
      <h2 style={{ fontSize: "22px", color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: "10px" }}>
        <Activity size={22} /> Monitoring TPS Real-time
      </h2>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: "12px" }}>
        <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>TPS Aktif</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "var(--text-primary)" }}>{active.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Waspada</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#f59e0b" }}>{critical.length - full.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Penuh</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#ef4444" }}>{full.length}</div>
        </div>
        <div className="glass-panel" style={{ padding: "16px", textAlign: "center" }}>
          <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>Butuh Review</div>
          <div style={{ fontSize: "26px", fontWeight: 700, color: "#6b7280" }}>{records.filter((r) => r.needsReview).length}</div>
        </div>
      </div>

      <div className="glass-panel" style={{ padding: "24px", textAlign: "center" }}>
        <Server size={40} style={{ opacity: 0.3, marginBottom: "12px" }} />
        <p style={{ color: "var(--text-primary)", fontWeight: 600, margin: "0 0 8px" }}>Dashboard Monitoring Lengkap</p>
        <p style={{ fontSize: "13px", color: "var(--text-secondary)", margin: 0, maxWidth: "600px", marginInline: "auto" }}>
          Integrasi Kafka + Spark + HDFS akan tersedia di tahap berikutnya.
          Saat ini data TPS diperbarui setiap 60 detik melalui simulasi real-time.
        </p>
        <div style={{ display: "flex", gap: "12px", justifyContent: "center", marginTop: "16px", flexWrap: "wrap" }}>
          <span style={{ padding: "6px 12px", borderRadius: "20px", background: "rgba(16,185,129,0.1)", color: "#10b981", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            <MapPin size={12} /> 126 TPS tersedia
          </span>
          <span style={{ padding: "6px 12px", borderRadius: "20px", background: "rgba(59,130,246,0.1)", color: "#3b82f6", fontSize: "12px", display: "flex", alignItems: "center", gap: "4px" }}>
            <Truck size={12} /> 152 Armada tersedia
          </span>
        </div>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "20px", color: "var(--text-secondary)" }}>Memuat data monitoring...</div>
      )}
    </div>
  );
}
