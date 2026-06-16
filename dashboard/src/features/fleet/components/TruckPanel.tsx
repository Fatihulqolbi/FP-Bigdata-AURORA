import { useMemo } from "react";
import type { TruckData, TpsData, WaypointStop } from "../api/fleetApi";

interface TruckPanelProps {
  trucks: TruckData[];
  tps: TpsData[];
  selectedTruckId: string | null;
  onSelectTruck: (truck: TruckData) => void;
  showCompactor: boolean;
  showDumpTruck: boolean;
  showArmRoll: boolean;
  onToggleCompactor: () => void;
  onToggleDumpTruck: () => void;
  onToggleArmRoll: () => void;
  showRoutes: boolean;
  onToggleRoutes: () => void;
  connected: boolean;
  lastUpdate: string | null;
}

const statusColors: Record<string, string> = {
  AVAILABLE: "#10b981",
  EN_ROUTE_TO_TPS: "#3b82f6",
  LOADING: "#f59e0b",
  EN_ROUTE_TO_HUB: "#8b5cf6",
  UNLOADING: "#ef4444",
};

const statusText: Record<string, string> = {
  AVAILABLE: "Idle",
  EN_ROUTE_TO_TPS: "Ke TPS",
  LOADING: "Muat",
  EN_ROUTE_TO_HUB: "Ke Hub",
  UNLOADING: "Bongkar",
};

