import { Response, NextFunction } from "express";
import { AuthRequest } from "./auth.js";

export enum Permission {
  // Admin management
  MANAGE_ADMINS = "MANAGE_ADMINS",

  // User verification & management
  VERIFY_USERS = "VERIFY_USERS",
  SUSPEND_USERS = "SUSPEND_USERS",

  // Material & pricing
  MANAGE_CATEGORIES = "MANAGE_CATEGORIES",
  MANAGE_PRICE_RANGE = "MANAGE_PRICE_RANGE",

  // Order moderation
  VIEW_ALL_ORDERS = "VIEW_ALL_ORDERS",
  MODERATE_ORDERS = "MODERATE_ORDERS",
  RESOLVE_DISPUTES = "RESOLVE_DISPUTES",

  // Seller
  CREATE_LISTING = "CREATE_LISTING",
  MANAGE_OWN_LISTING = "MANAGE_OWN_LISTING",
  VIEW_SELLER_ORDERS = "VIEW_SELLER_ORDERS",
  APPROVE_ORDER_ITEMS = "APPROVE_ORDER_ITEMS",

  // Buyer
  CREATE_DEMAND = "CREATE_DEMAND",
  BUY_PRODUCT = "BUY_PRODUCT",
  VIEW_BUYER_ORDERS = "VIEW_BUYER_ORDERS",
  CONFIRM_PAYMENT = "CONFIRM_PAYMENT",

  // Dispute & Review
  FILE_DISPUTE = "FILE_DISPUTE",
  SUBMIT_REVIEW = "SUBMIT_REVIEW",

  // TPS Management
  MANAGE_TPS = "MANAGE_TPS",
  VERIFY_TPS = "VERIFY_TPS",
}

// Permission map per admin level
const ADMIN_PERMISSIONS: Record<string, Permission[]> = {
  SUPER_ADMIN: Object.values(Permission),
  ADMIN_VERIFICATION: [
    Permission.VERIFY_USERS,
    Permission.SUSPEND_USERS,
  ],
  ADMIN_OPERATIONAL: [
    Permission.VIEW_ALL_ORDERS,
    Permission.MODERATE_ORDERS,
    Permission.RESOLVE_DISPUTES,
    Permission.MANAGE_CATEGORIES,
    Permission.MANAGE_PRICE_RANGE,
  ],
  ADMIN_REGIONAL: [
    Permission.VERIFY_USERS,
    Permission.VIEW_ALL_ORDERS,
    Permission.MODERATE_ORDERS,
  ],
};

// Permission map per role (non-admin)
const ROLE_PERMISSIONS: Record<string, Permission[]> = {
  BANK_SAMPAH: [
    Permission.CREATE_LISTING,
    Permission.MANAGE_OWN_LISTING,
    Permission.VIEW_SELLER_ORDERS,
    Permission.APPROVE_ORDER_ITEMS,
    Permission.BUY_PRODUCT,
    Permission.SUBMIT_REVIEW,
    Permission.FILE_DISPUTE,
  ],
  INDUSTRI: [
    Permission.CREATE_DEMAND,
    Permission.BUY_PRODUCT,
    Permission.VIEW_BUYER_ORDERS,
    Permission.CONFIRM_PAYMENT,
    Permission.FILE_DISPUTE,
    Permission.SUBMIT_REVIEW,
  ],
  WARGA: [
    Permission.BUY_PRODUCT,
    Permission.VIEW_BUYER_ORDERS,
    Permission.CONFIRM_PAYMENT,
    Permission.FILE_DISPUTE,
    Permission.SUBMIT_REVIEW,
  ],
  UMKM: [
    Permission.BUY_PRODUCT,
    Permission.VIEW_BUYER_ORDERS,
    Permission.CONFIRM_PAYMENT,
    Permission.FILE_DISPUTE,
    Permission.SUBMIT_REVIEW,
  ],
  ADMIN_TPS: [
    Permission.MANAGE_TPS,
    Permission.BUY_PRODUCT,
    Permission.SUBMIT_REVIEW,
  ],
};

/**
 * Get all permissions for a user based on their role and admin level.
 */
export function getUserPermissions(role: string, adminLevel?: string | null): Permission[] {
  if (role === "ADMIN") {
    if (adminLevel && ADMIN_PERMISSIONS[adminLevel]) {
      return ADMIN_PERMISSIONS[adminLevel];
    }
    // Default full access for legacy admin
    return Object.values(Permission);
  }

  return ROLE_PERMISSIONS[role] || [];
}

/**
 * Middleware that checks if the authenticated user has ALL specified permissions.
 */
export function requirePermission(...required: Permission[]) {
  return (req: AuthRequest, res: Response, next: NextFunction): void => {
    if (!req.user) {
      res.status(401).json({ error: "Unauthorized" });
      return;
    }

    const userPermissions = req.user.permissions || [];
    const hasAll = required.every((p) => userPermissions.includes(p));

    if (!hasAll) {
      res.status(403).json({
        error: "Forbidden: insufficient permissions",
        required,
        granted: userPermissions,
      });
      return;
    }

    next();
  };
}
