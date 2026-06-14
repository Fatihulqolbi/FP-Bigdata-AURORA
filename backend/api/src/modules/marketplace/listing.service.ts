import { prisma } from "../../config/db.js";
import { Prisma } from "@prisma/client";

interface CreateListingData {
  type: "MATERIAL" | "PRODUCT";
  categoryId: string;
  title: string;
  description?: string;
  quantity: number;
  pricePerKg: number;
  moq: number;
  fulfillmentOptions: "PICKUP" | "DELIVERY" | "BOTH";
  lat: number;
  lng: number;
  grade?: string;
}

interface ListingsQuery {
  type?: "MATERIAL" | "PRODUCT";
  categoryId?: string;
  minPrice?: number;
  maxPrice?: number;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  page: number;
  limit: number;
}

export async function createListing(sellerId: string, data: CreateListingData) {
  return prisma.listing.create({
    data: {
      ...data,
      sellerId,
    },
    include: {
      category: true,
      seller: {
        select: { id: true, name: true, sellerRating: true, contact: true },
      },
    },
  });
}

export async function getListings(query: ListingsQuery) {
  const where: Prisma.ListingWhereInput = {
    status: "ACTIVE",
  };

  if (query.type) where.type = query.type;
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.minPrice !== undefined || query.maxPrice !== undefined) {
    where.pricePerKg = {};
    if (query.minPrice !== undefined) where.pricePerKg.gte = query.minPrice;
    if (query.maxPrice !== undefined) where.pricePerKg.lte = query.maxPrice;
  }

  const [listings, total] = await Promise.all([
    prisma.listing.findMany({
      where,
      include: {
        category: true,
        seller: {
          select: { id: true, name: true, sellerRating: true, contact: true },
        },
      },
      orderBy: { [query.sortBy || "createdAt"]: query.sortOrder || "desc" },
      skip: (query.page - 1) * query.limit,
      take: query.limit,
    }),
    prisma.listing.count({ where }),
  ]);

  return { listings, total, page: query.page, limit: query.limit };
}

export async function getListingById(id: string) {
  return prisma.listing.findUnique({
    where: { id },
    include: {
      category: true,
      seller: {
        select: { id: true, name: true, sellerRating: true, contact: true, lat: true, lng: true, address: true },
      },
    },
  });
}

export async function updateListing(id: string, sellerId: string, data: Partial<CreateListingData & { status: string }>) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.sellerId !== sellerId) return null;

  return prisma.listing.update({
    where: { id },
    data: data as any,
    include: { category: true },
  });
}

export async function deleteListing(id: string, sellerId: string) {
  const listing = await prisma.listing.findUnique({ where: { id } });
  if (!listing || listing.sellerId !== sellerId) return false;

  await prisma.listing.update({ where: { id }, data: { status: "EXPIRED" } });
  return true;
}

export async function getListingsByCategoryAndLocation(
  categoryId: string,
  lat: number,
  lng: number,
  maxDistance: number,
  maxPrice?: number,
  minQuantity?: number
) {
  const listings = await prisma.listing.findMany({
    where: {
      categoryId,
      status: "ACTIVE",
      ...(maxPrice !== undefined ? { pricePerKg: { lte: maxPrice } } : {}),
      ...(minQuantity !== undefined ? { quantity: { gte: minQuantity } } : {}),
    },
    include: {
      seller: {
        select: { id: true, name: true, sellerRating: true, contact: true },
      },
      category: true,
    },
  });

  // Filter by distance using Haversine
  return listings.filter((listing) => {
    const dist = haversineDistance(lat, lng, listing.lat, listing.lng);
    return dist <= maxDistance;
  });
}

/**
 * Calculate distance between two points using Haversine formula (returns km)
 */
export function haversineDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}
