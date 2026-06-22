const API_BASE = "/api/metrics";

export interface WRIData {
  kecamatan: string;
  wri_score: number;
  wri_level: string;
  mu_fill_rate: number;
  delta_volume: number;
  rho_density: number;
  event_count: number;
  window_end: string;
}

export interface OverloadPrediction {
  tps_id: string;
  tps_name: string;
  kecamatan: string;
  capacity_m3: number;
  current_volume_m3: number;
  fill_rate_pct: number;
  avg_inflow_rate: number;
  avg_outflow_rate: number;
  hours_to_overload: number;
  lambda_rate: number;
  overload_prob_6h: number;
  overload_prob_12h: number;
  overload_prob_24h: number;
  overload_prob_48h: number;
  max_overload_prob: number;
  alert_level: string;
  last_update: string;
}

export interface FacilityUtilization {
  facility_id: string;
  facility_name: string;
  kecamatan: string;
  processed_kg_1h: number;
  received_kg_1h: number;
  processed_24h_estimate: number;
  in_transit_estimate: number;
  daily_capacity_kg: number;
  utilization_rate: number;
  capacity_used_pct: number;
  throughput_efficiency: number;
  utilization_status: string;
  available_capacity_kg: number;
  hours_until_full: number;
  truck_count_1h: number;
  last_update: string;
}

export interface Alert {
  tps_id: string;
  tps_name: string;
  kecamatan: string;
  wri_score: number;
  wri_alert_type: string;
  overload_prob_24h: number;
  overload_alert_type: string;
  utilization_pct: number;
  utilization_alert_type: string;
  combined_alert_level: string;
  alert_severity_score: number;
  alert_message: string;
  avg_inflow_rate: number;
  avg_outflow_rate: number;
  current_volume_m3: number;
  capacity_m3: number;
  last_update: string;
}

export interface CostBaseline {
  static_routing_cost: number;
  optimized_routing_cost: number;
  savings: number;
  savings_percent: number;
  distance_km: number;
  fuel_liters: number;
  co2_kg: number;
  trips: number;
}

export interface APIResponse<T> {
  success: boolean;
  data: T;
  timestamp: string;
  count?: number;
}

async function fetchAPI<T>(endpoint: string): Promise<T> {
  const response = await fetch(`${API_BASE}${endpoint}`);
  if (!response.ok) {
    throw new Error(`API Error: ${response.status} ${response.statusText}`);
  }
  const json: APIResponse<T> = await response.json();
  return json.data;
}

export const metricsApi = {
  getWRIRegions: () => fetchAPI<WRIData[]>("/wri/all"),
  
  getWRIByKecamatan: (kecamatan: string) =>
    fetchAPI<WRIData>(`/wri/${encodeURIComponent(kecamatan)}`),
  
  getWRICritical: () => fetchAPI<WRIData[]>("/wri/critical/all"),
  
  getWRIHistory: (kecamatan?: string, hours?: number) => {
    if (!kecamatan) return fetchAPI<WRIData[]>("/wri/all");
    const params = new URLSearchParams();
    if (hours) params.append("hours", hours.toString());
    const query = params.toString();
    return fetchAPI<WRIData[]>(`/wri/history/${encodeURIComponent(kecamatan)}${query ? `?${query}` : ""}`);
  },

  getOverloadPredictions: () => fetchAPI<OverloadPrediction[]>("/overload/all"),
  
  getOverloadByTPS: (tpsId: string) =>
    fetchAPI<OverloadPrediction>(`/overload/tps/${tpsId}`),
  
  getOverloadCritical: () => fetchAPI<OverloadPrediction[]>("/overload/critical"),

  getFacilityUtilization: () => fetchAPI<FacilityUtilization[]>("/utilization/facilities"),
  
  getFacilityById: (facilityId: string) =>
    fetchAPI<FacilityUtilization>(`/utilization/facility/${facilityId}`),
  
  getFacilityOverloaded: () => fetchAPI<FacilityUtilization[]>("/utilization/overloaded"),
  
  getFacilityHistory: (facilityId?: string, hours?: number) => {
    if (!facilityId) return fetchAPI<FacilityUtilization[]>("/utilization/facilities");
    const params = new URLSearchParams();
    if (hours) params.append("hours", hours.toString());
    const query = params.toString();
    return fetchAPI<FacilityUtilization[]>(`/utilization/history/${facilityId}${query ? `?${query}` : ""}`);
  },

  getAlertsActive: () => fetchAPI<Alert[]>("/overload/critical"),
  
  getAlertsCritical: () => fetchAPI<Alert[]>("/overload/critical"),
  
  getAlertsHistory: (hours?: number) => {
    return fetchAPI<Alert[]>("/overload/critical");
  },
  
  getAlertsByTPS: (tpsId: string) => fetchAPI<Alert[]>(`/overload/tps/${tpsId}`),

  getCostBaseline: () => fetchAPI<CostBaseline>("/cost/baseline"),
  
  getCostComparison: () =>
    fetchAPI<{ static: CostBaseline; optimized: CostBaseline }>("/cost/baseline"),
};

export default metricsApi;
