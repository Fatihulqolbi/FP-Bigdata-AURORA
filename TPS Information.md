---
date_created: 2026-06-20T16:55
date_modified: 2026-06-20T16:59
---

**SPESIFIKASI DATA FASILITAS PENGELOLAAN SAMPAH SURABAYA**

Berikut adalah rangkuman arsitektural dari dataset fasilitas pengolahan sampah, signifikansi operasionalnya terhadap mesin analitik (Spark MLlib), dan protokol standardisasi data sebelum masuk ke dalam ekosistem _Data Lakehouse_.

# 1. PEMETAAN DAN DEFINISI ATRIBUT DATA (DATA DICTIONARY)

- **Identitas & Lokasi:**
    - `nama` (String): Nama resmi fasilitas (contoh: "TPS Kendung Makam").
    - `id_tps` (Numeric/Null): Kode referensi fasilitas dari sumber sistem asli.
    - `alamat`, `kecamatan`, `kelurahan` (String): Parameter hierarki spasial administratif.
    - `lat`, `lng` (Float/Null): Koordinat geospasial aktual (WGS84) untuk perhitungan jarak navigasi.
- **Klasifikasi & Operasional:**
    - `jenis_fasilitas` (String): Kategori _endpoint_ pengolahan (TPS, TPS3R, Rumah Kompos, PLTSa).
    - `klasifikasi_struktur` (String): Deskripsi arsitektur fisik bangunan.
    - `klasifikasi_pengangkutan` (String): Spesifikasi mekanis pemuatan sampah (ENUM: `armroll`, `compactor`).
    - `status` (String): Kondisi operasional fasilitas (aktif/tidak aktif).
    - `thn_bangun` / `tahun` (Numeric/Null): Tahun konstruksi atau tahun data dicatat.
- **Metrik Volumetrik ($m^3$):**
    - `kapasitas`: Batas maksimal volume yang dapat ditampung oleh infrastruktur fisik fasilitas.
    - `vol_masuk`: Akumulasi volume sampah yang dibuang oleh warga ke lokasi tersebut per hari.
    - `vol_dikelola`: Volume sampah yang berhasil disortir/diolah secara mandiri di lokasi tersebut.
    - `vol_diangkut`: Volume residu yang harus dijemput oleh armada truk pemerintah per hari.
    - `waktu_diangkut` (Numeric/Null): Durasi (dalam hari) penyelesaian siklus pengangkutan.

# 2. SIGNIFIKANSI ARSITEKTURAL (PENGARUH TERHADAP KODE & AI)

Memahami struktur data ini memberikan landasan batasan (_hard-constraints_) absolut bagi algoritma pencarian rute dan distribusi:

- **Filter Kompatibilitas Armada (Logika Matriks):** Atribut `klasifikasi_pengangkutan` mencegah _routing error_ fatal. Kode Spark MLlib harus menerapkan fungsi `FILTER` dimana truk bertipe _Dump Truck_ atau _Pick Up_ secara matematis diberi nilai jarak infinitas ($\infty$) jika ditugaskan ke TPS berklasifikasi `armroll`.
- **Distribusi Vektor _Endpoint_ (Logika Destinasi):** Atribut `jenis_fasilitas` mendikte arah pembuangan akhir. Armada yang membawa rasio sampah organik/plastik tinggi akan dipaksa merutekan koordinat akhirnya ke titik dengan label `TPS3R` atau `Rumah Kompos`, mengubah alur dari sistem linier (semua ke TPA Benowo) menjadi model _Circular Economy_ terdistribusi.
- **Kalkulasi _Waste Risk Index_ (Logika Prediktif):** Kesenjangan antara `vol_masuk` dan `vol_diangkut` yang dikalibrasi terhadap `kapasitas` menjadi variabel independen utama untuk melatih model regresi prediktif. TPS dengan `vol_diangkut < vol_masuk` akan secara otomatis menaikkan indeks ancaman (WRI) pada _dashboard_.

# 3. PROTOKOL PEMBERSIHAN DATA (DATA CLEANSING)

Data mentah (_dirty data_) harus melewati _pipeline_ pembersihan Python/Pandas (di Layer _Bronze_ ke _Silver_) sebelum diakses oleh analitik.

- **Tindakan 1: Normalisasi Vektor String.** Eksekusi fungsi mutasi pada `jenis_fasilitas` dan `klasifikasi_struktur` untuk menghilangkan redundansi (Contoh: Konversi rekursif `str.upper().replace(" ", "")` mengubah "TPS 3R", "tps 3r", dan "TPS3R" menjadi satu format seragam absolut **"TPS3R"**).
- **Tindakan 2: Penyaringan Entitas Statis.** Lakukan _drop_ baris secara eksplisit untuk entitas dengan `status` $\neq$ "aktif". Mengirim armada ke fasilitas yang sudah tutup menyebabkan kegagalan sistem operasional riil.
- **Tindakan 3: Resolusi Tipe Data.** Konversi seluruh kolom volumetrik (`kapasitas`, `vol_masuk`, dkk) menjadi _Float_ agar operasi matematis agregasi dapat dieksekusi tanpa _typecasting error_.

