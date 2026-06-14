import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as tpsService from "./tps.service.js";
import { z } from "zod";

const createTpsSchema = z.object({
  code: z.string().min(1),
  name: z.string().min(1),
  kecamatan: z.string().min(1),
  kelurahan: z.string().optional(),
  lat: z.number(),
  lng: z.number(),
  capacity: z.number().positive().optional().default(50),
  currentVolume: z.number().min(0).optional().default(0),
  status: z.string().optional(),
  images: z.array(z.string()).optional(),
});

const updateTpsSchema = createTpsSchema.partial();

const updateVolumeSchema = z.object({
  currentVolume: z.number().min(0),
});

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = createTpsSchema.parse(req.body);
    const tps = await tpsService.createTps(data);
    res.status(201).json(tps);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "TPS code already exists") {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 200;
    const kecamatan = req.query.kecamatan as string | undefined;
    const result = await tpsService.getTpsList(page, limit, kecamatan);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const tps = await tpsService.getTpsById(req.params.id as string);
    if (!tps) {
      res.status(404).json({ error: "TPS not found" });
      return;
    }
    res.json(tps);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const data = updateTpsSchema.parse(req.body);
    const tps = await tpsService.updateTps(req.params.id as string, data);
    res.json(tps);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "TPS not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === "TPS code already taken") {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateVolume(req: AuthRequest, res: Response) {
  try {
    const data = updateVolumeSchema.parse(req.body);
    const tps = await tpsService.updateVolume(req.params.id as string, data.currentVolume);
    res.json(tps);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "TPS not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === "Volume cannot be negative" || err.message === "Volume exceeds capacity") {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    await tpsService.deleteTps(req.params.id as string);
    res.json({ message: "TPS deleted" });
  } catch (err: any) {
    if (err.message === "TPS not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}
