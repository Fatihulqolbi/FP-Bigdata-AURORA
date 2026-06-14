import { Request, Response } from "express";
import { AuthRequest } from "../../middleware/auth.js";
import { prisma } from "../../config/db.js";
import { z } from "zod";

const materialSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  minPrice: z.number().positive(),
  maxPrice: z.number().positive(),
  gradeOptions: z.array(z.string()).optional(),
  isProduct: z.boolean().optional(),
});

export async function list(_req: Request, res: Response) {
  try {
    const materials = await prisma.materialCategory.findMany({
      orderBy: { name: "asc" },
    });
    res.json(materials);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function getById(req: Request, res: Response) {
  try {
    const material = await prisma.materialCategory.findUnique({
      where: { id: req.params.id as string },
    });
    if (!material) {
      res.status(404).json({ error: "Material not found" });
      return;
    }
    res.json(material);
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function create(req: AuthRequest, res: Response) {
  try {
    const data = materialSchema.parse(req.body);
    const material = await prisma.materialCategory.create({
      data: {
        name: data.name,
        description: data.description || "",
        minPrice: data.minPrice,
        maxPrice: data.maxPrice,
        gradeOptions: data.gradeOptions || [],
        isProduct: data.isProduct || false,
      },
    });
    res.status(201).json(material);
  } catch (err: any) {
    if (err instanceof z.ZodError) {
      res.status(400).json({ error: "Validation error", details: err.errors });
      return;
    }
    if (err.code === "P2002") {
      res.status(409).json({ error: "Material category already exists" });
      return;
    }
    res.status(500).json({ error: "Internal server error" });
  }
}

export async function update(req: AuthRequest, res: Response) {
  try {
    const data = materialSchema.partial().parse(req.body);
    const material = await prisma.materialCategory.update({
      where: { id: req.params.id as string },
      data,
    });
    res.json(material);
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
    await prisma.materialCategory.delete({ where: { id: req.params.id as string } });
    res.json({ message: "Material deleted" });
  } catch {
    res.status(500).json({ error: "Internal server error" });
  }
}
