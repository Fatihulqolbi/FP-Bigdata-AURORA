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

// Admin user management
router.get("/admin/users", requireAuth, requireRole("ADMIN"), authCtrl.listUsers);
router.get("/admin/users/stats", requireAuth, requireRole("ADMIN"), authCtrl.getUserStats);
router.post("/admin/users", requireAuth, requireRole("ADMIN"), authCtrl.adminCreateUser);
router.patch("/admin/users/:userId", requireAuth, requireRole("ADMIN"), authCtrl.adminUpdateUser);
router.delete("/admin/users/:userId", requireAuth, requireRole("ADMIN"), authCtrl.adminDeleteUser);

router.patch("/profile", requireAuth, authCtrl.updateProfile);
router.patch("/password", requireAuth, authCtrl.changePassword);
router.delete("/account", requireAuth, authCtrl.deleteAccount);

export default router;
