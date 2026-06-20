#  AURORA - Sistem Cerdas Manajemen Sampah Kota Surabaya
### *Adaptive Urban Resource Optimization & Real-time Analytics*

> **Final Project Big Data 2026**  Mata Kuliah Big Data & Data Lakehouse

![AURORA Banner](./LOGO%20AURORA%20PNG.png)

---

## Anggota Kelompok 4

| Nama | NRP |
|------|-----|
| Tiara Putri Prasetya | 5027241013 |
| Muhammad Fatihul Qolbi Ash Shiddiqi | 5027241023 |
| Erlangga Valdhio Putra Sulistio | 5027241030 |
| Jonathan Zelig Sutopo | 5027241047 |
| Muhammad Ardiansyah Tri Wibowo | 5027241091 |

---

## Latar Belakang

Wali Kota Surabaya, Eri Cahyadi, secara terbuka menyoroti permasalahan kritis pada jaringan Tempat Pembuangan Sementara (TPS) di Surabaya, dimana banyak TPS ditemukan penuh, kotor, dan tidak terkelola dengan baik. Kondisi ini merupakan cerminan dari kegagalan sistemik dalam manajemen arus sampah perkotaan yang masih bersifat reaktif dan tidak berbasis data.

Berdasarkan data operasional, Kota Surabaya menghasilkan lebih dari **2.000 ton sampah per hari** yang harus diangkut menuju Tempat Pembuangan Akhir (TPA) Benowo dan berbagai fasilitas pengolahan. Namun, sistem pengangkutan yang ada masih menggunakan rute statis terjadwal yang tidak responsif terhadap kondisi real-time, sehingga menyebabkan:

- **TPS Overload**  TPS penuh sebelum jadwal pengangkutan tiba
- **Inefisiensi Armada**  Truk melewati TPS yang masih kosong, melewatkan yang sudah penuh
- **Bottleneck Fasilitas**  Semua sampah diarahkan ke PLTSa Benowo, mengabaikan fasilitas daur ulang

**AURORA** hadir sebagai solusi berbasis *Big Data Lakehouse Architecture* yang mengubah paradigma pengelolaan sampah dari **reaktif  prediktif**, dan dari **linear  circular economy**.

