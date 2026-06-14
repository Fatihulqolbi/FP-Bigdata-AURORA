import { Router } from "express";
import * as demandCtrl from "./demand.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): demand routes
router.post("/", requireAuth, requireRole("INDUSTRI"), demandCtrl.create);
router.get("/", requireAuth, demandCtrl.list);
router.get("/:id", requireAuth, demandCtrl.getById);
router.patch("/:id", requireAuth, requireRole("INDUSTRI"), demandCtrl.update);
router.delete("/:id", requireAuth, requireRole("INDUSTRI"), demandCtrl.remove);

export default router;
