import { Router } from "express";
import * as facilityCtrl from "./facility.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { Role } from "@prisma/client";

const router = Router();

router.get("/", requireAuth, facilityCtrl.listFacilities);
router.get("/alerts", requireAuth, facilityCtrl.getAlerts);
router.get("/:id", requireAuth, facilityCtrl.getFacility);
router.patch("/:id/capacity", requireAuth, requireRole(Role.ADMIN), facilityCtrl.updateCapacity);
router.post("/:id/reset-intake", requireAuth, requireRole(Role.ADMIN), facilityCtrl.resetIntake);

export default router;