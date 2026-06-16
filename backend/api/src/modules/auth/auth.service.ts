import { prisma } from "../../config/db.js";
import { generateToken } from "../../middleware/auth.js";
import { getUserPermissions } from "../../middleware/rbac.js";
import { Role, AccountStatus } from "@prisma/client";
import bcrypt from "bcryptjs";
import crypto from "crypto";

interface RegisterInput {
  email: string;
  password: string;
  role: Role;
  name: string;
  address?: string;
  kecamatan?: string;
  lat?: number;
  lng?: number;
  contact?: string;
}

function buildTokenPayload(user: any) {
  const permissions = getUserPermissions(user.role, user.adminLevel);
  return {
    userId: user.id,
    email: user.email,
    role: user.role,
    permissions,
  };
}

export async function register(input: RegisterInput) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, 12);

  const initialStatus: AccountStatus =
    input.role === "BANK_SAMPAH" || input.role === "INDUSTRI"
      ? "ACTIVE"
      : "ACTIVE";

  const user = await prisma.user.create({
    data: {
      email: input.email,
      passwordHash,
      role: input.role,
      status: initialStatus,
      name: input.name,
      address: input.address,
      kecamatan: input.kecamatan,
      lat: input.lat,
      lng: input.lng,
      contact: input.contact,
    },
  });

  const token = generateToken(buildTokenPayload(user));

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status,
      permissions: getUserPermissions(user.role, user.adminLevel),
    },
  };
}

export async function login(email: string, password: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) throw new Error("Invalid credentials");

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) throw new Error("Invalid credentials");

  if (user.status === "SUSPENDED" || user.status === "REJECTED") {
    throw new Error("Account not verified");
  }

  const token = generateToken(buildTokenPayload(user));

  return {
    token,
    user: {
      id: user.id,
      email: user.email,
      role: user.role,
      name: user.name,
      status: user.status,
      permissions: getUserPermissions(user.role, user.adminLevel),
    },
  };
}

export async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      email: true,
      role: true,
      adminLevel: true,
      status: true,
      name: true,
      address: true,
      kecamatan: true,
      lat: true,
      lng: true,
      contact: true,
      verificationDoc: true,
      sellerRating: true,
      assignedKecamatans: true,
      uploadedDocuments: true,
      createdAt: true,
    },
  });
  if (!user) return null;
  return {
    ...user,
    permissions: getUserPermissions(user.role, user.adminLevel),
  };
}

export async function updateAccountStatus(
  userId: string,
  status: AccountStatus,
  adminId: string
) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  return prisma.user.update({
    where: { id: userId },
    data: {
      status,
      verifiedBy: status === "ACTIVE" ? adminId : user.verifiedBy,
    },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      name: true,
    },
  });
}

