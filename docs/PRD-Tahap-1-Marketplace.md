# PRD Tahap 1 — Waste Exchange Marketplace

## 1. Overview
Tahap 1 membangun **Waste Exchange Marketplace** pada AURORA. Platform ini
menghubungkan **Bank Sampah** sebagai penjual dengan dua kelompok pembeli:
- **Industri / Pabrik (B2B)** untuk pembelian material daur ulang dalam jumlah besar.
- **Warga / UMKM (B2C/C2C)** untuk pembelian produk kerajinan hasil daur ulang.

Sistem secara otomatis mencocokkan kebutuhan pembeli dengan stok penjual,
mendukung **multi-seller** dan **partial fulfillment**, serta menerapkan
verifikasi akun oleh Admin DLH.

## 2. Goals & Success Criteria
- Bank Sampah dapat membuat listing material maupun produk kerajinan.
- Industri/Warga dapat mencari, membuat demand, dan membeli.
- Matching engine menghasilkan saran match yang akurat.
- Tombol **"Order Instan"** muncul untuk match dengan skor >= 0.90.
- Multi-seller & partial fulfillment berjalan dalam satu order.
- Akun Bank Sampah & Industri wajib diverifikasi Admin DLH.
- Sistem lolos vulnerability check dan semua test.

## 3. Aktor & Roles

| Aktor | Peran |
|---|---|
| **Admin DLH** | Verifikasi akun, moderasi listing/order, mengatur range harga min/max. |
| **Bank Sampah** | Penjual: listing material/produk, kelola inventori, terima/tolak order. |
| **Industri** | Pembeli B2B: buat demand, beli material dalam jumlah besar. |
| **Warga / UMKM** | Pembeli B2C/C2C: beli produk kerajinan hasil daur ulang. |

## 4. Katalog Material & Produk

### 4.1 Kategori Material
- Plastik PET
- Plastik HDPE
- Kardus / Kertas
- Logam
- Organik
- E-Waste

### 4.2 Produk Konsumen
- Produk kerajinan / hasil daur ulang yang dijual oleh **Bank Sampah**.
- Contoh: tas dari banner, pot dari botol plastik, dsb.

### 4.3 Satuan
- **Wajib menggunakan kg** sebagai satuan dasar untuk semua listing.
- Untuk produk konsumen, boleh menampilkan informasi tambahan (mis. 1 pot ~ 0.5 kg),
  tetapi stok dan transaksi tetap dalam kg.

## 5. Kebijakan Harga

- Pemerintah (Admin DLH) menetapkan **harga minimum dan maksimum** per kategori
  material/grade.
- Range harga mengikuti harga pasar dan dapat diperbarui secara berkala.
- Setiap Bank Sampah bebas menentukan harga sendiri **di dalam range** tersebut.
- Harga dapat berbeda antar Bank Sampah.

## 6. Alur Bisnis

### 6.1 Bank Sampah Membuat Listing
1. Register/login (role `BANK_SAMPAH`).
2. Menunggu verifikasi Admin DLH.
3. Setelah terverifikasi, buat listing:
   - Pilih kategori material/produk.
   - Kuantitas (kg).
   - Grade/kualitas (jika ada).
   - Harga per kg (dalam range yang ditetapkan).
   - Minimum Order Quantity (MOQ).
   - Opsi logistik yang disediakan: pickup, delivery, atau keduanya.
   - Lokasi (koordinat lat/long).
4. Listing aktif dan muncul di etalase.

### 6.2 Pembeli Mencari / Membuat Demand
1. Register/login (role `INDUSTRI` atau `WARGA`).
2. Industri boleh membuat **demand** (kebutuhan material).
3. Warga/UMKM umumnya langsung browse produk konsumen.
4. Sistem menampilkan saran match.

### 6.3 Matching Engine
**Input**: demand + pool listing aktif.
**Filter awal**:
- Kategori material sama.
- Harga per kg <= max price pembeli dan dalam range pemerintah.
- Jarak <= radius maksimum (default 50 km, bisa dikonfigurasi).

**Bobot Skor**:
| Kriteria | Bobot |
|---|---|
| Material cocok | 40% |
| Kuantitas tersedia | 20% |
| Jarak | 20% |
| Harga kompetitif | 15% |
| Reputasi/rating seller | 5% |

**Perhitungan jarak**:
- Default: Haversine dari koordinat lat/long.
- Opsional: OSRM / Google Distance Matrix untuk jarak jalan.
- Komponen peta UI: `mapcn.dev` (MapLibre) jika diintegrasikan.

**Output**:
- Daftar saran match diurutkan dari skor tertinggi.
- Tombol **"Buat Order Instan"** muncul jika skor **>= 0.90**.
- Jika skor < 0.90, pembeli tetap bisa order manual.

### 6.4 Multi-Seller & Partial Fulfillment
- Satu order dapat berisi **beberapa item dari seller berbeda**.
- Jika total stok tersedia < demand, order tetap dapat dibuat dengan status
  **"Partially Fulfilled"**.
- Sisa kebutuhan dapat di-order kembali setelahnya.

### 6.5 Order Lifecycle
`draft -> pending_approval -> approved -> awaiting_payment -> paid ->
ready_for_pickup / ready_for_delivery -> in_transit -> delivered -> completed`

atau `cancelled`.

