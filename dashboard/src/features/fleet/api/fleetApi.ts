const API_BASE = "http://localhost:4000/api";

function getToken(): string {
  return localStorage.getItem("aurora_token") || "";
}

export interface WaypointStop {
  tpsId: string;
  tpsName: string;
  tpsLat: number;
  tpsLng: number;
  collectedKg: number;
}

export interface RouteQueueItem {
  type: "TPS" | "FACILITY";
  tpsId?: string;
  tpsName?: string;
  tpsLat?: number;
  tpsLng?: number;
  facilityId?: string;
  facilityName?: string;
  facilityLat?: number;
  facilityLng?: number;
  collectedKg?: number;
  status: "pending" | "active" | "done";
}

export interface TruckData {
  id: string;
  code: string;
  name: string;
  type: string;
  capacityKg: number;
  currentLoadKg: number;
  status: string;
  lat: number | null;
  lng: number | null;
  heading: number | null;
  assignedTpsId: string | null;
  destinationLat: number | null;
  destinationLng: number | null;
  facilityId: string | null;
  route: any | null;
  routeProgress: number;
  routeDistance: number | null;
  routeDuration: number | null;
  routeWaypoints: WaypointStop[] | null;
  routeQueue: RouteQueueItem[] | null;
  routeLegIndex: number;
}

export interface TpsData {
  id: string;
  code: string;
  name: string;
  kecamatan: string;
  lat: number;
  lng: number;
  currentVolume: number;
  capacityKg: number;
  status: string;
  type: string;
}

export interface FacilityData {
  id: string;
  code: string;
  name: string;
  type: string;
  lat: number;
  lng: number;
  capacityKg: number;
  currentLoadKg: number;
}

export interface FleetStatus {
  totalTrucks: number;
  activeTrucks: number;
  idleTrucks: number;
  tpsActive: number;
  tpsCritical: number;
  totalWasteToday: number;
  trucks: TruckData[];
}

export interface FleetUpdate {
  type: string;
  trucks?: TruckData[];
  tps?: TpsData[];
  facilities?: FacilityData[];
  criticalTps?: { id: string; code: string; name: string; fill: string }[];
  timestamp: string;
}

export interface AvailableTruck {
  id: string;
  code: string;
  type: string;
  capacityKg: number;
  currentLoadKg: number;
  lat: number | null;
  lng: number | null;
  currentStatus: string;
  etaMinutes: number | null;
}

export interface TaskSuggestion {
  tps: {
    id: string;
    code: string;
    name: string;
    kecamatan: string;
    lat: number;
    lng: number;
    currentVolume: number;
    capacityKg: number;
    fillPct: number;
    status: string;
  };
  recommendedTruck: (AvailableTruck & { distanceKm: number; score: number }) | null;
  priority: "KRITIS" | "TINGGI" | "SEDANG";
}

export interface TaskSuggestionsResponse {
  suggestions: TaskSuggestion[];
  availableTrucks: AvailableTruck[];
}

export const fleet = {
  getFleetStatus: async (): Promise<FleetStatus> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/fleet/status`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  getTrucks: async (filter?: { status?: string; type?: string }): Promise<TruckData[]> => {
    const token = getToken();
    const qs = filter ? "?" + new URLSearchParams(filter as Record<string, string>).toString() : "";
    const res = await fetch(`${API_BASE}/fleet/trucks${qs}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  getTruckById: async (id: string): Promise<TruckData> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/fleet/trucks/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  getTaskSuggestions: async (): Promise<TaskSuggestionsResponse> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/fleet/suggestions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  getAvailableTrucks: async (): Promise<AvailableTruck[]> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/fleet/driver/available-trucks`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },

  dispatchTask: async (truckId: string, tpsId: string): Promise<{ success: boolean; truck: TruckData }> => {
    const token = getToken();
    const res = await fetch(`${API_BASE}/fleet/dispatch`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ truckId, tpsId }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
    return data;
  },
};
