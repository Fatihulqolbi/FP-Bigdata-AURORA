import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import * as listingService from "./listing.service.js";
import { createListingSchema, listingQuerySchema, updateListingSchema } from "./listing.schema.js";
import { z } from "zod";

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = createListingSchema.parse(req.body);
    const listing = await listingService.createListing(req.user!.userId, data);
    res.status(201).json(listing);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function list(req: Request, res: Response) {
  try {
    const query = listingQuerySchema.parse(req.query);
    const result = await listingService.getListings(query);
    res.json(result);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const listing = await listingService.getListingById(req.params.id as string);
    if (!listing) {
      res.status(404).json({ error: "Listing not found" });
      return;
    }
    res.json(listing);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const data = updateListingSchema.parse(req.body);
    const listing = await listingService.updateListing(req.params.id as string, req.user!.userId, data);
    if (!listing) {
      res.status(403).json({ error: "Forbidden: not your listing" });
      return;
    }
    res.json(listing);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function remove(req: AuthRequest, res: Response) {
  try {
    const deleted = await listingService.deleteListing(req.params.id as string, req.user!.userId);
    if (!deleted) {
      res.status(403).json({ error: "Forbidden: not your listing" });
      return;
    }
    res.json({ message: "Listing deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
