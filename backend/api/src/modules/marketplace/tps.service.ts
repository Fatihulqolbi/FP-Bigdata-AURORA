import { prisma } from "../../config/db.js";

interface CreateTpsInput {
  code: string;
  name: string;
  kecamatan: string;
  kelurahan?: string;
  lat: number;
  lng: number;
  capacity?: number;
  currentVolume?: number;
  status?: string;
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
  capacity?: number;
  currentVolume?: number;
  status?: string;
  images?: string[];
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
      capacity: data.capacity ?? 50,
      currentVolume: data.currentVolume ?? 0,
      status: data.status ?? "AKTIF",
      images: data.images ?? [],
      adminId: data.adminId,
    },
  });
}

export async function getTpsList(page = 1, limit = 50, kecamatan?: string) {
  const where: any = {};
  if (kecamatan) where.kecamatan = kecamatan;

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

export async function updateVolume(id: string, currentVolume: number) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");
  if (currentVolume < 0) throw new Error("Volume cannot be negative");
  if (currentVolume > existing.capacity) throw new Error("Volume exceeds capacity");

  return prisma.tps.update({ where: { id }, data: { currentVolume } });
}

export async function deleteTps(id: string) {
  const existing = await prisma.tps.findUnique({ where: { id } });
  if (!existing) throw new Error("TPS not found");

  await prisma.tps.delete({ where: { id } });
  return true;
}
