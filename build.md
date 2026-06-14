# BUILD.md — Roadmap Pengembangan AURORA

> **Proyek:** AURORA — Surabaya Smart Waste Management & Big Data Pipeline
> **Repositori:** `FP-Bigdata-AURORA`
> **Project Lead:** Muhammad Ardiansyah Tri Wibowo
> **Dokumen ini:** Rencana eksekusi bertahap (build plan) untuk Fitur 5, Fitur 6 + pendukung, dan Fitur 4.

---

## 0. Aturan Dasar Pengembangan (WAJIB DIBACA)

Aturan ini berlaku untuk **semua** tahap di bawah dan tidak boleh dilanggar.

### 0.1. Larangan Mengubah File Lama

> **PRINSIP UTAMA: *Additive, not destructive.***
> File yang **sudah ada** pada struktur repositori saat ini **TIDAK BOLEH diubah, dipindah, atau dihapus.** Fitur baru dibangun dengan **menambahkan file/folder baru**, bukan menulis ulang yang lama.

File baseline yang **dikunci (read-only)**:

```text
backend/docker-compose.yml
backend/hadoop.env
backend/kafka-producer/producer.py
backend/scratch/generate_real_tps.py
backend/scratch/generate_tps.py
backend/spark-streaming/app.py
dashboard/package.json            (lihat pengecualian 0.2)
dashboard/tsconfig.json
dashboard/vite.config.ts
dashboard/index.html
dashboard/src/main.tsx
dashboard/src/App.tsx              (lihat pengecualian 0.2)
dashboard/src/App.css
dashboard/src/index.css
dashboard/src/data/tpsData.ts
dashboard/public/dataset_tps_surabaya.csv
```

### 0.2. Pengecualian yang Diizinkan

File lama **boleh disentuh HANYA** untuk dua alasan, dan **wajib** ditandai jelas di commit message + komentar kode:

| Alasan | Yang Boleh | Yang TIDAK Boleh |
|--------|-----------|------------------|
| **Integrasi (`integration`)** | Menambah baris *import*, *route registration*, *menu item*, atau *config entry* yang menyambungkan modul baru. | Mengubah logika fungsi lama, mengganti nama, refactor besar. |
| **Perbaikan (`fix`)** | Memperbaiki *bug* yang menghalangi integrasi (mis. *typo*, *export* yang hilang). | "Sekalian merapikan" kode lama yang tidak terkait. |

**Format penanda wajib:**

```ts
// AURORA-INTEGRATION (Tahap 1 / Marketplace): registrasi route baru, logika lama tidak diubah.
// AURORA-FIX (Tahap 2): export yang sebelumnya hilang, dibutuhkan distribution engine.
```

Commit message: `integration(marketplace): wire listing routes into api index` atau `fix(dashboard): export TpsRecord type for reuse`.

### 0.3. Strategi Isolasi

- Semua fitur baru hidup di folder **modul terisolasi** (`modules/`, `features/`) → mudah di-*rollback*.
- Pipeline streaming lama (`producer.py`, `app.py`) **tidak diutak-atik**; modul baru **membaca hasilnya** (Parquet di HDFS / topik Kafka) sebagai konsumen, bukan mengubah produsernya.
- Satu tahap = satu *branch* (`feat/tahap-1-marketplace`, dst). Merge ke `main` hanya setelah lolos Testing (sub-tahap 3).

### 0.4. Definition of Done (per tahap)

Sebuah tahap dianggap **selesai** jika dan hanya jika ketiga sub-tahap lulus:
1. **Development** selesai & fitur berfungsi di lingkungan lokal.
2. **Cek Vulnerability** lulus (tidak ada temuan *High/Critical* yang belum di-*mitigate*).
3. **Testing** lulus (kriteria penerimaan di tiap tahap terpenuhi).

---

## 1. Peta Fitur & Urutan Eksekusi