> **Sumber:** [Wali Kota Surabaya Temukan Pelanggaran Fungsi TPS](https://www.superradio.id/ketika-wali-kota-surabaya-temukan-pelanggaran-fungsi-tps)

---

## Karakteristik Data  5V Big Data

Proyek AURORA menangani data yang memiliki karakteristik **5V Big Data** secara penuh:

| Dimensi | Karakteristik pada AURORA |
|---------|--------------------------|
| **Volume**  | Ratusan TPS aktif di Surabaya menghasilkan ribuan event sensor per menit. Secara historis, data timbulan sampah 365 hari di-bootstrap untuk melatih model prediksi. |
| **Velocity**  | Data telemetri TPS dan GPS armada mengalir secara *real-time* via Apache Kafka. Spark Structured Streaming memproses micro-batch setiap beberapa detik untuk menghasilkan insight yang up-to-date. |
| **Variety**  | Data bersifat heterogen: data terstruktur (sensor IoT kapasitas TPS), data semi-terstruktur (JSON GPS armada), dan data referensi statis (registry fasilitas, kalender event Surabaya). |
| **Veracity**  | Data mentah bersifat *dirty* (nilai null pada koordinat, inkonsistensi format jenis fasilitas). Pipeline Bronze  Silver menerapkan protokol data cleansing ketat sebelum diproses analitik. |
| **Value**  | Output analitik menghasilkan nilai nyata: penghematan biaya BBM armada, pencegahan TPS overload, dan optimasi distribusi sampah ke jalur *Circular Economy*. |

---

## Justifikasi Data Simulasi

> **Mengapa menggunakan data simulasi dan bukan data asli?**

Data operasional pengelolaan sampah Kota Surabaya (kapasitas TPS real-time, rute armada, volume timbulan per wilayah) **tidak tersedia secara open source**. Data tersebut bersifat internal dan hanya dapat diakses melalui **pengajuan resmi ke Dinas Lingkungan Hidup (DLH) Kota Surabaya**  sebuah proses birokrasi yang memerlukan waktu berbulan-bulan dan tidak memungkinkan dalam konteks akademik ini.

Oleh karena itu, tim AURORA menggunakan **synthetic data generation** yang dimodelkan secara statistik untuk mensimulasikan kondisi nyata:

- **Pola timbulan sampah** dimodelkan dengan fungsi *diurnal sine wave* + Gaussian noise, sesuai kebiasaan warga Surabaya (puncak pagi 06:00 WIB dan sore 17:00 WIB)
- **Lonjakan volume** disimulasikan berdasarkan kalender event nyata Kota Surabaya (car free day, hari raya, event olahraga)
- **Koordinat TPS** menggunakan data geospasial nyata dari OpenStreetMap (OSM) Surabaya
- **Perilaku armada** dimodelkan menggunakan jaringan jalan nyata via OSRM (Open Source Routing Machine)

> **Arsitektur sistem ini dirancang identik dengan deployment nyata**, sehingga ketika akses data resmi pemerintah tersedia, sistem dapat langsung diintegrasikan tanpa perubahan pipeline.

### Potensi Implementasi ke Depan

Sistem AURORA dirancang agar **dapat diperluas** dengan sumber data fisik di masa mendatang:

- **Computer Vision pada Kamera CCTV TPS**  Model deteksi objek (YOLO/MobileNet) dapat diintegrasikan untuk mendeteksi level pengisian TPS secara visual secara real-time (*"TPS ini sudah penuh atau belum?"*), menggantikan simulasi sensor IoT dengan data visual nyata
- **IoT Load Cell Sensor**  Sensor berat fisik pada kontainer TPS dapat langsung menggantikan data simulasi sebagai sumber stream Kafka
- **Integrasi API DLH Surabaya**  Jika akses data resmi diperoleh, producer Kafka hanya perlu diganti tanpa mengubah downstream pipeline

---

## Deskripsi Proyek & Fitur Unggulan

AURORA memperlakukan sampah sebagai ***resource flow***, bukan sekadar limbah:

```
Sampah Warga  TPS  Sorting Hub  Fasilitas Optimal (Daur Ulang / Kompos / PLTSa)
```

| Fitur | Deskripsi |
|-------|-----------|
| **Prediksi Volume Sampah** | AI memprediksi TPS mana yang akan penuh dan kapan, berdasarkan pola historis + event terjadwalkan |
| **Rekomendasi Rute Armada** | *"Google Maps untuk truk sampah"*  Routing dinamis real-time berdasarkan kondisi TPS terkini |
| **Waste Risk Index (WRI)** | Indeks risiko komposit [0.01.0] per wilayah kecamatan untuk deteksi dini ancaman overload |
| **Prediksi Overload TPS** | Kalkulasi probabilitas TPS penuh sebelum jadwal pengangkutan berikutnya |
| **Tingkat Utilisasi Fasilitas** | Monitoring beban kerja TPA, PLTSa, TPS3R, dan Rumah Kompos secara real-time |
| **Estimasi Penghematan Biaya** | Perbandingan rute statis vs. rute AI-optimized dalam satuan km/ton dan biaya BBM |
| **Distribusi Sampah Optimal** | Menentukan fasilitas tujuan terbaik (TPA / PLTSa / Recycler) per jenis sampah |

---

## Arsitektur Big Data Pipeline

Sistem AURORA dibangun dengan arsitektur **4-layer Medallion** yang mengalirkan data dari sumber simulasi hingga dashboard secara end-to-end:

**1. Ingestion Layer (Pengumpulan Data)**

Di tahap ini, fokusnya adalah mengambil data dari berbagai sumber dan melemparnya ke sistem streaming. Kami menggunakan **Python Kafka Producer** yang mensimulasikan data dari 3 source utama  karena data real operasional Pemkot Surabaya tidak tersedia secara open source dan memerlukan pengajuan formal ke Dinas Lingkungan Hidup (DLH):

- **Sensor IoT TPS**: Data kapasitas, berat muatan, dan fill ratio kontainer sampah di setiap lokasi TPS
- **GPS Armada (Fleet Telemetry)**: Koordinat real-time truk sampah yang sedang beroperasi (latitude, longitude, status perjalanan)
- **Event Kalender Surabaya**: Jadwal acara besar (car free day, hari raya, konser, event olahraga) yang biasanya memicu lonjakan volume sampah hingga +40%

**2. Streaming Layer (Transport & Buffering)**

Setelah data diproduksi, **Apache Kafka** bertindak sebagai buffer yang andal antara producer dan consumer. Kafka memastikan tidak ada data yang hilang meski consumer downstream sedang restart atau overload:

- **3 Kafka Topic**: `topic_tps_telemetry`, `topic_fleet_gps`, `topic_waste_generation`
- **3 Partisi per topic** untuk parallelisme dan load balancing
- **Log retention 24 jam** untuk kemampuan replay data saat terjadi kegagalan downstream

**3. Processing & Storage Layer (Medallion Architecture)**

Di sinilah inti pemrosesan terjadi. **Apache Spark Structured Streaming** mengkonsumsi micro-batch dari Kafka dan memproses data dalam 3 lapisan yang semakin bersih dan bernilai:

- **Bronze Layer**  Data JSON mentah langsung ditulis ke HDFS sebagai Parquet terkompresi (raw archive, tidak dimodifikasi sama sekali)
- **Silver Layer**  Data dibersihkan, schema di-enforce, koordinat null di-geocode via OSM, dan Waste Risk Index (WRI) per kecamatan mulai dihitung
- **Gold Layer**  Agregasi window 5 menit dijalankan, Spark MLlib mengeksekusi model prediksi overload TPS dan menghasilkan rekomendasi rute armada yang siap dikonsumsi API

**4. Serving Layer (Visualisasi & Aksi)**

Hasil analitik dari Gold Layer kemudian di-serve ke pengguna akhir (operator dinas, manajer armada) melalui dashboard interaktif:

- **FastAPI Backend** melakukan query periodik ke Gold tables di HDFS
- Data disalurkan via **REST API & WebSocket** ke frontend
- **React + Vite Dashboard** menampilkan peta posisi armada real-time, heatmap WRI per wilayah, notifikasi TPS kritis, dan statistik efisiensi pengangkutan

---

## Detail Komponen Pipeline

### 1 Ingestion Layer  Python Kafka Producer

**Fungsi:** Mensimulasikan sumber data IoT yang dalam deployment nyata akan digantikan sensor fisik atau kamera CCTV.

**Cara Kerja:**
- Menggunakan fungsi **diurnal sine wave** untuk mensimulasikan pola timbulan sampah harian warga
- Menyuntikkan **anomali buatan** (lonjakan +40%) pada hari libur, weekend, dan event kota Surabaya
- Mensimulasikan pergerakan armada truk menggunakan OSRM API di jaringan jalan Surabaya
- Setiap event di-serialize ke JSON dan di-publish ke topic Kafka yang sesuai

**Contoh Output JSON  `topic_tps_telemetry`:**
```json
{
  "tps_id": "TPS-GUBENG-012",
  "nama": "TPS Kertajaya Indah",
  "kecamatan": "Gubeng",
  "lat": -7.2754,
  "lon": 112.7654,
  "max_capacity_kg": 8000.0,
  "current_load_kg": 6842.5,
  "fill_ratio": 0.855,
  "jenis_fasilitas": "TPS3R",
  "klasifikasi_pengangkutan": "armroll",
  "event_time": "2026-06-20T06:32:11.423Z",
  "status": "WARNING"
}
```

**Contoh Output JSON  `topic_fleet_gps`:**
```json
{
  "truck_id": "TRK-SBY-054",
  "truck_type": "ARMROLL",
  "lat": -7.2801,
  "lon": 112.7512,
  "current_payload_kg": 3200.0,
  "operational_status": "TRANSIT_TO_TPS",
  "destination_tps_id": "TPS-GUBENG-012",
  "estimated_arrival_min": 8,
  "event_time": "2026-06-20T06:32:15.001Z"
}
```

**Contoh Output JSON  `topic_waste_generation`:**
```json
{
  "region_id": "KEC_GUBENG",
  "event_time": "2026-06-20T06:30:00.000Z",
  "generated_volume_kg": 1240.8,
  "waste_fraction": "ORGANIC",
  "population_multiplier": 1.32,
  "is_event_day": false,
  "day_of_week": "Friday"
}
```

---

### 2 Streaming Layer  Apache Kafka

**Fungsi:** Message broker fault-tolerant yang memisahkan producer dari consumer, memastikan tidak ada data yang hilang saat terjadi spike beban.

**Konfigurasi:**
- **3 Topic:** `topic_tps_telemetry`, `topic_fleet_gps`, `topic_waste_generation`
- **3 Partisi per topic** untuk load balancing dan parallelisme
- **Retention:** 24 jam untuk replay kemampuan saat terjadi kegagalan downstream

**Mengapa Kafka?**
> Kafka dipilih karena mampu menangani throughput tinggi (ratusan ribu pesan/detik) dengan latensi rendah. Arsitektur log-based-nya memungkinkan Spark Streaming untuk mem-*replay* data jika terjadi kegagalan, menjamin **exactly-once processing semantics**.

---

### 3 Processing & Storage Layer  Spark + HDFS (Medallion Architecture)

**Fungsi:** Jantung sistem  memproses stream data, membersihkan, mengagresi, dan mengeksekusi model ML.

#### Bronze Layer  Raw Archive
- Menerima data JSON mentah dari Kafka
- Ditulis ke HDFS dalam format **Snappy-compressed Parquet** tanpa transformasi
- Berfungsi sebagai *source of truth*  data asli selalu tersimpan dan dapat di-replay

**Contoh Output Parquet Bronze (TPS Telemetry):**
```
tps_id          | current_load_kg | fill_ratio | event_time
----------------|-----------------|------------|------------------------
TPS-GUBENG-012  | 6842.5          | 0.855      | 2026-06-20T06:32:11Z
TPS-RUNGKUT-007 | 2100.0          | 0.420      | 2026-06-20T06:32:12Z
TPS-WONOKROMO-3 | 9100.0          | 0.975      | 2026-06-20T06:32:09Z   CRITICAL
```

#### Silver Layer  Enriched & Cleaned
- **Data Cleansing:** Normalisasi string `jenis_fasilitas`, filter TPS tidak aktif, resolusi null pada koordinat via geocoding OSM
- **Schema Enforcement:** Tipe data divalidasi, field tidak valid di-reject
- **Enrichment:** Menghitung `fill_ratio`, mengklasifikasikan status (`NORMAL` / `WARNING` / `CRITICAL`)
- **Waste Risk Index (WRI)** per kecamatan dihitung pada layer ini

**Contoh Output Silver (WRI per Kecamatan):**
```json
{
  "kecamatan": "Wonokromo",
  "avg_fill_ratio": 0.89,
  "wri_score": 0.91,
  "status": "CRITICAL",
  "active_tps_count": 14,
  "overloaded_tps_count": 6,
  "computed_at": "2026-06-20T06:35:00Z"
}
```

#### Gold Layer  Aggregated ML Results
- Agregasi window 5 menit untuk trending analysis
- **Spark MLlib** menjalankan prediksi overload TPS dan rekomendasi routing
- Output siap dikonsumsi oleh API layer tanpa pemrosesan tambahan

**Contoh Output Gold (Rekomendasi Dispatch):**
```json
{
  "dispatch_id": "DISP-20260620-0635-001",
  "triggered_by": "WRI_THRESHOLD",
  "target_tps": "TPS-WONOKROMO-003",
  "fill_ratio": 0.975,
  "recommended_truck": "TRK-SBY-021",
  "truck_type": "ARMROLL",
  "optimal_destination": "TPS3R-WONOKROMO",
  "estimated_travel_km": 3.2,
  "priority_score": 0.97,
  "generated_at": "2026-06-20T06:35:02Z"
}
```

---

### 4 Serving Layer  FastAPI + React Dashboard

**Fungsi:** Mengekspos hasil analitik ke pengguna (operator dinas, manajer armada) melalui dashboard interaktif.

- **FastAPI** melakukan query periodik ke Gold tables di HDFS dan menyalurkan data via REST API & WebSocket
- **React + Vite Dashboard** merender peta interaktif posisi armada, heatmap WRI per wilayah, dan notifikasi real-time TPS overload
- **Leaflet.js** menampilkan posisi TPS dan armada di peta Surabaya secara live

---

## Tech Stack

### Backend & Pipeline Big Data

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| **Data Ingestion** | Python 3.11+ + `kafka-python` | Simulasi producer IoT sensor TPS & GPS armada |
| **Message Broker** | Apache Kafka | Buffer stream event fault-tolerant, multi-topic |
| **Processing Engine** | Apache Spark Structured Streaming + MLlib | Agregasi windowing, kalkulasi WRI, ML prediksi |
| **Storage** | Hadoop HDFS + Parquet (Snappy) | Data Lakehouse  Bronze/Silver/Gold layers |
| **API Server** | FastAPI | REST API & WebSocket serving ke frontend |
| **Containerization** | Docker + Docker Compose | Orkestrasi cluster Hadoop, Kafka, Spark |

### Frontend Dashboard

| Komponen | Teknologi | Fungsi |
|----------|-----------|--------|
| **Framework** | React + TypeScript + Vite | UI dashboard interaktif |
| **Charting** | Recharts | Visualisasi data real-time & historis |
| **Maps** | Leaflet.js | Peta interaktif posisi armada & TPS |
| **Styling** | Tailwind CSS | Desain dashboard modern |

---

## Alasan Pemilihan & Justifikasi Teknis

### Apache Kafka  Message Broker
Kafka dipilih karena sifat data pengelolaan sampah yang **continuous dan high-frequency**. Berbeda dengan REST API tradisional yang polling-based, Kafka memungkinkan **event-driven architecture** dimana setiap perubahan kondisi TPS langsung di-broadcast ke consumer tanpa delay. Kemampuan **log retention dan replay** juga krusial untuk memastikan tidak ada data historis yang hilang jika Spark downstream mengalami restart.

### Apache Spark Structured Streaming  Processing Engine
Spark dipilih karena kemampuan **unified batch & streaming processing** dalam satu framework. Fitur **windowed aggregation** sangat tepat untuk menghitung tren kenaikan volume sampah per interval waktu. Integrasi native dengan **Spark MLlib** memungkinkan eksekusi model prediksi langsung di dalam pipeline tanpa perpindahan data ke sistem lain, mengurangi latensi end-to-end secara signifikan.

### Hadoop HDFS + Parquet  Storage
HDFS dipilih sebagai backbone storage karena kemampuan **distribusi data horizontal** yang sesuai dengan volume data sensor IoT yang terus bertambah. Format **Parquet dengan kompresi Snappy** dipilih karena memberikan rasio kompresi tinggi sekaligus mendukung **columnar read**  memungkinkan Spark hanya membaca kolom yang diperlukan tanpa scan seluruh dataset, sehingga query Gold Layer menjadi sangat efisien.

### Medallion Architecture (Bronze  Silver  Gold)
Pola ini memastikan **data lineage yang jelas**  setiap transformasi data dapat di-trace kembali ke sumbernya. Bronze layer sebagai *immutable raw archive* memberikan safety net jika terjadi bug di layer transformasi, karena data asli selalu tersedia untuk di-reprocess. Pemisahan concern ini juga memungkinkan tim data dan tim analitik bekerja secara independen.

### Python Synthetic Data Generator
Menggunakan **fungsi matematika deterministik** (diurnal sine wave) bukan random murni agar data simulasi mencerminkan pola nyata perilaku warga Surabaya. Pendekatan ini juga memungkinkan **reproducibility**  eksperimen dapat diulang dengan seed yang sama untuk validasi hasil.

---

## Skema Data (Data Schema)

Seluruh data streaming di-serialize dalam format **JSON** untuk ingestion Kafka, lalu di-transform ke format **Snappy-compressed Parquet** di Bronze Layer.

### Schema 1: Regional Waste Generation
*Topic: `topic_waste_generation`*

| Field | Type | Deskripsi |
|-------|------|-----------|
| `event_time` | Timestamp | High-precision event log |
| `region_id` | String | Kecamatan Surabaya (e.g., `KEC_GUBENG`) |
| `generated_volume_kg` | Float | Volume sampah tergenerasi (kg) |
| `waste_fraction` | ENUM | `ORGANIC`, `PLASTIC`, `PAPER`, `METAL`, `RESIDUE` |
| `population_multiplier` | Float | Koefisien kepadatan demografis |

### Schema 2: TPS IoT Capacity Sensor
*Topic: `topic_tps_telemetry`*

| Field | Type | Deskripsi |
|-------|------|-----------|
| `tps_id` | String | ID unik TPS (mapping ke koordinat registry) |
| `max_capacity_kg` | Float | Batas kapasitas maksimal struktural |
| `current_load_kg` | Float | Berat real-time dari load cell sensor |
| `fill_ratio` | Float | `current_load_kg / max_capacity_kg` |
| `jenis_fasilitas` | String | `TPS`, `TPS3R`, `RUMAH_KOMPOS`, `PLTSA` |
| `klasifikasi_pengangkutan` | ENUM | `ARMROLL`, `COMPACTOR` |
| `event_time` | Timestamp | Waktu pembacaan sensor |

### Schema 3: Fleet GPS Telemetry
*Topic: `topic_fleet_gps`*

| Field | Type | Deskripsi |
|-------|------|-----------|
| `truck_id` | String | ID unik kendaraan |
| `truck_type` | ENUM | `ARMROLL`, `COMPACTOR`, `DUMP_TRUCK` |
| `lat` / `lon` | Float | Koordinat WGS84 real-time |
| `current_payload_kg` | Float | Berat muatan di dalam truk |
| `operational_status` | ENUM | `IDLE`, `TRANSIT_TO_TPS`, `COLLECTING`, `TRANSIT_TO_FACILITY`, `DUMPING` |
| `destination_tps_id` | String | Target TPS saat ini |
| `event_time` | Timestamp | Waktu pembacaan GPS |

---

## Cara Menjalankan

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) (versi terbaru)
- [Node.js](https://nodejs.org/) v18+
- Python 3.11+

---

### 1. Backend Big Data Pipeline (Docker)

```bash
cd backend

# Jalankan seluruh cluster: Hadoop, Spark, Kafka, Zookeeper
docker-compose up -d

# Tunggu semua container healthy (~60 detik)
docker-compose ps
```

**Verifikasi services:**
- Kafka Broker: `localhost:9092`
- Hadoop HDFS NameNode UI: `http://localhost:9870`
- Spark Master UI: `http://localhost:8080`

---

### 2. Jalankan Kafka Producer (Simulasi Data IoT)

```bash
# Install dependency Python
pip install kafka-python pyspark faker geopy

# Jalankan simulasi data TPS, Armada, dan Regional Waste
python kafka-producer/producer.py
```

> **Catatan:** Producer menggunakan fungsi **diurnal sine wave** untuk mensimulasikan pola buang sampah warga (puncak 06:00 WIB dan 17:00 WIB).

---

### 3. Jalankan Spark Streaming Job

```bash
# Submit Spark Structured Streaming Job
spark-submit \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
  spark-streaming/app.py
```

---

### 4. Frontend Dashboard (React + Vite)

```bash
cd dashboard

# Install dependencies
npm install

# Jalankan development server
npm run dev
```

Buka browser di **`http://localhost:5173`**

---

## Struktur Direktori

```
FP-Bigdata-AURORA/
│
├── backend/
│   ├── kafka-producer/              # Simulasi producer: IoT TPS, GPS Armada
│   │   └── producer.py
│   ├── spark-streaming/             # Spark Structured Streaming job
│   │   └── app.py
│   ├── analytics-engine/            # Spark MLlib: WRI, Prediksi, LP Optimizer
│   ├── api/                         # FastAPI REST API server
│   ├── scripts/                     # Utility scripts (data cleansing, geocoding)
│   ├── docker-compose.yml           # Orkestrasi cluster Big Data
│   └── hadoop.env                   # Environment variables Hadoop
│
├── dashboard/                       # Frontend React + TypeScript + Vite
│   ├── src/
│   │   ├── components/              # UI components (Map, Charts, Cards)
│   │   ├── pages/                   # Halaman dashboard
│   │   └── hooks/                   # Custom hooks (WebSocket, API)
│   ├── package.json
│   └── vite.config.ts
│
├── docs/                            # Dokumentasi teknis tambahan
├── README.md
└── COMPACT_CONTEXT.md
```

---

## Konsep Inti

AURORA dibangun di atas prinsip bahwa **sampah adalah sumber daya yang salah tempat**, bukan sekadar limbah. Sistem secara aktif memantau dan mengorkestrasi alur pergerakan sampah agar:

1.  **Material bernilai** (plastik, kertas, logam)  Masuk ke jalur *Circular Economy* (Recycler / TPS3R)
2.  **Sampah organik**  Diarahkan ke Rumah Kompos / Fasilitas Biogas
3.  **Residu tak terhindarkan**  PLTSa Benowo (sebagai *last resort*, bukan default)

---

## Referensi & Dokumen Pendukung

-  [`Revision.md`](./docs/)  Pipeline Architecture Specification
-  [`TPS Information.md`](./docs/)  Data Dictionary & Protokol Data Cleansing TPS Surabaya
-  [`Data Event Terjadwalkan Surabaya.md`](./docs/)  Konteks lonjakan sampah akibat event kota
-  [`Garbage Fleet Operational Information.md`](./docs/)  Spesifikasi operasional armada truk
-  [`Project Idea.md`](./docs/)  Ide awal & background proyek

