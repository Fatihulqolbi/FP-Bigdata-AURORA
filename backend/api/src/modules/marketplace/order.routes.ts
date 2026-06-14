import { Router } from "express";
import * as orderCtrl from "./order.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { requirePermission, Permission } from "../../middleware/rbac.js";
import { orderLimiter } from "../../middleware/rateLimit.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): order routes
router.post("/", requireAuth, orderLimiter, orderCtrl.create);
router.post("/instant", requireAuth, requirePermission(Permission.CREATE_DEMAND), orderLimiter, orderCtrl.createInstant);
router.get("/", requireAuth, orderCtrl.listBuyerOrders);
router.get("/seller", requireAuth, requirePermission(Permission.VIEW_SELLER_ORDERS), orderCtrl.listSellerOrders);
router.get("/admin", requireAuth, requirePermission(Permission.VIEW_ALL_ORDERS), orderCtrl.listAllOrders);
router.get("/:id", requireAuth, orderCtrl.getById);
router.patch("/:id/status", requireAuth, orderCtrl.updateStatus);
router.patch("/items/:itemId/approve", requireAuth, requirePermission(Permission.APPROVE_ORDER_ITEMS), orderCtrl.approveOrderItem);
router.patch("/items/:itemId/reject", requireAuth, requirePermission(Permission.APPROVE_ORDER_ITEMS), orderCtrl.rejectOrderItem);

export default router;
