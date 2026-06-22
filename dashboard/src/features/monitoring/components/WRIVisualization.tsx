import { useEffect, useState } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from "recharts";
import { AlertTriangle, TrendingUp, TrendingDown } from "lucide-react";

interface WRIData {
  regionId: string;
  regionName: string;
  timestamp: string;
  avgFillLevel: number;
  volumeTrend: number;
  populationDensity: number;
  wriValue: number;
  alertStatus: string;
  recommendedAction: string | null;
}

const WRI_COLORS: Record<string, string> = {
  CRITICAL: "#ef4444",
  WARNING: "#f59e0b",
  ELEVATED: "#3b82f6",
  NORMAL: "#10b981",
};

export default function WRIVisualization() {
  const [wriData, setWriData] = useState<WRIData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchWRI = async () => {
      try {
        const res = await fetch("/api/metrics/wri/all");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setWriData(data.data || []);
        setError(null);
      } catch (err) {
        console.error("WRI fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchWRI();
    const interval = setInterval(fetchWRI, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading WRI data...
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

  const sortedData = [...wriData].sort((a, b) => b.wriValue - a.wriValue);
  const criticalRegions = sortedData.filter((d) => d.alertStatus === "CRITICAL");
  const warningRegions = sortedData.filter((d) => d.alertStatus === "WARNING");
  const avgWRI =
    wriData.length > 0
      ? wriData.reduce((sum, d) => sum + d.wriValue, 0) / wriData.length
      : 0;

  return (
    <div className="glass-panel" style={{ padding: "24px" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "20px",
        }}
      >
        <div>
          <h3 style={{ fontSize: "18px", marginBottom: "4px" }}>
            Waste Risk Index (WRI)
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            WRI = 0.4×μ_fill + 0.35×|ΔV| + 0.25×ρ_density
          </p>
        </div>
        <div style={{ textAlign: "right" }}>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              color:
                avgWRI >= 0.85
                  ? WRI_COLORS.CRITICAL
                  : avgWRI >= 0.70
                  ? WRI_COLORS.WARNING
                  : avgWRI >= 0.50
                  ? WRI_COLORS.ELEVATED
                  : WRI_COLORS.NORMAL,
            }}
          >
            {avgWRI.toFixed(3)}
          </div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Avg WRI Score
          </div>
        </div>
      </div>

      {(criticalRegions.length > 0 || warningRegions.length > 0) && (
        <div
          style={{
            display: "flex",
            gap: "12px",
            marginBottom: "20px",
            flexWrap: "wrap",
          }}
        >
          {criticalRegions.map((r) => (
            <div
              key={r.regionId}
              style={{
                padding: "8px 12px",
                background: "rgba(239, 68, 68, 0.15)",
                border: "1px solid rgba(239, 68, 68, 0.3)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <AlertTriangle size={14} color="#ef4444" />
              <span style={{ fontSize: "12px", color: "#ef4444" }}>
                {r.regionName}: {r.wriValue.toFixed(2)}
              </span>
            </div>
          ))}
          {warningRegions.slice(0, 3).map((r) => (
            <div
              key={r.regionId}
              style={{
                padding: "8px 12px",
                background: "rgba(245, 158, 11, 0.15)",
                border: "1px solid rgba(245, 158, 11, 0.3)",
                borderRadius: "8px",
                display: "flex",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <TrendingUp size={14} color="#f59e0b" />
              <span style={{ fontSize: "12px", color: "#f59e0b" }}>
                {r.regionName}: {r.wriValue.toFixed(2)}
              </span>
            </div>
          ))}
        </div>
      )}

      <div style={{ height: "280px", width: "100%" }}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 30, left: 80, bottom: 10 }}
          >
            <CartesianGrid
              strokeDasharray="3 3"
              stroke="rgba(255,255,255,0.1)"
              horizontal={false}
            />
            <XAxis
              type="number"
              domain={[0, 1]}
              stroke="var(--text-secondary)"
              tickFormatter={(v) => v.toFixed(1)}
            />
            <YAxis
              type="category"
              dataKey="regionName"
              stroke="var(--text-secondary)"
              width={75}
              tick={{ fontSize: 11 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: "var(--bg-dark)",
                border: "1px solid var(--glass-border)",
                borderRadius: "8px",
                fontSize: "12px",
              }}
              formatter={(value: number, name: string) => [
                name === "wriValue" ? value.toFixed(3) : value,
                name === "wriValue" ? "WRI Score" : name,
              ]}
            />
            <Bar dataKey="wriValue" radius={[0, 4, 4, 0]}>
              {sortedData.map((entry, index) => (
                <Cell
                  key={`cell-${index}`}
                  fill={WRI_COLORS[entry.alertStatus] || WRI_COLORS.NORMAL}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div
        style={{
          display: "flex",
          justifyContent: "center",
          gap: "24px",
          marginTop: "16px",
          flexWrap: "wrap",
        }}
      >
        {Object.entries(WRI_COLORS).map(([level, color]) => (
          <div key={level} style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <div
              style={{
                width: "12px",
                height: "12px",
                borderRadius: "3px",
                background: color,
              }}
            />
            <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
              {level}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