export default function TruckPanel({
  trucks,
  tps,
  selectedTruckId,
  onSelectTruck,
  showCompactor,
  showDumpTruck,
  showArmRoll,
  onToggleCompactor,
  onToggleDumpTruck,
  onToggleArmRoll,
  showRoutes,
  onToggleRoutes,
  connected,
  lastUpdate,
}: TruckPanelProps) {
  const active = useMemo(() => trucks.filter((t) => t.status !== "AVAILABLE").length, [trucks]);
  const idle = useMemo(() => trucks.filter((t) => t.status === "AVAILABLE").length, [trucks]);

  const filteredTrucks = useMemo(() => {
    return trucks.filter((t) => {
      if (t.type === "COMPACTOR") return showCompactor;
      if (t.type === "DUMP_TRUCK") return showDumpTruck;
      if (t.type === "ARM_ROLL") return showArmRoll;
      return true;
    });
  }, [trucks, showCompactor, showDumpTruck, showArmRoll]);

  const sortedTrucks = useMemo(() => {
    const order: Record<string, number> = { EN_ROUTE_TO_TPS: 0, LOADING: 1, EN_ROUTE_TO_HUB: 2, UNLOADING: 3, AVAILABLE: 4 };
    return [...filteredTrucks].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  }, [filteredTrucks]);

  const tpsMap = useMemo(() => new Map(tps.map((t) => [t.id, t])), [tps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px", height: "100%", overflow: "hidden" }}>
      {/* Connection + Status (compact) */}
      <div className="glass-panel" style={{ padding: "10px 12px", display: "flex", flexDirection: "column", gap: "6px" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "11px" }}>
          <div style={{ width: "6px", height: "6px", borderRadius: "50%", background: connected ? "#10b981" : "#ef4444", animation: connected ? "pulse 2s infinite" : "none" }} />
          <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{connected ? "Live" : "Offline"}</span>
          {lastUpdate && <span style={{ color: "var(--text-secondary)", marginLeft: "auto", fontSize: "9px" }}>{new Date(lastUpdate).toLocaleTimeString()}</span>}
        </div>
        <div style={{ display: "flex", gap: "8px", fontSize: "10px" }}>
          <span style={{ color: "#3b82f6" }}>Aktif: <strong>{active}</strong></span>
          <span style={{ color: "#10b981" }}>Idle: <strong>{idle}</strong></span>
          <span style={{ color: "var(--text-secondary)", marginLeft: "auto" }}>Total: {trucks.length}</span>
        </div>
      </div>

      {/* Filter toggles (compact horizontal) */}
      <div className="glass-panel" style={{ padding: "8px 12px", display: "flex", gap: "6px", flexWrap: "wrap" }}>
        <FilterToggle label="Compactor" color="#3b82f6" checked={showCompactor} onChange={onToggleCompactor} />
        <FilterToggle label="Dump Truck" color="#f59e0b" checked={showDumpTruck} onChange={onToggleDumpTruck} />
        <FilterToggle label="Arm Roll" color="#10b981" checked={showArmRoll} onChange={onToggleArmRoll} />
        <FilterToggle label="Rute" color="#8b5cf6" checked={showRoutes} onChange={onToggleRoutes} />
      </div>

      {/* Truck feed list (scrollable, compact) */}
      <div className="glass-panel" style={{ padding: "10px 12px", flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "8px" }}>
          <h4 style={{ fontSize: "12px", margin: 0, color: "var(--text-primary)" }}>Live Feed</h4>
          <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>{sortedTrucks.length} truk</span>
        </div>
        <div className="custom-scrollbar" style={{ display: "flex", flexDirection: "column", gap: "4px", overflowY: "auto", flex: 1, minHeight: 0 }}>
          {sortedTrucks.map((truck) => {
            const isSelected = truck.id === selectedTruckId;
            const color = statusColors[truck.status] || "#6b7280";
            const waypoints = (truck.routeWaypoints as WaypointStop[] | null) || [];
            const activeWps = waypoints.filter((w) => w.collectedKg > 0);
            const tpsName = truck.assignedTpsId ? (tpsMap.get(truck.assignedTpsId)?.name || "—") : "—";

            return (
              <div
                key={truck.id}
                onClick={() => onSelectTruck(truck)}
                style={{
                  padding: "6px 8px",
                  background: isSelected ? "rgba(59,130,246,0.12)" : "transparent",
                  borderRadius: "4px",
                  borderLeft: `2px solid ${color}`,
                  cursor: "pointer",
                  fontSize: "10px",
                  transition: "background 0.1s",
                  opacity: truck.status === "AVAILABLE" ? 0.5 : 1,
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1px" }}>
                  <span style={{ fontWeight: 600, color: "var(--text-primary)", fontSize: "10px" }}>{truck.code}</span>
                  <span style={{ color, fontSize: "8px", fontWeight: 600 }}>{statusText[truck.status]}</span>
                </div>
                <div style={{ color: "var(--text-secondary)", fontSize: "9px", lineHeight: 1.3 }}>
                  {truck.status === "AVAILABLE" && "Depo"}
                  {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length > 1 && activeWps.map((w) => w.tpsName).join(" → ")}
                  {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length <= 1 && tpsName}
                  {truck.status === "EN_ROUTE_TO_HUB" && "→ Hub"}
                  {(truck.status === "LOADING" || truck.status === "UNLOADING") && tpsName}
                  {" · "}
                  {truck.currentLoadKg.toLocaleString()}/{truck.capacityKg.toLocaleString()} kg
                </div>
                {truck.routeProgress > 0 && truck.routeProgress < 1 && (
                  <div style={{ marginTop: "3px", height: "2px", background: "rgba(255,255,255,0.05)", borderRadius: "1px" }}>
                    <div style={{ width: `${truck.routeProgress * 100}%`, height: "100%", background: color, borderRadius: "1px", transition: "width 0.3s" }} />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function FilterToggle({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: () => void }) {
  return (
    <label style={{
      display: "flex", alignItems: "center", gap: "4px", cursor: "pointer",
      padding: "3px 6px", borderRadius: "3px",
      background: checked ? `${color}22` : "transparent",
      border: `1px solid ${color}33`, fontSize: "9px", color,
      transition: "all 0.15s",
    }}>
      <input type="checkbox" checked={checked} onChange={onChange} style={{ display: "none" }} />
      <div style={{ width: "5px", height: "5px", borderRadius: "1px", background: checked ? color : "transparent", border: `1px solid ${color}`, transition: "all 0.15s" }} />
      {label}
    </label>
  );
}
