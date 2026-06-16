import { Request, Response } from "express";
import * as analyticsService from "./analytics.service.js";

export async function getTpsSummary(_req: Request, res: Response) {
  try {
    const summary = await analyticsService.getTpsSummary();
    res.json(summary);
  } catch (err) {
    res.status(500).json({ error: "Failed to get TPS summary" });
  }
}

export async function getCriticalTps(_req: Request, res: Response) {
  try {
    const critical = await analyticsService.getCriticalTps();
    res.json(critical);
  } catch (err) {
    res.status(500).json({ error: "Failed to get critical TPS list" });
  }
}

export async function getWasteTypeDistribution(_req: Request, res: Response) {
  try {
    const dist = await analyticsService.getWasteTypeDistribution();
    res.json(dist);
  } catch (err) {
    res.status(500).json({ error: "Failed to get waste type distribution" });
  }
}

export async function getFleetStats(_req: Request, res: Response) {
  try {
    const stats = await analyticsService.getFleetStats();
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: "Failed to get fleet stats" });
  }
}
