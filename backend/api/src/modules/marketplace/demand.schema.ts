import { z } from "zod";

export const createDemandSchema = z.object({
  categoryId: z.string().min(1),
  quantityNeeded: z.number().positive(),
  maxPrice: z.number().positive(),
  preferredDistance: z.number().positive().default(50),
  lat: z.number().optional(),
  lng: z.number().optional(),
});

export const updateDemandSchema = createDemandSchema.partial().extend({
  status: z.enum(["OPEN", "PARTIALLY_FULFILLED", "FULFILLED", "CANCELLED"]).optional(),
});

export const demandQuerySchema = z.object({
  categoryId: z.string().optional(),
  status: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});
