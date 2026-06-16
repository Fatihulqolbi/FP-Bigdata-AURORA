const API_BASE = "http://localhost:4000/api";

function getToken(): string {
  return localStorage.getItem("aurora_token") || "";
}

async function authFetch(path: string) {
  const res = await fetch(`${API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${getToken()}` },
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export interface ServiceStatus {
  name: string;
  status: "online" | "offline" | "degraded";
  details: string;
  lastCheck: string;
}

export interface PipelineStats {
  tps: { total: number; active: number; critical: number };
  trucks: { total: number; active: number };
  users: number;
  volume: { current: number; capacity: number; fillPercent: number };
}

export interface PipelineEvent {
  timestamp: string;
  source: string;
  event: string;
  details: {
    code: string;
    kecamatan: string;
    volume: number;
    capacity: number;
    fill: number;
    status: string;
    type: string;
  };
}

export interface FleetStats {
  total: number;
  active: number;
  available: number;
  byType: Record<string, { total: number; active: number }>;
}

export interface TpsSummary {
  source: string;
  total_tps: number;
  active_tps: number;
  critical: number;
  waspada: number;
  total_capacity_kg: number;
  total_volume_kg: number;
  avg_fill_level: number;
  by_kecamatan: { kecamatan: string; count: number; current_kg: number; capacity_kg: number }[];
}

export const monitoringApi = {
  getPipelineStatus: (): Promise<ServiceStatus[]> => authFetch("/pipeline/status"),
  getPipelineStats: (): Promise<PipelineStats> => authFetch("/pipeline/stats"),
  getPipelineEvents: (limit = 10): Promise<PipelineEvent[]> => authFetch(`/pipeline/events?limit=${limit}`),
  getFleetStats: (): Promise<FleetStats> => authFetch("/analytics/fleet-stats"),
  getTpsSummary: (): Promise<TpsSummary> => authFetch("/analytics/tps-summary"),
};
