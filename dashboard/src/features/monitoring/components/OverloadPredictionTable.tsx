import { useEffect, useState } from "react";
import { AlertTriangle, Clock, ChevronDown, ChevronUp } from "lucide-react";

interface OverloadPrediction {
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

const ALERT_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  HIGH: "#f97316",
  MODERATE: "#eab308",
  LOW: "#3b82f6",
  MINIMAL: "#10b981",
};

const OVERLOAD_THRESHOLDS = {
  CRITICAL: 0.80,
  HIGH: 0.50,
  MODERATE: 0.30,
  LOW: 0.15,
};

export default function OverloadPredictionTable() {
  const [predictions, setPredictions] = useState<OverloadPrediction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<keyof OverloadPrediction>("overloadProb24h");
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState<string>("all");

  useEffect(() => {
    const fetchPredictions = async () => {
      try {
        const res = await fetch("/api/metrics/overload/all");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setPredictions(data.data || []);
        setError(null);
      } catch (err) {
        console.error("Overload fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchPredictions();
    const interval = setInterval(fetchPredictions, 60000);
    return () => clearInterval(interval);
  }, []);

  const handleSort = (key: keyof OverloadPrediction) => {
    if (sortBy === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortBy(key);
      setSortAsc(false);
    }
  };

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading overload predictions...
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

  const filteredData = predictions.filter((p) => {
    if (filter === "all") return true;
    if (filter === "critical") return p.riskLevel === "CRITICAL";
    if (filter === "high") return p.riskLevel === "CRITICAL" || p.riskLevel === "HIGH";
    return p.riskLevel === filter;
  });

  const sortedData = [...filteredData].sort((a, b) => {
    const aVal = a[sortBy];
    const bVal = b[sortBy];
    if (typeof aVal === "number" && typeof bVal === "number") {
      return sortAsc ? aVal - bVal : bVal - aVal;
    }
    if (typeof aVal === "string" && typeof bVal === "string") {
      return sortAsc ? aVal.localeCompare(bVal) : bVal.localeCompare(aVal);
    }
    return 0;
  }).slice(0, 20);

  const criticalCount = predictions.filter((p) => p.riskLevel === "CRITICAL").length;
  const highCount = predictions.filter((p) => p.riskLevel === "HIGH").length;

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
        <div>
          <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
            Overload Prediction
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            P(t) = 1 - e^(-λt), λ = (R_in - R_out) / (C_max - V_current)
          </p>
        </div>
        <div style={{ display: "flex", gap: "12px", alignItems: "center" }}>
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
            <option value="critical">Critical Only</option>
            <option value="high">Critical & High</option>
            <option value="moderate">Moderate</option>
          </select>
          {criticalCount > 0 && (
            <div
              style={{
                padding: "4px 10px",
                background: "rgba(239, 68, 68, 0.15)",
                borderRadius: "12px",
                fontSize: "11px",
                color: "#ef4444",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <AlertTriangle size={12} />
              {criticalCount} Critical
            </div>
          )}
          {highCount > 0 && (
            <div
              style={{
                padding: "4px 10px",
                background: "rgba(249, 115, 22, 0.15)",
                borderRadius: "12px",
                fontSize: "11px",
                color: "#f97316",
              }}
            >
              {highCount} High
            </div>
          )}
        </div>
      </div>

      <div style={{ overflowX: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "12px" }}>
          <thead>
            <tr style={{ borderBottom: "1px solid var(--glass-border)" }}>
              <th
                style={{ padding: "10px 8px", textAlign: "left", cursor: "pointer" }}
                onClick={() => handleSort("tpsName")}
              >
                TPS {sortBy === "tpsName" && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </th>
              <th style={{ padding: "10px 8px", textAlign: "right" }}>Fill %</th>
              <th
                style={{ padding: "10px 8px", textAlign: "right", cursor: "pointer" }}
                onClick={() => handleSort("estimatedHoursToFull")}
              >
                Hours to Full {sortBy === "estimatedHoursToFull" && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </th>
              <th
                style={{ padding: "10px 8px", textAlign: "right", cursor: "pointer" }}
                onClick={() => handleSort("overloadProb24h")}
              >
                P(24h) {sortBy === "overloadProb24h" && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </th>
              <th
                style={{ padding: "10px 8px", textAlign: "center", cursor: "pointer" }}
                onClick={() => handleSort("riskLevel")}
              >
                Level {sortBy === "riskLevel" && (sortAsc ? <ChevronUp size={12} /> : <ChevronDown size={12} />)}
              </th>
            </tr>
          </thead>
          <tbody>
            {sortedData.map((pred, index) => (
              <tr
                key={pred.tpsId || index}
                style={{
                  borderBottom: "1px solid rgba(255,255,255,0.05)",
                  background:
                    pred.riskLevel === "CRITICAL"
                      ? "rgba(239, 68, 68, 0.05)"
                      : pred.riskLevel === "HIGH"
                      ? "rgba(249, 115, 22, 0.05)"
                      : "transparent",
                }}
              >
                <td style={{ padding: "10px 8px", fontWeight: 500 }}>{pred.tpsName}</td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                  {pred.fillLevel != null ? `${(pred.fillLevel * 100).toFixed(1)}%` : "N/A"}
                </td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "flex-end", gap: "4px" }}>
                    <Clock size={12} />
                    {pred.estimatedHoursToFull != null && pred.estimatedHoursToFull < 999
                      ? `${pred.estimatedHoursToFull.toFixed(1)}h`
                      : "N/A"}
                  </div>
                </td>
                <td style={{ padding: "10px 8px", textAlign: "right" }}>
                  <span
                    style={{
                      color:
                        pred.overloadProb24h >= OVERLOAD_THRESHOLDS.CRITICAL
                          ? ALERT_COLORS.CRITICAL
                          : pred.overloadProb24h >= OVERLOAD_THRESHOLDS.HIGH
                          ? ALERT_COLORS.HIGH
                          : "var(--text-primary)",
                      fontWeight: pred.overloadProb24h >= OVERLOAD_THRESHOLDS.HIGH ? 600 : 400,
                    }}
                  >
                    {pred.overloadProb24h != null ? `${(pred.overloadProb24h * 100).toFixed(1)}%` : "N/A"}
                  </span>
                </td>
                <td style={{ padding: "10px 8px", textAlign: "center" }}>
                  <span
                    style={{
                      padding: "4px 8px",
                      borderRadius: "4px",
                      background: `${ALERT_COLORS[pred.riskLevel] || ALERT_COLORS.LOW}20`,
                      color: ALERT_COLORS[pred.riskLevel] || ALERT_COLORS.LOW,
                      fontSize: "11px",
                      fontWeight: 600,
                    }}
                  >
                    {pred.riskLevel}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {sortedData.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px", color: "var(--text-secondary)" }}>
          No predictions available
        </div>
      )}
    </div>
  );
}
