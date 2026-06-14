import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as demandService from "./demand.service.js";
import { createDemandSchema, demandQuerySchema, updateDemandSchema } from "./demand.schema.js";
import { z } from "zod";

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = createDemandSchema.parse(req.body);
    const demand = await demandService.createDemand(req.user!.userId, data);
    res.status(201).json(demand);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const query = demandQuerySchema.parse(req.query);
    const result = await demandService.getDemands(query);
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const demand = await demandService.getDemandById(req.params.id as string);
    if (!demand) {
      res.status(404).json({ error: "Demand not found" });
      return;
    }
    res.json(demand);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const data = updateDemandSchema.parse(req.body);
    const demand = await demandService.updateDemand(req.params.id as string, req.user!.userId, data);
    if (!demand) {
      res.status(403).json({ error: "Forbidden: not your demand" });
      return;
    }
    res.json(demand);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const deleted = await demandService.deleteDemand(req.params.id as string, req.user!.userId);
    if (!deleted) {
      res.status(403).json({ error: "Forbidden: not your demand" });
      return;
    }
    res.json({ message: "Demand removed" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
