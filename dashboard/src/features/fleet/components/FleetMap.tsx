import { useMemo, useCallback } from "react";
import { MapContainer, TileLayer, Marker, Popup, Tooltip, Polyline } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import type { TruckData, TpsData, FacilityData, WaypointStop } from "../api/fleetApi";

interface FleetMapProps {
  trucks: TruckData[];
  tps: TpsData[];
  facilities: FacilityData[];
  showCompactor: boolean;
  showDumpTruck: boolean;
  showArmRoll: boolean;
  showRoutes: boolean;
  onTruckClick?: (truck: TruckData) => void;
  selectedTruckId?: string | null;
}

// --- Icons (created once, not on every render) ---
const tpsIcon = new L.DivIcon({
  html: `<div style="background-color: #fde047; width: 8px; height: 8px; border-radius: 50%; border: 1px solid #450a0a;"></div>`,
  className: "tps-marker",
});

const tpsCriticalIcon = new L.DivIcon({
  html: `<div style="background-color: #ef4444; width: 12px; height: 12px; border-radius: 50%; border: 2px solid white; animation: pulse 1.5s infinite;"></div>`,
  className: "tps-critical-marker",
});

const facilityIcon = new L.DivIcon({
  html: `<div style="background-color: #3b82f6; width: 18px; height: 18px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 12px #3b82f6; display: flex; align-items: center; justify-content: center; font-size: 10px; color: white; font-weight: bold;">H</div>`,
  className: "facility-marker",
});

const pltsaIcon = new L.DivIcon({
  html: `<div style="background-color: #ef4444; width: 22px; height: 22px; border-radius: 50%; border: 3px solid white; box-shadow: 0 0 15px #ef4444;"></div>`,
  className: "pltsa-marker",
});

const depotIcon = new L.DivIcon({
  html: `<div style="background-color: #6b7280; width: 16px; height: 16px; border-radius: 50%; border: 2px solid white; box-shadow: 0 0 8px rgba(107,114,128,0.5); display: flex; align-items: center; justify-content: center;">
           <div style="width: 6px; height: 6px; background: white; border-radius: 50%;"></div>
         </div>`,
  className: "depot-marker",
  iconSize: [16, 16],
  iconAnchor: [8, 8],
});

function depotCountIcon(count: number) {
  const size = Math.min(32, 18 + count * 0.8);
  return new L.DivIcon({
    html: `<div style="position: relative; width: ${size}px; height: ${size}px;">
             <div style="position: absolute; inset: 0; background: #374151; border-radius: 50%; border: 2px solid #9ca3af; display: flex; align-items: center; justify-content: center;">
               <span style="font-size: ${Math.max(9, size * 0.35)}px; color: white; font-weight: bold;">${count}</span>
             </div>
           </div>`,
    className: "depot-count-marker",
    iconSize: [size, size],
    iconAnchor: [size / 2, size / 2],
  });
}

function waypointIcon(idx: number, color: string) {
  return new L.DivIcon({
    html: `<div style="background-color: ${color}; width: 22px; height: 22px; border-radius: 50%; border: 2px solid white; box-shadow: 0 2px 6px rgba(0,0,0,0.3); display: flex; align-items: center; justify-content: center; font-size: 11px; color: white; font-weight: bold;">${idx + 1}</div>`,
    className: "waypoint-marker",
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  });
}

const truckIcons: Record<string, (heading: number | null) => L.DivIcon> = {
  COMPACTOR: (heading) => new L.DivIcon({
    html: `<div style="width: 44px; height: 32px; display: flex; align-items: center; justify-content: center;">
             <img src="/Referensi/3.png" style="width: 40px; height: 28px; object-fit: contain; transform: rotate(${heading ?? 0}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));" />
           </div>`,
    className: "truck-marker-custom",
    iconSize: [44, 32],
    iconAnchor: [22, 16],
  }),
  DUMP_TRUCK: (heading) => new L.DivIcon({
    html: `<div style="width: 44px; height: 32px; display: flex; align-items: center; justify-content: center;">
             <img src="/Referensi/2.png" style="width: 40px; height: 28px; object-fit: contain; transform: rotate(${heading ?? 0}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));" />
           </div>`,
    className: "truck-marker-custom",
    iconSize: [44, 32],
    iconAnchor: [22, 16],
  }),
  ARM_ROLL: (heading) => new L.DivIcon({
    html: `<div style="width: 44px; height: 32px; display: flex; align-items: center; justify-content: center;">
             <img src="/Referensi/1.png" style="width: 40px; height: 28px; object-fit: contain; transform: rotate(${heading ?? 0}deg); filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));" />
           </div>`,
    className: "truck-marker-custom",
    iconSize: [44, 32],
    iconAnchor: [22, 16],
  }),
};

