import { useEffect, useState } from "react";
import {
  AlertTriangle,
  AlertCircle,
  Info,
  X,
  Bell,
  CheckCircle,
  Clock,
  MapPin,
} from "lucide-react";

interface Alert {
  tpsId: string;
  tpsCode: string;
  tpsName: string;
  timestamp: string;
  currentVolumeKg: number;
  capacityKg: number;
  fillLevel: number;
  inflowRateKgPerHour: number;
  outflowRateKgPerHour: number;
  netRateKgPerHour: number;
  lambda: number;
  overloadProb24h: number;
  overloadProb48h: number;
  overloadProb72h: number;
  estimatedHoursToFull: number;
  estimatedFullAt: string;
  riskLevel: string;
}

const LEVEL_CONFIG: Record<
  string,
  { color: string; bg: string; icon: typeof AlertTriangle; label: string }
> = {
  CRITICAL: {
    color: "#ef4444",
    bg: "rgba(239, 68, 68, 0.15)",
    icon: AlertTriangle,
    label: "Critical",
  },
  HIGH: {
    color: "#f97316",
    bg: "rgba(249, 115, 22, 0.15)",
    icon: AlertCircle,
    label: "High",
  },
  WARNING: {
    color: "#eab308",
    bg: "rgba(234, 179, 8, 0.15)",
    icon: AlertCircle,
    label: "Warning",
  },
  NORMAL: {
    color: "#10b981",
    bg: "rgba(16, 185, 129, 0.15)",
    icon: CheckCircle,
    label: "Normal",
  },
};

