import { useState, useEffect, useCallback } from "react";
import {
  CheckCircle, XCircle, AlertTriangle, Radio, MessageSquare,
  Zap, HardDrive, BarChart3, Folder, File, ChevronRight,
  Server, Database, Activity, ArrowRight,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  details: string;
  lastCheck: string;
}

interface PipelineEvent {
  timestamp: string;
  source: string;
  event: string;
  details: any;
}

interface PipelineStats {
  tps: { total: number; active: number; critical: number };
  trucks: { total: number; active: number };
  users: number;
  volume: { current: number; capacity: number; fillPercent: number };
}

const statusIcons: Record<string, typeof CheckCircle> = {
  online: CheckCircle,
  offline: XCircle,
  degraded: AlertTriangle,
};

const statusColors: Record<string, string> = {
  online: "#10b981",
  offline: "#ef4444",
  degraded: "#f59e0b",
};

const serviceIcons: Record<string, typeof Server> = {
  "Kafka Broker": MessageSquare,
  "Spark Master": Zap,
  "HDFS Namenode": HardDrive,
  "OSRM Routing": Radio,
  "Analytics Engine": BarChart3,
  "MongoDB": Database,
};

export default function PipelineDashboard() {
  const [services, setServices] = useState<ServiceStatus[]>([]);
  const [stats, setStats] = useState<PipelineStats | null>(null);
  const [events, setEvents] = useState<PipelineEvent[]>([]);
  const [hdfsFiles, setHdfsFiles] = useState<any[]>([]);
  const [hdfsPath, setHdfsPath] = useState("/aurora");
  const [loading, setLoading] = useState(true);

  const token = localStorage.getItem("aurora_token") || "";
  const headers = { Authorization: `Bearer ${token}` };

  const fetchAll = useCallback(async () => {
    try {
      const [s, st, e] = await Promise.all([
        fetch(`${API_BASE}/pipeline/status`, { headers }).then((r) => r.json()).catch(() => []),
        fetch(`${API_BASE}/pipeline/stats`, { headers }).then((r) => r.json()).catch(() => null),
        fetch(`${API_BASE}/pipeline/events?limit=30`, { headers }).then((r) => r.json()).catch(() => []),
      ]);
      setServices(s);
      setStats(st);
      setEvents(e);
    } catch { /* ignore */ }
    finally { setLoading(false); }
  }, [token]);

  const fetchHDFS = useCallback(async (path: string) => {
    try {
      const res = await fetch(`${API_BASE}/pipeline/hdfs?path=${encodeURIComponent(path)}`, { headers });
      if (res.ok) {
        const files = await res.json();
        setHdfsFiles(files);
        setHdfsPath(path);
      }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchAll(); fetchHDFS("/aurora"); }, [fetchAll, fetchHDFS]);

  useEffect(() => {
    const interval = setInterval(fetchAll, 30000);
    return () => clearInterval(interval);
  }, [fetchAll]);

  const navigateHDFS = (file: any) => {
    if (file.type === "DIRECTORY") {
      fetchHDFS(file.path);
    }
  };

  const pathParts = hdfsPath.split("/").filter(Boolean);

  return (
    <div style={{ animation: "fadeIn 0.4s ease" }}>
      {/* Service Status Cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px", marginBottom: "20px" }}>
        {loading ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="glass-panel" style={{ padding: "14px 16px", height: "80px" }} />
          ))
        ) : services.map((s) => {
          const StatusIcon = statusIcons[s.status] || AlertTriangle;
          const SvcIcon = serviceIcons[s.name] || Server;
          return (
            <div key={s.name} className="glass-panel" style={{
              padding: "14px 16px",
              borderLeft: `3px solid ${statusColors[s.status]}`,
              transition: "all 0.2s",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                <StatusIcon size={16} style={{ color: statusColors[s.status] }} />
                <span style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{s.name}</span>
              </div>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", display: "flex", alignItems: "center", gap: "4px" }}>
                <SvcIcon size={10} />
                {s.details}
              </div>
            </div>
          );
        })}
      </div>

      {/* Data Flow Visualization */}
      <div className="glass-panel" style={{ padding: "24px", marginBottom: "20px" }}>
        <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Alur Data Pipeline</h3>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: "0", flexWrap: "wrap" }}>
          <FlowNode icon={Radio} label="IoT/TPS" desc="Sensor & Input" color="#f59e0b" />
          <FlowArrow />
          <FlowNode icon={MessageSquare} label="Kafka" desc="Message Broker" color="#3b82f6" />
          <FlowArrow />
          <FlowNode icon={Zap} label="Spark" desc="Stream Processing" color="#ef4444" />
          <FlowArrow />
          <FlowNode icon={HardDrive} label="HDFS" desc="Data Lake" color="#10b981" />
          <FlowArrow />
          <FlowNode icon={BarChart3} label="Analytics" desc="API & Dashboard" color="#8b5cf6" />
        </div>
      </div>

      {/* Stats + Events + HDFS */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "20px", marginBottom: "20px" }}>
        {/* Pipeline Stats */}
        {stats && (
          <div className="glass-panel" style={{ padding: "20px" }}>
            <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "16px" }}>Statistik Pipeline</h3>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
              <StatItem label="TPS Aktif" value={stats.tps.active} total={stats.tps.total} color="#10b981" />
              <StatItem label="TPS Kritis" value={stats.tps.critical} total={stats.tps.total} color="#ef4444" />
              <StatItem label="Truk Aktif" value={stats.trucks.active} total={stats.trucks.total} color="#3b82f6" />
              <StatItem label="Volume" value={`${stats.volume.current} ton`} total={`${stats.volume.capacity} ton`} color="#f59e0b" />
              <StatItem label="Fill Level" value={`${stats.volume.fillPercent}%`} total="" color="#8b5cf6" />
              <StatItem label="Total User" value={stats.users} total="" color="#06b6d4" />
            </div>
          </div>
        )}

        {/* HDFS Files with Navigation */}
        <div className="glass-panel" style={{ padding: "20px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "12px" }}>HDFS Data Lake</h3>

          {/* Breadcrumb */}
          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginBottom: "12px", fontSize: "11px", flexWrap: "wrap" }}>
            <button
              onClick={() => fetchHDFS("/aurora")}
              style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "11px", padding: "2px 4px" }}
            >
              /aurora
            </button>
            {pathParts.slice(1).map((part, i) => {
              const path = "/aurora/" + pathParts.slice(1, i + 2).join("/");
              return (
                <span key={i} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <ChevronRight size={10} style={{ color: "var(--text-secondary)" }} />
                  <button
                    onClick={() => fetchHDFS(path)}
                    style={{ background: "none", border: "none", color: "#3b82f6", cursor: "pointer", fontSize: "11px", padding: "2px 4px" }}
                  >
                    {part}
                  </button>
                </span>
              );
            })}
          </div>

          {/* File list */}
          <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
            {hdfsFiles.length === 0 ? (
              <div style={{ padding: "12px", textAlign: "center", color: "var(--text-secondary)", fontSize: "11px" }}>Tidak ada file</div>
            ) : hdfsFiles.map((f, i) => (
              <div
                key={i}
                onClick={() => navigateHDFS(f)}
                style={{
                  display: "flex", alignItems: "center", gap: "8px",
                  padding: "8px 10px", borderRadius: "6px",
                  background: "rgba(255,255,255,0.02)",
                  fontSize: "11px",
                  cursor: f.type === "DIRECTORY" ? "pointer" : "default",
                  transition: "background 0.15s",
                }}
                onMouseEnter={(e) => { if (f.type === "DIRECTORY") e.currentTarget.style.background = "rgba(59,130,246,0.08)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "rgba(255,255,255,0.02)"; }}
              >
                {f.type === "DIRECTORY" ? (
                  <Folder size={14} style={{ color: "#f59e0b", flexShrink: 0 }} />
                ) : (
                  <File size={14} style={{ color: "var(--text-secondary)", flexShrink: 0 }} />
                )}
                <span style={{ flex: 1, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px" }}>{f.name}</span>
                {f.size > 0 && <span style={{ color: "var(--text-secondary)", fontSize: "10px" }}>{formatBytes(f.size)}</span>}
                {f.type === "DIRECTORY" && <ChevronRight size={12} style={{ color: "var(--text-secondary)" }} />}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Live Events */}
      <div className="glass-panel" style={{ padding: "20px" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <h3 style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: "8px" }}>
            <Activity size={16} />
            Live Events
          </h3>
          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{events.length} events</span>
        </div>
        <div className="custom-scrollbar" style={{ maxHeight: "400px", overflowY: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "11px" }}>
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
                <th style={{ padding: "8px 6px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Waktu</th>
                <th style={{ padding: "8px 6px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Sumber</th>
                <th style={{ padding: "8px 6px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Event</th>
                <th style={{ padding: "8px 6px", textAlign: "left", color: "var(--text-secondary)", fontWeight: 600 }}>Detail</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e, i) => (
                <tr key={i} style={{ borderBottom: "1px solid rgba(255,255,255,0.03)" }}>
                  <td style={{ padding: "6px", color: "var(--text-secondary)", fontFamily: "'JetBrains Mono', monospace", fontSize: "10px", whiteSpace: "nowrap" }}>{formatTime(e.timestamp)}</td>
                  <td style={{ padding: "6px" }}>
                    <span style={{ padding: "1px 6px", borderRadius: "3px", fontSize: "9px", fontWeight: 600, background: "rgba(59,130,246,0.15)", color: "#3b82f6" }}>{e.source}</span>
                  </td>
                  <td style={{ padding: "6px", color: "var(--text-primary)" }}>{e.event}</td>
                  <td style={{ padding: "6px", color: "var(--text-secondary)", fontSize: "10px" }}>
                    {e.details && (
                      <span>
                        {e.details.fill !== undefined && <span style={{ color: e.details.fill > 80 ? "#ef4444" : e.details.fill > 60 ? "#f59e0b" : "#10b981" }}>{e.details.fill}%</span>}
                        {e.details.status && <span> · {e.details.status}</span>}
                        {e.details.kecamatan && <span> · {e.details.kecamatan}</span>}
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function FlowNode({ icon: Icon, label, desc, color }: { icon: typeof Radio; label: string; desc: string; color: string }) {
  return (
    <div style={{
      padding: "16px 20px", borderRadius: "12px", textAlign: "center",
      background: `${color}10`, border: `1px solid ${color}30`,
      minWidth: "100px",
    }}>
      <Icon size={24} style={{ color, marginBottom: "6px" }} />
      <div style={{ fontSize: "12px", fontWeight: 700, color: "var(--text-primary)" }}>{label}</div>
      <div style={{ fontSize: "9px", color: "var(--text-secondary)" }}>{desc}</div>
    </div>
  );
}

function FlowArrow() {
  return (
    <ArrowRight size={16} style={{ color: "var(--text-secondary)", opacity: 0.5, margin: "0 8px" }} />
  );
}

function StatItem({ label, value, total, color }: { label: string; value: string | number; total: string | number; color: string }) {
  return (
    <div style={{ padding: "10px", borderRadius: "8px", background: "rgba(255,255,255,0.02)" }}>
      <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>{label}</div>
      <div style={{ fontSize: "16px", fontWeight: 700, color }}>{value}</div>
      {total && <div style={{ fontSize: "9px", color: "var(--text-secondary)" }}>dari {total}</div>}
    </div>
  );
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const k = 1024;
  const sizes = ["B", "KB", "MB", "GB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

function formatTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit", second: "2-digit" });
}
