import { useState, useMemo, useCallback, useEffect } from "react";
import { toast } from "sonner";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, ReferenceLine,
} from "recharts";
import FleetMap from "../features/fleet/components/FleetMap";
import { useFleetStream } from "../features/fleet/hooks/useFleetStream";
import { fleet } from "../features/fleet/api/fleetApi";
import type { TruckData, WaypointStop, TaskSuggestion, AvailableTruck } from "../features/fleet/api/fleetApi";

// ── Constants ────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, string> = {
  AVAILABLE: "#10b981",
  EN_ROUTE_TO_TPS: "#3b82f6",
  LOADING: "#f59e0b",
  EN_ROUTE_TO_HUB: "#8b5cf6",
  UNLOADING: "#ef4444",
};

const STATUS_LABEL: Record<string, string> = {
  AVAILABLE: "Idle",
  EN_ROUTE_TO_TPS: "Ke TPS",
  LOADING: "Muat",
  EN_ROUTE_TO_HUB: "Ke Hub",
  UNLOADING: "Bongkar",
};

const PRIORITY_CFG = {
  KRITIS: { color: "#ef4444", bg: "rgba(239,68,68,0.13)", label: "KRITIS" },
  TINGGI: { color: "#f59e0b", bg: "rgba(245,158,11,0.13)", label: "TINGGI" },
  SEDANG: { color: "#3b82f6", bg: "rgba(59,130,246,0.13)", label: "SEDANG" },
};

const TRUCK_TYPE_LABEL: Record<string, string> = {
  COMPACTOR: "Compactor",
  DUMP_TRUCK: "Dump Truck",
  ARM_ROLL: "Arm Roll",
};

const FUEL_EFF: Record<string, number> = { COMPACTOR: 8, DUMP_TRUCK: 6, ARM_ROLL: 7 };
const FUEL_PRICE = 24800;

const COST_BAR_H = 42;
const COST_CHART_H = 300;
const TASK_BAR_H = 44;
const TASK_PANEL_H = 320;
const CHART_HOURS = [0, 2, 4, 6, 8, 10, 12, 16, 20, 24];

// ── Helpers ──────────────────────────────────────────────────────────────────

function calcRouteCost(truck: TruckData) {
  const km = (truck.routeDistance || 0) / 1000;
  const eff = FUEL_EFF[truck.type] || 7;
  const L = km / eff;
  return { costRp: L * FUEL_PRICE, liters: L, distKm: km, durationSec: truck.routeDuration || 3600 };
}

function getPlannedLoad(truck: TruckData): number {
  if (truck.status === "EN_ROUTE_TO_TPS" && truck.routeWaypoints) {
    const remaining = (truck.routeWaypoints as WaypointStop[]).reduce((s, w) => s + (w.collectedKg || 0), 0);
    return truck.currentLoadKg + remaining;
  }
  return truck.currentLoadKg;
}

/** Minutes until truck finishes current leg (to current TPS or to hub) */
function etaCurrentLegMin(truck: TruckData): number | null {
  if (!truck.routeDuration || truck.routeProgress >= 1) return null;
  const remaining = (1 - truck.routeProgress) * truck.routeDuration;
  return Math.max(1, Math.ceil(remaining / 60));
}

/** Minutes until truck is back at hub (current leg + remaining TPS stops estimated) */
function etaHubMin(truck: TruckData): number | null {
  const legMin = etaCurrentLegMin(truck);
  if (legMin == null) return null;
  if (truck.status === "EN_ROUTE_TO_HUB") return legMin;
  // For EN_ROUTE_TO_TPS: add estimate per remaining waypoint leg + hub return
  const remainingWps = (truck.routeWaypoints as WaypointStop[] | null)?.filter((w) => w.collectedKg > 0) || [];
  // Each extra stop: avg 3km apart at 50km/h = ~4 min + 2 min loading = 6 min per stop
  const extraStopsMin = Math.max(0, remainingWps.length - 1) * 6;
  // Hub return estimate: ~20 min average (weighted by fleet distribution in Surabaya)
  const hubReturnMin = 20;
  return legMin + extraStopsMin + hubReturnMin;
}

function fmtDur(min: number | null): string {
  if (min == null) return "—";
  if (min < 60) return `${min}m`;
  return `${Math.floor(min / 60)}j ${min % 60}m`;
}

function fmtRp(v: number) {
  if (v >= 1_000_000_000) return `Rp ${(v / 1_000_000_000).toFixed(1)}M`;
  if (v >= 1_000_000) return `Rp ${(v / 1_000_000).toFixed(1)}jt`;
  return `Rp ${(v / 1_000).toFixed(0)}rb`;
}

// ── Main Component ────────────────────────────────────────────────────────────