export default function AlertPanel() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(new Set());
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await fetch("/api/metrics/overload/critical");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setAlerts(data.data || []);
        setError(null);
      } catch (err) {
        console.error("Alerts fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchAlerts();
    const interval = setInterval(fetchAlerts, 30000);
    return () => clearInterval(interval);
  }, []);

  const dismissAlert = (tpsId: string) => {
    setDismissedAlerts((prev) => new Set([...prev, tpsId]));
  };

  const restoreAlert = (tpsId: string) => {
    setDismissedAlerts((prev) => {
      const next = new Set(prev);
      next.delete(tpsId);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading alerts...
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ textAlign: "center", color: "#ef4444" }}>
          Error: {error}
        </div>
      </div>
    );
  }

  const visibleAlerts = alerts.filter(
    (a) => !dismissedAlerts.has(a.tpsId) && (filter === "all" || a.riskLevel === filter)
  );

  const dismissedCount = dismissedAlerts.size;

  const criticalCount = alerts.filter((a) => a.riskLevel === "CRITICAL").length;
  const highCount = alerts.filter((a) => a.riskLevel === "HIGH").length;
  const warningCount = alerts.filter((a) => a.riskLevel === "WARNING").length;

  return (
    <div className="glass-panel" style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <Bell size={20} />
          <div>
            <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>Active Alerts</h3>
            <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
              Real-time alerts from Spark Streaming pipeline
            </p>
          </div>
        </div>
        <div style={{ display: "flex", gap: "8px", alignItems: "center" }}>
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            style={{
              padding: "6px 12px",
              borderRadius: "6px",
              background: "rgba(255,255,255,0.05)",
              border: "1px solid var(--glass-border)",
              color: "var(--text-primary)",
              fontSize: "12px",
            }}
          >
            <option value="all">All Levels</option>
            <option value="CRITICAL">Critical</option>
            <option value="HIGH">High</option>
            <option value="WARNING">Warning</option>
          </select>
          {criticalCount > 0 && (
            <span
              style={{
                padding: "4px 10px",
                background: "rgba(239, 68, 68, 0.15)",
                color: "#ef4444",
                borderRadius: "12px",
                fontSize: "12px",
                fontWeight: 600,
              }}
            >
              {criticalCount} Critical
            </span>
          )}
          {highCount > 0 && (
            <span
              style={{
                padding: "4px 10px",
                background: "rgba(249, 115, 22, 0.15)",
                color: "#f97316",
                borderRadius: "12px",
                fontSize: "12px",
              }}
            >
              {highCount} High
            </span>
          )}
          {dismissedCount > 0 && (
            <button
              onClick={() => setDismissedAlerts(new Set())}
              style={{
                padding: "4px 10px",
                background: "rgba(255,255,255,0.05)",
                border: "1px solid var(--glass-border)",
                color: "var(--text-secondary)",
                borderRadius: "12px",
                fontSize: "11px",
                cursor: "pointer",
              }}
            >
              Restore {dismissedCount} dismissed
            </button>
          )}
        </div>
      </div>

      {visibleAlerts.length === 0 ? (
        <div
          style={{
            textAlign: "center",
            padding: "40px",
            color: "var(--text-secondary)",
          }}
        >
          {alerts.length === 0 ? (
            <>
              <CheckCircle size={32} color="#10b981" style={{ marginBottom: "12px" }} />
              <div style={{ fontSize: "14px", color: "#10b981" }}>
                All systems normal - No active alerts
              </div>
            </>
          ) : (
            <div style={{ fontSize: "14px" }}>
              No alerts matching current filter
            </div>
          )}
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          {visibleAlerts.map((alert) => {
            const config = LEVEL_CONFIG[alert.riskLevel] || LEVEL_CONFIG.WARNING;
            const IconComponent = config.icon;

            return (
              <div
                key={alert.tpsId}
                style={{
                  padding: "16px",
                  background: config.bg,
                  border: `1px solid ${config.color}40`,
                  borderRadius: "12px",
                  position: "relative",
                }}
              >
                <button
                  onClick={() => dismissAlert(alert.tpsId)}
                  style={{
                    position: "absolute",
                    top: "12px",
                    right: "12px",
                    background: "transparent",
                    border: "none",
                    color: "var(--text-secondary)",
                    cursor: "pointer",
                    padding: "4px",
                  }}
                >
                  <X size={14} />
                </button>

                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "12px",
                  }}
                >
                  <div
                    style={{
                      width: "36px",
                      height: "36px",
                      borderRadius: "8px",
                      background: `${config.color}20`,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      flexShrink: 0,
                    }}
                  >
                    <IconComponent size={18} color={config.color} />
                  </div>

                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: "8px",
                        marginBottom: "8px",
                        flexWrap: "wrap",
                      }}
                    >
                      <span style={{ fontWeight: 600, fontSize: "14px" }}>
                        {alert.tpsName}
                      </span>
                      <span
                        style={{
                          padding: "2px 8px",
                          background: `${config.color}30`,
                          color: config.color,
                          borderRadius: "4px",
                          fontSize: "10px",
                          fontWeight: 600,
                        }}
                      >
                        {config.label}
                      </span>
                    </div>

                    <div
                      style={{
                        fontSize: "12px",
                        color: "var(--text-secondary)",
                        marginBottom: "12px",
                      }}
                    >
                      Overload probability: {alert.overloadProb24h != null ? `${(alert.overloadProb24h * 100).toFixed(1)}%` : "N/A"} | 
                      Estimated full: {alert.estimatedHoursToFull != null ? `${alert.estimatedHoursToFull.toFixed(1)}h` : "N/A"}
                    </div>

                    <div
                      style={{
                        display: "flex",
                        gap: "16px",
                        flexWrap: "wrap",
                        fontSize: "11px",
                      }}
                    >
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Volume:</span>{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {alert.currentVolumeKg != null ? `${(alert.currentVolumeKg / 1000).toFixed(1)} Ton` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Capacity:</span>{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {alert.capacityKg != null ? `${(alert.capacityKg / 1000).toFixed(1)} Ton` : "N/A"}
                        </span>
                      </div>
                      <div>
                        <span style={{ color: "var(--text-secondary)" }}>Fill Level:</span>{" "}
                        <span style={{ color: "var(--text-primary)" }}>
                          {alert.fillLevel != null ? `${(alert.fillLevel * 100).toFixed(1)}%` : "N/A"}
                        </span>
                      </div>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "4px",
                          color: "var(--text-secondary)",
                        }}
                      >
                        <Clock size={10} />
                        {alert.timestamp
                          ? new Date(alert.timestamp).toLocaleTimeString("id-ID", {
                              hour: "2-digit",
                              minute: "2-digit",
                            })
                          : "N/A"}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div
        style={{
          marginTop: "16px",
          padding: "12px",
          background: "rgba(255,255,255,0.03)",
          borderRadius: "8px",
          fontSize: "11px",
          color: "var(--text-secondary)",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "8px",
        }}
      >
        <div>
          Showing {visibleAlerts.length} of {alerts.length} alerts
        </div>
        <div style={{ display: "flex", gap: "12px" }}>
          <span>Critical: {criticalCount}</span>
          <span>High: {highCount}</span>
          <span>Warning: {warningCount}</span>
        </div>
      </div>
    </div>
  );
}
