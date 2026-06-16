import { Router } from "express";
import * as analyticsCtrl from "./analytics.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

router.get("/tps-summary", requireAuth, analyticsCtrl.getTpsSummary);
router.get("/critical-tps", requireAuth, analyticsCtrl.getCriticalTps);
router.get("/waste-types", requireAuth, analyticsCtrl.getWasteTypeDistribution);
router.get("/fleet-stats", requireAuth, analyticsCtrl.getFleetStats);

export default router;