export default function LogisticsPage() {
  const { trucks, tps, facilities: _facilities, allFacilities, lastUpdate, connected } = useFleetStream();

  const [showCompactor, setShowCompactor] = useState(true);
  const [showDumpTruck, setShowDumpTruck] = useState(true);
  const [showArmRoll, setShowArmRoll] = useState(true);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selectedTruckId, setSelectedTruckId] = useState<string | null>(null);
  const [feedOpen, setFeedOpen] = useState(true);
  const [costChartOpen, setCostChartOpen] = useState(true);
  const [taskPanelOpen, setTaskPanelOpen] = useState(false);

  const [suggestions, setSuggestions] = useState<TaskSuggestion[]>([]);
  const [availableTrucks, setAvailableTrucks] = useState<AvailableTruck[]>([]);
  const [selectedTrucks, setSelectedTrucks] = useState<Record<string, string>>({});
  const [suggestionsLoading, setSuggestionsLoading] = useState(false);
  const [dispatching, setDispatching] = useState<string | null>(null);
  const [dispatched, setDispatched] = useState<Set<string>>(new Set());

  const handleTruckClick = useCallback((t: TruckData) => {
    setSelectedTruckId((prev) => (prev === t.id ? null : t.id));
  }, []);

  const active = useMemo(() => trucks.filter((t) => t.status !== "AVAILABLE").length, [trucks]);
  const idle   = useMemo(() => trucks.filter((t) => t.status === "AVAILABLE").length, [trucks]);

  // ── Cost summary ────────────────────────────────────────────────────────────
  const costSummary = useMemo(() => {
    const pool = trucks.filter((t) => t.status !== "AVAILABLE" && (t.routeDistance || 0) > 0);
    if (pool.length === 0) return null;

    const routes = pool.map((t) => ({ ...calcRouteCost(t), type: t.type }));
    const byType: Record<string, { count: number; avgCost: number; avgDur: number }> = {};
    for (const r of routes) {
      if (!byType[r.type]) byType[r.type] = { count: 0, avgCost: 0, avgDur: 0 };
      byType[r.type].count++;
      byType[r.type].avgCost += r.costRp;
      byType[r.type].avgDur  += r.durationSec;
    }
    for (const k of Object.keys(byType)) {
      byType[k].avgCost /= byType[k].count;
      byType[k].avgDur  /= byType[k].count;
    }

    const trips = (h: number, dur: number) => Math.max(1, Math.floor((h * 3600) / Math.max(dur, 600)));
    const totalCostFor = (h: number) =>
      Object.values(byType).reduce((s, st) => s + trips(h, st.avgDur) * st.count * st.avgCost, 0);
    const totalKgFor = (h: number) => {
      const avgKgPerTrip = pool.reduce((s, t) => s + getPlannedLoad(t), 0) / pool.length;
      return Object.values(byType).reduce((s, st) => s + trips(h, st.avgDur) * st.count * avgKgPerTrip, 0);
    };

    const chartData = CHART_HOURS.map((h) => {
      const pt: Record<string, number | string> = { label: h === 0 ? "0j" : `${h}j` };
      if (h === 0) { pt.COMPACTOR = 0; pt.DUMP_TRUCK = 0; pt.ARM_ROLL = 0; pt.tonDiproses = 0; return pt; }
      for (const [type, st] of Object.entries(byType)) {
        pt[type] = Math.round(trips(h, st.avgDur) * st.count * st.avgCost);
      }
      pt.tonDiproses = Math.round(totalKgFor(h) / 100) / 10; // tons with 1 decimal
      return pt;
    });

    // Per-truck ETA details for completion projection
    const truckDetails = pool.map((t) => ({
      id: t.id, code: t.code, type: t.type,
      etaHubMin: etaHubMin(t),
      etaLegMin: etaCurrentLegMin(t),
      totalKg: getPlannedLoad(t),
      costRp: calcRouteCost(t).costRp,
      status: t.status,
    }));

    // Group by completion bucket
    const BUCKETS = [
      { label: "< 30 mnt",  max: 30 },
      { label: "30–60 mnt", max: 60 },
      { label: "1–2 jam",   max: 120 },
      { label: "2–4 jam",   max: 240 },
      { label: "> 4 jam",   max: Infinity },
    ];
    const completionBuckets = BUCKETS.map((b, i) => {
      const prev = i === 0 ? 0 : BUCKETS[i - 1].max;
      const inBucket = truckDetails.filter((t) =>
        t.etaHubMin != null && t.etaHubMin > prev && t.etaHubMin <= b.max
      );
      return {
        label: b.label,
        count: inBucket.length,
        totalKg: Math.round(inBucket.reduce((s, t) => s + t.totalKg, 0)),
        totalCost: Math.round(inBucket.reduce((s, t) => s + t.costRp, 0)),
      };
    }).filter((b) => b.count > 0);

    const totalKg = Math.round(pool.reduce((s, t) => s + getPlannedLoad(t), 0));
    const totalCurrentCost = Math.round(routes.reduce((s, r) => s + r.costRp, 0));

    return {
      nTrucks: pool.length,
      totalKg,
      totalCurrentCost,
      costPerTon: totalKg > 0 ? Math.round(totalCurrentCost / (totalKg / 1000)) : 0,
      totalLiters: Math.round(routes.reduce((s, r) => s + r.liters, 0) * 10) / 10,
      cost6h: Math.round(totalCostFor(6)),
      cost12h: Math.round(totalCostFor(12)),
      cost24h: Math.round(totalCostFor(24)),
      ton6h: Math.round(totalKgFor(6) / 10) / 100,   // tons
      ton12h: Math.round(totalKgFor(12) / 10) / 100,
      ton24h: Math.round(totalKgFor(24) / 10) / 100,
      avgDurMin: Math.round(routes.reduce((s, r) => s + r.durationSec, 0) / routes.length / 60),
      chartData,
      truckDetails,
      completionBuckets,
    };
  }, [trucks]);

  const sortedTrucks = useMemo(() => {
    const order: Record<string, number> = { EN_ROUTE_TO_TPS: 0, LOADING: 1, EN_ROUTE_TO_HUB: 2, UNLOADING: 3, AVAILABLE: 4 };
    return trucks
      .filter((t) => {
        if (t.type === "COMPACTOR") return showCompactor;
        if (t.type === "DUMP_TRUCK") return showDumpTruck;
        if (t.type === "ARM_ROLL")   return showArmRoll;
        return true;
      })
      .slice()
      .sort((a, b) => (order[a.status] ?? 5) - (order[b.status] ?? 5));
  }, [trucks, showCompactor, showDumpTruck, showArmRoll]);

  const tpsMap = useMemo(() => new Map(tps.map((t) => [t.id, t])), [tps]);

  // ── Suggestions ─────────────────────────────────────────────────────────────
  const fetchSuggestions = useCallback(async () => {
    setSuggestionsLoading(true);
    try {
      const data = await fleet.getTaskSuggestions();
      setSuggestions(data.suggestions);
      setAvailableTrucks(data.availableTrucks);
      setDispatched(new Set());
      const init: Record<string, string> = {};
      data.suggestions.forEach((s) => { if (s.recommendedTruck) init[s.tps.id] = s.recommendedTruck.id; });
      setSelectedTrucks(init);
    } catch {
      toast.error("Gagal memuat saran tugas");
    } finally {
      setSuggestionsLoading(false);
    }
  }, []);

  useEffect(() => { if (taskPanelOpen) fetchSuggestions(); }, [taskPanelOpen, fetchSuggestions]);

  const handleDispatch = async (tpsId: string) => {
    const truckId = selectedTrucks[tpsId];
    if (!truckId) { toast.error("Pilih truk terlebih dahulu"); return; }
    const selectedTruck = availableTrucks.find((t) => t.id === truckId);
    if (selectedTruck?.currentStatus === "EN_ROUTE_TO_HUB") {
      toast.error(`Truk ${selectedTruck.code} sedang kembali ke hub (ETA ${selectedTruck.etaMinutes} mnt). Tunggu hingga tersedia.`);
      return;
    }
    setDispatching(tpsId);
    try {
      await fleet.dispatchTask(truckId, tpsId);
      toast.success("Truk berhasil dikirim ke TPS");
      setDispatched((prev) => new Set([...prev, tpsId]));
      setAvailableTrucks((prev) => prev.filter((t) => t.id !== truckId));
      setSelectedTrucks((prev) => {
        const next = { ...prev };
        Object.keys(next).forEach((k) => { if (next[k] === truckId) delete next[k]; });
        return next;
      });
    } catch (err: any) {
      toast.error(err.message || "Gagal mengirim truk");
    } finally {
      setDispatching(null);
    }
  };

  const activeSuggestions = suggestions.filter((s) => !dispatched.has(s.tps.id));

  const mapHeight = useMemo(() => {
    let sub = COST_BAR_H + TASK_BAR_H;
    if (costChartOpen && costSummary) sub += COST_CHART_H;
    if (taskPanelOpen) sub += TASK_PANEL_H;
    return `calc(100vh - 120px - ${sub}px)`;
  }, [costChartOpen, costSummary, taskPanelOpen]);

  // ── Render ───────────────────────────────────────────────────────────────────
  return (
    <div style={{ display: "flex", flexDirection: "column", height: "calc(100vh - 120px)", animation: "fadeIn 0.4s ease" }}>
      {/* MAP */}
      <div style={{
        position: "relative", height: mapHeight,
        transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
        minHeight: "220px", borderRadius: "12px 12px 0 0", overflow: "hidden",
      }}>
        {/* Top overlay bar */}
        <div style={{
          position: "absolute", top: 0, left: 0, right: 0, zIndex: 1000,
          display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px",
          background: "linear-gradient(180deg,rgba(15,23,42,0.94) 0%,rgba(15,23,42,0.55) 80%,transparent 100%)",
          backdropFilter: "blur(10px)", pointerEvents: "none",
        }}>
          <div style={{ pointerEvents: "auto", display: "flex", alignItems: "center", gap: "14px" }}>
            <div style={{ display: "flex", gap: "8px" }}>
              <StatusPill color="#3b82f6" label="Aktif"  value={active} />
              <StatusPill color="#10b981" label="Idle"   value={idle} />
              <StatusPill color="#6b7280" label="Total"  value={trucks.length} />
            </div>
            <div style={{ width: "1px", height: "22px", background: "rgba(255,255,255,0.12)" }} />
            <div style={{ display: "flex", gap: "6px" }}>
              <FilterChip label="Compactor" color="#3b82f6" on={showCompactor} toggle={() => setShowCompactor(v => !v)} />
              <FilterChip label="Dump Truck" color="#f59e0b" on={showDumpTruck} toggle={() => setShowDumpTruck(v => !v)} />
              <FilterChip label="Arm Roll"   color="#10b981" on={showArmRoll}   toggle={() => setShowArmRoll(v => !v)} />
              <FilterChip label="Rute"       color="#8b5cf6" on={showRoutes}    toggle={() => setShowRoutes(v => !v)} />
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "11px", color: "var(--text-secondary)" }}>
              <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: connected ? "#10b981" : "#ef4444", display: "inline-block", animation: connected ? "pulse 2s infinite" : "none" }} />
              {connected ? "Live" : "Offline"}
              {lastUpdate && <span style={{ opacity: 0.45 }}>{new Date(lastUpdate).toLocaleTimeString()}</span>}
            </div>
          </div>
        </div>

        <div style={{ position: "absolute", inset: 0 }}>
          <FleetMap
            trucks={trucks} tps={tps} facilities={allFacilities}
            showCompactor={showCompactor} showDumpTruck={showDumpTruck}
            showArmRoll={showArmRoll} showRoutes={showRoutes}
            selectedTruckId={selectedTruckId} onTruckClick={handleTruckClick}
          />
        </div>

        {/* Live Feed sidebar */}
        <div style={{
          position: "absolute", top: "68px", right: "18px", bottom: "14px",
          width: feedOpen ? "300px" : "42px", zIndex: 1000,
          display: "flex", flexDirection: "column",
          transition: "width 0.25s cubic-bezier(0.4,0,0.2,1)",
        }}>
          <button onClick={() => setFeedOpen(v => !v)} style={{
            position: "absolute", top: "10px", left: "-18px", zIndex: 1001,
            width: "34px", height: "34px", borderRadius: "50%",
            background: "rgba(15,23,42,0.92)", border: "1px solid rgba(255,255,255,0.18)",
            color: "white", cursor: "pointer", fontSize: "15px",
            display: "flex", alignItems: "center", justifyContent: "center",
            boxShadow: "0 4px 14px rgba(0,0,0,0.35)", transition: "transform 0.2s",
          }}
            onMouseEnter={(e) => (e.currentTarget.style.transform = "scale(1.1)")}
            onMouseLeave={(e) => (e.currentTarget.style.transform = "scale(1)")}
          >{feedOpen ? "›" : "‹"}</button>

          {feedOpen && (
            <div style={{
              flex: 1, display: "flex", flexDirection: "column",
              background: "rgba(13,20,38,0.92)", backdropFilter: "blur(18px)",
              border: "1px solid rgba(255,255,255,0.1)", borderRadius: "14px",
              overflow: "hidden", boxShadow: "0 10px 40px rgba(0,0,0,0.5)",
            }}>
              <div style={{ padding: "14px 16px", borderBottom: "1px solid rgba(255,255,255,0.07)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <span style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>Live Feed Armada</span>
                <span style={{ fontSize: "11px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.06)", padding: "2px 8px", borderRadius: "10px" }}>{sortedTrucks.length} unit</span>
              </div>
              <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto", padding: "8px 10px" }}>
                {sortedTrucks.map((truck) => {
                  const sel       = truck.id === selectedTruckId;
                  const color     = STATUS_COLOR[truck.status] || "#6b7280";
                  const wps       = (truck.routeWaypoints as WaypointStop[] | null) || [];
                  const activeWps = wps.filter((w) => w.collectedKg > 0);
                  const tpsName   = truck.assignedTpsId ? (tpsMap.get(truck.assignedTpsId)?.name || "—") : "—";
                  const planned   = getPlannedLoad(truck);
                  const hasPlanned = truck.status === "EN_ROUTE_TO_TPS" && truck.currentLoadKg < planned;
                  const legMin    = etaCurrentLegMin(truck);
                  const hubMin    = etaHubMin(truck);
                  return (
                    <div key={truck.id} onClick={() => handleTruckClick(truck)} style={{
                      padding: "9px 12px", marginBottom: "3px",
                      background: sel ? "rgba(59,130,246,0.14)" : "rgba(255,255,255,0.01)",
                      borderRadius: "8px", cursor: "pointer",
                      borderLeft: `3px solid ${sel ? color : "transparent"}`,
                      transition: "all 0.15s",
                    }}
                      onMouseEnter={(e) => { if (!sel) e.currentTarget.style.background = "rgba(255,255,255,0.04)"; }}
                      onMouseLeave={(e) => { if (!sel) e.currentTarget.style.background = "rgba(255,255,255,0.01)"; }}
                    >
                      {/* Row 1: code + status + load */}
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "3px" }}>
                        <div style={{ display: "flex", alignItems: "center", gap: "7px" }}>
                          <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)", fontFamily: "monospace" }}>{truck.code}</span>
                          <span style={{ fontSize: "9px", fontWeight: 600, padding: "2px 6px", borderRadius: "4px", background: `${color}22`, color }}>{STATUS_LABEL[truck.status]}</span>
                        </div>
                        {truck.status !== "AVAILABLE" && (
                          <span style={{ fontSize: "10px", color: hasPlanned ? "#60a5fa" : "var(--text-secondary)", fontStyle: hasPlanned ? "italic" : "normal" }}>
                            {planned > 0 ? `${planned.toLocaleString()} kg` : "—"}{hasPlanned ? " ↗" : ""}
                          </span>
                        )}
                      </div>
                      {/* Row 2: destination */}
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", lineHeight: 1.5, marginLeft: "2px" }}>
                        {truck.status === "AVAILABLE" && <span style={{ opacity: 0.45 }}>Menunggu tugas</span>}
                        {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length > 1 && (
                          <span style={{ color: "#60a5fa" }}>{activeWps.map((w, i) => <span key={w.tpsId}>{i > 0 && <span style={{ opacity: 0.4 }}> → </span>}{w.tpsName}</span>)}</span>
                        )}
                        {truck.status === "EN_ROUTE_TO_TPS" && activeWps.length <= 1 && <span style={{ color: "#60a5fa" }}>{tpsName}</span>}
                        {truck.status === "EN_ROUTE_TO_HUB" && <span style={{ color: "#a78bfa" }}>→ Kembali ke Hub</span>}
                        {(truck.status === "LOADING" || truck.status === "UNLOADING") && <span style={{ color: "#fbbf24" }}>{tpsName}</span>}
                      </div>
                      {/* Row 3: ETA badges */}
                      {(legMin != null || hubMin != null) && (
                        <div style={{ display: "flex", gap: "5px", marginTop: "5px", flexWrap: "wrap" }}>
                          {legMin != null && truck.status === "EN_ROUTE_TO_TPS" && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: "rgba(59,130,246,0.15)", color: "#60a5fa", fontWeight: 600 }}>
                              TPS ~{fmtDur(legMin)}
                            </span>
                          )}
                          {legMin != null && truck.status === "EN_ROUTE_TO_HUB" && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: "rgba(139,92,246,0.15)", color: "#a78bfa", fontWeight: 600 }}>
                              Hub ~{fmtDur(legMin)}
                            </span>
                          )}
                          {hubMin != null && truck.status === "EN_ROUTE_TO_TPS" && (
                            <span style={{ fontSize: "9px", padding: "1px 6px", borderRadius: "4px", background: "rgba(16,185,129,0.12)", color: "#34d399", fontWeight: 600 }}>
                              Selesai ~{fmtDur(hubMin)}
                            </span>
                          )}
                        </div>
                      )}
                      {/* Row 4: progress bar */}
                      {truck.routeProgress > 0 && truck.routeProgress < 1 && (
                        <div style={{ marginTop: "5px", height: "3px", background: "rgba(255,255,255,0.07)", borderRadius: "2px" }}>
                          <div style={{ width: `${truck.routeProgress * 100}%`, height: "100%", background: `linear-gradient(90deg,${color},${color}88)`, borderRadius: "2px", transition: "width 0.5s ease" }} />
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

      {/* COST CHART TOGGLE */}
      <button onClick={() => setCostChartOpen(v => !v)} style={{
        height: `${COST_BAR_H}px`, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px",
        background: "rgba(10,18,36,0.98)",
        borderLeft: "1px solid rgba(255,255,255,0.08)",
        borderRight: "1px solid rgba(255,255,255,0.08)",
        borderTop: "1px solid rgba(255,255,255,0.1)",
        borderBottom: costChartOpen && costSummary ? "none" : "1px solid rgba(255,255,255,0.08)",
        cursor: "pointer", color: "var(--text-primary)", transition: "background 0.15s",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(18,28,52,0.99)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(10,18,36,0.98)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px" }}>{costChartOpen ? "▼" : "▲"}</span>
          <span style={{ fontSize: "12px", fontWeight: 700 }}>Estimasi Biaya BBM Operasional</span>
          {costSummary ? (
            <div style={{ display: "flex", alignItems: "center", gap: "8px", marginLeft: "4px" }}>
              <Pill color="#10b981">{(costSummary.totalKg / 1000).toFixed(1)} ton transit</Pill>
              <Pill color="#f59e0b">Rp{Math.round(costSummary.costPerTon / 1000)}rb/ton</Pill>
              <Pill color="#3b82f6">{fmtRp(costSummary.cost6h)} / 6j</Pill>
              <Pill color="#8b5cf6">{fmtRp(costSummary.cost12h)} / 12j</Pill>
              <Pill color="#ef4444">{fmtRp(costSummary.cost24h)} / 24j</Pill>
            </div>
          ) : (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.5 }}>Menunggu data truk aktif…</span>
          )}
        </div>
        <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{costChartOpen ? "Sembunyikan" : "Tampilkan"}</span>
      </button>

      {/* COST CHART PANEL */}
      <div style={{
        height: costChartOpen && costSummary ? `${COST_CHART_H}px` : "0px",
        overflow: "hidden", transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
        background: "rgba(10,18,36,0.98)",
        border: costChartOpen && costSummary ? "1px solid rgba(255,255,255,0.08)" : "none",
        borderTop: "none", flexShrink: 0,
      }}>
        {costChartOpen && costSummary && (
          <div style={{ height: "100%", display: "flex", gap: "16px", padding: "12px 18px 10px" }}>

            {/* ── Col 1: Biaya kumulatif + efisiensi ── */}
            <div style={{ width: "200px", display: "flex", flexDirection: "column", gap: "7px", flexShrink: 0 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1px" }}>Proyeksi Biaya BBM</div>
              <CostCard label="Per 6 Jam"  value={costSummary.cost6h}  ton={costSummary.ton6h}  color="#3b82f6" />
              <CostCard label="Per 12 Jam" value={costSummary.cost12h} ton={costSummary.ton12h} color="#8b5cf6" />
              <CostCard label="Per 24 Jam" value={costSummary.cost24h} ton={costSummary.ton24h} color="#f59e0b" />
              {/* Efficiency */}
              <div style={{ marginTop: "4px", padding: "8px 10px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ fontSize: "9px", color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: "4px" }}>Efisiensi Saat Ini</div>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <span style={{ fontSize: "14px", fontWeight: 800, color: "#10b981", fontFamily: "monospace" }}>
                    {fmtRp(costSummary.costPerTon)}
                  </span>
                  <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>per ton</span>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "3px", lineHeight: 1.6 }}>
                  <div>{costSummary.nTrucks} truk · {(costSummary.totalKg / 1000).toFixed(1)} ton transit</div>
                  <div>{costSummary.totalLiters} L · avg {costSummary.avgDurMin}m/trip</div>
                </div>
              </div>
            </div>

            {/* ── Col 2: Stacked bar chart biaya vs ton ── */}
            <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "5px", display: "flex", gap: "14px", alignItems: "center" }}>
                <span style={{ fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase" }}>Biaya Operasional vs Ton Diproses</span>
                {[["COMPACTOR","#3b82f6","Compactor"],["DUMP_TRUCK","#f59e0b","Dump Truck"],["ARM_ROLL","#10b981","Arm Roll"]].map(([,c,l]) => (
                  <span key={l} style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ width: "7px", height: "7px", borderRadius: "2px", background: c, display: "inline-block" }} />
                    <span>{l}</span>
                  </span>
                ))}
                <span style={{ display: "flex", alignItems: "center", gap: "4px", marginLeft: "auto" }}>
                  <span style={{ width: "14px", height: "2px", background: "#34d399", display: "inline-block", borderRadius: "1px" }} />
                  <span>Ton diproses</span>
                </span>
              </div>
              <ResponsiveContainer width="99%" height={COST_CHART_H - 48}>
                <BarChart data={costSummary.chartData} margin={{ top: 6, right: 40, left: 0, bottom: 0 }} barCategoryGap="22%">
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.06)" vertical={false} />
                  <XAxis dataKey="label" tick={{ fontSize: 11, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} />
                  <YAxis yAxisId="cost" tick={{ fontSize: 10, fill: "var(--text-secondary)" }} axisLine={false} tickLine={false} width={58}
                    tickFormatter={(v) => v >= 1_000_000 ? `${(v/1_000_000).toFixed(0)}jt` : v >= 1000 ? `${(v/1000).toFixed(0)}rb` : String(v)} />
                  <YAxis yAxisId="ton" orientation="right" tick={{ fontSize: 10, fill: "#34d399" }} axisLine={false} tickLine={false} width={34}
                    tickFormatter={(v) => `${v}t`} />
                  <RechartsTooltip
                    contentStyle={{ background: "rgba(10,18,36,0.97)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: "10px", fontSize: "12px" }}
                    labelStyle={{ color: "var(--text-primary)", fontWeight: 700, marginBottom: "6px" }}
                    formatter={(v, name) =>
                      name === "tonDiproses" ? [`${v} ton`, "Ton Diproses"] : [fmtRp(v as number), TRUCK_TYPE_LABEL[name as string] || name]
                    }
                  />
                  <ReferenceLine yAxisId="cost" x="6j"  stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1.5} />
                  <ReferenceLine yAxisId="cost" x="12j" stroke="#8b5cf6" strokeDasharray="4 2" strokeWidth={1.5} />
                  <ReferenceLine yAxisId="cost" x="24j" stroke="#f59e0b" strokeDasharray="4 2" strokeWidth={1.5} />
                  <Bar yAxisId="cost" dataKey="COMPACTOR"  stackId="a" fill="#3b82f6" fillOpacity={0.82} />
                  <Bar yAxisId="cost" dataKey="DUMP_TRUCK" stackId="a" fill="#f59e0b" fillOpacity={0.82} />
                  <Bar yAxisId="cost" dataKey="ARM_ROLL"   stackId="a" fill="#10b981" fillOpacity={0.82} radius={[3,3,0,0]} />
                  <Bar yAxisId="ton"  dataKey="tonDiproses" fill="#34d399" fillOpacity={0.25} radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* ── Col 3: ETA Completion projection ── */}
            <div style={{ width: "220px", display: "flex", flexDirection: "column", gap: "6px", flexShrink: 0 }}>
              <div style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-secondary)", letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: "1px" }}>Proyeksi Penyelesaian Trip</div>
              {costSummary.completionBuckets.length === 0 ? (
                <div style={{ fontSize: "11px", color: "var(--text-secondary)", opacity: 0.45, marginTop: "8px" }}>Tidak ada data ETA</div>
              ) : (
                costSummary.completionBuckets.map((b) => (
                  <div key={b.label} style={{
                    padding: "8px 10px", borderRadius: "8px",
                    background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)",
                  }}>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "4px" }}>
                      <span style={{ fontSize: "11px", fontWeight: 700, color: "var(--text-primary)" }}>{b.label}</span>
                      <span style={{ fontSize: "10px", color: "var(--text-secondary)", background: "rgba(255,255,255,0.07)", padding: "1px 7px", borderRadius: "8px" }}>
                        {b.count} truk
                      </span>
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                      <div>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#3b82f6", fontFamily: "monospace" }}>{fmtRp(b.totalCost)}</div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "1px" }}>biaya BBM</div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ fontSize: "13px", fontWeight: 800, color: "#10b981", fontFamily: "monospace" }}>{(b.totalKg / 1000).toFixed(1)}t</div>
                        <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: "1px" }}>sampah</div>
                      </div>
                    </div>
                    {/* mini efficiency */}
                    {b.totalKg > 0 && (
                      <div style={{ marginTop: "4px", fontSize: "9px", color: "var(--text-secondary)", opacity: 0.7, borderTop: "1px solid rgba(255,255,255,0.05)", paddingTop: "4px" }}>
                        {fmtRp(Math.round(b.totalCost / (b.totalKg / 1000)))}/ton
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>

          </div>
        )}
      </div>

      {/* TASK PANEL TOGGLE */}
      <button onClick={() => setTaskPanelOpen(v => !v)} style={{
        height: `${TASK_BAR_H}px`, flexShrink: 0,
        display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0 18px",
        background: "rgba(15,23,42,0.97)",
        borderLeft: "1px solid rgba(255,255,255,0.09)",
        borderRight: "1px solid rgba(255,255,255,0.09)",
        borderTop: "1px solid rgba(255,255,255,0.07)",
        borderBottom: taskPanelOpen ? "none" : "1px solid rgba(255,255,255,0.09)",
        borderRadius: taskPanelOpen ? "0" : "0 0 12px 12px",
        cursor: "pointer", color: "var(--text-primary)", transition: "background 0.15s",
      }}
        onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(25,38,60,0.99)")}
        onMouseLeave={(e) => (e.currentTarget.style.background = "rgba(15,23,42,0.97)")}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "14px" }}>{taskPanelOpen ? "▼" : "▲"}</span>
          <span style={{ fontSize: "13px", fontWeight: 700 }}>Task yang Disarankan</span>
          {activeSuggestions.length > 0 && (
            <span style={{ fontSize: "11px", fontWeight: 700, padding: "2px 9px", borderRadius: "12px", background: "rgba(239,68,68,0.18)", color: "#f87171" }}>
              {activeSuggestions.length} TPS
            </span>
          )}
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          {taskPanelOpen && (
            <button onClick={(e) => { e.stopPropagation(); fetchSuggestions(); }} style={{
              fontSize: "11px", padding: "4px 12px", borderRadius: "6px",
              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)",
              color: "var(--text-secondary)", cursor: "pointer",
            }}>↻ Refresh</button>
          )}
          <span style={{ fontSize: "11px", color: "var(--text-secondary)" }}>{taskPanelOpen ? "Sembunyikan" : "Tampilkan"}</span>
        </div>
      </button>

      {/* TASK PANEL BODY */}
      <div style={{
        height: taskPanelOpen ? `${TASK_PANEL_H}px` : "0px",
        overflow: "hidden", transition: "height 0.3s cubic-bezier(0.4,0,0.2,1)",
        background: "rgba(13,20,38,0.99)",
        border: taskPanelOpen ? "1px solid rgba(255,255,255,0.09)" : "none",
        borderTop: "none", borderRadius: "0 0 12px 12px", flexShrink: 0,
      }}>
        {taskPanelOpen && (
          <div style={{ height: "100%", display: "flex", flexDirection: "column" }}>
            {/* Header row */}
            <div style={{
              display: "grid", gridTemplateColumns: "82px 1fr 110px 100px 1fr 120px",
              gap: "10px", padding: "10px 18px",
              borderBottom: "1px solid rgba(255,255,255,0.07)",
              fontSize: "10px", fontWeight: 700, letterSpacing: "0.08em",
              color: "var(--text-secondary)", textTransform: "uppercase",
            }}>
              <span>Prioritas</span>
              <span>TPS</span>
              <span>Volume</span>
              <span>Fill</span>
              <span>Armada Rekomendasi</span>
              <span style={{ textAlign: "right" }}>Aksi</span>
            </div>
            {/* Rows */}
            <div className="custom-scrollbar" style={{ flex: 1, overflowY: "auto" }}>
              {suggestionsLoading ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", gap: "10px", color: "var(--text-secondary)", fontSize: "13px" }}>
                  <span style={{ animation: "spin 1s linear infinite", display: "inline-block", fontSize: "16px" }}>⟳</span>
                  Memuat rekomendasi…
                </div>
              ) : activeSuggestions.length === 0 ? (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-secondary)", fontSize: "13px", opacity: 0.55 }}>
                  Tidak ada TPS yang membutuhkan layanan saat ini
                </div>
              ) : (
                activeSuggestions.map((s) => (
                  <SuggestionRow
                    key={s.tps.id}
                    suggestion={s}
                    availableTrucks={availableTrucks}
                    selectedTruckId={selectedTrucks[s.tps.id] || ""}
                    onSelectTruck={(id) => setSelectedTrucks((prev) => ({ ...prev, [s.tps.id]: id }))}
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

// ── Sub-components ────────────────────────────────────────────────────────────

function SuggestionRow({ suggestion, availableTrucks, selectedTruckId, onSelectTruck, onDispatch, isDispatching }: {
  suggestion: TaskSuggestion;
  availableTrucks: AvailableTruck[];
  selectedTruckId: string;
  onSelectTruck: (id: string) => void;
  onDispatch: () => void;
  isDispatching: boolean;
}) {
  const { tps, recommendedTruck, priority } = suggestion;
  const p = PRIORITY_CFG[priority];
  const fillColor = tps.fillPct >= 90 ? "#ef4444" : tps.fillPct >= 70 ? "#f59e0b" : "#3b82f6";

  const others = availableTrucks.filter((t) => t.id !== recommendedTruck?.id);
  const options = recommendedTruck
    ? [{ ...recommendedTruck, isRec: true }, ...others.map(t => ({ ...t, distanceKm: 0, score: 0, isRec: false }))]
    : others.map(t => ({ ...t, distanceKm: 0, score: 0, isRec: false }));

  const selTruck = availableTrucks.find((t) => t.id === selectedTruckId);
  const returning = selTruck?.currentStatus === "EN_ROUTE_TO_HUB";
  const canDispatch = !!selectedTruckId && !returning && !isDispatching;

  return (
    <div style={{
      display: "grid", gridTemplateColumns: "82px 1fr 110px 100px 1fr 120px",
      gap: "10px", padding: "10px 18px", alignItems: "center",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
      transition: "background 0.12s",
    }}
      onMouseEnter={(e) => (e.currentTarget.style.background = "rgba(255,255,255,0.03)")}
      onMouseLeave={(e) => (e.currentTarget.style.background = "transparent")}
    >
      {/* Priority */}
      <span style={{
        fontSize: "10px", fontWeight: 800, letterSpacing: "0.05em",
        padding: "4px 10px", borderRadius: "5px",
        background: p.bg, color: p.color, textAlign: "center",
      }}>{p.label}</span>

      {/* TPS */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 600, color: "var(--text-primary)", lineHeight: 1.4 }}>{tps.name}</div>
        <div style={{ fontSize: "10px", color: "var(--text-secondary)", opacity: 0.7 }}>{tps.kecamatan}</div>
      </div>

      {/* Volume */}
      <div style={{ fontSize: "12px", color: "var(--text-primary)", fontFamily: "monospace", fontWeight: 600 }}>
        {tps.currentVolume.toLocaleString()}
        <span style={{ fontSize: "10px", color: "var(--text-secondary)", marginLeft: "3px", fontWeight: 400 }}>kg</span>
      </div>

      {/* Fill bar */}
      <div>
        <div style={{ fontSize: "12px", fontWeight: 700, color: fillColor, marginBottom: "4px" }}>{tps.fillPct}%</div>
        <div style={{ height: "5px", background: "rgba(255,255,255,0.08)", borderRadius: "3px", overflow: "hidden" }}>
          <div style={{ width: `${tps.fillPct}%`, height: "100%", background: `linear-gradient(90deg,${fillColor},${fillColor}99)`, borderRadius: "3px", transition: "width 0.5s ease" }} />
        </div>
      </div>

      {/* Truck selector */}
      <div style={{ position: "relative" }}>
        <select value={selectedTruckId} onChange={(e) => onSelectTruck(e.target.value)} style={{
          width: "100%", padding: "6px 10px", borderRadius: "8px",
          background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.14)",
          color: "var(--text-primary)", fontSize: "11px", cursor: "pointer", outline: "none", appearance: "none",
        }}>
          <option value="" style={{ background: "#0f172a" }}>— Pilih Armada —</option>
          {options.map((t) => {
            const isRet = t.currentStatus === "EN_ROUTE_TO_HUB";
            const eta = t.etaMinutes != null ? ` · ETA ${t.etaMinutes}m` : "";
            const dist = t.isRec && t.distanceKm > 0 ? ` · ${t.distanceKm}km` : "";
            return (
              <option key={t.id} value={t.id} style={{ background: "#0f172a" }}>
                {t.isRec ? "★ " : ""}{t.code} · {TRUCK_TYPE_LABEL[t.type] || t.type}
                {isRet ? ` (Kembali${eta})` : dist}
              </option>
            );
          })}
        </select>
        {recommendedTruck && selectedTruckId === recommendedTruck.id && (
          <div style={{
            position: "absolute", top: "-7px", right: "6px",
            fontSize: "9px", fontWeight: 700, padding: "1px 6px", borderRadius: "4px",
            background: recommendedTruck.currentStatus === "EN_ROUTE_TO_HUB"
              ? "rgba(139,92,246,0.2)" : "rgba(16,185,129,0.2)",
            color: recommendedTruck.currentStatus === "EN_ROUTE_TO_HUB" ? "#a78bfa" : "#34d399",
          }}>
            {recommendedTruck.currentStatus === "EN_ROUTE_TO_HUB"
              ? `AI Rec. · ETA ${recommendedTruck.etaMinutes}m`
              : "AI Rec."}
          </div>
        )}
        {returning && (
          <div style={{ fontSize: "10px", color: "#f59e0b", marginTop: "3px" }}>
            ⚠ Sedang kembali · ETA {selTruck?.etaMinutes}m
          </div>
        )}
      </div>

      {/* Dispatch */}
      <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button onClick={onDispatch} disabled={!canDispatch} style={{
          padding: "7px 16px", borderRadius: "8px",
          background: isDispatching
            ? "rgba(59,130,246,0.25)"
            : returning
              ? "rgba(245,158,11,0.15)"
              : canDispatch
                ? "rgba(59,130,246,0.88)"
                : "rgba(255,255,255,0.05)",
          border: `1px solid ${returning ? "rgba(245,158,11,0.35)" : canDispatch ? "rgba(59,130,246,0.55)" : "rgba(255,255,255,0.08)"}`,
          color: returning ? "#f59e0b" : canDispatch ? "white" : "var(--text-secondary)",
          fontSize: "12px", fontWeight: 600,
          cursor: canDispatch ? "pointer" : "not-allowed",
          transition: "all 0.15s", display: "flex", alignItems: "center", gap: "5px", whiteSpace: "nowrap",
        }}
          onMouseEnter={(e) => { if (canDispatch) e.currentTarget.style.background = "rgba(59,130,246,1)"; }}
          onMouseLeave={(e) => { if (canDispatch) e.currentTarget.style.background = "rgba(59,130,246,0.88)"; }}
        >
          {isDispatching
            ? <><span style={{ animation: "spin 1s linear infinite", display: "inline-block" }}>⟳</span> Mengirim…</>
            : returning ? "⏳ Menunggu"
            : <>▶ Kirim</>}
        </button>
      </div>
    </div>
  );
}

function StatusPill({ color, label, value }: { color: string; label: string; value: number }) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: "6px",
      padding: "5px 12px", borderRadius: "20px",
      background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)",
      fontSize: "12px", color: "var(--text-secondary)",
    }}>
      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: color, display: "inline-block" }} />
      <span style={{ fontWeight: 700, color: "var(--text-primary)" }}>{value}</span>
      <span>{label}</span>
    </div>
  );
}

