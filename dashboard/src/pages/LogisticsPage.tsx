import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import FleetMap from "../features/fleet/components/FleetMap";
import { useFleetStream } from "../features/fleet/hooks/useFleetStream";
import { fleet } from "../features/fleet/api/fleetApi";
import type { TruckData, WaypointStop, TaskSuggestion, AvailableTruck } from "../features/fleet/api/fleetApi";

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

const priorityConfig = {
  KRITIS: { color: "#ef4444", bg: "rgba(239,68,68,0.12)", label: "KRITIS" },
  TINGGI: { color: "#f59e0b", bg: "rgba(245,158,11,0.12)", label: "TINGGI" },
  SEDANG: { color: "#3b82f6", bg: "rgba(59,130,246,0.12)", label: "SEDANG" },
};

const truckTypeLabel: Record<string, string> = {
  COMPACTOR: "Compactor",
  DUMP_TRUCK: "Dump",
  ARM_ROLL: "Arm Roll",
};

const PANEL_HEIGHT = 268;
const TOGGLE_BAR_H = 40;

const FUEL_EFFICIENCY: Record<string, number> = {
  COMPACTOR: 8,
  DUMP_TRUCK: 6,
  ARM_ROLL: 7,
};
const FUEL_PRICE = 24800; // Rp/liter

function calcRouteCost(truck: TruckData): { costRp: number; liters: number; distKm: number; durationSec: number } {
  const distKm = (truck.routeDistance || 0) / 1000;
  const fuelEff = FUEL_EFFICIENCY[truck.type] || 7;
  const liters = distKm / fuelEff;
  return { costRp: liters * FUEL_PRICE, liters, distKm, durationSec: truck.routeDuration || 3600 };
}

function getPlannedLoad(truck: TruckData): number {
  if (truck.status === "EN_ROUTE_TO_TPS" && truck.routeWaypoints) {
    const wps = truck.routeWaypoints as WaypointStop[];
    return wps.reduce((s, w) => s + (w.collectedKg || 0), 0);
  }
  return truck.currentLoadKg;
}

