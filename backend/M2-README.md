## AURORA M2 — Kafka + Spark + HDFS Pipeline

### Prasyarat
- **WSL2** dengan Ubuntu 22.04 (sudah terinstal).
- **Docker Desktop** dengan WSL2 integration enabled.
- **Node.js** (v18+) dan **Python 3.10+** untuk backend/analytics.

### Quick Start (WSL)

```bash
# 1. Buka WSL terminal, masuk ke direktori project
cd /mnt/d/Github/FP-Bigdata-AURORA

# 2. Jalankan pipeline (Docker containers + Kafka topics + HDFS dirs + Spark job)
bash backend/scripts/start-pipeline.sh

# 3. Jalankan backend API (di Windows PowerShell / WSL)
cd backend/api && npx tsx src/index.ts

# 4. Jalankan frontend (di Windows PowerShell)
cd dashboard && npm run dev

# 5. Stop pipeline saat selesai
bash backend/scripts/stop-pipeline.sh
```

### Arsitektur Data Flow
```
Backend Simulation (60s) → Kafka: aurora_tps_volume
                              ↓
                         Spark Streaming (tps_volume_streaming.py)
                              ↓
                         HDFS Parquet
                              ├─ raw/tps_volume/
                              ├─ aggregated/by_kecamatan/
                              ├─ aggregated/by_waste_type/
                              ├─ aggregated/critical/
                              └─ aggregated/event_type_distribution/
                              ↓
                         Python Analytics Engine (:4001)
                              ↓
                         Backend /api/analytics/*
                              ↓
                         Frontend Dashboard
```

### Services & Ports
| Service | Port | URL |
|---|---|---|
| Backend API | 4000 | http://localhost:4000 |
| Frontend | 5173 | http://localhost:5173 |
| Kafka Broker | 9092 | localhost:9092 |
| ZooKeeper | 2181 | localhost:2181 |
| Spark Master UI | 8080 | http://localhost:8080 |
| HDFS Namenode | 9870 | http://localhost:9870 |
| Analytics Engine | 4001 | http://localhost:4001 |

### API Endpoints
```
GET  /api/health                       - Health check
GET  /api/tps                          - TPS list (CRUD)
POST /api/tps                          - Create TPS
PATCH /api/tps/:id                     - Update TPS
PATCH /api/tps/:id/verify              - Verify TPS (ADMIN only)
GET  /api/analytics/tps-summary        - TPS summary (by kecamatan, fill level)
GET  /api/analytics/critical-tps       - Critical TPS list
GET  /api/analytics/waste-types        - Waste type distribution
```

### File Pipeline (Semua BARU, tidak ubah pipeline lama)
- `backend/api/src/modules/marketplace/tps.kafka.ts` — Kafka producer (kafkajs)
- `backend/api/src/modules/marketplace/tps.simulation.ts` — Simulasi 60s + Kafka events
- `backend/api/src/modules/analytics/` — Analytics endpoints
- `backend/spark-streaming/tps_volume_streaming.py` — Spark streaming (NEW)
- `backend/analytics-engine/main.py` — Python analytics service
- `backend/analytics-engine/reader.py` — HDFS Parquet reader
- `backend/scripts/start-pipeline.sh` — WSL startup script
- `backend/scripts/stop-pipeline.sh` — WSL shutdown script

### Troubleshooting
- **Kafka exited**: ZooKeeper belum siap saat Kafka mulai. Start script otomatis retry.
- **Spark job gagal**: Pastikan `spark-sql-kafka-0-10_2.12` package berhasil di-download.
- **HDFS permission**: Run `docker exec namenode hdfs dfs -chmod -R 777 /aurora`.
- **Backend tidak konek Kafka**: Pastikan `localhost:9092` reachable dari Windows ke WSL Docker.