function FilterChip({ label, color, on, toggle }: { label: string; color: string; on: boolean; toggle: () => void }) {
  return (
    <button onClick={toggle} style={{
      padding: "5px 10px", borderRadius: "7px", cursor: "pointer",
      background: on ? `${color}1e` : "rgba(255,255,255,0.04)",
      border: `1px solid ${on ? `${color}44` : "rgba(255,255,255,0.09)"}`,
      color: on ? color : "var(--text-secondary)",
      fontSize: "11px", fontWeight: 600, transition: "all 0.15s",
      display: "flex", alignItems: "center", gap: "5px",
    }}>
      <span style={{ width: "5px", height: "5px", borderRadius: "50%", background: on ? color : "transparent", border: `1.5px solid ${color}`, display: "inline-block", transition: "all 0.15s" }} />
      {label}
    </button>
  );
}

function Pill({ color, children }: { color: string; children: React.ReactNode }) {
  return (
    <span style={{
      fontSize: "11px", fontWeight: 600, padding: "2px 9px", borderRadius: "10px",
      background: `${color}18`, color, border: `1px solid ${color}28`,
    }}>{children}</span>
  );
}

function CostCard({ label, value, ton, color }: { label: string; value: number; ton: number; color: string }) {
  const costPerTon = ton > 0 ? Math.round(value / ton) : 0;
  return (
    <div style={{
      padding: "7px 10px", borderRadius: "8px",
      background: `${color}0d`, border: `1px solid ${color}2a`,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "3px" }}>
        <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{label}</span>
        <span style={{ fontSize: "9px", color, opacity: 0.65 }}>{ton.toFixed(1)} ton</span>
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <span style={{ fontSize: "14px", fontWeight: 800, color, fontFamily: "monospace", lineHeight: 1 }}>{fmtRp(value)}</span>
        {costPerTon > 0 && (
          <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{fmtRp(costPerTon)}/t</span>
        )}
      </div>
    </div>
  );
}