| Urutan | Tahap | Fitur | Status Fokus |
|--------|-------|-------|--------------|
| Baseline | — | Fitur 1 (AI Waste Flow Prediction), Fitur 2 (Smart Route Optimization) | Sudah ada / hanya titik integrasi |
| **1** | **Tahap 1** | **Fitur 5 — Waste Exchange Marketplace** | Fokus utama |
| **2** | **Tahap 2** | **Fitur 6 — Dynamic Waste Distribution Engine** + Pendukung (Citizen Reporting, Eco Reward, Digital Twin) | Fokus utama |
| **3** | **Tahap 3** | **Fitur 4 — AI Waste Classification (Computer Vision)** | Dikerjakan paling akhir |

Setiap tahap dipecah menjadi: **(1) Development → (2) Cek Vulnerability → (3) Testing.**

---

## TAHAP 1 — Fitur 5: Waste Exchange Marketplace

**Tujuan:** Marketplace yang otomatis men-*matching* stok material di Bank Sampah dengan kebutuhan Industri (B2B) dan masyarakat (B2C/C2C), sehingga *circular economy* berjalan.

**Aktor terlibat:** Bank Sampah (penjual), Industri/Pabrik (pembeli B2B), Warga (pembeli B2C/C2C), Admin DLH (moderasi).

### 1.1. Development

**Backend — API baru (Express + Prisma, tidak menyentuh pipeline streaming):**

```text
backend/
└── api/                                  # BARU — layer Web & API (MERN + Prisma)
    ├── package.json
    ├── .env.example
    ├── prisma/
    │   └── schema.prisma                 # Model: User, BankSampah, Industri,
    │                                      #        Listing, Order, MatchResult
    ├── src/
    │   ├── index.ts                       # Bootstrap Express
    │   ├── config/
    │   │   └── db.ts                       # Koneksi MongoDB via Prisma
    │   ├── middleware/
    │   │   ├── auth.ts                     # JWT + RBAC multi-tenant
    │   │   └── rateLimit.ts
    │   ├── modules/
    │   │   ├── auth/                       # Login/registrasi per peran
    │   │   │   ├── auth.controller.ts
    │   │   │   ├── auth.service.ts
    │   │   │   └── auth.routes.ts
    │   │   └── marketplace/
    │   │       ├── listing.controller.ts  # CRUD stok material
    │   │       ├── listing.service.ts
    │   │       ├── listing.routes.ts
    │   │       ├── matching.engine.ts     # Matching otomatis stok vs kebutuhan
    │   │       ├── order.controller.ts
    │   │       ├── order.service.ts
    │   │       └── order.routes.ts
    │   └── utils/
    │       └── logger.ts
    └── tests/
        └── marketplace.spec.ts
```

**Frontend — modul fitur baru (struktur `features/`, tidak menulis ulang `App.tsx`):**

```text
dashboard/src/
└── features/                             # BARU — modular per fitur
    └── marketplace/
        ├── pages/
        │   ├── MarketplaceBrowse.tsx      # Etalase material
        │   ├── InventoryManage.tsx        # Dashboard Bank Sampah
        │   └── BuyerDashboard.tsx         # Dashboard Industri
        ├── components/
        │   ├── ListingCard.tsx
        │   └── MatchSuggestion.tsx
        ├── api/
        │   └── marketplaceApi.ts          # Pemanggil REST API
        └── types.ts
```

**Titik integrasi (lihat aturan 0.2 — diubah seminimal mungkin, ditandai):**
- `dashboard/src/App.tsx` → tambah **route/menu** ke halaman marketplace (tanpa mengubah logika dashboard lama).
- `dashboard/package.json` → tambah dependensi *routing*/data fetching bila belum ada.

**Logika inti `matching.engine.ts`:** mencocokkan `Listing` (mis. Bank Sampah A: 500 kg PET) dengan kebutuhan `Industri` (butuh 400 kg PET) berdasarkan: jenis material, jumlah, lokasi/jarak, dan harga. Output: daftar *match* terurut.

**Deliverable:** API marketplace berjalan lokal, dashboard menampilkan listing + saran *match*.

### 1.2. Cek Vulnerability

