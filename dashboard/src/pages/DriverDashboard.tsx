import { useState, useEffect, useMemo } from "react";
import { MapContainer, TileLayer, Marker, Polyline, Tooltip } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

const API_BASE = "http://localhost:4000/api";

interface DriverData {
  truck: { id: string; code: string; type: string; status: string; currentLoadKg: number; capacityKg: number; lat: number | null; lng: number | null; heading: number | null };
  route: { geometry: any; distance: number | null; duration: number | null; progress: number };
  steps: { instruction: string; lat: number; lng: number }[];
  waypoints: { name: string; lat: number; lng: number; collectedKg: number }[];
  nextStop: { name: string; distanceKm: number; etaMin: number; collectedKg: number } | null;
  traffic: { congestion: number; status: string } | null;
  cost: { fuelLiters: number; fuelCost: number; co2Kg: number };
}

const truckIcon = new L.DivIcon({
  html: `<div style="width: 48px; height: 36px; display: flex; align-items: center; justify-content: center;">
           <img src="/Referensi/3.png" style="width: 44px; height: 32px; object-fit: contain; filter: drop-shadow(0 3px 6px rgba(0,0,0,0.5));" />
         </div>`,
  className: "driver-truck-icon",
  iconSize: [48, 36],
  iconAnchor: [24, 18],
});

function waypointIcon(idx: number) {
  return new L.DivIcon({
    html: `<div style="background: #3b82f6; width: 24px; height: 24px; border-radius: 50%; border: 3px solid white; box-shadow: 0 2px 8px rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; font-size: 12px; color: white; font-weight: bold;">${idx + 1}</div>`,
    className: "driver-waypoint-icon",
    iconSize: [24, 24],
    iconAnchor: [12, 12],
  });
}

