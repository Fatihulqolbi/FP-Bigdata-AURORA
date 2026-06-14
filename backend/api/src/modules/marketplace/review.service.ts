import { prisma } from "../../config/db.js";

export async function submitReview(
  reviewerId: string,
  orderId: string,
  targetId: string,
  rating: number,
  comment?: string
) {
  if (rating < 1 || rating > 5) throw new Error("Rating must be between 1 and 5");

  const order = await prisma.order.findUnique({ where: { id: orderId } });
  if (!order) throw new Error("Order not found");
  if (order.status !== "COMPLETED") throw new Error("Can only review completed orders");

  // Check buyer involvement
  const isBuyer = order.buyerId === reviewerId;
  const isSellerInOrder = await prisma.orderItem.findFirst({
    where: { orderId, sellerId: reviewerId },
  });

  if (!isBuyer && !isSellerInOrder) throw new Error("Not authorized to review this order");

  // Prevent duplicate reviews
  const existing = await prisma.review.findFirst({
    where: { orderId, reviewerId, targetId },
  });
  if (existing) throw new Error("Already reviewed this order for this target");

  const review = await prisma.review.create({
    data: {
      orderId,
      reviewerId,
      targetId,
      rating,
      comment,
    },
  });

  // Update average rating for target user
  const targetReviews = await prisma.review.findMany({
    where: { targetId },
    select: { rating: true },
  });
  const avgRating =
    targetReviews.reduce((s, r) => s + r.rating, 0) / targetReviews.length;

  await prisma.user.update({
    where: { id: targetId },
    data: { sellerRating: avgRating },
  });

  await prisma.auditLog.create({
    data: {
      userId: reviewerId,
      action: "REVIEW_SUBMITTED",
      entity: "Order",
      entityId: orderId,
      detail: { rating, comment },
    },
  });

  return review;
}

export async function getReviewsForUser(userId: string) {
  return prisma.review.findMany({
    where: { targetId: userId },
    include: {
      reviewer: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });
}
