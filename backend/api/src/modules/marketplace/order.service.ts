import { prisma } from "../../config/db.js";
import { OrderStatus } from "@prisma/client";
import { findMatches } from "./matching.engine.js";

interface OrderItemInput {
  listingId: string;
  sellerId: string;
  quantity: number;
  pricePerKg: number;
}

interface CreateOrderInput {
  demandId?: string;
  items: OrderItemInput[];
  logisticsOption?: "PICKUP" | "DELIVERY";
  notes?: string;
}

export async function createOrder(buyerId: string, data: CreateOrderInput) {
  // Validate items exist
  const listingIds = data.items.map((i) => i.listingId);
  const listings = await prisma.listing.findMany({
    where: { id: { in: listingIds }, status: "ACTIVE" },
  });

  if (listings.length !== listingIds.length) {
    throw new Error("One or more listings not available");
  }

  const listingMap = new Map(listings.map((l) => [l.id, l]));

  let totalQuantity = 0;
  let totalAmount = 0;

  const orderItems = data.items.map((item) => {
    const listing = listingMap.get(item.listingId)!;
    const subtotal = item.quantity * item.pricePerKg;
    totalQuantity += item.quantity;
    totalAmount += subtotal;

    return {
      listingId: item.listingId,
      sellerId: listing.sellerId,
      quantity: item.quantity,
      pricePerKg: item.pricePerKg,
      subtotal,
      status: "PENDING_APPROVAL" as "PENDING_APPROVAL",
    };
  });

  // Check if demand is fully/partially fulfilled
  let demandUpdate = {};
  if (data.demandId) {
    const demand = await prisma.demand.findUnique({ where: { id: data.demandId } });
    if (demand) {
      const fulfilledQty = totalQuantity;
      if (fulfilledQty >= demand.quantityNeeded) {
        demandUpdate = { status: "FULFILLED" };
      } else {
        demandUpdate = { status: "PARTIALLY_FULFILLED" };
      }
    }
  }

  const order = await prisma.order.create({
    data: {
      buyerId,
      demandId: data.demandId || null,
      status: "PENDING_APPROVAL",
      logisticsOption: data.logisticsOption || null,
      totalQuantity,
      totalAmount,
      notes: data.notes,
      items: { create: orderItems },
    },
    include: {
      items: {
        include: {
          listing: { include: { category: true } },
        },
      },
      demand: { include: { category: true } },
    },
  });

  // Update demand status
  if (data.demandId && Object.keys(demandUpdate).length > 0) {
    await prisma.demand.update({ where: { id: data.demandId }, data: demandUpdate });
  }

  return order;
}

/**
 * Create order instantly from best match suggestion
 */
export async function createInstantOrder(buyerId: string, demandId: string) {
  const matchResult = await findMatches(demandId);

  if (!matchResult.instantOrderEligible) {
    throw new Error("No match eligible for instant order (score below threshold)");
  }

  const bestMatch = matchResult.matches[0];
  const items: OrderItemInput[] = bestMatch.candidates.map((c) => ({
    listingId: c.listingId,
    sellerId: c.sellerId,
    quantity: c.availableQuantity,
    pricePerKg: c.pricePerKg,
  }));

  return createOrder(buyerId, {
    demandId,
    items,
    logisticsOption: "PICKUP",
  });
}

export async function getUserOrders(userId: string, page = 1, limit = 20) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      where: { buyerId: userId },
      include: {
        items: {
          include: { listing: { include: { category: true } } },
        },
        demand: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count({ where: { buyerId: userId } }),
  ]);

  return { orders, total, page, limit };
}

