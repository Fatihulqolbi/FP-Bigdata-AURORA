import { prisma } from "../../config/db.js";

interface CreateTpsInput {
  code: string;
  name: string;
  kecamatan: string;
  kelurahan?: string;
  lat: number;
  lng: number;
  capacityKg?: number;
  fillThreshold?: number;
  currentVolume?: number;
  status?: string;
  type?: string;
  schedule?: any[];
  needsReview?: boolean;
  source?: string;
  rawAddress?: string;
  confidence?: number;
  images?: string[];
  adminId?: string;
}

interface UpdateTpsInput {
  code?: string;
  name?: string;
  kecamatan?: string;
  kelurahan?: string;
  lat?: number;
  lng?: number;
  capacityKg?: number;
  fillThreshold?: number;
  currentVolume?: number;
  status?: string;
  type?: string;
  schedule?: any[];
  needsReview?: boolean;
  source?: string;
  rawAddress?: string;
  confidence?: number;
  images?: string[];
}

interface VerifyTpsInput {
  status?: string;
  lat?: number;
  lng?: number;
  capacityKg?: number;
  verifiedBy: string;
}

export async function createTps(data: CreateTpsInput) {
  const existing = await prisma.tps.findUnique({ where: { code: data.code } });
  if (existing) throw new Error("TPS code already exists");

  return prisma.tps.create({
    data: {
      code: data.code,
      name: data.name,
      kecamatan: data.kecamatan,
      kelurahan: data.kelurahan,
      lat: data.lat,
      lng: data.lng,
      capacityKg: data.capacityKg ?? 3500,
      fillThreshold: data.fillThreshold ?? 0.9,
      currentVolume: data.currentVolume ?? 0,
      status: data.status ?? "AKTIF",
      type: data.type ?? "TPS_BIASA",
      schedule: data.schedule ?? [],
      needsReview: data.needsReview ?? true,
      source: data.source ?? "MANUAL",
      rawAddress: data.rawAddress,
      confidence: data.confidence ?? 1.0,
      images: data.images ?? [],
      adminId: data.adminId,
    },
  });
}

export async function getTpsList(page = 1, limit = 50, kecamatan?: string, status?: string, needsReview?: boolean) {
  const where: any = {};
  if (kecamatan) where.kecamatan = kecamatan;
  if (status) where.status = status;
  if (typeof needsReview === "boolean") where.needsReview = needsReview;

  const [list, total] = await Promise.all([
    prisma.tps.findMany({
      where,
      orderBy: { name: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.tps.count({ where }),
  ]);

  return { tps: list, total, page, limit };
}

export async function getTpsById(id: string) {
  return prisma.tps.findUnique({ where: { id } });
}

export async function updateTps(id: string, data: UpdateTpsInput) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");

  if (data.code && data.code !== existing.code) {
    const duplicate = await prisma.tps.findUnique({ where: { code: data.code } });
    if (duplicate) throw new Error("TPS code already taken");
  }

  return prisma.tps.update({ where: { id }, data });
}

export async function verifyTps(id: string, data: VerifyTpsInput) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");

  const updateData: any = {
    needsReview: false,
    verifiedBy: data.verifiedBy,
    verifiedAt: new Date(),
  };

  if (data.status) updateData.status = data.status;
  if (typeof data.lat === "number") updateData.lat = data.lat;
  if (typeof data.lng === "number") updateData.lng = data.lng;
  if (typeof data.capacityKg === "number") updateData.capacityKg = data.capacityKg;

  return prisma.tps.update({ where: { id }, data: updateData });
}

export async function updateVolume(id: string, currentVolume: number) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");
  if (currentVolume < 0) throw new Error("Volume cannot be negative");

  const fillLevel = existing.capacityKg > 0 ? currentVolume / existing.capacityKg : 0;
  let status = existing.status;
  if (existing.status !== "NONAKTIF") {
    if (fillLevel >= 0.9) status = "PENUH";
    else if (fillLevel >= 0.7) status = "WASPADA";
    else status = "AKTIF";
  }

  return prisma.tps.update({ where: { id }, data: { currentVolume, status } });
}

export async function deleteTps(id: string) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");

  await prisma.tps.delete({ where: { id } });
  return true;
}
