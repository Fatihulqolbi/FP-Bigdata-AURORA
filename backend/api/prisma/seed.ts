import { PrismaClient, Role, AccountStatus, FulfillmentOption } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  console.log("Seeding AURORA Marketplace...");

  // Clean existing data via dropDatabase (avoids MongoDB replica set requirement for transactions)
  try {
    await prisma.$runCommandRaw({ dropDatabase: 1 });
    console.log("Database dropped.");
  } catch {
    // Database may not exist yet, that's fine
  }

  const hash = await bcrypt.hash("password123", 4); // fast hash for seed

  // Admin
  const admin = await prisma.user.create({
    data: {
      email: "admin@aurora.go.id",
      passwordHash: hash,
      role: "ADMIN" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "DLH Surabaya",
      contact: "031-xxxx",
    },
  });
  console.log("Admin created:", admin.email);

  // Material categories
  const categories = await Promise.all([
    prisma.materialCategory.create({
      data: { name: "Plastik PET", description: "Botol plastik bening", minPrice: 2000, maxPrice: 8000, gradeOptions: ["Bersih", "Kotor", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Plastik HDPE", description: "Botol plastik warna/susu", minPrice: 1500, maxPrice: 6000, gradeOptions: ["Bersih", "Kotor"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Kardus / Kertas", description: "Karton dan kertas bekas", minPrice: 500, maxPrice: 3000, gradeOptions: ["Bersih", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Logam", description: "Besi, aluminium, tembaga", minPrice: 3000, maxPrice: 50000, gradeOptions: ["Besi", "Aluminium", "Tembaga", "Campur"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Organik", description: "Sampah sisa makanan & tanaman", minPrice: 200, maxPrice: 1500 },
    }),
    prisma.materialCategory.create({
      data: { name: "E-Waste", description: "Sampah elektronik", minPrice: 5000, maxPrice: 100000, gradeOptions: ["PCB", "Kabel", "Komponen"] },
    }),
    prisma.materialCategory.create({
      data: { name: "Produk Daur Ulang", description: "Kerajinan hasil daur ulang", minPrice: 10000, maxPrice: 500000, isProduct: true },
    }),
  ]);
  console.log("Categories created:", categories.length);

  // Bank Sampah
  const bank1 = await prisma.user.create({
    data: {
      email: "bank.bratang@aurora.go.id",
      passwordHash: hash,
      role: "BANK_SAMPAH" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "Bank Sampah Bratang",
      address: "Jl. Bratang Binangun, Surabaya",
      lat: -7.295,
      lng: 112.765,
      contact: "0812-xxxx-xxxx",
      sellerRating: 4.5,
    },
  });

  const bank2 = await prisma.user.create({
    data: {
      email: "bank.keputih@aurora.go.id",
      passwordHash: hash,
      role: "BANK_SAMPAH" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "Bank Sampah Keputih",
      address: "Jl. Keputih, Surabaya",
      lat: -7.282,
      lng: 112.795,
      contact: "0813-xxxx-xxxx",
      sellerRating: 4.2,
    },
  });

  const bank3 = await prisma.user.create({
    data: {
      email: "bank.wonorejo@aurora.go.id",
      passwordHash: hash,
      role: "BANK_SAMPAH" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "Bank Sampah Wonorejo",
      address: "Jl. Wonorejo, Surabaya",
      lat: -7.315,
      lng: 112.795,
      contact: "0814-xxxx-xxxx",
      sellerRating: 4.8,
    },
  });
  console.log("Bank Sampah created: 3");

  // Industry
  const industry = await prisma.user.create({
    data: {
      email: "pt.daurulang@aurora.go.id",
      passwordHash: hash,
      role: "INDUSTRI" as Role,
      status: "ACTIVE" as AccountStatus,
      verifiedBy: admin.id,
      name: "PT Daur Ulang Bersama",
      address: "Jl. Rungkut Industri, Surabaya",
      lat: -7.335,
      lng: 112.755,
      contact: "031-xxxx-yyyy",
    },
  });
  console.log("Industry created:", industry.email);

  // Warga
  const warga = await prisma.user.create({
    data: {
      email: "warga@aurora.go.id",
      passwordHash: hash,
      role: "WARGA" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "Budi Santoso",
      address: "Jl. Ngagel, Surabaya",
      lat: -7.290,
      lng: 112.745,
      contact: "0857-xxxx-xxxx",
    },
  });
  console.log("Warga created:", warga.email);

  // Admin TPS
  const tpsAdmin = await prisma.user.create({
    data: {
      email: "admin.tps@aurora.go.id",
      passwordHash: hash,
      role: "ADMIN_TPS" as Role,
      status: "ACTIVE" as AccountStatus,
      name: "Admin TPS Benowo",
      kecamatan: "Benowo",
      contact: "0815-xxxx-xxxx",
    },
  });
  console.log("Admin TPS created:", tpsAdmin.email);

  // Listings
  await prisma.listing.createMany({
    data: [
      {
        sellerId: bank1.id,
        type: "MATERIAL",
        categoryId: categories[0].id, // PET
        title: "PET Botol Bersih",
        description: "500 kg botol PET bersih, sudah dicuci dan dipotong",
        quantity: 500,
        pricePerKg: 4000,
        moq: 50,
        fulfillmentOptions: "BOTH" as FulfillmentOption,
        lat: bank1.lat!,
        lng: bank1.lng!,
        grade: "Bersih",
      },
      {
        sellerId: bank1.id,
        type: "MATERIAL",
        categoryId: categories[2].id, // Kertas
        title: "Kardus Bekas",
        description: "Kardus bersih campuran, 300 kg",
        quantity: 300,
        pricePerKg: 1000,
        moq: 30,
        fulfillmentOptions: "PICKUP" as FulfillmentOption,
        lat: bank1.lat!,
        lng: bank1.lng!,
        grade: "Campur",
      },
      {
        sellerId: bank2.id,
        type: "MATERIAL",
        categoryId: categories[0].id, // PET
        title: "PET Plastik Campur",
        description: "350 kg PET berbagai warna",
        quantity: 350,
        pricePerKg: 3000,
        moq: 25,
        fulfillmentOptions: "BOTH" as FulfillmentOption,
        lat: bank2.lat!,
        lng: bank2.lng!,
        grade: "Campur",
      },
      {
        sellerId: bank2.id,
        type: "MATERIAL",
        categoryId: categories[3].id, // Logam
        title: "Besi Tua",
        description: "200 kg besi tua siap smelter",
        quantity: 200,
        pricePerKg: 2500,
        moq: 100,
        fulfillmentOptions: "DELIVERY" as FulfillmentOption,
        lat: bank2.lat!,
        lng: bank2.lng!,
        grade: "Besi",
      },
      {
        sellerId: bank3.id,
        type: "MATERIAL",
        categoryId: categories[1].id, // HDPE
        title: "HDPE Botol Susu",
        description: "400 kg botol HDPE bersih",
        quantity: 400,
        pricePerKg: 2500,
        moq: 40,
        fulfillmentOptions: "BOTH" as FulfillmentOption,
        lat: bank3.lat!,
        lng: bank3.lng!,
        grade: "Bersih",
      },
      {
        sellerId: bank3.id,
        type: "PRODUCT",
        categoryId: categories[6].id, // Produk Daur Ulang
        title: "Pot Tanaman dari Botol",
        description: "Pot tanaman unik dari botol plastik daur ulang, ~0.5 kg per pot",
        quantity: 50,
        pricePerKg: 25000,
        moq: 2,
        fulfillmentOptions: "BOTH" as FulfillmentOption,
        lat: bank3.lat!,
        lng: bank3.lng!,
      },
    ],
  });
  console.log("Listings created: 6");

  // Demand
  await prisma.demand.create({
    data: {
      buyerId: industry.id,
      categoryId: categories[0].id,
      quantityNeeded: 400,
      maxPrice: 15000,
      preferredDistance: 50,
      status: "OPEN",
    },
  });
  console.log("Demand created for PET 400kg");

  console.log("\nSeeding complete!");
  console.log("============================");
  console.log("Login credentials (all users password: password123)");
  console.log("  Admin:    admin@aurora.go.id");
  console.log("  Bank 1:   bank.bratang@aurora.go.id");
  console.log("  Bank 2:   bank.keputih@aurora.go.id");
  console.log("  Bank 3:   bank.wonorejo@aurora.go.id");
  console.log("  Industry: pt.daurulang@aurora.go.id");
  console.log("  Warga:    warga@aurora.go.id");
  console.log("  Admin TPS:admin.tps@aurora.go.id");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
