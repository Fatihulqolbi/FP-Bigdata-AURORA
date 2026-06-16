import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as pipelineService from "./pipeline.service.js";

export async function getStatus(req: AuthRequest, res: Response) {
  try {
    const status = await pipelineService.getPipelineStatus();
    res.json(status);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getStats(req: AuthRequest, res: Response) {
  try {
    const stats = await pipelineService.getPipelineStats();
    res.json(stats);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getEvents(req: AuthRequest, res: Response) {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const events = await pipelineService.getRecentEvents(limit);
    res.json(events);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getHDFSFiles(req: AuthRequest, res: Response) {
  try {
    const path = (req.query.path as string) || "/aurora";
    const files = await pipelineService.getHDFSFiles(path);
    res.json(files);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