- **Dependency audit:** `npm audit` pada `backend/api` & `dashboard`; perbaiki temuan High/Critical.
- **Auth & otorisasi:** verifikasi RBAC — Bank Sampah tidak bisa mengakses data Industri lain; uji *broken access control* (IDOR pada `listing/:id`, `order/:id`).
- **Input validation:** validasi semua *body*/query (jumlah, harga, jenis material) untuk cegah *injection* (NoSQL injection ke MongoDB) & *type confusion*.
- **Secrets:** pastikan `.env` tidak ter-*commit*; gunakan `.env.example`.
- **Rate limiting** aktif pada *endpoint* auth & order.
- **Tool minimal:** `npm audit`, ESLint security plugin, pengujian *auth bypass* manual.

**Gate:** Tidak ada temuan High/Critical tersisa.

### 1.3. Testing

- **Unit:** `matching.engine.ts` (skenario stok > kebutuhan, stok < kebutuhan, tidak ada match).
- **Integration:** alur API listing → match → order (gunakan DB test, **bukan** data produksi).
- **E2E (happy path):** Bank Sampah membuat listing → Industri melihat saran match → membuat order.
- **Kriteria penerimaan:**
  - Matching otomatis menghasilkan saran yang benar untuk minimal 3 skenario uji.
  - RBAC: peran tanpa izin selalu ditolak (403).
  - Pipeline streaming lama tetap berjalan tanpa perubahan (uji regресi ringan: `docker-compose up` tetap normal).

**Gate menuju Tahap 2:** ketiga jenis test lulus + Definition of Done (0.4) terpenuhi.

---

## TAHAP 2 — Fitur 6 (Dynamic Waste Distribution Engine) + Fitur Pendukung

**Tujuan:** AI menentukan distribusi terbaik tiap jenis sampah dari Sorting Hub (Organik→Kompos/Biogas, PET→Daur Ulang, Logam→Smelter, Kertas→Paper Recycling, Residu→PLTSa Benowo) berdasarkan **kapasitas fasilitas, jarak, nilai ekonomi, dan emisi karbon** — plus tiga fitur pendukung.

### 2.1. Development

**Backend — Distribution Engine (Python, konsumen data Spark/HDFS, tidak mengubah `app.py`):**

```text
backend/
├── distribution-engine/                  # BARU — optimizer distribusi
│   ├── engine.py                         # Scoring: kapasitas, jarak, nilai ekonomi, emisi
│   ├── facilities.py                     # Registry fasilitas + kapasitas (kuota Benowo dll)
│   ├── reader.py                         # Baca agregasi Parquet dari HDFS (read-only)
│   ├── service.py                        # FastAPI: ekspos hasil ke api/
│   └── requirements.txt
└── api/src/modules/                       # BARU — modul tambahan dalam api/ yang sudah ada
    ├── distribution/                      # Proxy/route ke distribution-engine
    │   ├── distribution.controller.ts
    │   └── distribution.routes.ts
    ├── citizen-report/                    # Fitur pendukung: Citizen Reporting
    │   ├── report.controller.ts
    │   ├── report.service.ts
    │   └── report.routes.ts
    └── eco-reward/                        # Fitur pendukung: Eco Reward System
        ├── reward.controller.ts
        ├── reward.service.ts              # Aturan poin: setor, lapor valid, pilah
        └── reward.routes.ts
```

**Frontend — modul fitur pendukung + Digital Twin:**

```text
dashboard/src/features/
├── distribution/
│   └── pages/DistributionBoard.tsx        # Visualisasi keputusan distribusi
├── citizen-report/
│   ├── pages/ReportForm.tsx               # Warga unggah foto TPS penuh / sampah liar
│   └── api/reportApi.ts
├── eco-reward/
│   └── pages/RewardWallet.tsx             # Saldo & penukaran poin (diskon UMKM, voucher)
└── digital-twin/
    ├── pages/DigitalTwin3D.tsx            # Dashboard 3D Kota Surabaya (three.js / R3F)
    └── components/CityScene.tsx           # Volume real-time, TPS penuh, posisi armada, prediksi 7 hari
```

**Catatan distribusi:** `engine.py` membaca agregasi yang **sudah dihasilkan** pipeline lama (Parquet/HDFS), lalu menghitung skor distribusi. Tidak ada perubahan pada producer/spark streaming.

**Catatan Citizen Reporting:** pada tahap ini verifikasi foto memakai *placeholder* (status `pending`). Verifikasi Computer Vision **nyata** disambungkan di **Tahap 3** (Fitur 4).

