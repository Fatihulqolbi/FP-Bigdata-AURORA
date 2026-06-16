import { Router } from "express";
import * as tpsCtrl from "./tps.controller.js";
import { requireAuth } from "../../middleware/auth.js";
import { requirePermission, Permission } from "../../middleware/rbac.js";

const router = Router();

router.post("/", requireAuth, requirePermission(Permission.MANAGE_TPS), tpsCtrl.create);
router.get("/", requireAuth, tpsCtrl.list);
router.get("/:id", requireAuth, tpsCtrl.getById);
router.patch("/:id", requireAuth, requirePermission(Permission.MANAGE_TPS), tpsCtrl.update);
router.patch("/:id/verify", requireAuth, tpsCtrl.verify);
router.patch("/:id/volume", requireAuth, requirePermission(Permission.MANAGE_TPS), tpsCtrl.updateVolume);
router.delete("/:id", requireAuth, requirePermission(Permission.MANAGE_TPS), tpsCtrl.remove);

export default router;
