import { useState } from "react";
import { TrendingUp, AlertTriangle, Building2, BarChart3 } from "lucide-react";
import WRIVisualization from "./WRIVisualization";
import OverloadPredictionTable from "./OverloadPredictionTable";
import FacilityUtilizationDashboard from "./FacilityUtilizationDashboard";
import AlertPanel from "./AlertPanel";

type TabType = "wri" | "overload" | "facility" | "alerts";

const TABS: { id: TabType; label: string; icon: typeof TrendingUp }[] = [
  { id: "wri", label: "WRI Score", icon: BarChart3 },
  { id: "overload", label: "Overload Prediction", icon: TrendingUp },
  { id: "facility", label: "Facility Utilization", icon: Building2 },
  { id: "alerts", label: "Active Alerts", icon: AlertTriangle },
];

export default function MetricsDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>("wri");

  return (
    <div style={{ marginTop: "24px" }}>
      <div
        style={{
          display: "flex",
          gap: "8px",
          marginBottom: "24px",
          flexWrap: "wrap",
        }}
      >
        {TABS.map((tab) => {
          const IconComponent = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: "10px 16px",
                borderRadius: "8px",
                border: activeTab === tab.id ? "1px solid var(--accent-blue)" : "1px solid var(--glass-border)",
                background: activeTab === tab.id ? "rgba(59, 130, 246, 0.15)" : "rgba(255,255,255,0.03)",
                color: activeTab === tab.id ? "var(--accent-blue)" : "var(--text-secondary)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: "8px",
                fontSize: "13px",
                fontWeight: activeTab === tab.id ? 600 : 400,
                transition: "all 0.2s",
              }}
            >
              <IconComponent size={16} />
              {tab.label}
            </button>
          );
        })}
      </div>

      <div style={{ animation: "fadeIn 0.3s ease-in-out" }}>
        {activeTab === "wri" && <WRIVisualization />}
        {activeTab === "overload" && <OverloadPredictionTable />}
        {activeTab === "facility" && <FacilityUtilizationDashboard />}
        {activeTab === "alerts" && <AlertPanel />}
      </div>

      <div
        className="glass-panel"
        style={{
          padding: "16px",
          marginTop: "24px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          flexWrap: "wrap",
          gap: "12px",
        }}
      >
        <div style={{ fontSize: "12px", color: "var(--text-secondary)" }}>
          <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>Formulas:</span>
          <span style={{ marginLeft: "12px" }}>
            WRI = 0.4×μ_fill + 0.35×|ΔV| + 0.25×ρ
          </span>
          <span style={{ margin: "0 12px", color: "var(--glass-border)" }}>|</span>
          <span>P(t) = 1 - e^(-λt)</span>
          <span style={{ margin: "0 12px", color: "var(--glass-border)" }}>|</span>
          <span>Util = (processed + transit) / capacity</span>
        </div>
        <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>
          Refresh interval: 60s | Source: Spark Streaming
        </div>
      </div>
    </div>
  );
}
