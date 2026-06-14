import { Router } from "express";
import * as authCtrl from "./auth.controller.js";
import { requireAuth, requireRole } from "../../middleware/auth.js";
import { authLimiter } from "../../middleware/rateLimit.js";

const router = Router();

// AURORA-INTEGRATION (Tahap 1 / Marketplace): auth routes
router.post("/register", authLimiter, authCtrl.register);
router.post("/login", authLimiter, authCtrl.login);
router.get("/me", requireAuth, authCtrl.getMe);
router.post("/forgot-password", authLimiter, authCtrl.forgotPassword);
router.post("/reset-password", authLimiter, authCtrl.resetPassword);

// Admin
router.get("/admin/verifications", requireAuth, requireRole("ADMIN"), authCtrl.getPendingVerifications);
router.patch("/admin/verifications/:userId", requireAuth, requireRole("ADMIN"), authCtrl.verifyUser);

router.patch("/profile", requireAuth, authCtrl.updateProfile);
router.patch("/password", requireAuth, authCtrl.changePassword);
router.delete("/account", requireAuth, authCtrl.deleteAccount);

export default router;
