import { useState, useEffect, useCallback, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { toast } from "sonner";
import { useAuth } from "../contexts/AuthContext";
import {
  Truck, ClipboardList, MapPin, CheckCircle, Play,
  Package, Home, RefreshCw, Loader2, ArrowRight,
} from "lucide-react";

const API_BASE = "http://localhost:4000/api";

interface TruckInfo {
  id: string; code: string; type: string; status: string;
  capacityKg: number; currentLoadKg: number; lat: number | null; lng: number | null; heading: number | null;
}

interface Assignment {
  truck: TruckInfo;
  route: { geometry: any; distance: number | null; duration: number | null; progress: number };
  waypoints: { tpsId: string; tpsName: string; tpsLat: number; tpsLng: number; collectedKg: number; tpsCurrentVolume: number; tpsCapacity: number }[];
  facility: { id: string; name: string; lat: number; lng: number } | null;
}

const truckIcon = (heading: number | null) => new L.DivIcon({
  html: `<div style="width: 48px; height: 36px; display: flex; align-items: center; justify-content: center;">
           <img src="/Referensi/3.png" style="width: 44px; height: 32px; object-fit: contain; transform: rotate(${heading ?? 0}deg); filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));" />
         </div>`,
  iconSize: [48, 36], iconAnchor: [24, 18],
});

function waypointIcon(idx: number, color: string) {
  return new L.DivIcon({
    html: `<div style="background: ${color}; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold;">${idx + 1}</div>`,
    iconSize: [24, 24], iconAnchor: [12, 12],
  });
}

const facilityIcon = new L.DivIcon({
  html: `<div style="background: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px #ef4444; display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; font-weight: bold;">H</div>`,
  iconSize: [22, 22], iconAnchor: [11, 11],
});

export default function DriverPage() {
  const { user, logout } = useAuth();
  const [truck, setTruck] = useState<TruckInfo | null>(null);
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  const token = localStorage.getItem("aurora_token") || "";
  const headers = { Authorization: `Bearer ${token}`, "Content-Type": "application/json" };

  // Fetch driver info + assignment
  const fetchData = useCallback(async () => {
    try {
      const [meRes, assignRes] = await Promise.all([
        fetch(`${API_BASE}/fleet/driver/me`, { headers }),
        fetch(`${API_BASE}/fleet/driver/assignment`, { headers }),
      ]);
      if (meRes.ok) { const d = await meRes.json(); setTruck(d.truck); }
      if (assignRes.ok) { const d = await assignRes.json(); setAssignment(d); }
    } catch { /* ignore */ }
  }, [token]);

  useEffect(() => { fetchData(); }, [fetchData]);

  // Auto-refresh every 10s when active
  useEffect(() => {
    if (!truck || truck.status === "AVAILABLE") return;
    const interval = setInterval(fetchData, 10000);
    return () => clearInterval(interval);
  }, [truck?.status, fetchData]);

  // Action handlers
  const doAction = async (endpoint: string, label: string) => {
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/fleet/driver/${endpoint}`, { method: "POST", headers });
      const data = await res.json();
      if (data.success) {
        toast.success(label);
        await fetchData();
      } else {
        toast.error(data.error || "Gagal");
      }
    } catch { toast.error("Koneksi gagal"); }
    finally { setActionLoading(false); }
  };

  // Release truck back to pool
  const doRelease = async () => {
    if (!truck || truck.status !== "AVAILABLE") {
      toast.error("Truk masih dalam perjalanan");
      return;
    }
    setActionLoading(true);
    try {
      const res = await fetch(`${API_BASE}/fleet/driver/release`, { method: "POST", headers });
      const data = await res.json();
      if (data.success) {
        toast.success("Truk dilepas");
        setTruck(null);
        setAssignment(null);
        fetchData();
      }
    } catch { toast.error("Koneksi gagal"); }
    finally { setActionLoading(false); }
  };

  // Route geometry
  const routeCoords = useMemo(() => {
    if (!assignment?.route?.geometry?.coordinates) return [];
    return assignment.route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  }, [assignment]);

  // Current waypoint (first with collectedKg > 0)
  const currentWp = assignment?.waypoints?.find((w) => w.collectedKg > 0);
  const nextWps = assignment?.waypoints?.filter((w) => w.collectedKg > 0).slice(1) || [];
  const progressPct = assignment?.route?.progress ? Math.round(assignment.route.progress * 100) : 0;

  // Status-based rendering
  const status = truck?.status || "LOADING";

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.4s ease" }}>
      {/* Header */}
      <div className="glass-panel" style={{ padding: "12px 20px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <span style={{ fontSize: "18px" }}><Truck size={18} /></span>
          <div>
            <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>Dashboard Supir</div>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)" }}>Selamat datang, {user?.name || "Supir"}</div>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {truck && (
            <span style={{ fontSize: "11px", color: "var(--text-secondary)", padding: "4px 10px", borderRadius: "6px", background: "rgba(255,255,255,0.06)" }}>
              {truck.code} · {truck.type.replace("_", " ")}
            </span>
          )}
          <button onClick={logout} style={{ padding: "6px 12px", borderRadius: "6px", background: "rgba(239,68,68,0.15)", color: "#ef4444", border: "1px solid rgba(239,68,68,0.2)", fontSize: "11px", cursor: "pointer" }}>Logout</button>
        </div>
      </div>

      {/* Content based on status */}
      {!truck && (
        <ClaimTruckScreen
          onClaim={() => doAction("claim", "Truk berhasil di-claim!")}
          loading={actionLoading}
        />
      )}

      {truck && status === "AVAILABLE" && (
        <WelcomeScreen truck={truck} />
      )}

      {truck && (status === "ASSIGNED" || (status !== "AVAILABLE" && status !== "EN_ROUTE_TO_TPS" && status !== "LOADING" && status !== "EN_ROUTE_TO_HUB" && assignment)) && (
        <AssignmentScreen assignment={assignment} onGo={() => doAction("start", "Berangkat!")} loading={actionLoading} />
      )}

      {truck && status === "EN_ROUTE_TO_TPS" && assignment && (
        <NavigationScreen
          truck={truck}
          assignment={assignment}
          routeCoords={routeCoords}
          currentWp={currentWp}
          progressPct={progressPct}
          onArrive={() => doAction("arrive", "Sampai di TPS!")}
          loading={actionLoading}
        />
      )}

      {truck && status === "LOADING" && (
        <LoadingScreen
          truck={truck}
          currentWp={currentWp}
          onComplete={() => doAction("complete", "Selesai mengangkut!")}
          loading={actionLoading}
        />
      )}

      {truck && status === "EN_ROUTE_TO_HUB" && assignment && (
        <HubNavigationScreen
          truck={truck}
          assignment={assignment}
          routeCoords={routeCoords}
          progressPct={progressPct}
          onArrive={() => doAction("arrive-hub", "Sampai di fasilitas!")}
          onUnload={() => doAction("unload", "Truk dikosongkan, siap tugas baru! 🔄")}
          loading={actionLoading}
        />
      )}

      {truck && status === "UNLOADING" && (
        <UnloadingScreen truck={truck} onUnload={() => doAction("unload", "Selesai! Siap tugas baru 🔄")} loading={actionLoading} />
      )}
    </div>
  );
}

// --- Sub-components ---

function ClaimTruckScreen({ onClaim, loading }: { onClaim: () => void; loading: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", maxWidth: "400px" }}>
        <Truck size={64} style={{ color: "var(--text-secondary)", opacity: 0.3, marginBottom: "20px" }} />
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Selamat datang, Supir!
        </div>
        <div style={{ fontSize: "13px", color: "var(--text-secondary)", marginBottom: "24px" }}>
          Anda belum memiliki truk yang di-assign. Klik tombol di bawah untuk mengambil truk dari depo.
        </div>
        <button
          onClick={onClaim}
          disabled={loading}
          style={{
            padding: "12px 24px", borderRadius: "10px",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white",
            border: "none", fontSize: "14px", fontWeight: 700,
            cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
          }}
        >
          {loading ? "Mengambil truk..." : "Ambil Truk dari Depo"}
        </button>
      </div>
    </div>
  );
}

function WelcomeScreen({ truck }: { truck: TruckInfo }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", maxWidth: "400px" }}>
        <Truck size={64} style={{ color: "var(--text-secondary)", opacity: 0.3, marginBottom: "20px" }} />
        <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>
          Selamat datang, Supir!
        </div>
        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
          Kode Truk: <strong style={{ color: "var(--text-primary)" }}>{truck.code}</strong>
          <br />
          Tipe: {truck.type.replace("_", " ")} · Kapasitas: {(truck.capacityKg / 1000).toFixed(0)} Ton
        </div>
        <div style={{ padding: "12px 20px", borderRadius: "8px", background: "rgba(16,185,129,0.1)", border: "1px solid rgba(16,185,129,0.2)", fontSize: "13px", color: "#10b981", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          <CheckCircle size={16} />
          Siap menerima tugas
        </div>
        <div style={{ marginTop: "16px", fontSize: "11px", color: "var(--text-secondary)" }}>
          Menunggu sistem menugaskan rute pengangkutan...
        </div>
      </div>
    </div>
  );
}

function AssignmentScreen({ assignment, onGo, loading }: { assignment: Assignment | null; onGo: () => void; loading: boolean }) {
  if (!assignment) return null;
  const firstWp = assignment.waypoints[0];
  const totalDist = assignment.route.distance ? (assignment.route.distance / 1000).toFixed(1) : "?";
  const totalDuration = assignment.route.duration ? Math.round(assignment.route.duration / 60) : "?";

  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "40px", maxWidth: "450px", width: "100%" }}>
        <div style={{ textAlign: "center", marginBottom: "24px" }}>
          <ClipboardList size={48} style={{ color: "var(--text-secondary)", opacity: 0.3, marginBottom: "12px" }} />
          <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>Tugas Baru!</div>
        </div>

        {firstWp && (
          <div style={{ padding: "16px", borderRadius: "10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)", marginBottom: "16px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Tujuan Pertama</div>
            <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{firstWp.tpsName}</div>
            <div style={{ fontSize: "12px", color: "var(--text-secondary)", marginTop: "4px" }}>
              Volume: {firstWp.tpsCurrentVolume.toLocaleString()} / {firstWp.tpsCapacity.toLocaleString()} kg
            </div>
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px", marginBottom: "20px" }}>
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{totalDist} km</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Total Jarak</div>
          </div>
          <div style={{ padding: "12px", borderRadius: "8px", background: "rgba(255,255,255,0.04)", textAlign: "center" }}>
            <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)" }}>{totalDuration} menit</div>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)" }}>Estimasi</div>
          </div>
        </div>

        {assignment.waypoints.length > 1 && (
          <div style={{ marginBottom: "20px" }}>
            <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginBottom: "8px" }}>Rute Multi-Stop:</div>
            {assignment.waypoints.filter((w) => w.collectedKg > 0).map((wp, i) => (
              <div key={wp.tpsId} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontSize: "12px" }}>
                <span style={{ width: "18px", height: "18px", borderRadius: "50%", background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "10px", color: "white", fontWeight: "bold" }}>{i + 1}</span>
                <span style={{ color: "var(--text-primary)" }}>{wp.tpsName}</span>
                <span style={{ marginLeft: "auto", color: "var(--text-secondary)", fontSize: "10px" }}>{wp.collectedKg.toLocaleString()} kg</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onGo}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px",
            background: "linear-gradient(135deg, #3b82f6, #2563eb)", color: "white",
            border: "none", fontSize: "16px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(59,130,246,0.3)",
            transition: "transform 0.15s",
          }}
          onMouseDown={(e) => (e.currentTarget.style.transform = "scale(0.97)")}
          onMouseUp={(e) => (e.currentTarget.style.transform = "scale(1)")}
        >
          {loading ? "Memuat..." : "Gas Berangkat!"}
        </button>
      </div>
    </div>
  );
}

function NavigationScreen({ truck, assignment, routeCoords, currentWp, progressPct, onArrive, loading }: {
  truck: TruckInfo; assignment: Assignment; routeCoords: [number, number][];
  currentWp: any; progressPct: number; onArrive: () => void; loading: boolean;
}) {
  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", minHeight: 0 }}>
      {/* Map */}
      <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden", position: "relative" }}>
        <MapContainer
          center={truck.lat && truck.lng ? [truck.lat, truck.lng] : [-7.25, 112.75]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#3b82f6" weight={5} opacity={0.8} />}
          {truck.lat && truck.lng && (
            <Marker position={[truck.lat, truck.lng]} icon={truckIcon(truck.heading)}>
              <Tooltip permanent direction="top" offset={L.point(0, -20)}>
                <div style={{ textAlign: "center", fontSize: "11px" }}><strong>{truck.code}</strong></div>
              </Tooltip>
            </Marker>
          )}
          {assignment.waypoints.filter((w) => w.collectedKg > 0).map((wp, i) => (
            <Marker key={wp.tpsId} position={[wp.tpsLat, wp.tpsLng]} icon={waypointIcon(i, "#3b82f6")}>
              <Tooltip direction="top" offset={L.point(0, -14)}>
                <div style={{ textAlign: "center", fontSize: "11px" }}><strong>{wp.tpsName}</strong><br />{wp.collectedKg.toLocaleString()} kg</div>
              </Tooltip>
            </Marker>
          ))}
          {assignment.facility && (
            <Marker position={[assignment.facility.lat, assignment.facility.lng]} icon={facilityIcon}>
              <Tooltip direction="top" offset={L.point(0, -14)}>
                <div style={{ textAlign: "center", fontSize: "11px" }}><strong>{assignment.facility.name}</strong></div>
              </Tooltip>
            </Marker>
          )}
        </MapContainer>

        {/* Progress overlay */}
        <div style={{ position: "absolute", bottom: "16px", left: "16px", right: "16px", zIndex: 1000, background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Progress</span>
            <span style={{ color: "#3b82f6", fontWeight: 700 }}>{progressPct}%</span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, #3b82f6, #60a5fa)", borderRadius: "3px", transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      {/* Info panel */}
      <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "auto" }}>
        <div className="glass-panel" style={{ padding: "16px", borderLeft: "3px solid #3b82f6" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Menuju TPS</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{currentWp?.tpsName || "—"}</div>
          <div style={{ display: "flex", gap: "12px", fontSize: "11px", marginTop: "8px" }}>
            <span style={{ color: "var(--text-secondary)" }}>{assignment.route.distance ? (assignment.route.distance / 1000).toFixed(1) : 0} km</span>
            <span style={{ color: "var(--text-secondary)" }}>{assignment.route.duration ? Math.round(assignment.route.duration / 60) : 0} menit</span>
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Muatan</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{truck.currentLoadKg.toLocaleString()} <span style={{ fontSize: "12px", color: "var(--text-secondary)" }}>/ {truck.capacityKg.toLocaleString()} kg</span></div>
        </div>

        {assignment.waypoints.filter((w) => w.collectedKg > 0).length > 1 && (
          <div className="glass-panel" style={{ padding: "16px" }}>
            <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Rute</div>
            {assignment.waypoints.filter((w) => w.collectedKg > 0).map((wp, i) => (
              <div key={wp.tpsId} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px", fontSize: "11px" }}>
                <span style={{ width: "16px", height: "16px", borderRadius: "50%", background: i === 0 ? "#3b82f6" : "rgba(59,130,246,0.3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "9px", color: "white", fontWeight: "bold" }}>{i + 1}</span>
                <span style={{ color: i === 0 ? "var(--text-primary)" : "var(--text-secondary)" }}>{wp.tpsName}</span>
              </div>
            ))}
          </div>
        )}

        <button
          onClick={onArrive}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px",
            background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
            border: "none", fontSize: "14px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
            boxShadow: "0 4px 12px rgba(16,185,129,0.3)",
          }}
        >
          {loading ? "Memuat..." : "Sudah Sampai di TPS"}
        </button>
      </div>
    </div>
  );
}

function LoadingScreen({ truck, currentWp, onComplete, loading }: {
  truck: TruckInfo; currentWp: any; onComplete: () => void; loading: boolean;
}) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", maxWidth: "400px" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}><Loader2 size={64} style={{ color: "var(--text-secondary)", opacity: 0.3 }} className="animate-spin" /></div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Proses Mengangkut</div>
        {currentWp && (
          <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "20px" }}>
            TPS: <strong style={{ color: "var(--text-primary)" }}>{currentWp.tpsName}</strong>
            <br />
            Volume: {currentWp.collectedKg.toLocaleString()} kg
          </div>
        )}
        <div style={{ padding: "12px 20px", borderRadius: "8px", background: "rgba(245,158,11,0.1)", border: "1px solid rgba(245,158,11,0.2)", fontSize: "13px", color: "#f59e0b", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          <Loader2 size={16} className="animate-spin" />
          Sedang mengangkut sampah...
        </div>
        <button
          onClick={onComplete}
          disabled={loading}
          style={{
            width: "100%", padding: "14px", borderRadius: "10px",
            background: "linear-gradient(135deg, #10b981, #059669)", color: "white",
            border: "none", fontSize: "14px", fontWeight: 700, cursor: loading ? "wait" : "pointer",
          }}
        >
          {loading ? "Memuat..." : "Selesai Mengangkut"}
        </button>
      </div>
    </div>
  );
}

function HubNavigationScreen({ truck, assignment, routeCoords, progressPct, onArrive, onUnload, loading }: {
  truck: TruckInfo; assignment: Assignment; routeCoords: [number, number][];
  progressPct: number; onArrive: () => void; onUnload: () => void; loading: boolean;
}) {
  const facility = assignment.facility;
  return (
    <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 300px", gap: "16px", minHeight: 0 }}>
      <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden", position: "relative" }}>
        <MapContainer
          center={truck.lat && truck.lng ? [truck.lat, truck.lng] : [-7.25, 112.75]}
          zoom={13}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png" />
          {routeCoords.length > 1 && <Polyline positions={routeCoords} color="#8b5cf6" weight={5} opacity={0.8} dashArray="8 6" />}
          {truck.lat && truck.lng && (
            <Marker position={[truck.lat, truck.lng]} icon={truckIcon(truck.heading)}>
              <Tooltip permanent direction="top" offset={L.point(0, -20)}>
                <div style={{ textAlign: "center", fontSize: "11px" }}><strong>{truck.code}</strong></div>
              </Tooltip>
            </Marker>
          )}
          {facility && (
            <Marker position={[facility.lat, facility.lng]} icon={facilityIcon}>
              <Tooltip permanent direction="top" offset={L.point(0, -14)}>
                <div style={{ textAlign: "center", fontSize: "11px" }}><strong>{facility.name}</strong></div>
              </Tooltip>
            </Marker>
          )}
        </MapContainer>
        <div style={{ position: "absolute", bottom: "16px", left: "16px", right: "16px", zIndex: 1000, background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)", borderRadius: "10px", padding: "12px 16px", border: "1px solid rgba(255,255,255,0.1)" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "6px", fontSize: "11px" }}>
            <span style={{ color: "var(--text-secondary)" }}>Progress</span>
            <span style={{ color: "#8b5cf6", fontWeight: 700 }}>{progressPct}%</span>
          </div>
          <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }}>
            <div style={{ width: `${progressPct}%`, height: "100%", background: "linear-gradient(90deg, #8b5cf6, #a78bfa)", borderRadius: "3px", transition: "width 0.5s ease" }} />
          </div>
        </div>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
        <div className="glass-panel" style={{ padding: "16px", borderLeft: "3px solid #8b5cf6" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase" }}>Menuju Fasilitas</div>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{facility?.name || "—"}</div>
          <div style={{ fontSize: "11px", color: "var(--text-secondary)", marginTop: "4px" }}>
            {assignment.route.distance ? (assignment.route.distance / 1000).toFixed(1) : 0} km · {assignment.route.duration ? Math.round(assignment.route.duration / 60) : 0} menit
          </div>
        </div>

        <div className="glass-panel" style={{ padding: "16px" }}>
          <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px" }}>Muatan Akhir</div>
          <div style={{ fontSize: "20px", fontWeight: 700, color: "var(--text-primary)" }}>{truck.currentLoadKg.toLocaleString()} kg</div>
        </div>

        <button onClick={onArrive} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg, #8b5cf6, #7c3aed)", color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: loading ? "wait" : "pointer" }}>
          {loading ? "Memuat..." : "Sudah Sampai di Fasilitas"}
        </button>
        <button onClick={onUnload} disabled={loading} style={{ width: "100%", padding: "12px", borderRadius: "10px", background: "rgba(255,255,255,0.06)", color: "var(--text-primary)", border: "1px solid rgba(255,255,255,0.12)", fontSize: "12px", cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          <RefreshCw size={14} /> Kosongkan Truk
        </button>
      </div>
    </div>
  );
}

function UnloadingScreen({ truck, onUnload, loading }: { truck: TruckInfo; onUnload: () => void; loading: boolean }) {
  return (
    <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div className="glass-panel" style={{ padding: "48px", textAlign: "center", maxWidth: "400px" }}>
        <div style={{ fontSize: "64px", marginBottom: "20px" }}><Package size={64} style={{ color: "var(--text-secondary)", opacity: 0.3 }} /></div>
        <div style={{ fontSize: "18px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "8px" }}>Membongkar Muatan</div>
        <div style={{ fontSize: "14px", color: "var(--text-secondary)", marginBottom: "24px" }}>
          Muatan: {truck.currentLoadKg.toLocaleString()} kg
        </div>
        <button onClick={onUnload} disabled={loading} style={{ width: "100%", padding: "14px", borderRadius: "10px", background: "linear-gradient(135deg, #10b981, #059669)", color: "white", border: "none", fontSize: "14px", fontWeight: 700, cursor: loading ? "wait" : "pointer", display: "flex", alignItems: "center", gap: "8px", justifyContent: "center" }}>
          {loading ? "Memuat..." : "Selesai, Siap Tugas Baru"}
        </button>
      </div>
    </div>
  );
}
