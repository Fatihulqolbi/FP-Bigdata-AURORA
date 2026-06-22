import { Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { z } from "zod";
import * as facilityService from "./facility.service.js";

export async function listFacilities(_req: AuthRequest, res: Response) {
  try {
    const facilities = await facilityService.getAllFacilities();
    res.json({ facilities, total: facilities.length });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getFacility(req: AuthRequest, res: Response) {
  try {
    const facility = await facilityService.getFacilityById(req.params.id as string);
    if (!facility) {
      res.status(404).json({ error: "Facility not found" });
      return;
    }
    res.json(facility);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

const updateCapacitySchema = z.object({
  dailyCapacityKg: z.number().min(0).nullable(),
});

export async function updateCapacity(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ error: "Only ADMIN can update facility capacity" });
      return;
    }

    const data = updateCapacitySchema.parse(req.body);
    const facility = await facilityService.updateDailyCapacity(
      req.params.id as string,
      data.dailyCapacityKg
    );
    res.json(facility);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Facility not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message === "dailyCapacityKg must be >= 0 or null (unlimited)") {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function resetIntake(req: AuthRequest, res: Response) {
  try {
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ error: "Only ADMIN can reset facility intake" });
      return;
    }

    const facility = await facilityService.resetIntake(req.params.id as string);
    res.json(facility);
  } catch (err: any) {
    if (err.message === "Facility not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getAlerts(_req: AuthRequest, res: Response) {
  try {
    const alerts = await facilityService.getFacilityAlerts();
    res.json({ alerts, total: alerts.length });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}