export default function DriverDashboard() {
  const [data, setData] = useState<DriverData | null>(null);
  const [truckId, setTruckId] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const fetchRoute = async (id: string) => {
    setLoading(true);
    setError("");
    try {
      const token = localStorage.getItem("aurora_token") || "";
      const res = await fetch(`${API_BASE}/fleet/driver/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) throw new Error("Gagal memuat data rute");
      const result = await res.json();
      setData(result);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refresh every 10s
  useEffect(() => {
    if (!truckId) return;
    fetchRoute(truckId);
    const interval = setInterval(() => fetchRoute(truckId), 10000);
    return () => clearInterval(interval);
  }, [truckId]);

  const routeCoords = useMemo(() => {
    if (!data?.route?.geometry?.coordinates) return [];
    return data.route.geometry.coordinates.map((c: [number, number]) => [c[1], c[0]] as [number, number]);
  }, [data]);

  const progressPct = data?.route?.progress ? Math.round(data.route.progress * 100) : 0;

  return (
    <div style={{ height: "calc(100vh - 120px)", display: "flex", flexDirection: "column", gap: "16px", animation: "fadeIn 0.4s ease" }}>
      {/* Truck selector */}
      <div className="glass-panel" style={{ padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)" }}>Dashboard Supir</span>
        <input
          value={truckId}
          onChange={(e) => setTruckId(e.target.value)}
          placeholder="Masukkan Truck ID..."
          style={{
            flex: 1, padding: "8px 12px", borderRadius: "8px",
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)",
            color: "var(--text-primary)", fontSize: "12px", outline: "none",
          }}
        />
        <button
          onClick={() => truckId && fetchRoute(truckId)}
          disabled={!truckId || loading}
          style={{
            padding: "8px 16px", borderRadius: "8px",
            background: "#3b82f6", color: "white", border: "none",
            fontSize: "12px", fontWeight: 600, cursor: loading ? "wait" : "pointer",
            opacity: loading ? 0.6 : 1,
          }}
        >
          {loading ? "Memuat..." : "Cari"}
        </button>
      </div>

      {error && (
        <div className="glass-panel" style={{ padding: "12px 16px", color: "#ef4444", fontSize: "12px" }}>{error}</div>
      )}

      {data && (
        <div style={{ flex: 1, display: "grid", gridTemplateColumns: "1fr 320px", gap: "16px", minHeight: 0 }}>
          {/* Map */}
          <div className="glass-panel" style={{ borderRadius: "12px", overflow: "hidden", position: "relative" }}>
            <MapContainer
              center={data.truck.lat && data.truck.lng ? [data.truck.lat, data.truck.lng] : [-7.25, 112.75]}
              zoom={13}
              style={{ height: "100%", width: "100%" }}
            >
              <TileLayer
                url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
                attribution='&copy; OpenStreetMap'
              />

              {/* Route polyline */}
              {routeCoords.length > 1 && (
                <Polyline
                  positions={routeCoords}
                  color="#3b82f6"
                  weight={5}
                  opacity={0.8}
                />
              )}

              {/* Truck marker */}
              {data.truck.lat && data.truck.lng && (
                <Marker position={[data.truck.lat, data.truck.lng]} icon={truckIcon}>
                  <Tooltip permanent direction="top" offset={L.point(0, -20)}>
                    <div style={{ textAlign: "center", fontSize: "11px" }}>
                      <strong>{data.truck.code}</strong><br />
                      <span>{data.truck.type.replace("_", " ")}</span>
                    </div>
                  </Tooltip>
                </Marker>
              )}

              {/* Waypoint markers */}
              {data.waypoints.map((wp, i) => (
                <Marker key={`wp-${i}`} position={[wp.lat, wp.lng]} icon={waypointIcon(i)}>
                  <Tooltip direction="top" offset={L.point(0, -14)}>
                    <div style={{ textAlign: "center", fontSize: "11px" }}>
                      <strong>{wp.name}</strong><br />
                      <span>{wp.collectedKg.toLocaleString()} kg</span>
                    </div>
                  </Tooltip>
                </Marker>
              ))}
            </MapContainer>

            {/* Progress overlay */}
            <div style={{
              position: "absolute", bottom: "16px", left: "16px", right: "16px", zIndex: 1000,
              background: "rgba(15,23,42,0.9)", backdropFilter: "blur(12px)",
              borderRadius: "10px", padding: "12px 16px",
              border: "1px solid rgba(255,255,255,0.1)",
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "8px", fontSize: "11px" }}>
                <span style={{ color: "var(--text-secondary)" }}>Progress Rute</span>
                <span style={{ color: "#3b82f6", fontWeight: 700 }}>{progressPct}%</span>
              </div>
              <div style={{ height: "6px", background: "rgba(255,255,255,0.08)", borderRadius: "3px" }}>
                <div style={{
                  width: `${progressPct}%`, height: "100%",
                  background: "linear-gradient(90deg, #3b82f6, #60a5fa)",
                  borderRadius: "3px", transition: "width 0.5s ease",
                }} />
              </div>
            </div>
          </div>

          {/* Info panel */}
          <div style={{ display: "flex", flexDirection: "column", gap: "12px", overflow: "auto" }}>
            {/* Truck info */}
            <div className="glass-panel" style={{ padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "10px" }}>
                <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>{data.truck.code}</span>
                <span style={{
                  fontSize: "10px", fontWeight: 600, padding: "3px 8px", borderRadius: "6px",
                  background: data.truck.status === "EN_ROUTE_TO_TPS" ? "rgba(59,130,246,0.2)" : "rgba(16,185,129,0.2)",
                  color: data.truck.status === "EN_ROUTE_TO_TPS" ? "#3b82f6" : "#10b981",
                }}>{data.truck.status === "EN_ROUTE_TO_TPS" ? "Menuju TPS" : data.truck.status}</span>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div><span style={{ color: "var(--text-secondary)" }}>Muatan:</span> <strong>{data.truck.currentLoadKg.toLocaleString()}</strong>/{data.truck.capacityKg.toLocaleString()} kg</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Jarak:</span> <strong>{data.route.distance ? (data.route.distance / 1000).toFixed(1) : 0}</strong> km</div>
                <div><span style={{ color: "var(--text-secondary)" }}>Durasi:</span> <strong>{data.route.duration ? Math.round(data.route.duration / 60) : 0}</strong> menit</div>
                <div><span style={{ color: "var(--text-secondary)" }}>BBM:</span> <strong>Rp{data.cost.fuelCost.toLocaleString()}</strong></div>
              </div>
            </div>

            {/* Next stop */}
            {data.nextStop && (
              <div className="glass-panel" style={{ padding: "14px 16px", borderLeft: "3px solid #3b82f6" }}>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Berikutnya</div>
                <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)", marginBottom: "6px" }}>{data.nextStop.name}</div>
                <div style={{ display: "flex", gap: "12px", fontSize: "11px" }}>
                  <span style={{ color: "var(--text-secondary)" }}>{data.nextStop.distanceKm} km</span>
                  <span style={{ color: "var(--text-secondary)" }}>ETA {data.nextStop.etaMin} menit</span>
                  <span style={{ color: "#3b82f6" }}>{data.nextStop.collectedKg.toLocaleString()} kg</span>
                </div>
              </div>
            )}

            {/* Traffic */}
            {data.traffic && (
              <div className="glass-panel" style={{
                padding: "14px 16px",
                borderLeft: `3px solid ${data.traffic.congestion < 0.5 ? "#ef4444" : data.traffic.congestion < 0.7 ? "#f59e0b" : "#10b981"}`,
              }}>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "4px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Lalu Lintas</div>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "10px", height: "10px", borderRadius: "50%",
                    background: data.traffic.congestion < 0.5 ? "#ef4444" : data.traffic.congestion < 0.7 ? "#f59e0b" : "#10b981",
                  }} />
                  <span style={{ fontSize: "13px", fontWeight: 600, color: "var(--text-primary)", textTransform: "capitalize" }}>{data.traffic.status}</span>
                </div>
              </div>
            )}

            {/* Waypoints list */}
            {data.waypoints.length > 0 && (
              <div className="glass-panel" style={{ padding: "14px 16px" }}>
                <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Rute Multi-Stop</div>
                {data.waypoints.map((wp, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "6px" }}>
                    <span style={{
                      width: "20px", height: "20px", borderRadius: "50%",
                      background: "#3b82f6", display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", color: "white", fontWeight: "bold", flexShrink: 0,
                    }}>{i + 1}</span>
                    <span style={{ fontSize: "11px", color: "var(--text-primary)", flex: 1 }}>{wp.name}</span>
                    <span style={{ fontSize: "10px", color: "var(--text-secondary)" }}>{wp.collectedKg.toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            )}

            {/* Cost summary */}
            <div className="glass-panel" style={{ padding: "14px 16px" }}>
              <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginBottom: "8px", textTransform: "uppercase", letterSpacing: "0.5px" }}>Estimasi Biaya</div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px", fontSize: "11px" }}>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{data.cost.fuelLiters}</div>
                  <div style={{ color: "var(--text-secondary)" }}>Liter BBM</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>Rp{data.cost.fuelCost.toLocaleString()}</div>
                  <div style={{ color: "var(--text-secondary)" }}>Biaya BBM</div>
                </div>
                <div style={{ textAlign: "center" }}>
                  <div style={{ fontSize: "16px", fontWeight: 700, color: "var(--text-primary)" }}>{data.cost.co2Kg}</div>
                  <div style={{ color: "var(--text-secondary)" }}>kg CO2</div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {!data && !loading && !error && (
        <div style={{ flex: 1, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ textAlign: "center", color: "var(--text-secondary)" }}>
            <div style={{ fontSize: "48px", marginBottom: "16px", opacity: 0.3 }}>🚛</div>
            <div style={{ fontSize: "14px" }}>Masukkan Truck ID untuk melihat rute</div>
          </div>
        </div>
      )}
    </div>
  );
}
