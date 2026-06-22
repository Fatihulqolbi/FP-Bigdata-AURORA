import { Router, Request, Response } from "express";
import * as wriService from "./wri.service.js";
import * as overloadService from "./overload-prediction.service.js";
import * as utilizationService from "./facility-utilization.service.js";
import * as costService from "./cost-baseline.service.js";

const router = Router();

router.get("/wri/all", async (_req: Request, res: Response) => {
  try {
    const results = await wriService.calculateAllWRI();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to calculate WRI" });
  }
});

router.get("/wri/:kecamatan", async (req: Request, res: Response) => {
  try {
    const kecamatan = String(req.params.kecamatan);
    const result = await wriService.getWRIByRegion(kecamatan);
    if (!result) {
      res.status(404).json({ success: false, error: "Region not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get WRI" });
  }
});

router.get("/wri/history/:kecamatan", async (req: Request, res: Response) => {
  try {
    const hoursQuery = req.query.hours;
    const hours = typeof hoursQuery === "string" ? parseInt(hoursQuery) : 24;
    const kecamatan = String(req.params.kecamatan);
    const history = await wriService.getWRIHistory(kecamatan, hours);
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get WRI history" });
  }
});

router.get("/wri/critical/all", async (_req: Request, res: Response) => {
  try {
    const results = await wriService.getCriticalRegions();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get critical regions" });
  }
});

router.get("/overload/all", async (_req: Request, res: Response) => {
  try {
    const results = await overloadService.predictAllOverload();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to calculate overload predictions" });
  }
});

router.get("/overload/critical", async (_req: Request, res: Response) => {
  try {
    const results = await overloadService.getCriticalOverloadPredictions();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get critical predictions" });
  }
});

router.get("/overload/tps/:tpsId", async (req: Request, res: Response) => {
  try {
    const tpsId = String(req.params.tpsId);
    const result = await overloadService.getOverloadPredictionByTps(tpsId);
    if (!result) {
      res.status(404).json({ success: false, error: "TPS not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get overload prediction" });
  }
});

router.get("/utilization/facilities", async (_req: Request, res: Response) => {
  try {
    const results = await utilizationService.getAllFacilityUtilization();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get facility utilization" });
  }
});

router.get("/utilization/facility/:facilityId", async (req: Request, res: Response) => {
  try {
    const facilityId = String(req.params.facilityId);
    const result = await utilizationService.getFacilityUtilization(facilityId);
    if (!result) {
      res.status(404).json({ success: false, error: "Facility not found" });
      return;
    }
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get facility utilization" });
  }
});

router.get("/utilization/overloaded", async (_req: Request, res: Response) => {
  try {
    const results = await utilizationService.getOverloadedFacilities();
    res.json({ success: true, data: results, count: results.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get overloaded facilities" });
  }
});

router.get("/utilization/history/:facilityId", async (req: Request, res: Response) => {
  try {
    const hoursQuery = req.query.hours;
    const hours = typeof hoursQuery === "string" ? parseInt(hoursQuery) : 24;
    const facilityId = String(req.params.facilityId);
    const history = await utilizationService.getFacilityUtilizationHistory(
      facilityId,
      hours
    );
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get utilization history" });
  }
});

router.get("/cost/baseline", async (_req: Request, res: Response) => {
  try {
    const result = await costService.getLatestCostBaseline();
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get cost baseline" });
  }
});

router.post("/cost/calculate", async (req: Request, res: Response) => {
  try {
    const { periodStart, periodEnd } = req.body;
    if (!periodStart || !periodEnd) {
      res.status(400).json({ success: false, error: "Missing periodStart or periodEnd" });
      return;
    }
    const result = await costService.calculateCostBaseline(
      new Date(periodStart),
      new Date(periodEnd)
    );
    res.json({ success: true, data: result });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to calculate cost baseline" });
  }
});

router.get("/cost/history", async (req: Request, res: Response) => {
  try {
    const limitQuery = req.query.limit;
    const limit = typeof limitQuery === "string" ? parseInt(limitQuery) : 30;
    const history = await costService.getCostBaselineHistory(limit);
    res.json({ success: true, data: history, count: history.length });
  } catch (err) {
    res.status(500).json({ success: false, error: "Failed to get cost history" });
  }
});

export default router;