### 6.6 Logistik
- Opsi logistik ditentukan **oleh penjual per listing**.
- Pembeli memilih opsi yang tersedia saat checkout:
  - **Pickup**: pembeli mengambil ke lokasi seller.
  - **Delivery**: seller mengantar ke lokasi pembeli.

### 6.7 Pembayaran
- Tahap 1 menggunakan **simulasi pembayaran realistis**.
- Status order mencakup `awaiting_payment`.
- Pembeli mengunggah bukti transfer (simulasi).
- Penjual/Admin konfirmasi pembayaran.
- Struktur data & flow disiapkan agar mudah diganti ke gateway asli nanti.

## 7. Data Model (Prisma — high level)

- `User` — id, email, passwordHash, role, status, verifiedBy, createdAt.
- `ProfileBankSampah` — userId, name, address, lat, lng, contact, verificationDoc.
- `ProfileIndustry` — userId, name, address, lat, lng, contact, verificationDoc.
- `ProfileConsumer` — userId, name, address, lat, lng, contact.
- `MaterialCategory` — id, name, gradeOptions, unit (kg), minPrice, maxPrice.
- `Listing` — id, sellerId, type (MATERIAL|PRODUCT), categoryId, title, description,
  quantity, pricePerKg, moq, fulfillmentOptions, lat, lng, status, expiresAt.
- `Demand` — id, buyerId, type, categoryId, quantityNeeded, maxPrice, preferredDistance,
  lat, lng, status.
- `MatchSuggestion` — id, demandId, candidateListings[], totalQuantity, totalCost,
  distanceKm, score, status.
- `Order` — id, buyerId, orderType, status, totalAmount, logisticsOption,
  paymentStatus, createdAt.
- `OrderItem` — id, orderId, listingId, sellerId, quantity, pricePerKg, subtotal,
  status.
- `TransactionLog` / `AuditLog`.

## 8. API Endpoints (high level)

### Auth
- `POST /auth/register`
- `POST /auth/login`
- `GET /auth/me`

### Admin
- `GET /admin/verifications`
- `PATCH /admin/verifications/:userId`

### Material
- `GET /materials`
- `GET /materials/:id`

### Listing
- `POST /listings`
- `GET /listings`
- `GET /listings/:id`
- `PATCH /listings/:id`
- `DELETE /listings/:id`

### Demand
- `POST /demands`
- `GET /demands`
- `GET /demands/:id`
- `PATCH /demands/:id`
- `DELETE /demands/:id`

### Matching
- `GET /matches?demandId=...`

### Order
- `POST /orders` (manual atau instant)
- `GET /orders`
- `GET /orders/:id`
- `PATCH /orders/:id/status`
- `POST /orders/:id/payment-proof`

## 9. Frontend Pages & Components

### Pages
- `MarketplaceBrowse` — etalase material & produk.
- `ListingDetail` — detail listing.
- `InventoryManage` — dashboard Bank Sampah.
- `DemandForm` — form kebutuhan Industri.
- `MatchSuggestion` — daftar saran match.
- `BuyerDashboard` — dashboard pembeli (Industri/Warga).
- `OrderDetail` — detail transaksi.
- `AdminVerification` — verifikasi akun & moderasi.

### Components
- `ListingCard`
- `MatchSuggestionCard`
- `OrderItemList`
- `PriceRangeBadge`
- `VerificationStatusBadge`

### Integrasi ke Baseline
- `dashboard/src/App.tsx` — tambah route & menu marketplace.
- `dashboard/package.json` — tambah dependency:
  - `react-router-dom`
  - `@tanstack/react-query`
  - shadcn/ui components
- `backend/api/src/index.ts` — register `/marketplace` routes.
- File pipeline lama (`producer.py`, `app.py`, `docker-compose.yml`, dsb.)
  **tidak disentuh**.

## 10. Security & Vulnerability Checklist

- [ ] `npm audit` clean untuk `backend/api` & `dashboard`.
- [ ] JWT + RBAC teruji.
- [ ] IDOR test pada `listings/:id`, `orders/:id`, `demands/:id`.
- [ ] Input validation (jumlah, harga, koordinat) menggunakan Zod/Joi.
- [ ] Sanitasi query ke MongoDB (jika pakai MongoDB) untuk cegah NoSQL injection.
- [ ] Rate limiting pada auth & order endpoints.
- [ ] `.env.example` tersedia; `.env` di `.gitignore`.
- [ ] Enkripsi password dengan bcrypt/argon2.

## 11. Testing & Acceptance Criteria

- [ ] **Unit**: matching engine — stok > demand, stok < demand, no match,
  multi-seller, partial fulfillment.
- [ ] **Integration**: alur listing -> match -> order.
- [ ] **E2E B2B**: Bank Sampah listing -> Industri demand -> instant match -> order.
- [ ] **E2E B2C**: Bank Sampah listing produk -> Warga beli -> order.
- [ ] **RBAC**: role tanpa izin selalu ditolak (403).
- [ ] **Regression**: `docker-compose up` pipeline Kafka/Spark/HDFS tetap normal.

## 12. Risks & Open Items

- Map API: jarak matching pakai Haversine default; OSRM/Google opsional.
  Peta UI bisa pakai `mapcn.dev` (MapLibre).
- Integrasi pembayaran: simulasi di Tahap 1, siap diganti gateway asli.
- Kebijakan range harga DLH perlu data awal untuk seeding.
