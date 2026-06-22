import { useMemo } from "react";
import type { TruckData, TpsData, RouteQueueItem } from "../api/fleetApi";

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

function getPlannedLoad(truck: TruckData): number {
  const queue = truck.routeQueue as RouteQueueItem[] | null;
  if (!queue) return truck.currentLoadKg;
  const pendingTps = queue.filter((l) => l.type === "TPS" && l.status !== "done" && l.collectedKg);
  const plannedFromQueue = pendingTps.reduce((s, l) => s + (l.collectedKg || 0), 0);
  return truck.currentLoadKg + plannedFromQueue;
}

export default function TruckPanel({
  trucks,
  tps: _tps,
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
            const queue = (truck.routeQueue as RouteQueueItem[] | null) || [];
            const tpsLegs = queue.filter((l) => l.type === "TPS");
            const activeLeg = queue.find((l) => l.status === "active");
            const pendingLegs = tpsLegs.filter((l) => l.status === "pending");
            const planned = getPlannedLoad(truck);
            const hasPlanned = planned > truck.currentLoadKg;

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
                  {truck.status === "AVAILABLE" && "Menunggu tugas di depo"}
                  {truck.status === "EN_ROUTE_TO_TPS" && activeLeg && activeLeg.tpsName && (
                    <span style={{ color: "#60a5fa" }}>
                      {activeLeg.tpsName}
                      {pendingLegs.length > 0 && <span style={{ opacity: 0.5 }}> → {pendingLegs.map((l) => l.tpsName).join(" → ")}</span>}
                    </span>
                  )}
                  {truck.status === "EN_ROUTE_TO_HUB" && <span style={{ color: "#a78bfa" }}>→ {activeLeg?.facilityName || "Hub"}</span>}
                  {(truck.status === "LOADING" || truck.status === "UNLOADING") && <span style={{ color: "#fbbf24" }}>{activeLeg?.tpsName || "TPS"}</span>}
                  {" · "}
                  <span style={{ color: hasPlanned ? "#60a5fa" : "inherit" }}>
                    {planned.toLocaleString()} kg
                  </span>
                  {hasPlanned && <span style={{ opacity: 0.5, marginLeft: "2px" }}>(+{(planned - truck.currentLoadKg).toLocaleString()})</span>}
                  <span style={{ opacity: 0.5 }}> / {truck.capacityKg.toLocaleString()} kg</span>
                </div>
                {tpsLegs.length > 1 && truck.status !== "AVAILABLE" && (
                  <div style={{ marginTop: "3px", display: "flex", gap: "3px", flexWrap: "wrap" }}>
                    {tpsLegs.map((l) => (
                      <span key={l.tpsId} style={{
                        padding: "1px 5px", borderRadius: "3px", fontSize: "8px",
                        background: l.status === "active" ? "rgba(59,130,246,0.2)" : l.status === "done" ? "rgba(16,185,129,0.1)" : "rgba(255,255,255,0.04)",
                        color: l.status === "active" ? "#3b82f6" : l.status === "done" ? "#10b981" : "var(--text-secondary)",
                        border: `1px solid ${l.status === "active" ? "rgba(59,130,246,0.3)" : "transparent"}`,
                      }}>
                        {l.tpsName && l.tpsName.length > 12 ? l.tpsName.slice(0, 12) + "..." : l.tpsName}
                        {l.status === "done" && " ✓"}
                      </span>
                    ))}
                  </div>
                )}
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
