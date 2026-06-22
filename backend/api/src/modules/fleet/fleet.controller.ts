import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as fleetService from "./fleet.service.js";
import { z } from "zod";
import { prisma } from "../../config/db.js";
import { getRoute, type GeoJSONLineString, type Coordinate } from "./route.service.js";
import { checkRouteTraffic } from "./traffic.service.js";
import { getCriticalTps, getCriticalTpsCount } from "./tps-alert.service.js";

const updateLocationSchema = z.object({
  lat: z.number(),
  lng: z.number(),
  heading: z.number().optional(),
});

const assignTruckSchema = z.object({
  truckId: z.string(),
  tpsId: z.string(),
});

export async function getFleetStatus(req: AuthRequest, res: Response) {
  try {
    const status = await fleetService.getFleetStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listTrucks(req: AuthRequest, res: Response) {
  try {
    const filter: { status?: string; type?: string; facilityId?: string } = {};
    if (req.query.status) filter.status = req.query.status as string;
    if (req.query.type) filter.type = req.query.type as string;
    if (req.query.facilityId) filter.facilityId = req.query.facilityId as string;
    const trucks = await fleetService.getTrucks(filter);
    res.json(trucks);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTruckById(req: AuthRequest, res: Response) {
  try {
    const truck = await fleetService.getTruckById(req.params.id as string);
    if (!truck) {
      res.status(404).json({ error: "Truck not found" });
      return;
    }
    res.json(truck);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateLocation(req: AuthRequest, res: Response) {
  try {
    const data = updateLocationSchema.parse(req.body);
    const truck = await fleetService.updateTruckLocation(req.params.id as string, data);
    res.json(truck);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Truck not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function assignTruck(req: AuthRequest, res: Response) {
  try {
    const data = assignTruckSchema.parse(req.body);
    const truck = await fleetService.assignTruck(data);
    res.json(truck);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Truck not found" || err.message === "TPS not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === "Truck is not available") {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getTaskSuggestionsHandler(_req: AuthRequest, res: Response) {
  try {
    const data = await fleetService.getTaskSuggestions();
    res.json(data);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

const dispatchSchema = z.object({
  truckId: z.string(),
  tpsId: z.string(),
});

export async function dispatchManualHandler(req: AuthRequest, res: Response) {
  try {
    const { truckId, tpsId } = dispatchSchema.parse(req.body);
    const truck = await fleetService.dispatchManual(truckId, tpsId);
    res.json({ success: true, truck });
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    const known = ["Truck not found", "TPS not found", "Truck is not available", "No facility available"];
    if (known.includes(err.message)) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getDriverRoute(req: AuthRequest, res: Response) {
  try {
    const truck = await prisma.truck.findUnique({ where: { id: req.params.id as string } });
    if (!truck) {
      res.status(404).json({ error: "Truck not found" });
      return;
    }

    const waypoints = (truck.routeWaypoints as any[]) || [];
    const activeWps = waypoints.filter((w: any) => w.collectedKg > 0);

    // Get OSRM steps if route exists
    let steps: any[] = [];
    if (truck.route && (truck.route as any).coordinates?.length >= 2) {
      const coords = (truck.route as any).coordinates as [number, number][];
      const stepCount = Math.min(10, coords.length - 1);
      for (let i = 0; i < stepCount; i++) {
        const idx = Math.floor((i / stepCount) * (coords.length - 1));
        const nextIdx = Math.min(idx + 1, coords.length - 1);
        const [lng1, lat1] = coords[idx];
        const [lng2, lat2] = coords[nextIdx];
        const dLng = lng2 - lng1;
        const dLat = lat2 - lat1;
        let direction = "Lurus";
        if (Math.abs(dLng) > Math.abs(dLat)) {
          direction = dLng > 0 ? "Timur" : "Barat";
        } else {
          direction = dLat > 0 ? "Utara" : "Selatan";
        }
        steps.push({
          instruction: `${i === 0 ? "Mulai" : `Arah ${direction}`} di titik ${i + 1}`,
          lat: lat1,
          lng: lng1,
          distance: 0,
          duration: 0,
        });
      }
    }

    // Calculate next stop info
    let nextStop: any = null;
    if (truck.status === "EN_ROUTE_TO_TPS" && activeWps.length > 0) {
      const nextWp = activeWps[0];
      const dist = truck.routeDistance ? (truck.routeDistance * (1 - truck.routeProgress)) / 1000 : 0;
      const duration = truck.routeDuration ? (truck.routeDuration * (1 - truck.routeProgress)) / 60 : 0;
      nextStop = {
        name: nextWp.tpsName,
        distanceKm: Math.round(dist * 10) / 10,
        etaMin: Math.round(duration),
        collectedKg: nextWp.collectedKg,
      };
    }

    // Traffic check
    let traffic: any = null;
    if (truck.route && (truck.route as any).coordinates) {
      const coords = (truck.route as any).coordinates as [number, number][];
      const result = await checkRouteTraffic(coords, 2);
      traffic = {
        congestion: result.avgCongestion,
        status: result.avgCongestion < 0.5 ? "macet" : result.avgCongestion < 0.7 ? "lancar" : "sangat lancar",
      };
    }

    // Fuel & emission stats
    const totalDistKm = truck.routeDistance ? truck.routeDistance / 1000 : 0;
    const fuelEfficiency = truck.type === "DUMP_TRUCK" ? 6 : truck.type === "COMPACTOR" ? 8 : 7;
    const fuelLiters = totalDistKm / fuelEfficiency;
    const fuelCost = Math.round(fuelLiters * 24800);
    const co2Kg = Math.round(fuelLiters * 2.68 * 100) / 100;

    res.json({
      truck: {
        id: truck.id,
        code: truck.code,
        type: truck.type,
        status: truck.status,
        currentLoadKg: truck.currentLoadKg,
        capacityKg: truck.capacityKg,
        lat: truck.lat,
        lng: truck.lng,
        heading: truck.heading,
      },
      route: {
        geometry: truck.route,
        distance: truck.routeDistance,
        duration: truck.routeDuration,
        progress: truck.routeProgress,
      },
      steps,
      waypoints: activeWps.map((w: any) => ({
        name: w.tpsName,
        lat: w.tpsLat,
        lng: w.tpsLng,
        collectedKg: w.collectedKg,
      })),
      nextStop,
      traffic,
      cost: {
        fuelLiters: Math.round(fuelLiters * 100) / 100,
        fuelCost,
        co2Kg,
      },
    });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// --- GET /api/fleet/critical-tps ---
export async function getCriticalTpsHandler(_req: AuthRequest, res: Response) {
  try {
    const criticalTps = await getCriticalTps();
    const counts = await getCriticalTpsCount();
    res.json({ tps: criticalTps, counts });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
