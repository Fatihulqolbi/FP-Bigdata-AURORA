const OSRM_SERVERS = [
  process.env.OSRM_BASE_URL || "https://router.project-osrm.org",
  "https://routing.openstreetmap.de/routed-car",
];

let currentServerIdx = 0;
let osrmSuccess = 0;
let osrmFallback = 0;
let osrmErrors: string[] = [];

function logRouteStats() {
  const total = osrmSuccess + osrmFallback;
  if (total > 0 && total % 20 === 0) {
    console.log(
      `[ROUTE] Stats: ${osrmSuccess} OSRM ok, ${osrmFallback} fallback (${total} total, ${((osrmSuccess / total) * 100).toFixed(0)}% success) [server: ${OSRM_SERVERS[currentServerIdx]}]`
    );
  }
}

function logFirstError(err: unknown) {
  if (osrmErrors.length < 3) {
    const msg = err instanceof Error ? `${err.name}: ${err.message}` : String(err);
    osrmErrors.push(msg);
    console.error(`[ROUTE] OSRM error #${osrmErrors.length}: ${msg}`);
    if (osrmErrors.length === 3) {
      console.error("[ROUTE] Further OSRM errors suppressed. Using fallback routes.");
    }
  }
}

export async function checkOsrmHealth(): Promise<void> {
  for (let i = 0; i < OSRM_SERVERS.length; i++) {
    const server = OSRM_SERVERS[i];
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 10000);
      const url = `${server}/route/v1/driving/112.620,-7.234;112.768,-7.250?overview=false`;
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);
      if (res.ok) {
        const data = await res.json() as any;
        if (data.routes?.length > 0) {
          console.log(`[ROUTE] Health check OK: ${server} (${data.routes[0].distance}m)`);
          currentServerIdx = i;
          return;
        }
      }
      console.warn(`[ROUTE] Health check failed: ${server} — HTTP ${res.status}`);
    } catch (err) {
      console.warn(`[ROUTE] Health check failed: ${server} — ${(err as Error).message}`);
    }
  }
  console.error("[ROUTE] All OSRM servers failed health check. Using fallback routes.");
}

export interface GeoJSONLineString {
  type: "LineString";
  coordinates: [number, number][]; // [lng, lat]
  isFallback?: boolean;
}

export interface RouteResult {
  geometry: GeoJSONLineString;
  distance: number; // meters
  duration: number; // seconds
}

export interface Coordinate {
  lat: number;
  lng: number;
}

/**
 * Get road-following route between points via OSRM.
 * Supports multi-stop waypoints. Falls back to straight-line interpolation.
 */
function isValidCoord(c: Coordinate): boolean {
  return (
    c.lat != null && c.lng != null &&
    !isNaN(c.lat) && !isNaN(c.lng) &&
    Math.abs(c.lat) <= 90 && Math.abs(c.lng) <= 180 &&
    !(c.lat === 0 && c.lng === 0)
  );
}

function roundCoord(n: number): string {
  return (Math.round(n * 1e6) / 1e6).toString();
}

export async function getRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[]
): Promise<RouteResult> {
  // Validate all coordinates
  if (!isValidCoord(origin) || !isValidCoord(destination)) {
    osrmFallback++;
    logRouteStats();
    return fallbackRoute(origin, destination, waypoints);
  }
  const validWaypoints = waypoints?.filter(isValidCoord);

  // Build coordinate string with rounding (6 decimal places)
  const coordParts = [`${roundCoord(origin.lng)},${roundCoord(origin.lat)}`];
  if (validWaypoints) {
    for (const wp of validWaypoints) {
      coordParts.push(`${roundCoord(wp.lng)},${roundCoord(wp.lat)}`);
    }
  }
  coordParts.push(`${roundCoord(destination.lng)},${roundCoord(destination.lat)}`);
  const coords = coordParts.join(";");

  // Try each OSRM server
  let lastError: unknown;
  let lastUrl = "";
  for (let attempt = 0; attempt < OSRM_SERVERS.length; attempt++) {
    const idx = (currentServerIdx + attempt) % OSRM_SERVERS.length;
    const server = OSRM_SERVERS[idx];
    const url = `${server}/route/v1/driving/${coords}?overview=full&geometries=geojson&alternatives=false`;
    lastUrl = url;

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 20000);
      const res = await fetch(url, { signal: controller.signal });
      clearTimeout(timeout);

      if (!res.ok) {
        const body = await res.text().catch(() => "");
        throw new Error(`HTTP ${res.status} — ${body.slice(0, 200)}`);
      }

      const data = await res.json() as any;
      const route = data.routes?.[0];
      if (!route?.geometry?.coordinates?.length) {
        throw new Error("No route geometry in response");
      }

      // Success — remember this server
      if (idx !== currentServerIdx) {
        console.log(`[ROUTE] Switched to server: ${server}`);
        currentServerIdx = idx;
      }
      osrmSuccess++;
      logRouteStats();

      return {
        geometry: route.geometry,
        distance: route.distance,
        duration: route.duration,
      };
    } catch (err) {
      lastError = err;
      // Try next server
    }
  }

  // All servers failed
  osrmFallback++;
  logFirstError(lastError);
  if (osrmErrors.length <= 3) {
    console.error(`[ROUTE] Failed URL: ${lastUrl}`);
  }
  logRouteStats();
  return fallbackRoute(origin, destination, waypoints);
}

