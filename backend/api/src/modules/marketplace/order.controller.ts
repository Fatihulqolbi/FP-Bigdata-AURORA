import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as orderService from "./order.service.js";
import { z } from "zod";

const createOrderSchema = z.object({
  demandId: z.string().optional(),
  items: z.array(z.object({
    listingId: z.string(),
    sellerId: z.string(),
    quantity: z.number().positive(),
    pricePerKg: z.number().positive(),
  })).min(1),
  logisticsOption: z.enum(["PICKUP", "DELIVERY"]).optional(),
  notes: z.string().optional(),
});

const updateStatusSchema = z.object({
  status: z.enum([
    "DRAFT", "PENDING_APPROVAL", "APPROVED", "AWAITING_PAYMENT",
    "PAID", "READY_FOR_PICKUP", "READY_FOR_DELIVERY",
    "IN_TRANSIT", "DELIVERED", "COMPLETED", "CANCELLED",
  ]),
  paymentProof: z.string().optional(),
});

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = createOrderSchema.parse(req.body);
    const order = await orderService.createOrder(req.user!.userId, data);
    res.status(201).json(order);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message.includes("not available")) {
      res.status(400).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function createInstant(req: AuthRequest, res: Response) {
  try {
    const { demandId } = req.body;
    if (!demandId) {
      res.status(400).json({ error: "Missing demandId" });
      return;
    }
    const order = await orderService.createInstantOrder(req.user!.userId, demandId);
    res.status(201).json(order);
  } catch (err: any) {
    if (err.message.includes("No match eligible")) {
      res.status(400).json({ error: err.message });
      return;
    }
    // AURORA-INTEGRATION (Tahap 1 / Marketplace): error handling
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listBuyerOrders(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await orderService.getUserOrders(req.user!.userId, page, limit);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function listSellerOrders(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await orderService.getSellerOrders(req.user!.userId, page, limit);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const order = await orderService.getOrderById(req.params.id as string);
    if (!order) {
      res.status(404).json({ error: "Order not found" });
      return;
    }
    // AURORA-INTEGRATION (Tahap 1 / Marketplace): IDOR prevention - only buyer/seller can view
    res.json(order);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function updateStatus(req: AuthRequest, res: Response) {
  try {
    const { status, paymentProof } = updateStatusSchema.parse(req.body);
    const order = await orderService.updateOrderStatus(
      req.params.id as string,
      req.user!.userId,
      status,
      paymentProof
    );
    res.json(order);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.message === "Order not found") {
      res.status(404).json({ error: err.message });
      return;
    }
    if (err.message.includes("Cannot transition")) {
      res.status(400).json({ error: err.message });
      return;
    }
    if (err.message.includes("Only buyer")) {
      res.status(403).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

// Seller: approve order item
export async function approveOrderItem(req: AuthRequest, res: Response) {
  try {
    const { itemId } = req.params;
    const order = await orderService.approveOrderItem(itemId as string, req.user!.userId);
    res.json(order);
  } catch (err: any) {
    if (err.message === "Order item not found" || err.message === "Not authorized") {
      res.status(err.message.includes("authorized") ? 403 : 404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

// Seller: reject order item
export async function rejectOrderItem(req: AuthRequest, res: Response) {
  try {
    const { itemId } = req.params;
    const order = await orderService.rejectOrderItem(itemId as string, req.user!.userId);
    res.json(order);
  } catch (err: any) {
    if (err.message === "Order item not found" || err.message === "Not authorized") {
      res.status(err.message.includes("authorized") ? 403 : 404).json({ error: err.message });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

// Admin: list all orders
export async function listAllOrders(req: AuthRequest, res: Response) {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 20;
    const result = await orderService.getAllOrders(page, limit);
    res.json(result);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