export default function LogisticsPage() {
  const { trucks, tps, facilities, lastUpdate, connected } = useFleetStream();

  const [showCompactor, setShowCompactor] = useState(true);
  const [showDumpTruck, setShowDumpTruck] = useState(true);
  const [showArmRoll, setShowArmRoll] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(true);

  // Task panel state
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [availableTrucks, setAvailableTrucks] = useState<AvailableTruck[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<Record<string, string>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<Set<string>>(new Set());

  const handleTruckClick = useCallback((truck: TruckData) => {
    setSelectedTruckId((prev) => (prev === truck.id ? null : truck.id));
  }, []);

  const active = useMemo(() => trucks.filter((t) => t.status !== "AVAILABLE").length, [trucks]);
  const idle = useMemo(() => trucks.filter((t) => t.status === "AVAILABLE").length, [trucks]);

  const costSummary = useMemo(() => {
    const activeTrucksWithRoutes = trucks.filter((t) => t.status !== "AVAILABLE" && (t.routeDistance || 0) > 0);
    if (activeTrucksWithRoutes.length === 0) return null;

    const routes = activeTrucksWithRoutes.map(calcRouteCost);
    const avgCostRp = routes.reduce((s, r) => s + r.costRp, 0) / routes.length;
    const avgDurationSec = routes.reduce((s, r) => s + r.durationSec, 0) / routes.length;
    const totalDistKmNow = routes.reduce((s, r) => s + r.distKm, 0);
    const totalLitersNow = routes.reduce((s, r) => s + r.liters, 0);
    const nTrucks = activeTrucksWithRoutes.length;

    const tripsPerTruckIn = (hours: number) => Math.max(1, Math.floor((hours * 3600) / Math.max(avgDurationSec, 600)));

    const cost6h = tripsPerTruckIn(6) * nTrucks * avgCostRp;
    const cost12h = tripsPerTruckIn(12) * nTrucks * avgCostRp;
    const cost24h = tripsPerTruckIn(24) * nTrucks * avgCostRp;

    const totalKgInTransit = activeTrucksWithRoutes.reduce((s, t) => s + getPlannedLoad(t), 0);

    return {
      nTrucks,
      totalDistKmNow: Math.round(totalDistKmNow * 10) / 10,
      totalLitersNow: Math.round(totalLitersNow * 100) / 100,
      totalKgInTransit: Math.round(totalKgInTransit),
      cost6h: Math.round(cost6h),
      cost12h: Math.round(cost12h),
      cost24h: Math.round(cost24h),
    };
  }, [trucks]);

  const sortedTrucks = useMemo(() => {
    const order: Record<string, number> = { EN_ROUTE_TO_TPS: 0, LOADING: 1, EN_ROUTE_TO_HUB: 2, UNLOADING: 3, AVAILABLE: 4 };
    const filtered = trucks.filter((t) => {
      if (t.type === "COMPACTOR") return showCompactor;
      if (t.type === "DUMP_TRUCK") return showDumpTruck;
      if (t.type === "ARM_ROLL") return showArmRoll;
      return true;
    });
    return [...filtered].sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  }, [trucks, showCompactor, showDumpTruck, showArmRoll]);

  const tpsMap = useMemo(() => new Map(tps.map((t) => [t.id, t])), [tps]);

  // Fetch suggestions
  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const data = await fleet.getTaskSuggestions();
      setSuggestions(data.suggestions);
      setAvailableTrucks(data.availableTrucks);
      setDispatched(new Set());
      const init: Record<string, string> = {};
      data.suggestions.forEach((s) => {
        if (s.recommendedTruck) init[s.tps.id] = s.recommendedTruck.id;
      });
      setSelectedTrucks(init);
    } catch (err: any) {
      toast.error("Gagal memuat saran tugas");
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (taskPanelOpen) fetchSuggestions();
  }, [taskPanelOpen, fetchSuggestions]);

  const handleDispatch = async (tpsId: string) => {
    const truckId = selectedTrucks[tpsId];
    if (!truckId) { toast.error("Pilih truk terlebih dahulu"); return; }
    setDispatching(tpsId);
    try {
      await fleet.dispatchTask(truckId, tpsId);
      toast.success("Truk berhasil dikirim ke TPS");
      setDispatched((prev) => new Set([...prev, tpsId]));
      setAvailableTrucks((prev) => prev.filter((t) => t.id !== truckId));
      // Remove from other suggestions' selected truck if it was the same truck
      setSelectedTrucks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((key) => { if (next[key] === truckId) delete next[key]; });
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim truk");
    } finally {
      setDispatching(null);
    }
  };

  const mapHeight = taskPanelOpen
    ? `calc(100vh - 120px - ${PANEL_HEIGHT + TOGGLE_BAR_H}px)`
    : `calc(100vh - 120px - ${TOGGLE_BAR_H}px)`;

  const activeSuggestions = suggestions.filter((s) => !dispatched.has(s.tps.id));

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", animation: "fadeIn 0.4s ease" }}>

      {/* ── MAP SECTION ── */}
      <div style={{
        position: "relative",
        height: mapHeight,
        transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
        minHeight: "260px",
        borderRadius: "12px 12px 0 0",
        overflow: "hidden",
      }}>
        {/* Top bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000,
          display: "flex", alignItems: "center", gap: "12px", padding: "12px 16px",
          background: "linear-gradient(180deg, rgba(15,23,42,0.92) 0%, rgba(15,23,42,0.6) 80%, transparent 100%)",
          backdropFilter: "blur(8px)",
          pointerEvents: "none",
        }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: "12px" }}>
            <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
              <StatusPill color="#3b82f6" label="Aktif" value={active} />
              <StatusPill color="#10b981" label="Idle" value={idle} />
              <StatusPill color="var(--text-secondary)" label="Total" value={trucks.length} />
            </div>
            <div style={{ width: "1px", height: "20px", background: "rgba(255,255,255,0.1)" }} />
            <div style={{ display: "flex", gap: "4px" }}>
              <CompactToggle label="Compactor" color="#3b82f6" checked={showCompactor} onChange={() => setShowCompactor(v => !v)} />
              <CompactToggle label="Dump" color="#f59e0b" checked={showDumpTruck} onChange={() => setShowDumpTruck(v => !v)} />
              <CompactToggle label="Arm Roll" color="#10b981" checked={showArmRoll} onChange={() => setShowArmRoll(v => !v)} />
              <CompactToggle label="Rute" color="#8b5cf6" checked={showRoutes} onChange={() => setShowRoutes(v => !v)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px", color: "var(--text-secondary)" }}>
              <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: connected ? "#10b981" : "#ef4444", animation: connected ? "pulse 2s infinite" : "none" }} />
              {connected ? "Live" : "Offline"}
              {lastUpdate && <span style={{ opacity: 0.5 }}>{new Date(lastUpdate).toLocaleTimeString()}</span>}
            </div>
          </div>
        </div>

        {/* Map */}
        <div style={{ position: "absolute", inset: 0 }}>
          <FleetMap
            trucks={trucks} tps={tps} facilities={facilities}
            showCompactor={showCompactor} showDumpTruck={showDumpTruck}
            showArmRoll={showArmRoll} showRoutes={showRoutes}
            selectedTruckId={selectedTruckId} onTruckClick={handleTruckClick}
          />
        </div>

        {/* Live Feed overlay */}
        <div style={{
          position: "absolute", top: "60px", right: "16px", bottom: "12px",
          width: feedOpen ? "280px" : "40px",
          zIndex: 1000,
          display: "flex", flexDirection: "column",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <button
            onClick={() => setFeedOpen(v => !v)}
            style={{
              position: "absolute", top: "8px", left: "-16px", zIndex: 1001,
              width: "32px", height: "32px", borderRadius: "50%",
              background: "rgba(15,23,42,0.9)", border: "1px solid rgba(255,255,255,0.15)",
              color: "white", cursor: "pointer", fontSize: "14px",
              display: "flex", alignItems: "center", justifyContent: "center",
              boxShadow: "0 4px 12px rgba(0,0,0,0.3)", transition: "transform 0.2s",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >{feedOpen ? "›" : "‹"}</button>

          {feedOpen && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              background: "rgba(15,23,42,0.88)", backdropFilter: "blur(16px)",
              border: "1px solid rgba(255,255,255,0.08)", borderRadius: "12px",
              overflow: "hidden", boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
            }}>
              <div style={{ padding: "12px 14px", borderBottom: "1px solid rgba(255,255,255,0.06)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>Live Feed</span>
                <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{sortedTrucks.length}</span>
              </div>
              <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "6px 8px" }}>
                {sortedTrucks.map((truck) => {
                  const isSelected = truck.id === selectedTruckId;
                  const color = statusColors[truck.status] || "#6b7280";
                  const waypoints = (truck.routeWaypoints as WaypointStop[] | null) || [];
                  const activeWps = waypoints.filter((w) => w.collectedKg > 0);
                  const tpsName = truck.assignedTpsId ? (tpsMap.get(truck.assignedTpsId)?.name || "—") : "—";
                  return (
                    <div key={truck.id} onClick={() => handleTruckClick(truck)} style={{
                      padding: "7px 10px", marginBottom: "2px",
                      background: isSelected ? "rgba(59,130,246,0.15)" : "transparent",
                      borderRadius: "6px", cursor: "pointer",
                      borderLeft: isSelected ? `3px solid ${color}` : "3px solid transparent",
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={(e) => { if (!isSelected) e.currentTarget.style.background = "rgba(255,255,255,0.03)"; }}
                      onMouseLeave={(e) => { if (!isSelected) e.currentTarget.style.background = "transparent"; }}
                    >
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "2px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>{truck.code}</span>
                          <span style={{ fontSize: "8px", fontWeight: 600, padding: "1px 5px", borderRadius: "3px", background: `${color}20`, color }}>{statusText[truck.status]}</span>
                        </div>
                        {truck.status !== "AVAILABLE" && (() => {
                          const planned = getPlannedLoad(truck);
                          const isPlanned = truck.status === "EN_ROUTE_TO_TPS" && truck.currentLoadKg === 0 && planned > 0;
                          return (
                            <span style={{ fontSize: "9px", color: isPlanned ? "#60a5fa" : "var(--text-secondary)", fontStyle: isPlanned ? "italic" : "normal" }}>
                              {planned.toLocaleString()}kg{isPlanned ? " ↗" : ""}
                            </span>
                          );
                        })()}
                      </div>
                      <div style={{ fontSize: "9px", color: "var(--text-secondary)", lineHeight: 1.4, marginLeft: "2px" }}>
                        {truck.status === "AVAILABLE" && <span style={{ opacity: 0.5 }}>Menunggu tugas</span>}
                        {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length > 1 && (
                          <span style={{ color: "#60a5fa" }}>
                            {activeWps.map((w, i) => <span key={w.tpsId}>{i > 0 && <span style={{ opacity: 0.4 }}> → </span>}<span style={{ opacity: 1 - i * 0.2 }}>{w.tpsName}</span></span>)}
                          </span>
                        )}
                        {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length <= 1 && <span style={{ color: "#60a5fa" }}>{tpsName}</span>}
                        {truck.status === "EN_ROUTE_TO_HUB" && <span style={{ color: "#a78bfa" }}>→ Sorting Hub</span>}
                        {(truck.status === "LOADING" || truck.status === "UNLOADING") && <span style={{ color: "#fbbf24" }}>{tpsName}</span>}
                      </div>
                      {truck.routeProgress > 0 && truck.routeProgress < 1 && (
                        <div style={{ marginTop: "4px", height: "2px", background: "rgba(255,255,255,0.06)", borderRadius: "1px" }}>
                          <div style={{ width: `${truck.routeProgress * 100}%`, height: "100%", background: `linear-gradient(90deg, ${color}, ${color}88)`, borderRadius: "1px", transition: "width 0.5s ease" }} />
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── COST SUMMARY BAR ── */}
      {costSummary && (
        <div style={{
          display: "flex", alignItems: "center", gap: "0",
          background: "rgba(15,23,42,0.97)",
          border: "1px solid rgba(255,255,255,0.06)",
          borderTop: "1px solid rgba(255,255,255,0.08)",
          borderBottom: "none",
          padding: "8px 16px",
          flexShrink: 0,
          flexWrap: "wrap",
          gap: "0",
          rowGap: "4px",
        }}>
          <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.06em", textTransform: "uppercase", marginRight: "12px" }}>
            Estimasi Biaya BBM
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: "6px", marginRight: "16px" }}>
            <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>Angkut skrg:</span>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#10b981", fontFamily: "'JetBrains Mono', monospace" }}>
              {costSummary.totalKgInTransit.toLocaleString()} kg
            </span>
            <span style={{ fontSize: "9px", color: "var(--text-secondary)" }}>({costSummary.totalLitersNow.toFixed(1)} L · {costSummary.totalDistKmNow} km)</span>
          </div>
          <div style={{ width: "1px", height: "16px", background: "rgba(255,255,255,0.08)", marginRight: "16px" }} />
          <CostBadge label="6 Jam" value={costSummary.cost6h} color="#3b82f6" />
          <CostBadge label="12 Jam" value={costSummary.cost12h} color="#8b5cf6" />
          <CostBadge label="24 Jam" value={costSummary.cost24h} color="#f59e0b" />
          <span style={{ marginLeft: "auto", fontSize: "9px", color: "var(--text-secondary)", opacity: 0.5 }}>
            {costSummary.nTrucks} truk aktif · Pertamina Dex Rp{FUEL_PRICE.toLocaleString()}/L
          </span>
        </div>
      )}

      {/* ── TASK PANEL TOGGLE BAR ── */}
      <button
        onClick={() => setTaskPanelOpen(v => !v)}
        style={{
          height: `${TOGGLE_BAR_H}px`,
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "0 16px",
          background: "rgba(15,23,42,0.95)",
          border: "1px solid rgba(255,255,255,0.08)",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          borderBottom: taskPanelOpen ? "none" : "1px solid rgba(255,255,255,0.08)",
          borderRadius: taskPanelOpen ? "0" : "0 0 10px 10px",
          cursor: "pointer",
          color: "var(--text-primary)",
          transition: "background 0.15s",
          flexShrink: 0,
        }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(30,41,59,0.98)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.95)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          <span style={{ fontSize: "13px" }}>
            {taskPanelOpen ? "▼" : "▲"}
          </span>
          <span style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)" }}>
            Task yang Disarankan
          </span>
          {activeSuggestions.length > 0 && (
            <span style={{
              fontSize: "10px", fontWeight: 700,
              padding: "1px 7px", borderRadius: "10px",
              background: "rgba(239,68,68,0.18)", color: "#f87171",
            }}>
              {activeSuggestions.length} TPS
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {taskPanelOpen && (
            <button
              onClick={(e) => { e.stopPropagation(); fetchSuggestions(); }}
              style={{
                fontSize: "10px", padding: "3px 10px", borderRadius: "5px",
                background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)",
                color: "var(--text-secondary)", cursor: "pointer",
              }}
            >
              ↻ Refresh
            </button>
          )}
          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>
            {taskPanelOpen ? "Sembunyikan" : "Tampilkan"}
          </span>
        </div>
      </button>

      {/* ── TASK PANEL BODY ── */}
      <div style={{
        height: taskPanelOpen ? `${PANEL_HEIGHT}px` : "0px",
        overflow: "hidden",
        transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
        background: "rgba(15,23,42,0.97)",
        border: taskPanelOpen ? "1px solid rgba(255,255,255,0.08)" : "none",
        borderTop: "none",
        borderRadius: "0 0 10px 10px",
        flexShrink: 0,
      }}>
        {taskPanelOpen && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Column headers */}
            <div style={{
              display: "grid",
              gridTemplateColumns: "70px 1fr 90px 80px 200px 100px",
              gap: "8px",
              padding: "8px 16px",
              borderBottom: "1px solid rgba(255,255,255,0.05)",
              fontSize: "9px", fontWeight: 700, letterSpacing: "0.08em",
              color: "var(--text-secondary)", textTransform: "uppercase",
            }}>
              <span>Prioritas</span>
              <span>TPS</span>
              <span>Volume</span>
              <span>Fill</span>
              <span>Truk yang Direkomendasikan</span>
              <span style={{ textAlign: "right" }}>Aksi</span>
            </div>

            {/* Rows */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
              {suggestionsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px", color: "var(--text-secondary)", fontSize: "12px" }}>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span>
                  Memuat saran tugas…
                </div>
              ) : activeSuggestions.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: "12px", opacity: 0.6 }}>
                  Tidak ada TPS yang butuh layanan saat ini
                </div>
              ) : (
                activeSuggestions.map((s) => (
                  <SuggestionRow
                    key={s.tps.id}
                    suggestion={s}
                    availableTrucks={availableTrucks}
                    selectedTruckId={selectedTrucks[s.tps.id] || ""}
                    onSelectTruck={(truckId) => setSelectedTrucks((prev) => ({ ...prev, [s.tps.id]: truckId }))}
                    onDispatch={() => handleDispatch(s.tps.id)}
                    isDispatching={dispatching === s.tps.id}
                  />
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Suggestion Row ──
interface SuggestionRowProps {
  suggestion: TaskSuggestion;
  availableTrucks: AvailableTruck[];
  selectedTruckId: string;
  onSelectTruck: (id: string) => void;
  onDispatch: () => void;
  isDispatching: boolean;
}

function SuggestionRow({ suggestion, availableTrucks, selectedTruckId, onSelectTruck, onDispatch, isDispatching }: SuggestionRowProps) {
  const { tps, recommendedTruck, priority } = suggestion;
  const p = priorityConfig[priority];
  const fillBarColor = tps.fillPct >= 90 ? "#ef4444" : tps.fillPct >= 70 ? "#f59e0b" : "#3b82f6";

  // Build truck options: recommended first, then rest
  const otherTrucks = availableTrucks.filter((t) => t.id !== recommendedTruck?.id);
  const truckOptions = recommendedTruck
    ? [{ ...recommendedTruck, isRecommended: true }, ...otherTrucks.map(t => ({ ...t, distanceKm: 0, score: 0, isRecommended: false }))]
    : otherTrucks.map(t => ({ ...t, distanceKm: 0, score: 0, isRecommended: false }));

  return (
    <div style={{
      display: "grid",
      gridTemplateColumns: "70px 1fr 90px 80px 200px 100px",
      gap: "8px",
      padding: "8px 16px",
      alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.04)",
      transition: "background 0.12s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.025)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Priority badge */}
      <span style={{
        fontSize: "9px", fontWeight: 800, letterSpacing: "0.05em",
        padding: "3px 8px", borderRadius: "4px",
        background: p.bg, color: p.color,
        display: "inline-block", textAlign: "center",
      }}>
        {p.label}
      </span>

      {/* TPS info */}
      <div>
        <div style={{ fontSize: "11px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.3 }}>{tps.name}</div>
        <div style={{ fontSize: "9px", color: "var(--text-secondary)", opacity: 0.7 }}>{tps.kecamatan}</div>
      </div>

      {/* Volume */}
      <div style={{ fontSize: "11px", color: "var(--text-primary)", fontFamily: "'JetBrains Mono', monospace" }}>
        {tps.currentVolume.toLocaleString()}<span style={{ fontSize: "9px", color: "var(--text-secondary)", marginLeft: "2px" }}>kg</span>
      </div>

      {/* Fill bar */}
      <div>
        <div style={{ fontSize: "10px", fontWeight: 700, color: fillBarColor, marginBottom: "3px" }}>{tps.fillPct}%</div>
        <div style={{ height: "4px", background: "rgba(255,255,255,0.08)", borderRadius: "2px", overflow: "hidden" }}>
          <div style={{
            width: `${tps.fillPct}%`, height: "100%",
            background: `linear-gradient(90deg, ${fillBarColor}, ${fillBarColor}aa)`,
            borderRadius: "2px", transition: "width 0.5s ease",
          }} />
        </div>
      </div>

      {/* Truck selector */}
      <div style={{ position: "relative" }}>
        <select
          value={selectedTruckId}
          onChange={(e) => onSelectTruck(e.target.value)}
          style={{
            width: "100%",
            padding: "5px 8px",
            borderRadius: "6px",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-primary)",
            fontSize: "10px",
            cursor: "pointer",
            outline: "none",
            appearance: "none",
          }}
        >
          <option value="" style={{ background: "#0f172a" }}>— Pilih Truk —</option>
          {truckOptions.map((t) => (
            <option key={t.id} value={t.id} style={{ background: "#0f172a" }}>
              {t.isRecommended ? "★ " : ""}{t.code} · {truckTypeLabel[t.type] || t.type}
              {t.isRecommended && t.distanceKm > 0 ? ` · ${t.distanceKm}km` : ""}
            </option>
          ))}
        </select>
        {/* Recommended badge */}
        {recommendedTruck && selectedTruckId === recommendedTruck.id && (
          <div style={{
            position: "absolute", top: "-6px", right: "4px",
            fontSize: "8px", fontWeight: 700,
            padding: "1px 5px", borderRadius: "3px",
            background: "rgba(16,185,129,0.18)", color: "#34d399",
          }}>
            AI Rec.
          </div>
        )}
      </div>

      {/* Dispatch button */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={onDispatch}
          disabled={isDispatching || !selectedTruckId}
          style={{
            padding: "5px 14px",
            borderRadius: "6px",
            background: isDispatching ? "rgba(59,130,246,0.2)" : selectedTruckId ? "rgba(59,130,246,0.85)" : "rgba(255,255,255,0.05)",
            border: "1px solid " + (selectedTruckId ? "rgba(59,130,246,0.5)" : "rgba(255,255,255,0.08)"),
            color: selectedTruckId ? "white" : "var(--text-secondary)",
            fontSize: "11px", fontWeight: 600,
            cursor: selectedTruckId && !isDispatching ? "pointer" : "not-allowed",
            transition: "all 0.15s",
            display: "flex", alignItems: "center", gap: "5px",
            whiteSpace: "nowrap",
          }}
          onMouseEnter={(e) => { if (selectedTruckId && !isDispatching) e.currentTarget.style.background = "rgba(59,130,246,1)"; }}
          onMouseLeave={(e) => { if (selectedTruckId && !isDispatching) e.currentTarget.style.background = "rgba(59,130,246,0.85)"; }}
        >
          {isDispatching
            ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Mengirim…</>
            : <>▶ Kirim</>
          }
        </button>
      </div>
    </div>
  );
}

function StatusPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "5px",
      padding: "4px 10px", borderRadius: "20px",
      background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.08)",
      fontSize: "11px", color: "var(--text-secondary)",
    }}>
      <div style={{ width: "5px", height: "5px", borderRadius: "50%", background: color }} />
      <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function CostBadge({ label, value, color }: { label: string; value: number; color: string }) {
  const formatted = value >= 1_000_000
    ? `Rp ${(value / 1_000_000).toFixed(1)}jt`
    : `Rp ${(value / 1_000).toFixed(0)}rb`;
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      padding: "3px 12px", marginRight: "8px",
      background: `${color}12`, border: `1px solid ${color}30`, borderRadius: "6px",
    }}>
      <span style={{ fontSize: "8px", color: "var(--text-secondary)", letterSpacing: "0.04em" }}>{label}</span>
      <span style={{ fontSize: "12px", fontWeight: 700, color, fontFamily: "'JetBrains Mono', monospace" }}>{formatted}</span>
    </div>
  );
}

function CompactToggle({ label, color, checked, onChange }: { label: string; color: string; checked: boolean; onChange: () => void }) {
  return (
    <button
      onClick={onChange}
      style={{
        padding: "4px 8px", borderRadius: "6px", cursor: "pointer",
        background: checked ? `${color}20` : "rgba(255,255,255,0.04)",
        border: `1px solid ${checked ? `${color}40` : "rgba(255,255,255,0.08)"}`,
        color: checked ? color : "var(--text-secondary)",
        fontSize: "10px", fontWeight: 600,
        transition: "all 0.15s",
        display: "flex", alignItems: "center", gap: "4px",
      }}
    >
      <div style={{
        width: "4px", height: "4px", borderRadius: "50%",
        background: checked ? color : "transparent",
        border: `1px solid ${color}`, transition: "all 0.15s",
      }} />
      {label}
    </button>
  );
}
