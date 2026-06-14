# Project Context: AURORA - Surabaya Smart Waste Management & Big Data Pipeline

## 1. Project Overview
AURORA adalah platform monitoring aliran sumber daya sampah (*resource flow*) untuk Kota Surabaya. Sistem ini dirancang untuk menyelesaikan masalah inefisiensi rute pengangkutan dan penumpukan sampah dengan memanfaatkan Artificial Intelligence (AI), Internet of Things (IoT), dan Big Data Analytics. 

Proyek ini dikembangkan sebagai Final Project Big Data & Data Lakehouse, dengan target skalabilitas untuk kompetisi Gemastik kategori Smart City. Sampah diperlakukan sebagai *resource flow* (Sampah → TPS → Sorting Hub → Fasilitas Optimal) agar fasilitas seperti PLTSa Benowo tidak kelebihan beban dan ekonomi sirkular berjalan.

**Project Lead:** Muhammad Ardiansyah Tri Wibowo

## 2. Tech Stack & Architecture

### Arsitektur Big Data & Streaming
Sistem menggunakan arsitektur aliran data *real-time*:
* **Ingestion (Apache Kafka):** Mengumpulkan data pergerakan sampah secara *real-time* dari berbagai TPS di Surabaya (seperti TPS Benowo, Bratang, Keputih, Wonorejo) menggunakan script produser Python (`backend/kafka-producer/producer.py`).
* **Processing (Apache Spark):** Spark Streaming mengkonsumsi topik `aurora_waste_flow` dari Kafka, melakukan agregasi jendela waktu (*window aggregation*) setiap 10 menit berdasarkan jenis sampah (`backend/spark-streaming/app.py`).
* **Storage (Hadoop HDFS):** Data Lakehouse menyimpan data agregasi dalam format Parquet untuk keperluan *Batch Analytics* dan *Machine Learning*.

### AI & Aplikasi Terintegrasi
* **AI/ML Models:** Ekosistem Python (TensorFlow/PyTorch/OpenCV) untuk model *Computer Vision* pendeteksi jenis sampah.
* **Web & API:** Pengembangan *full-stack* menggunakan ekosistem MERN stack (MongoDB, Express, React, Node.js) dipadukan dengan Prisma ORM.
* **Frontend Dashboard:** Dibangun dengan React, TypeScript, dan Recharts (via Vite) untuk visualisasi monitoring arus sampah (`dashboard/src/App.tsx`).
* **Hardware / IoT:** ESP32/Arduino dengan sensor ultrasonik dan radar.
    * *Rekomendasi Transmisi Data:* Data volume/metrik numerik ringan dikirim via protokol MQTT ke *broker* untuk diteruskan ke Kafka. Transmisi gambar dari kamera ESP32-CAM dikirim via HTTP REST API (Multipart form-data) ke *server backend* untuk diproses oleh model CV.

## 3. Sistem Aktor & Otorisasi
Sistem memiliki kontrol akses *Multi-Tenant* untuk berbagai entitas:
1.  **Admin Pemerintah Kota (DLH Surabaya):** Akses penuh ke *Dashboard Digital Twin*, pemantauan kuota PLTSa Benowo, dan manajemen armada kota.
2.  **Sopir Truk Sampah:** Akses ke aplikasi navigasi untuk menerima *Smart Route Optimization* dan instruksi drop-off sampah.
3.  **Bank Sampah (Pengepul):** Akses manajemen inventaris dan *Marketplace* untuk menjual hasil pilahan sampah.
4.  **Industri / Pabrik (B2B):** Akses sebagai pembeli (*buyer*) material daur ulang massal dalam skema *Circular Economy*.
5.  **Khalayak Umum (Warga):** Akses ke aplikasi *Citizen Reporting*, *Eco Reward System*, serta akses untuk membeli produk/material hasil daur ulang (*marketplace* B2C/C2C).

## 4. Core Features

### AI Waste Flow Prediction & Classification
* Sistem memprediksi TPS mana yang akan penuh dan kapan lonjakan sampah terjadi.
* Model *Computer Vision* (Python) mengklasifikasikan aliran sampah menjadi kategori: Organik, Plastik, Kertas, Logam, dan E-Waste. Sistem menentukan tujuan akhir terbaik untuk setiap kategori.

### Dynamic Waste Distribution Engine & Smart Routing
* AI menentukan distribusi terbaik dari Sorting Hub berdasarkan kapasitas fasilitas, jarak, nilai ekonomi, dan emisi karbon.
* Sistem mengkonversi data volume dari TPS (diproses via Spark Streaming) menjadi rute *real-time* yang optimal untuk armada truk guna mencegah penumpukan.

### Waste Exchange Marketplace
* Platform *marketplace* yang melakukan *matching* otomatis antara stok material di Bank Sampah dengan kebutuhan Industri daur ulang maupun masyarakat umum.

### Citizen Reporting & Eco Reward
* Aplikasi bagi warga untuk melaporkan TPS penuh atau sampah liar via foto yang diverifikasi otomatis oleh *Computer Vision*. Pelapor dan warga yang memilah sampah mendapatkan poin *reward*.

## 5. Project Directory Structure
Struktur direktori saat ini (Berdasarkan repositori `FP-Bigdata-AURORA`):

```text
FP-Bigdata-AURORA/
├── README.md                      # Dokumentasi utama proyek
├── backend/                       # Pipeline Big Data & Streaming
│   ├── docker-compose.yml         # Konfigurasi container Hadoop, Spark, & Kafka
│   ├── hadoop.env                 # Environment variables untuk Hadoop
│   ├── kafka-producer/            # Simulasi data IoT dari TPS
│   │   └── producer.py            # Script Python pembuat data sampah real-time
│   ├── scratch/                   # Script tambahan/testing
│   │   ├── generate_real_tps.py
│   │   └── generate_tps.py
│   └── spark-streaming/           # Pemrosesan aliran data
│       └── app.py                 # PySpark script untuk agregasi data Kafka
└── dashboard/                     # Frontend Visualisasi (React + Vite)
    ├── README.md
    ├── package.json               # Dependensi NPM
    ├── package-lock.json
    ├── tsconfig.json              # Konfigurasi TypeScript
    ├── vite.config.ts             # Konfigurasi bundler Vite
    ├── index.html                 # Entry point HTML
    ├── public/                    # Aset statis & dataset
    │   ├── dataset_tps_surabaya.csv
    │   └── Referensi/             # Folder referensi gambar truk & PDF Big Data
    └── src/                       # Source code React
        ├── main.tsx               # Entry point React
        ├── App.tsx                # Komponen utama Dashboard
        ├── App.css
        ├── index.css
        ├── assets/                # Gambar/logo UI
        └── data/                  # Mockup data atau skema TypeScript
            └── tpsData.ts