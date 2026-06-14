import { Router } from "express";
import * as matchingCtrl from "./matching.controller.js";
import { requireAuth } from "../../middleware/auth.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): matching routes
router.get("/", requireAuth, matchingCtrl.getMatches);

export default router;
