import { AuthRequest } from "../../middleware/auth.js";
import * as authService from "./auth.service.js";
import { z } from "zod";
import { Request, Response } from "express";

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(["BANK_SAMPAH", "INDUSTRI", "WARGA", "UMKM"]),
  name: z.string().min(1),
  address: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  contact: z.string().optional(),
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function register(req: Request, res: Response) {
  try {
    const data = registerSchema.parse(req.body);
    const result = await authService.register(data);
    res.status(201).json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Email already registered") {
      res.status(409).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function login(req: Request, res: Response) {
  try {
    const data = loginSchema.parse(req.body);
    const result = await authService.login(data.email, data.password);
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Invalid credentials") {
      res.status(401).json({ error: err.message });
      return;
    }
    if (err.message === "Account not verified") {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getMe(req: AuthRequest, res: Response) {
  try {
    const user = await authService.getProfile(req.user!.userId);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }
    res.json(user);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// Admin: verify user accounts
export async function verifyUser(req: AuthRequest, res: Response) {
  try {
    const userId = req.params.userId as string;
    const { status } = req.body;
    const result = await authService.updateAccountStatus(userId, status, req.user!.userId);
    res.json(result);
  } catch (err: any) {
    if (err.message === "User not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getPendingVerifications(req: AuthRequest, res: Response) {
  try {
    const users = await authService.getPendingUsers(req.user!.userId);
    res.json(users);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// Forgot password
export async function forgotPassword(req: Request, res: Response) {
  try {
    const { email } = req.body;
    if (!email) {
      res.status(400).json({ error: "Email is required" });
      return;
    }
    await authService.forgotPassword(email);
    res.json({ message: "If the email exists, a reset link has been sent (check console in dev mode)." });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

// Reset password
export async function resetPassword(req: Request, res: Response) {
  try {
    const { token, password } = req.body;
    if (!token || !password || password.length < 6) {
      res.status(400).json({ error: "Token and password (min 6 chars) are required" });
      return;
    }
    await authService.resetPassword(token, password);
    res.json({ message: "Password reset successful. Please login." });
  } catch (err: any) {
    if (err.message === "Invalid or expired reset token") {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateProfile(req: AuthRequest, res: Response) {
  try {
    const { name, kecamatan, contact, address } = req.body;
    const user = await authService.updateProfile(req.user!.userId, { name, kecamatan, contact, address });
    res.json(user);
  } catch (err: any) {
    if (err.message === "User not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function changePassword(req: AuthRequest, res: Response) {
  try {
    const { oldPassword, newPassword } = req.body;
    if (!oldPassword || !newPassword || newPassword.length < 6) {
      res.status(400).json({ error: "oldPassword and newPassword (min 6 chars) are required" });
      return;
    }
    await authService.changePassword(req.user!.userId, oldPassword, newPassword);
    res.json({ message: "Password changed successfully." });
  } catch (err: any) {
    if (err.message === "Current password is incorrect") {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.message === "User not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function deleteAccount(req: AuthRequest, res: Response) {
  try {
    const { password } = req.body;
    if (!password) {
      res.status(400).json({ error: "Password confirmation is required" });
      return;
    }
    await authService.deleteAccount(req.user!.userId);
    res.json({ message: "Account deleted." });
  } catch (err: any) {
    res.status(500).json({ error: "Internal server error" });
  }
}
