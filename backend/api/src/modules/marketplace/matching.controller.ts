import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as matchingEngine from "./matching.engine.js";

export async function getMatches(req: AuthRequest, res: Response) {
  try {
    const demandId = req.query.demandId as string;
    if (!demandId) {
      res.status(400).json({ error: "Missing demandId query parameter" });
      return;
    }

    const result = await matchingEngine.findMatches(demandId);
    res.json(result);
  } catch (err: any) {
    if (err.message === "Demand not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}
