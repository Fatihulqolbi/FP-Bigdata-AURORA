import { logger } from "../../utils/logger.js";

const TOMTOM_KEY = process.env.TOMTOM_API_KEY || "";
const FLOW_URL = "https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json";

interface TrafficResult {
  currentSpeed: number;
  freeFlowSpeed: number;
  congestion: number; // 0-1, <0.5 = congested
  roadClosure: boolean;
  confidence: number;
}

/**
 * Check traffic at a specific point using TomTom Flow Segment API.
 * Returns null if API unavailable or rate limited.
 */
export async function checkTrafficAt(lat: number, lng: number): Promise<TrafficResult | null> {
  if (!TOMTOM_KEY) return null;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const url = `${FLOW_URL}?key=${TOMTOM_KEY}&point=${lat},${lng}&unit=kmph&thickness=1`;
    const res = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);

    if (res.status === 429) {
      logger.warn("[TRAFFIC] TomTom rate limited (429)");
      return null;
    }
    if (!res.ok) return null;

    const data = await res.json() as any;
    const flow = data.flowSegmentData;
    if (!flow) return null;

    const currentSpeed = flow.currentSpeed || 0;
    const freeFlowSpeed = flow.freeFlowSpeed || 1;
    const congestion = currentSpeed / freeFlowSpeed; // 0-1

    return {
      currentSpeed,
      freeFlowSpeed,
      congestion,
      roadClosure: flow.roadClosure || false,
      confidence: flow.confidence || 0,
    };
  } catch {
    return null;
  }
}

/**
 * Check traffic at multiple points along a route.
 * Returns average congestion and worst point.
 */
export async function checkRouteTraffic(
  coordinates: [number, number][], // [lng, lat] format
  sampleCount: number = 3
): Promise<{ avgCongestion: number; worstCongestion: number; worstPoint: [number, number] | null }> {
  if (!TOMTOM_KEY || coordinates.length < 2) {
    return { avgCongestion: 1, worstCongestion: 1, worstPoint: null };
  }

  // Sample evenly spaced points
  const indices: number[] = [];
  for (let i = 0; i < sampleCount; i++) {
    indices.push(Math.floor((i / (sampleCount - 1)) * (coordinates.length - 1)));
  }

  const results: TrafficResult[] = [];
  for (const idx of indices) {
    const [lng, lat] = coordinates[idx];
    const result = await checkTrafficAt(lat, lng);
    if (result) results.push(result);
    // Rate limit: wait 100ms between requests
    await new Promise((r) => setTimeout(r, 100));
  }

  if (results.length === 0) {
    return { avgCongestion: 1, worstCongestion: 1, worstPoint: null };
  }

  const avgCongestion = results.reduce((sum, r) => sum + r.congestion, 0) / results.length;
  const worstIdx = results.reduce((minIdx, r, i) => r.congestion < results[minIdx].congestion ? i : minIdx, 0);
  const worstPoint = coordinates[indices[worstIdx]] || null;

  return {
    avgCongestion,
    worstCongestion: results[worstIdx].congestion,
    worstPoint,
  };
}
