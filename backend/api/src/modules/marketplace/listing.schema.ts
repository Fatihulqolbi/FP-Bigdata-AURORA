import { z } from "zod";

export const createListingSchema = z.object({
  type: z.enum(["MATERIAL", "PRODUCT"]),
  categoryId: z.string().min(1),
  title: z.string().min(1),
  description: z.string().optional(),
  quantity: z.number().positive(),
  pricePerKg: z.number().positive(),
  moq: z.number().positive().default(1),
  fulfillmentOptions: z.enum(["PICKUP", "DELIVERY", "BOTH"]).default("BOTH"),
  lat: z.number(),
  lng: z.number(),
  grade: z.string().optional(),
});

export const updateListingSchema = createListingSchema.partial().extend({
  status: z.enum(["ACTIVE", "SOLD_OUT", "EXPIRED", "DRAFT"]).optional(),
});

export const listingQuerySchema = z.object({
  type: z.enum(["MATERIAL", "PRODUCT"]).optional(),
  categoryId: z.string().optional(),
  minPrice: z.coerce.number().optional(),
  maxPrice: z.coerce.number().optional(),
  sortBy: z.enum(["price", "quantity", "createdAt"]).optional(),
  sortOrder: z.enum(["asc", "desc"]).optional().default("desc"),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
