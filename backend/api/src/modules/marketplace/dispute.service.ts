import { prisma } from "../../config/db.js";
import { DisputeStatus } from "@prisma/client";

export async function fileDispute(
  orderId: string,
  userId: string,
  reason: string,
  description?: string,
  evidence?: string[]
) {
  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");

  // Only buyer or seller of this order can dispute
  const isBuyer = order.buyerId === userId;
  const isSeller = await prisma.orderItem.findFirst({
    where: { orderId, sellerId: userId },
  });
  if (!isBuyer && !isSeller) throw new Error("Not authorized to dispute this order");

  // Can only dispute within 48h of delivery
  const deliveredDate = order.updatedAt;
  const hoursSinceDelivery = (Date.now() - deliveredDate.getTime()) / 3600000;
  if (hoursSinceDelivery > 48) throw new Error("Dispute window (48h) has expired");

  const dispute = await prisma.dispute.create({
    data: {
      orderId,
      filedBy: userId,
      reason,
      description,
      evidence: evidence || [],
      status: "OPEN",
    },
  });

  // Update order status to DISPUTE
  await prisma.order.update({
    where: { id: orderId },
    data: { status: "DISPUTE" },
  });

  // AURORA-INTEGRATION (Tahap 1 / Marketplace): audit log
  await prisma.auditLog.create({
    data: {
      userId,
      action: "DISPUTE_FILED",
      entity: "Order",
      entityId: orderId,
      detail: { reason, disputeId: dispute.id },
    },
  });

  return dispute;
}

export async function resolveDispute(
  disputeId: string,
  adminId: string,
  resolution: string,
  resolvedFor: "BUYER" | "SELLER"
) {
  const dispute = await prisma.dispute.findUnique({ where: { id: disputeId } });
  if (!dispute) throw new Error("Dispute not found");

  const status: DisputeStatus =
    resolvedFor === "BUYER" ? "RESOLVED_BUYER" : "RESOLVED_SELLER";

  const updated = await prisma.dispute.update({
    where: { id: disputeId },
    data: {
      status,
      resolution,
      resolvedBy: adminId,
    },
  });

  // Update order status
  await prisma.order.update({
    where: { id: dispute.orderId },
    data: { status: "RESOLVED" },
  });

  await prisma.auditLog.create({
    data: {
      userId: adminId,
      action: "DISPUTE_RESOLVED",
      entity: "Dispute",
      entityId: disputeId,
      detail: { resolution, resolvedFor, status },
    },
  });

  return updated;
}

export async function getDisputes(page = 1, limit = 20) {
  const [disputes, total] = await Promise.all([
    prisma.dispute.findMany({
      include: {
        order: {
          include: {
            buyer: { select: { id: true, name: true } },
            items: { include: { listing: { select: { title: true } } } },
          },
        },
      },
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.dispute.count(),
  ]);

  return { disputes, total, page, limit };
}
