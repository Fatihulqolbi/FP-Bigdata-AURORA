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
  LineChart,
  Line,
  Legend,
} from "recharts";
import { Building2, Truck, TrendingUp, AlertCircle } from "lucide-react";

interface FacilityUtilization {
  facility_id: string;
  facility_name: string;
  kecamatan: string;
  processed_kg_1h: number;
  received_kg_1h: number;
  processed_24h_estimate: number;
  in_transit_estimate: number;
  daily_capacity_kg: number;
  utilization_rate: number;
  capacity_used_pct: number;
  throughput_efficiency: number;
  utilization_status: string;
  available_capacity_kg: number;
  hours_until_full: number;
  truck_count_1h: number;
  last_update: string;
}

const STATUS_COLORS: Record<string, string> = {
  OVERLOADED: "#ef4444",
  NEAR_CAPACITY: "#f97316",
  MODERATE: "#eab308",
  NORMAL: "#3b82f6",
  LOW: "#10b981",
};

const FACILITY_ICONS: Record<string, string> = {
  INCINERATOR: "🔥",
  LANDFILL: "🗑️",
  SORTING_HUB: "♻️",
  COMPOSTING: "🌿",
  RECYCLING: "🔄",
};

export default function FacilityUtilizationDashboard() {
  const [facilities, setFacilities] = useState<FacilityUtilization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFacility, setSelectedFacility] = useState<string | null>(null);

  useEffect(() => {
    const fetchFacilities = async () => {
      try {
        const res = await fetch("/api/metrics/utilization/facilities");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        setFacilities(data.data || []);
        setError(null);
      } catch (err) {
        console.error("Facility fetch error:", err);
        setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    };

    fetchFacilities();
    const interval = setInterval(fetchFacilities, 60000);
    return () => clearInterval(interval);
  }, []);

  if (loading) {
    return (
      <div className="glass-panel" style={{ padding: "24px" }}>
        <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
          Loading facility utilization...
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

  const overloadedCount = facilities.filter(
    (f) => f.utilization_status === "OVERLOADED"
  ).length;
  const nearCapacityCount = facilities.filter(
    (f) => f.utilization_status === "NEAR_CAPACITY"
  ).length;

  const totalProcessed24h = facilities.reduce(
    (sum, f) => sum + f.processed_24h_estimate,
    0
  );
  const totalCapacity = facilities.reduce(
    (sum, f) => sum + f.daily_capacity_kg,
    0
  );
  const avgUtilization =
    facilities.length > 0
      ? facilities.reduce((sum, f) => sum + f.utilization_rate, 0) / facilities.length
      : 0;

  const barChartData = facilities.map((f) => ({
    name: f.facility_name.replace(/TPS|TPA|PLTSa|SORTING|COMPOST|RECYCLING/gi, "").trim(),
    utilization: f.utilization_rate,
    capacity: f.capacity_used_pct,
    status: f.utilization_status,
    fill: STATUS_COLORS[f.utilization_status] || STATUS_COLORS.NORMAL,
  }));

  const flowData = facilities.map((f) => ({
    name: f.facility_name.substring(0, 10),
    inflow: f.received_kg_1h,
    outflow: f.processed_kg_1h,
  }));

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
            Facility Utilization
          </h3>
          <p style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
            Utilization = (processed_24h + in_transit) / daily_capacity × 100%
          </p>
        </div>
        <div style={{ display: "flex", gap: "16px" }}>
          {(overloadedCount > 0 || nearCapacityCount > 0) && (
            <div style={{ display: "flex", gap: "8px" }}>
              {overloadedCount > 0 && (
                <div
                  style={{
                    padding: "6px 12px",
                    background: "rgba(239, 68, 68, 0.15)",
                    borderRadius: "8px",
                    display: "flex",
                    alignItems: "center",
                    gap: "6px",
                    fontSize: "12px",
                    color: "#ef4444",
                  }}
                >
                  <AlertCircle size={14} />
                  {overloadedCount} Overloaded
                </div>
              )}
              {nearCapacityCount > 0 && (
                <div
                  style={{
                    padding: "6px 12px",
                    background: "rgba(249, 115, 22, 0.15)",
                    borderRadius: "8px",
                    fontSize: "12px",
                    color: "#f97316",
                  }}
                >
                  {nearCapacityCount} Near Capacity
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: "16px",
          marginBottom: "24px",
        }}
      >
        <div
          style={{
            padding: "16px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Total Processed (24h)
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "4px" }}>
            {(totalProcessed24h / 1000).toFixed(1)}
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}> Ton</span>
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Total Capacity
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "4px" }}>
            {(totalCapacity / 1000).toFixed(1)}
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}> Ton</span>
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Avg Utilization
          </div>
          <div
            style={{
              fontSize: "24px",
              fontWeight: "bold",
              marginTop: "4px",
              color:
                avgUtilization >= 95
                  ? STATUS_COLORS.OVERLOADED
                  : avgUtilization >= 80
                  ? STATUS_COLORS.NEAR_CAPACITY
                  : "var(--text-primary)",
            }}
          >
            {avgUtilization.toFixed(1)}%
          </div>
        </div>
        <div
          style={{
            padding: "16px",
            background: "rgba(255,255,255,0.03)",
            borderRadius: "12px",
            border: "1px solid var(--glass-border)",
          }}
        >
          <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
            Active Facilities
          </div>
          <div style={{ fontSize: "24px", fontWeight: "bold", marginTop: "4px" }}>
            {facilities.length}
            <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}> Units</span>
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
          gap: "24px",
        }}
      >
        <div>
          <div
            style={{
              fontSize: "14px",
              marginBottom: "12px",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            Utilization Rate by Facility
          </div>
          <div style={{ height: "250px", width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={barChartData}
                layout="vertical"
                margin={{ top: 10, right: 30, left: 60, bottom: 10 }}
              >
                <CartesianGrid
                  strokeDasharray="3 3"
                  stroke="rgba(255,255,255,0.1)"
                  horizontal={false}
                />
                <XAxis
                  type="number"
                  domain={[0, 100]}
                  stroke="var(--text-secondary)"
                  tickFormatter={(v) => `${v}%`}
                />
                <YAxis
                  type="category"
                  dataKey="name"
                  stroke="var(--text-secondary)"
                  width={55}
                  tick={{ fontSize: 10 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-dark)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                  formatter={(value: number) => [`${value.toFixed(1)}%`, "Utilization"]}
                />
                <Bar dataKey="utilization" radius={[0, 4, 4, 0]}>
                  {barChartData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.fill} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div>
          <div
            style={{
              fontSize: "14px",
              marginBottom: "12px",
              fontWeight: 500,
              color: "var(--text-primary)",
            }}
          >
            Inflow vs Outflow (kg/h)
          </div>
          <div style={{ height: "250px", width: "100%", minWidth: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={flowData} margin={{ top: 10, right: 30, left: 0, bottom: 10 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
                <XAxis dataKey="name" stroke="var(--text-secondary)" tick={{ fontSize: 9 }} />
                <YAxis stroke="var(--text-secondary)" tick={{ fontSize: 10 }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "var(--bg-dark)",
                    border: "1px solid var(--glass-border)",
                    borderRadius: "8px",
                    fontSize: "11px",
                  }}
                />
                <Legend wrapperStyle={{ fontSize: "11px" }} />
                <Line
                  type="monotone"
                  dataKey="inflow"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Inflow"
                />
                <Line
                  type="monotone"
                  dataKey="outflow"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  name="Outflow"
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ marginTop: "24px" }}>
        <div
          style={{
            fontSize: "14px",
            marginBottom: "12px",
            fontWeight: 500,
            color: "var(--text-primary)",
          }}
        >
          Facility Details
        </div>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
            gap: "12px",
          }}
        >
          {facilities.map((facility) => (
            <div
              key={facility.facility_id}
              style={{
                padding: "16px",
                background: "rgba(255,255,255,0.02)",
                borderRadius: "12px",
                border: `1px solid ${
                  facility.utilization_status === "OVERLOADED"
                    ? "rgba(239, 68, 68, 0.3)"
                    : facility.utilization_status === "NEAR_CAPACITY"
                    ? "rgba(249, 115, 22, 0.3)"
                    : "var(--glass-border)"
                }`,
                cursor: "pointer",
                transition: "all 0.2s",
              }}
              onClick={() =>
                setSelectedFacility(
                  selectedFacility === facility.facility_id ? null : facility.facility_id
                )
              }
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "8px",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <Building2 size={14} color="var(--text-secondary)" />
                  <span style={{ fontWeight: 500, fontSize: "13px" }}>
                    {facility.facility_name}
                  </span>
                </div>
                <span
                  style={{
                    padding: "2px 8px",
                    borderRadius: "4px",
                    background: `${STATUS_COLORS[facility.utilization_status]}20`,
                    color: STATUS_COLORS[facility.utilization_status],
                    fontSize: "10px",
                    fontWeight: 600,
                  }}
                >
                  {facility.utilization_status}
                </span>
              </div>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: "8px",
                  fontSize: "11px",
                  color: "var(--text-secondary)",
                }}
              >
                <div>
                  <span>Utilization:</span>{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {facility.utilization_rate.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span>Efficiency:</span>{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {facility.throughput_efficiency.toFixed(1)}%
                  </span>
                </div>
                <div>
                  <span>Processed:</span>{" "}
                  <span style={{ color: "var(--text-primary)" }}>
                    {(facility.processed_24h_estimate / 1000).toFixed(1)} Ton
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                  <Truck size={10} />
                  <span>{facility.truck_count_1h} trucks/h</span>
                </div>
              </div>
              {selectedFacility === facility.facility_id && (
                <div
                  style={{
                    marginTop: "12px",
                    paddingTop: "12px",
                    borderTop: "1px solid var(--glass-border)",
                    fontSize: "11px",
                    color: "var(--text-secondary)",
                  }}
                >
                  <div style={{ marginBottom: "4px" }}>
                    Capacity: {(facility.daily_capacity_kg / 1000).toFixed(1)} Ton/day
                  </div>
                  <div style={{ marginBottom: "4px" }}>
                    Available: {(facility.available_capacity_kg / 1000).toFixed(1)} Ton
                  </div>
                  <div>
                    Hours until full:{" "}
                    {facility.hours_until_full > 0
                      ? `${facility.hours_until_full.toFixed(1)}h`
                      : "N/A"}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
