import { Response } from "express";
import { prisma } from "../../config/db.js";
import { AuthRequest } from "../../middleware/auth.js";
import { getCriticalTps } from "./tps-alert.service.js";

interface SSEClient {
  res: Response;
  filters?: { types?: string[] };
}

const clients: SSEClient[] = [];

/**
 * Push data to all connected SSE clients
 */
export function broadcastFleetUpdate(data: unknown) {
  const payload = `data: ${JSON.stringify(data)}\n\n`;
  for (const client of clients) {
    try {
      client.res.write(payload);
    } catch {
      // Client disconnected, will be removed on next cleanup
    }
  }
}

/**
 * SSE endpoint handler
 */
export async function fleetSSEHandler(req: AuthRequest, res: Response) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
  });
  res.write("\n");

  const client: SSEClient = { res };
  clients.push(client);

  // Send initial data
  try {
    const [trucks, tpsList, allFacilities, criticalTps] = await Promise.all([
      prisma.truck.findMany({
        orderBy: { code: "asc" },
      }),
      prisma.tps.findMany({
        where: { needsReview: false, status: { not: "NONAKTIF" } },
        select: {
          id: true, code: true, name: true, kecamatan: true,
          lat: true, lng: true, currentVolume: true, capacityKg: true,
          status: true, type: true,
        },
      }),
      prisma.sortingHub.findMany(),
      getCriticalTps(),
    ]);

    // Only facilities with active trucks
    const facilityIds = [...new Set(trucks.map((t) => t.facilityId).filter(Boolean))];
    const facilities = facilityIds.length > 0
      ? allFacilities.filter((f) => facilityIds.includes(f.id))
      : [];

    res.write(`data: ${JSON.stringify({ type: "init", trucks, tps: tpsList, facilities, allFacilities, criticalTps })}\n\n`);
  } catch (err) {
    // Send empty init
    res.write(`data: ${JSON.stringify({ type: "init", trucks: [], tps: [], facilities: [], allFacilities: [], criticalTps: [] })}\n\n`);
  }

  req.on("close", () => {
    const idx = clients.indexOf(client);
    if (idx !== -1) clients.splice(idx, 1);
  });
}