**Titik integrasi:** registrasi 3 modul route baru di `backend/api/src/index.ts` (tambah baris, tandai `AURORA-INTEGRATION`); tambah menu di `App.tsx`.

### 2.2. Cek Vulnerability

- **Dependency audit** untuk paket Python baru (`pip-audit`) dan paket frontend 3D.
- **File upload (Citizen Reporting):** validasi *MIME type*, batas ukuran, sanitasi nama file, simpan di luar *webroot* → cegah *upload* berbahaya.
- **Eco Reward — integritas poin:** cegah manipulasi (lapor ganda, *replay*, *race condition* saat penukaran). Transaksi poin harus *atomic*.
- **Distribution Engine:** validasi data masuk dari HDFS; pastikan service hanya **membaca** (tidak ada *write* ke pipeline lama).
- **API exposure:** distribution-engine (FastAPI) tidak terekspos publik — hanya dapat diakses dari `api/` (jaringan internal).

**Gate:** temuan High/Critical (terutama integritas poin & upload) tertangani.

### 2.3. Testing

- **Unit:** fungsi *scoring* `engine.py` (uji bobot kapasitas vs jarak vs emisi vs nilai ekonomi); aturan poin `reward.service.ts`.
- **Integration:** API distribution → engine → respons; alur Citizen Report (upload → status pending); penukaran reward.
- **E2E:** warga melapor → poin masuk; Digital Twin menampilkan data real-time dari sumber yang ada.
- **Kriteria penerimaan:**
  - Engine menghasilkan tujuan yang benar untuk tiap jenis sampah pada data uji.
  - Poin tidak bisa digandakan / dimanipulasi pada uji penyalahgunaan.
  - Digital Twin merender tanpa error & menampilkan minimal volume + posisi armada + prediksi 7 hari.
  - Regресi: Tahap 1 (marketplace) tetap berfungsi.

**Gate menuju Tahap 3:** ketiga jenis test lulus + Definition of Done (0.4).

---

## TAHAP 3 — Fitur 4: AI Waste Classification (Computer Vision)

**Tujuan:** Model Computer Vision mengklasifikasikan sampah (Plastik PET, HDPE, Kardus, Logam, Organik, E-Waste) dari kamera TPS / Bank Sampah / Conveyor / ESP32-CAM, lalu menentukan tujuan terbaik tiap jenis. Dikerjakan **paling akhir** karena menyatukan hasil Tahap 1 & 2 (memberi label otomatis ke marketplace, distribution engine, dan verifikasi citizen report).

### 3.1. Development

```text
ai/                                        # BARU — folder ML/CV tingkat atas
└── waste-classifier/
    ├── train.py                           # Training/fine-tuning model CV
    ├── inference_service.py               # FastAPI: terima gambar → label + confidence
    ├── preprocess.py
    ├── models/                            # Bobot model (di-.gitignore bila besar)
    ├── datasets/                          # Pointer/manifest dataset (bukan data mentah)
    └── requirements.txt                   # TensorFlow/PyTorch/OpenCV

backend/api/src/modules/
└── classification/                        # BARU — jembatan ke inference_service
    ├── classify.controller.ts             # Terima Multipart (ESP32-CAM HTTP REST)
    ├── classify.service.ts                # Teruskan ke inference_service, simpan hasil
    └── classify.routes.ts
```

**Frontend:**

```text
dashboard/src/features/classification/
└── pages/ClassificationMonitor.tsx        # Tampilkan hasil klasifikasi real-time
```

**Integrasi lintas-tahap (menyambung, bukan mengubah logika lama):**
- **Tahap 2 — Citizen Reporting:** ganti verifikasi *placeholder* → panggilan nyata ke `classification` (tandai `AURORA-INTEGRATION`).
- **Tahap 1 — Marketplace:** label CV mengisi otomatis jenis material pada `Listing`.
- **Tahap 2 — Distribution Engine:** label CV menjadi input penentuan tujuan akhir.

**Transmisi data (sesuai arsitektur):** gambar dari ESP32-CAM dikirim via **HTTP REST (multipart/form-data)** ke `classify.controller.ts`; data metrik numerik tetap lewat jalur MQTT→Kafka yang sudah ada (tidak diubah).