# 4. STRATEGI PENANGANAN NILAI _NULL_ (MISSING VALUE HANDLING)

Kehadiran nilai _null_ dalam dataset geospasial dapat memicu pengecualian (_exceptions_) yang menggagalkan eksekusi _batch processing_. Terapkan strategi resolusi berikut:

- **Resolusi Null pada `lat` dan `lng` (Geocoding Deterministik):**
    - _Mekanisme:_ Jangan membuang data. Buat modul _script_ Python yang menggunakan pustaka `geopy` (API Nominatim/OSM).
    - _Logika:_ Jika `lat` IS NULL $\rightarrow$ Konkatenasi string: `alamat` + ", " + `kelurahan` + ", " + `kecamatan` + ", Surabaya" $\rightarrow$ Kirim _request_ geocoding $\rightarrow$ Ekstrak dan timpa nilai _null_ dengan koordinat WGS84 hasil _request_.
- **Resolusi Null pada `id_tps`:**
    - _Mekanisme:_ Sistem _relational database_ atau _Delta Table_ membutuhkan _Primary Key_.
    - _Logika:_ Jika `id_tps` IS NULL $\rightarrow$ _Generate_ ID sintetik menggunakan hash deterministik dari nama (contoh: `MD5(nama)`) atau buat sekuens alfanumerik mandiri (contoh: `TPS-EXT-001`).
- **Resolusi Null pada Metrik Volume (`vol_masuk`, `vol_diangkut`, `waktu_diangkut`):**
    - _Mekanisme:_ Imputasi statistik bersyarat untuk menghindari _NaN propagation_ pada kalkulasi Spark.
    - _Logika 1 (Skenario Konservatif):_ Jika `vol_masuk` IS NULL $\rightarrow$ Set nilai sama dengan `kapasitas` (asumsi beban puncak sebagai tindakan pencegahan keamanan sistem).
    - _Logika 2 (Skenario Agregat):_ Jika `waktu_diangkut` IS NULL $\rightarrow$ Lakukan _query_ pencarian nilai _mean/median_ dari waktu angkut pada TPS lain di _kecamatan_ yang sama, dan imputasikan nilai tersebut.

---

Berikut adalah **Rencana Eksekusi Matang (Data Pipeline Blueprint)** untuk menangani, membersihkan, dan memanfaatkan data ini pada tahap _coding_ selanjutnya.

## TAHAP 1: Data Cleansing & Standardization (Python / Pandas)

Sebelum data ini masuk ke _Database_ (Prisma) atau _Data Lake_ (Delta/Hadoop), Anda wajib membuat satu _script_ Python (misal: `backend/scripts/cleanse_tps_data.py`) untuk menstandarisasi seluruh isi _fields_.

**Aksi yang harus dikodekan dalam Script:**

1. **Standarisasi String (Lower/Upper Casing & Spasi):**
    
    - Target: `jenis_fasilitas` dan `klasifikasi_struktur`.
    - Logika: Ubah semua teks menjadi huruf kapital, hapus spasi berlebih, dan ganti spasi di tengah kata. (Contoh kode: `df['jenis_fasilitas'] = df['jenis_fasilitas'].str.upper().str.replace(' ', '')`).
    - Hasil: "TPS 3R", "tps 3r", "TPS3R" semuanya menjadi seragam **"TPS3R"**.
        
2. **Penanganan _Null_ (Imputasi Data):**
    
    - Target `id_tps`: Jika _null_, _generate_ ID unik baru (misal: `UUID` atau auto-increment `TPS-999`).
    - Target `vol_masuk` / `vol_dikelola`: Jika _null_, gunakan nilai rata-rata (_mean_) dari kelurahan yang sama, ATAU asumsikan nilainya sama dengan `kapasitas` (skenario terburuk/TPS penuh).
        
3. **Filter Data Aktif:**
    
    - Target `status`: Buang (_drop_) baris data yang statusnya "tidak aktif" atau "tutup". AI tidak boleh merutekan truk ke TPS yang sudah mati.

**Dampak:** Data Silver Layer Anda menjadi 100% bersih (ACID compliant). Tidak ada lagi _bug_ karena salah ketik saat AI membaca tipe TPS.

## TAHAP 2: Transformasi Volume ke Massa (Integrasi dengan Temuan Sebelumnya)

