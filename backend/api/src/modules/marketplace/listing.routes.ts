import { Router } from "express";
import * as listingCtrl from "./listing.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): listing routes
router.post("/", requireAuth, requireRole("BANK_SAMPAH"), listingCtrl.create);
router.get("/", listingCtrl.list);
router.get("/:id", listingCtrl.getById);
router.patch("/:id", requireAuth, requireRole("BANK_SAMPAH"), listingCtrl.update);
router.delete("/:id", requireAuth, requireRole("BANK_SAMPAH"), listingCtrl.remove);

export default router;
