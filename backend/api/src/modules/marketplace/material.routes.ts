import { Router } from "express";
import * as materialCtrl from "./material.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): material routes
router.get("/", materialCtrl.list);
router.get("/:id", materialCtrl.getById);
router.post("/", requireAuth, requireRole("ADMIN"), materialCtrl.create);
router.patch("/:id", requireAuth, requireRole("ADMIN"), materialCtrl.update);
router.delete("/:id", requireAuth, requireRole("ADMIN"), materialCtrl.remove);

export default router;