Anda menyebutkan bahwa `kapasitas`, `vol_masuk`, dll menggunakan satuan **Kubik ($m^3$)**. Ini sangat sinkron dengan temuan rasio **sampah plastik** Anda sebelumnya!

**Aksi yang harus dikodekan:**

- Di dalam _script_ transformasi Anda, buat kolom turunan (_derived columns_) yang menghitung estimasi berat dalam Kilogram (KG) menggunakan matriks kepadatan (_density matrix_) yang kita sepakati:
    - `estimasi_berat_kg = vol_masuk * 200` (Asumsi 200 kg/$m^3$ untuk sampah campuran/plastik longgar di TPS).
- Kirim _field_ baru ini (`estimasi_berat_kg` dan `vol_masuk_m3`) ke _streaming engine_ Anda.

**Dampak:** AI kini memiliki "dua mata". AI bisa mendeteksi bahwa sebuah TPS sudah penuh secara _ruang/volume_ (karena banyak plastik) meskipun _beratnya_ belum mencapai maksimal.

## TAHAP 3: Implementasi Hard-Constraints pada AI (Apache Spark MLlib)

Informasi spesifik dari tabel ini akan menjadi _aturan mutlak_ (Hard Constraints) dalam algoritma pencarian rute (_Routing Engine_) Anda.

**Aksi yang harus dikodekan (di `analytics-engine` atau `spark-streaming`):**

1. **Constraint Mekanis Truk (`klasifikasi_pengangkutan`):**
    
    - Logika: Lakukan _JOIN_ antara data Truk dan data TPS.
    - Jika TPS memiliki `klasifikasi_pengangkutan == "armroll"`, maka **hanya** 54 truk jenis Armroll yang boleh menerima rute ke titik tersebut. AI harus menolak (_reject_) jika mencoba mengirim truk Compactor ke sana.
        
2. **Constraint Tujuan Akhir (`jenis_fasilitas`):**
    
    - Logika: Gunakan _field_ ini untuk menyempurnakan **Feature 4 (Dynamic Waste Distribution)**.
    - Jika jenis fasilitas adalah "Rumah Kompos" atau "TPS3R", instruksikan AI untuk memprioritaskan rute truk dengan muatan sampah daun/plastik yang bisa didaur ulang ke koordinat TPS ini, alih-alih mengirim semuanya ke PLTSa Benowo.
        
3. **Constraint Kapasitas Penjemputan (`vol_diangkut` vs `vol_masuk`):**
    
    - Logika: Selisih antara `vol_masuk` dan `vol_diangkut` adalah metrik **Tingkat Bahaya (Waste Risk Index)** yang diminta dosen Anda.
    - Jika `vol_masuk` > `vol_diangkut`, berarti TPS tersebut mengalami penumpukan harian. AI harus mendeteksi ini dan mengirim 2 truk atau lebih ke TPS tersebut keesokan harinya.

## TAHAP 4: Pembaruan Skema Database (Backend Prisma)

Agar fitur ini bisa ditampilkan ke _dashboard digital twin_ aplikasi Anda, Anda harus mengubah rancangan _database_ awal Anda.

**Aksi yang harus dikodekan (di `schema.prisma`):**

Buat model yang persis mencerminkan arsitektur data ini, dan gunakan `enum` untuk mencegah masuknya _dirty data_ di masa depan.

Code snippet

```
enum TipeFasilitas {
  TPS
  TPS3R
  RUMAH_KOMPOS
  PLTSA
  SUPERDEPO
}

enum TipePengangkutan {
  ARMROLL
  COMPACTOR
  DUMP_TRUCK
}

model TpsRegistry {
  id                    Int      @id @default(autoincrement())
  nama                  String
  alamat                String
  kecamatan             String
  lat                   Float
  lng                   Float
  jenisFasilitas        TipeFasilitas
  tipePengangkutan      TipePengangkutan
  kapasitasM3           Float
  rataVolumeMasukM3     Float
  rataVolumeDiangkutM3  Float
  statusAktif           Boolean  @default(true)
}
```

## Kesimpulan Dampak Arsitektur:

Dengan mengeksekusi rencana di atas, Anda membuktikan kepada dosen bahwa Anda **tidak sekadar memakai tools Big Data (Kafka/Spark) secara asal**, melainkan Anda menggunakan arsitektur _Lakehouse_ untuk memecahkan masalah dunia nyata:

1. **Mengubah data pemerintah yang kotor (dirty) menjadi data emas (Gold Layer) yang siap dianalisis.**
2. **Mengawinkan constraint fisik (Truk Armroll vs Compactor) dengan algoritma digital (Spark MLlib).**
3. **Mengkalibrasi satuan Volume ($m^3$) sampah plastik dengan Kapasitas Massa (Ton) mesin truk.**