### 3.2. Cek Vulnerability

- **Endpoint upload gambar:** batas ukuran & *MIME*, *timeout*, anti-*DoS* (kamera mengirim beruntun).
- **Model/dependency:** `pip-audit` untuk TF/PyTorch/OpenCV; pastikan sumber bobot model tepercaya (*supply chain*).
- **Pemisahan layanan:** `inference_service` hanya diakses internal oleh `api/`, tidak publik.
- **Privasi:** gambar dapat memuat plat/wajah — terapkan retensi minimal & akses terbatas.

**Gate:** temuan High/Critical tertangani; endpoint upload tahan beban kamera.

### 3.3. Testing

- **Unit:** `preprocess.py`, pemetaan label → kategori.
- **Model eval:** akurasi/recall per kelas pada *test set* (target ambang disepakati tim).
- **Integration:** ESP32-CAM (atau simulator multipart) → `classify` → label tersimpan; verifikasi Citizen Report kini otomatis.
- **E2E penuh:** foto masuk → diklasifikasi → mengisi marketplace & distribution engine.
- **Kriteria penerimaan:**
  - Akurasi model memenuhi ambang yang disepakati.
  - Integrasi ke Tahap 1 & 2 berjalan tanpa mengubah logika inti keduanya.
  - Regресi penuh: semua fitur Tahap 1 & 2 tetap berfungsi.

**Gate:** ketiga jenis test lulus + Definition of Done (0.4) → proyek inti siap demo Smart City.

---

## 2. Ringkasan Struktur File Akhir (Setelah Semua Tahap)

`[LAMA]` = file existing yang **tidak diubah** · `[BARU]` = ditambahkan · `[INT]` = disentuh minimal untuk integrasi.

```text
FP-Bigdata-AURORA/
├── README.md                              [LAMA]
├── build.md                               [BARU] ← dokumen ini
├── backend/
│   ├── docker-compose.yml                 [LAMA]
│   ├── hadoop.env                         [LAMA]
│   ├── kafka-producer/producer.py         [LAMA]
│   ├── scratch/                           [LAMA]
│   ├── spark-streaming/app.py             [LAMA]
│   ├── api/                               [BARU] ← Tahap 1 (Express+Prisma) + modul Tahap 2 & 3
│   │   ├── prisma/schema.prisma           [BARU]
│   │   └── src/modules/
│   │       ├── auth/                      [BARU] Tahap 1
│   │       ├── marketplace/               [BARU] Tahap 1
│   │       ├── distribution/              [BARU] Tahap 2
│   │       ├── citizen-report/            [BARU] Tahap 2
│   │       ├── eco-reward/                [BARU] Tahap 2
│   │       └── classification/            [BARU] Tahap 3
│   └── distribution-engine/               [BARU] Tahap 2 (Python, read-only ke HDFS)
├── ai/
│   └── waste-classifier/                  [BARU] Tahap 3 (CV)
└── dashboard/
    ├── package.json                       [INT]  tambah dependensi
    ├── index.html / vite.config.ts / ...  [LAMA]
    └── src/
        ├── App.tsx                        [INT]  tambah route/menu saja
        ├── main.tsx / *.css               [LAMA]
        ├── data/tpsData.ts                [LAMA]
        └── features/                      [BARU]
            ├── marketplace/               [BARU] Tahap 1
            ├── distribution/              [BARU] Tahap 2
            ├── citizen-report/            [BARU] Tahap 2
            ├── eco-reward/                [BARU] Tahap 2
            ├── digital-twin/              [BARU] Tahap 2
            └── classification/            [BARU] Tahap 3
```

---

## 3. Checklist Eksekusi Cepat

- [ ] **Tahap 1** — Marketplace: Development → Vulnerability → Testing
- [ ] **Tahap 2** — Distribution Engine + Citizen Reporting + Eco Reward + Digital Twin: Development → Vulnerability → Testing
- [ ] **Tahap 3** — AI Waste Classification (CV): Development → Vulnerability → Testing
- [ ] Setiap tahap: branch terpisah, file lama tidak diubah (kecuali `[INT]`/`fix` bertanda), merge hanya setelah Testing lulus.