export async function getPendingUsers(adminUserId: string) {
  const admin = await prisma.user.findUnique({ where: { id: adminUserId } });

  // Regional admin only sees users in their assigned kecamatans
  if (admin?.adminLevel === "ADMIN_REGIONAL" && admin.assignedKecamatans.length > 0) {
    return prisma.user.findMany({
      where: {
        status: "PENDING_VERIFICATION",
        kecamatan: { in: admin.assignedKecamatans },
      },
      select: {
        id: true,
        email: true,
        role: true,
        status: true,
        name: true,
        address: true,
        kecamatan: true,
        contact: true,
        verificationDoc: true,
        industryDoc: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    });
  }

  return prisma.user.findMany({
    where: { status: "PENDING_VERIFICATION" },
    select: {
      id: true,
      email: true,
      role: true,
      status: true,
      name: true,
      address: true,
      kecamatan: true,
      contact: true,
      verificationDoc: true,
      industryDoc: true,
      createdAt: true,
    },
    orderBy: { createdAt: "asc" },
  });
}

// Forgot password — generate reset token
export async function forgotPassword(email: string) {
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return true; // Don't reveal whether email exists

  const resetToken = crypto.randomBytes(32).toString("hex");
  const resetTokenExpires = new Date(Date.now() + 3600000); // 1 hour

  await prisma.user.update({
    where: { id: user.id },
    data: { resetToken, resetTokenExpires },
  });

  // In dev mode, print to console. In prod, send email.
  console.log(`\n[RESET PASSWORD] Token for ${email}: ${resetToken}`);
  console.log(`[RESET PASSWORD] Link: http://localhost:5173/reset-password?token=${resetToken}\n`);

  return true;
}

// Reset password with token
export async function resetPassword(token: string, newPassword: string) {
  const user = await prisma.user.findFirst({
    where: {
      resetToken: token,
      resetTokenExpires: { gte: new Date() },
    },
  });

  if (!user) throw new Error("Invalid or expired reset token");

  const passwordHash = await bcrypt.hash(newPassword, 12);

  await prisma.user.update({
    where: { id: user.id },
    data: {
      passwordHash,
      resetToken: null,
      resetTokenExpires: null,
    },
  });

  return true;
}

export async function updateProfile(userId: string, data: { name?: string; kecamatan?: string; contact?: string; address?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  return prisma.user.update({
    where: { id: userId },
    data,
    select: {
      id: true, email: true, role: true, status: true, name: true,
      address: true, kecamatan: true, contact: true,
    },
  });
}

export async function changePassword(userId: string, oldPassword: string, newPassword: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const valid = await bcrypt.compare(oldPassword, user.passwordHash);
  if (!valid) throw new Error("Current password is incorrect");

  const passwordHash = await bcrypt.hash(newPassword, 12);
  await prisma.user.update({ where: { id: userId }, data: { passwordHash } });

  return true;
}

export async function deleteAccount(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  return true;
}

// --- Admin User Management ---

export async function listUsers(params: {
  page: number;
  limit: number;
  role?: string;
  status?: string;
  search?: string;
}) {
  const { page, limit, role, status, search } = params;
  const skip = (page - 1) * limit;

  const where: any = {};
  if (role) where.role = role;
  if (status) where.status = status;
  if (search) {
    where.OR = [
      { name: { contains: search, mode: "insensitive" } },
      { email: { contains: search, mode: "insensitive" } },
    ];
  }

  const [users, total] = await Promise.all([
    prisma.user.findMany({
      where,
      skip,
      take: limit,
      orderBy: { createdAt: "desc" },
      select: {
        id: true, email: true, name: true, role: true, status: true,
        address: true, kecamatan: true, contact: true,
        createdAt: true, updatedAt: true,
      },
    }),
    prisma.user.count({ where }),
  ]);

  return {
    users,
    total,
    page,
    limit,
    totalPages: Math.ceil(total / limit),
  };
}

export async function getUserStats() {
  const [total, byRole, byStatus] = await Promise.all([
    prisma.user.count(),
    prisma.user.groupBy({ by: ["role"], _count: { id: true } }),
    prisma.user.groupBy({ by: ["status"], _count: { id: true } }),
  ]);

  return {
    total,
    byRole: byRole.map((r) => ({ role: r.role, count: r._count.id })),
    byStatus: byStatus.map((s) => ({ status: s.status, count: s._count.id })),
  };
}

export async function adminUpdateUser(userId: string, data: { name?: string; email?: string; role?: string; status?: string }) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  const updateData: any = {};
  if (data.name) updateData.name = data.name;
  if (data.email) updateData.email = data.email;
  if (data.role) updateData.role = data.role as Role;
  if (data.status) updateData.status = data.status as AccountStatus;

  return prisma.user.update({
    where: { id: userId },
    data: updateData,
    select: {
      id: true, email: true, name: true, role: true, status: true,
      address: true, kecamatan: true, contact: true,
      createdAt: true, updatedAt: true,
    },
  });
}

export async function adminDeleteUser(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) throw new Error("User not found");

  await prisma.user.update({ where: { id: userId }, data: { status: "SUSPENDED" } });
  return true;
}

export async function adminCreateUser(input: {
  name: string;
  email: string;
  password: string;
  role: Role;
  status?: AccountStatus;
  address?: string;
  contact?: string;
}) {
  const existing = await prisma.user.findUnique({ where: { email: input.email } });
  if (existing) throw new Error("Email already registered");

  const passwordHash = await bcrypt.hash(input.password, 12);

  const user = await prisma.user.create({
    data: {
      name: input.name,
      email: input.email,
      passwordHash,
      role: input.role,
      status: input.status || "ACTIVE",
      address: input.address,
      contact: input.contact,
    },
    select: {
      id: true, email: true, name: true, role: true, status: true,
      address: true, kecamatan: true, contact: true,
      createdAt: true, updatedAt: true,
    },
  });

  return user;
}
