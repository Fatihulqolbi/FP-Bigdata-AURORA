# AURORA - Surabaya Waste Management System (Big Data Pipeline & Dashboard)

Proyek ini adalah implementasi dari **AURORA**, sebuah platform monitoring aliran sumber daya sampah untuk Kota Surabaya. Sesuai dengan materi perkuliahan Big Data, sistem ini memanfaatkan teknologi Hadoop, Apache Kafka, dan Apache Spark.

## Arsitektur Big Data
Sistem ini menggunakan arsitektur aliran data realtime (streaming):
1. **Apache Kafka (Ingestion)**: Mengumpulkan data pergerakan sampah secara *real-time* dari berbagai TPS (Tempat Pembuangan Sementara) di Surabaya (skrip `producer.py`).
2. **Apache Spark (Processing)**: `spark-streaming/app.py` mengkonsumsi data dari Kafka (`aurora_waste_flow`), melakukan agregasi jendela waktu (window aggregation), dan menyimpan datanya.
3. **Hadoop HDFS (Storage)**: Bertindak sebagai Data Lakehouse, menyimpan data log sampah dari Spark dalam format Parquet untuk keperluan Batch Analytics dan Machine Learning (MLlib) di masa depan.
4. **React & Vite (Frontend Dashboard)**: Dashboard visualisasi monitoring arus sampah, dibangun dengan React, TypeScript, dan Recharts, yang memberikan *insight* mengenai efisiensi Sorting Hub dan prediksi kapasitas PLTSa.

## Cara Menjalankan

### 1. Frontend Dashboard (Vite + React)
Pastikan Node.js sudah terinstal.
```bash
cd dashboard
npm install
npm run dev
```

### 2. Backend Big Data Pipeline (Docker)
Pastikan Docker dan Docker Compose sudah terinstal.
```bash
cd backend
# Menjalankan klaster Hadoop, Spark, dan Kafka
docker-compose up -d

# Instalasi dependency Python untuk produser data simulasi
pip install kafka-python pyspark

# Jalankan simulasi data Kafka
python kafka-producer/producer.py

# Jalankan Spark Streaming Job
spark-submit --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 spark-streaming/app.py
```

## Konsep
AURORA memperlakukan sampah sebagai *resource flow*, bukan limbah.
**Sampah → TPS → Sorting Hub → Fasilitas Optimal (Daur Ulang/PLTSa)**

Sistem secara aktif memantau efisiensi pemilahan sampah agar PLTSa Benowo tidak kelebihan beban, dan material bernilai ekonomi tinggi masuk ke jalur *Circular Economy*.