const idleTruckIcon = new L.DivIcon({
  html: `<div style="width: 28px; height: 20px; display: flex; align-items: center; justify-content: center; opacity: 0.4;">
           <img src="/Referensi/3.png" style="width: 24px; height: 16px; object-fit: contain; filter: grayscale(100%);" />
         </div>`,
  className: "idle-truck-marker",
  iconSize: [28, 20],
  iconAnchor: [14, 10],
});

const routeColors: Record<string, string> = {
  COMPACTOR: "#3b82f6",
  DUMP_TRUCK: "#f59e0b",
  ARM_ROLL: "#10b981",
};

const statusText: Record<string, string> = {
  AVAILABLE: "Idle (Depo)",
  EN_ROUTE_TO_TPS: "Menuju TPS",
  LOADING: "Memuat",
  EN_ROUTE_TO_HUB: "Menuju Hub",
  UNLOADING: "Membongkar",
};

// --- Main Component ---
export default function FleetMap({
  trucks,
  tps,
  facilities,
  showCompactor,
  showDumpTruck,
  showArmRoll,
  showRoutes,
  selectedTruckId,
  onTruckClick,
}: FleetMapProps) {
  const filteredTrucks = useMemo(() => {
    return trucks.filter((t) => {
      if (t.type === "COMPACTOR") return showCompactor;
      if (t.type === "DUMP_TRUCK") return showDumpTruck;
      if (t.type === "ARM_ROLL") return showArmRoll;
      return true;
    });
  }, [trucks, showCompactor, showDumpTruck, showArmRoll]);

  const activeTrucks = useMemo(() => filteredTrucks.filter((t) => t.status !== "AVAILABLE"), [filteredTrucks]);
  const idleTrucks = useMemo(() => filteredTrucks.filter((t) => t.status === "AVAILABLE"), [filteredTrucks]);

  // Only show routes for selected truck (or all if none selected)
  const trucksToShowRoutes = useMemo(() => {
    if (selectedTruckId) {
      return activeTrucks.filter((t) => t.id === selectedTruckId);
    }
    return showRoutes ? activeTrucks : [];
  }, [activeTrucks, selectedTruckId, showRoutes]);

  // Collect unique depots from idle trucks
  const depots = useMemo(() => {
    const map = new Map<string, { lat: number; lng: number; count: number }>();
    for (const t of idleTrucks) {
      if (t.lat == null || t.lng == null) continue;
      const key = `${t.lat.toFixed(3)}_${t.lng.toFixed(3)}`;
      const existing = map.get(key);
      if (existing) existing.count++;
      else map.set(key, { lat: t.lat, lng: t.lng, count: 1 });
    }
    return Array.from(map.values());
  }, [idleTrucks]);

  const selectedTruck = useMemo(() => trucks.find((t) => t.id === selectedTruckId) || null, [trucks, selectedTruckId]);

  const handleClick = useCallback((truck: TruckData) => onTruckClick?.(truck), [onTruckClick]);

  return (
    <MapContainer
      center={[-7.2504, 112.7688]}
      zoom={12}
      minZoom={12}
      maxBounds={[[-7.3500, 112.5500], [-7.1500, 112.8500]]}
      maxBoundsViscosity={1.0}
      style={{ height: "100%", width: "100%", borderRadius: "12px" }}
    >
      <TileLayer
        url="https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
      />

      {/* TPS Markers */}
      {tps.map((t) => (
        <Marker key={`tps-${t.id}`} position={[t.lat, t.lng]} icon={t.status === "PENUH" ? tpsCriticalIcon : tpsIcon}>
          <Tooltip direction="top" offset={L.point(0, -10)} opacity={1}>
            <div style={{ textAlign: "center" }}>
              <strong style={{ color: "#000" }}>{t.name}</strong><br />
              <span style={{ fontSize: "11px", color: "#666" }}>{t.currentVolume.toLocaleString()} / {t.capacityKg.toLocaleString()} kg</span>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* Facility Markers */}
      {facilities.map((f) => (
        <Marker key={`facility-${f.id}`} position={[f.lat, f.lng]} icon={f.type === "PLTSa" ? pltsaIcon : facilityIcon} zIndexOffset={f.type === "PLTSa" ? 1000 : 500}>
          <Tooltip direction="top" offset={L.point(0, -15)} opacity={1} permanent={f.type === "PLTSa"}>
            <div style={{ textAlign: "center" }}>
              <strong style={{ color: f.type === "PLTSa" ? "#ef4444" : "#000", fontSize: f.type === "PLTSa" ? "14px" : "12px" }}>{f.name}</strong><br />
              <span style={{ fontSize: "11px", color: "#666" }}>{f.type}</span>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* Depot Markers (1 per depot with count badge) */}
      {depots.map((depot, i) => (
        <Marker key={`depot-${i}`} position={[depot.lat, depot.lng]} icon={depotCountIcon(depot.count)} zIndexOffset={50}>
          <Tooltip direction="top" offset={L.point(0, -14)} opacity={1}>
            <div style={{ textAlign: "center" }}>
              <strong style={{ color: "#000" }}>Depo</strong><br />
              <span style={{ fontSize: "11px", color: "#666" }}>{depot.count} truk idle</span>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* Route Polylines (only for selected truck or all active if showRoutes) */}
      {trucksToShowRoutes.map((truck) => {
        if (!truck.route?.coordinates || truck.route.coordinates.length < 2) return null;
        const color = routeColors[truck.type] || "#6b7280";
        const isFallback = truck.route.isFallback === true;
        const isSelected = truck.id === selectedTruckId;
        const coords: [number, number][] = truck.route.coordinates.map((c: [number, number]) => [c[1], c[0]]);

        return (
          <Polyline
            key={`route-${truck.id}`}
            positions={coords}
            color={isFallback ? "#ef4444" : color}
            weight={isSelected ? 5 : 2}
            opacity={isFallback ? 0.4 : isSelected ? 0.95 : 0.3}
            dashArray={isFallback ? "6 4" : truck.status === "EN_ROUTE_TO_HUB" ? "8 6" : undefined}
          />
        );
      })}

      {/* Waypoint markers (only for selected truck) */}
      {selectedTruck?.routeWaypoints && (selectedTruck.routeWaypoints as WaypointStop[]).filter((w) => w.collectedKg > 0).map((wp, i) => (
        <Marker
          key={`wp-${selectedTruck.id}-${wp.tpsId}`}
          position={[wp.tpsLat, wp.tpsLng]}
          icon={waypointIcon(i, routeColors[selectedTruck.type] || "#3b82f6")}
          zIndexOffset={200}
        >
          <Tooltip direction="top" offset={L.point(0, -14)} opacity={1} permanent>
            <div style={{ textAlign: "center" }}>
              <strong style={{ color: "#000" }}>Stop {i + 1}: {wp.tpsName}</strong><br />
              <span style={{ fontSize: "11px", color: "#666" }}>{wp.collectedKg.toLocaleString()} kg</span>
            </div>
          </Tooltip>
        </Marker>
      ))}

      {/* Active Truck Markers */}
      {activeTrucks.map((truck) => (
        <Marker
          key={`truck-${truck.id}`}
          position={[truck.lat!, truck.lng!]}
          icon={(truckIcons[truck.type] || (() => idleTruckIcon))(truck.heading)}
          zIndexOffset={truck.id === selectedTruckId ? 500 : 100}
          eventHandlers={{ click: () => handleClick(truck) }}
        >
          <Popup>
            <div style={{ fontSize: "12px", color: "#000", minWidth: "160px" }}>
              <strong>{truck.code} ({truck.type.replace("_", " ")})</strong><br />
              <span>Status: {statusText[truck.status] || truck.status}</span><br />
              <span>Muatan: {truck.currentLoadKg.toLocaleString()} / {truck.capacityKg.toLocaleString()} kg</span>
              {truck.routeDistance != null && (
                <><br /><span>Jarak: {(truck.routeDistance / 1000).toFixed(1)} km</span><br /><span>Progress: {(truck.routeProgress * 100).toFixed(0)}%</span></>
              )}
              {(truck.routeWaypoints as WaypointStop[] | null)?.filter((w) => w.collectedKg > 0).length > 0 && (
                <>
                  <br /><span style={{ fontWeight: "bold", color: "#3b82f6" }}>Rute:</span>
                  {(truck.routeWaypoints as WaypointStop[]).filter((w) => w.collectedKg > 0).map((wp, i) => (
                    <div key={wp.tpsId} style={{ marginLeft: "8px", fontSize: "11px" }}>{i + 1}. {wp.tpsName} ({wp.collectedKg.toLocaleString()} kg)</div>
                  ))}
                </>
              )}
            </div>
          </Popup>
        </Marker>
      ))}

      {/* Selected truck detail panel (overlay) */}
      {selectedTruck && (
        <div className="leaflet-bottom leaflet-right" style={{ marginBottom: "20px", marginRight: "20px" }}>
          <div style={{
            background: "rgba(15,23,42,0.95)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(255,255,255,0.1)",
            borderRadius: "12px",
            padding: "16px",
            minWidth: "260px",
            fontSize: "12px",
            color: "white",
            boxShadow: "0 8px 32px rgba(0,0,0,0.4)",
          }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "12px" }}>
              <strong style={{ fontSize: "14px" }}>{selectedTruck.code}</strong>
              <span style={{
                padding: "2px 8px",
                borderRadius: "6px",
                fontSize: "10px",
                background: selectedTruck.status === "AVAILABLE" ? "rgba(16,185,129,0.2)" : "rgba(59,130,246,0.2)",
                color: selectedTruck.status === "AVAILABLE" ? "#10b981" : "#3b82f6",
              }}>{statusText[selectedTruck.status] || selectedTruck.status}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px", marginBottom: "12px" }}>
              <div><span style={{ color: "#94a3b8" }}>Tipe:</span> {selectedTruck.type.replace("_", " ")}</div>
              <div><span style={{ color: "#94a3b8" }}>Muatan:</span> {selectedTruck.currentLoadKg.toLocaleString()} / {selectedTruck.capacityKg.toLocaleString()} kg</div>
              {selectedTruck.routeDistance != null && (
                <>
                  <div><span style={{ color: "#94a3b8" }}>Jarak:</span> {(selectedTruck.routeDistance / 1000).toFixed(1)} km</div>
                  <div><span style={{ color: "#94a3b8" }}>Progress:</span> {(selectedTruck.routeProgress * 100).toFixed(0)}%</div>
                </>
              )}
            </div>
            {/* Waypoints list */}
            {(selectedTruck.routeWaypoints as WaypointStop[] | null)?.filter((w) => w.collectedKg > 0).length > 0 && (
              <div style={{ borderTop: "1px solid rgba(255,255,255,0.1)", paddingTop: "10px" }}>
                <div style={{ fontWeight: "bold", marginBottom: "6px", color: "#94a3b8" }}>Rute Multi-Stop:</div>
                {(selectedTruck.routeWaypoints as WaypointStop[]).filter((w) => w.collectedKg > 0).map((wp, i) => (
                  <div key={wp.tpsId} style={{ display: "flex", alignItems: "center", gap: "8px", marginBottom: "4px" }}>
                    <span style={{
                      width: "18px", height: "18px", borderRadius: "50%",
                      background: routeColors[selectedTruck.type] || "#3b82f6",
                      display: "flex", alignItems: "center", justifyContent: "center",
                      fontSize: "10px", fontWeight: "bold", flexShrink: 0,
                    }}>{i + 1}</span>
                    <span>{wp.tpsName}</span>
                    <span style={{ marginLeft: "auto", color: "#94a3b8" }}>{wp.collectedKg.toLocaleString()} kg</span>
                  </div>
                ))}
              </div>
            )}
            <button
              onClick={() => onTruckClick?.(selectedTruck)}
              style={{
                marginTop: "12px", width: "100%", padding: "6px",
                background: "rgba(255,255,255,0.1)", border: "1px solid rgba(255,255,255,0.2)",
                borderRadius: "6px", color: "white", cursor: "pointer", fontSize: "11px",
              }}
            >Tutup</button>
          </div>
        </div>
      )}
    </MapContainer>
  );
}