function fallbackRoute(
  origin: Coordinate,
  destination: Coordinate,
  waypoints?: Coordinate[]
): RouteResult {
  const points: { lat: number; lng: number }[] = [origin];
  if (waypoints) points.push(...waypoints);
  points.push(destination);

  const coordinates: [number, number][] = [];

  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    const segments = 20;
    for (let s = 0; s <= segments; s++) {
      const t = s / segments;
      const lat = from.lat + (to.lat - from.lat) * t;
      const lng = from.lng + (to.lng - from.lng) * t;
      coordinates.push([lng, lat]);
    }
  }

  let totalDist = 0;
  for (let i = 0; i < points.length - 1; i++) {
    totalDist += haversine(points[i], points[i + 1]);
  }

  return {
    geometry: { type: "LineString", coordinates, isFallback: true },
    distance: Math.round(totalDist * 10) / 10,
    duration: Math.round(totalDist / 11.11),
  };
}

/**
 * Interpolate position along a GeoJSON LineString at a given progress (0..1).
 * Returns [lng, lat] and heading in degrees (0=N, 90=E).
 */
export function interpolateAlongRoute(
  geometry: GeoJSONLineString,
  progress: number
): { position: [number, number]; heading: number } {
  const coords = geometry.coordinates;
  if (coords.length === 0) {
    return { position: [0, 0], heading: 0 };
  }
  if (coords.length === 1 || progress <= 0) {
    const h = coords.length >= 2
      ? Math.atan2(coords[1][0] - coords[0][0], coords[1][1] - coords[0][1]) * 180 / Math.PI
      : 0;
    return { position: [coords[0][0], coords[0][1]], heading: h < 0 ? h + 360 : h };
  }
  if (progress >= 1) {
    const last = coords.length - 1;
    const h = coords.length >= 2
      ? Math.atan2(coords[last][0] - coords[last - 1][0], coords[last][1] - coords[last - 1][1]) * 180 / Math.PI
      : 0;
    return { position: [coords[last][0], coords[last][1]], heading: h < 0 ? h + 360 : h };
  }

  const distances: number[] = [0];
  let total = 0;
  for (let i = 1; i < coords.length; i++) {
    const d = haversine(
      { lat: coords[i - 1][1], lng: coords[i - 1][0] },
      { lat: coords[i][1], lng: coords[i][0] }
    );
    total += d;
    distances.push(total);
  }

  const targetDist = progress * total;

  for (let i = 1; i < distances.length; i++) {
    if (distances[i] >= targetDist) {
      const segLen = distances[i] - distances[i - 1];
      const t = segLen > 0 ? (targetDist - distances[i - 1]) / segLen : 0;
      const lng = coords[i - 1][0] + (coords[i][0] - coords[i - 1][0]) * t;
      const lat = coords[i - 1][1] + (coords[i][1] - coords[i - 1][1]) * t;

      const dLng = coords[i][0] - coords[i - 1][0];
      const dLat = coords[i][1] - coords[i - 1][1];
      let heading = Math.atan2(dLng, dLat) * 180 / Math.PI;
      if (heading < 0) heading += 360;

      return { position: [lng, lat], heading };
    }
  }

  return { position: [coords[coords.length - 1][0], coords[coords.length - 1][1]], heading: 0 };
}

function haversine(p1: Coordinate, p2: Coordinate): number {
  const R = 6371000;
  const dLat = (p2.lat - p1.lat) * Math.PI / 180;
  const dLng = (p2.lng - p1.lng) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(p1.lat * Math.PI / 180) *
      Math.cos(p2.lat * Math.PI / 180) *
      Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