export async function getSellerOrders(userId: string, page = 1, limit = 20) {
  const [items, total] = await Promise.all([
    prisma.orderItem.findMany({
      where: { sellerId: userId },
      include: {
        order: {
          include: {
            buyer: { select: { id: true, name: true, contact: true } },
          },
        },
        listing: { include: { category: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.orderItem.count({ where: { sellerId: userId } }),
  ]);

  return { orderItems: items, total, page, limit };
}

export async function getOrderById(orderId: string) {
  return prisma.order.findUnique({
    where: { id: orderId },
    include: {
      items: {
        include: {
          listing: { include: { category: true } },
        },
      },
      buyer: { select: { id: true, name: true, contact: true, address: true, lat: true, lng: true } },
      demand: { include: { category: true } },
    },
  });
}

export async function updateOrderStatus(
  orderId: string,
  userId: string,
  status: OrderStatus,
  paymentProof?: string
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  const isBuyer = order.buyerId === userId;

  // Validation on allowed transitions
  const allowedTransitions: Record<string, string[]> = {
    DRAFT: ["PENDING_APPROVAL", "CANCELLED"],
    PENDING_APPROVAL: ["APPROVED", "CANCELLED"],
    APPROVED: ["AWAITING_PAYMENT", "CANCELLED"],
    AWAITING_PAYMENT: ["PAID", "CANCELLED"],
    PAID: ["READY_FOR_PICKUP", "READY_FOR_DELIVERY"],
    READY_FOR_PICKUP: ["IN_TRANSIT", "DELIVERED"],
    READY_FOR_DELIVERY: ["IN_TRANSIT"],
    IN_TRANSIT: ["DELIVERED"],
    DELIVERED: ["COMPLETED"],
  };

  const allowed = allowedTransitions[order.status];
  if (!allowed || !allowed.includes(status)) {
    throw new Error(`Cannot transition from ${order.status} to ${status}`);
  }

  // Only seller can approve/reject; only buyer can mark paid/delivered
  if (status === "APPROVED" || status === "CANCELLED" && order.status === "PENDING_APPROVAL") {
    // Seller action
  } else if (status === "PAID" || status === "DELIVERED" || status === "COMPLETED") {
    if (!isBuyer) throw new Error("Only buyer can perform this action");
  }

  const updateData: any = { status };
  if (paymentProof) updateData.paymentProof = paymentProof;

  const updated = await prisma.order.update({
    where: { id: orderId },
    data: updateData,
    include: {
      items: { include: { listing: true } },
    },
  });

  // If completed, update seller ratings (simulated)
  if (status === "COMPLETED") {
    for (const item of updated.items) {
      await prisma.user.update({
        where: { id: item.sellerId },
        data: { sellerRating: { increment: 0.01 } },
      });
    }
  }

  return updated;
}

export async function uploadPaymentProof(orderId: string, buyerId: string, proofUrl: string) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order || order.buyerId !== buyerId) throw new Error("Order not found or not authorized");

  return prisma.order.update({
    where: { id: orderId },
    data: {
      paymentProof: proofUrl,
      status: "PAID",
    },
  });
}

// Seller: approve an order item
export async function approveOrderItem(itemId: string, sellerId: string) {
  const item = await prisma.orderItem.findUnique({ where: { id: itemId }, include: { order: true } });
  if (!item) throw new Error("Order item not found");
  if (item.sellerId !== sellerId) throw new Error("Not authorized");

  // Update item status
  await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: "APPROVED" },
  });

  // Check if all items approved → update order status
  const order = await prisma.order.findUnique({
    where: { id: item.orderId },
    include: { items: true },
  });

  const allApproved = order?.items.every((i) => i.status === "APPROVED");
  if (allApproved) {
    await prisma.order.update({
      where: { id: item.orderId },
      data: { status: "AWAITING_PAYMENT" },
    });

    await prisma.auditLog.create({
      data: {
        userId: sellerId,
        action: "ORDER_APPROVED",
        entity: "Order",
        entityId: item.orderId,
      },
    });
  }

  return prisma.order.findUnique({
    where: { id: item.orderId },
    include: { items: { include: { listing: true } } },
  });
}

// Seller: reject an order item
export async function rejectOrderItem(itemId: string, sellerId: string) {
  const item = await prisma.orderItem.findUnique({ where: { id: itemId } });
  if (!item) throw new Error("Order item not found");
  if (item.sellerId !== sellerId) throw new Error("Not authorized");

  await prisma.orderItem.update({
    where: { id: itemId },
    data: { status: "CANCELLED" },
  });

  // Check if all items cancelled → cancel order
  const order = await prisma.order.findUnique({
    where: { id: item.orderId },
    include: { items: true },
  });

  const allCancelled = order?.items.every((i) => i.status === "CANCELLED");
  if (allCancelled) {
    await prisma.order.update({
      where: { id: item.orderId },
      data: { status: "CANCELLED" },
    });
  }

  return prisma.order.findUnique({
    where: { id: item.orderId },
    include: { items: { include: { listing: true } } },
  });
}

// Admin: list all orders
export async function getAllOrders(page = 1, limit = 20) {
  const [orders, total] = await Promise.all([
    prisma.order.findMany({
      include: {
        items: { include: { listing: { include: { category: true } } } },
        buyer: { select: { id: true, name: true, email: true } },
        dispute: true,
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.order.count(),
  ]);

  return { orders, total, page, limit };
}
