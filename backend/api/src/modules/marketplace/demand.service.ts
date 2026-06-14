import { prisma } from "../../config/db.js";
import { Prisma } from "@prisma/client";

interface CreateDemandData {
  categoryId: string;
  quantityNeeded: number;
  maxPrice: number;
  preferredDistance: number;
  lat?: number;
  lng?: number;
}

interface DemandQuery {
  categoryId?: string;
  status?: string;
  page: number;
  limit: number;
}

export async function createDemand(buyerId: string, data: CreateDemandData) {
  return prisma.demand.create({
    data: { ...data, buyerId },
    include: {
      category: true,
      buyer: {
        select: { id: true, name: true, contact: true },
      },
    },
  });
}

export async function getDemands(query: DemandQuery) {
  const where: Prisma.DemandWhereInput = {};
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status) where.status = query.status as any;

  const [demands, total] = await Promise.all([
    prisma.demand.findMany({
      where,
      include: {
        category: true,
        buyer: { select: { id: true, name: true, contact: true } },
      },
      orderBy: { createdAt: "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.demand.count({ where }),
  ]);

  return { demands, total, page: query.page, limit: query.limit };
}

export async function getDemandById(id: string) {
  return prisma.demand.findUnique({
    where: { id },
    include: {
      category: true,
      buyer: { select: { id: true, name: true, contact: true, lat: true, lng: true } },
      matchSuggestions: { orderBy: { score: "desc" }, take: 10 },
    },
  });
}

export async function updateDemand(id: string, buyerId: string, data: Partial<CreateDemandData & { status: string }>) {
  const demand = await prisma.demand.findUnique({ where: { id } });
  if (!demand || demand.buyerId !== buyerId) return null;

  return prisma.demand.update({
    where: { id },
    data: data as any,
    include: { category: true },
  });
}

export async function deleteDemand(id: string, buyerId: string) {
  const demand = await prisma.demand.findUnique({ where: { id } });
  if (!demand || demand.buyerId !== buyerId) return false;

  await prisma.demand.update({ where: { id }, data: { status: "CANCELLED" } });
  return true;
}
