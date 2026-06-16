#!/bin/bash
# ============================================
# AURORA M2/M4 — WSL Pipeline Startup Script
# Run from WSL terminal:
#   cd /mnt/d/Github/FP-Bigdata-AURORA
#   bash backend/scripts/start-pipeline.sh
# ============================================

set -e

PROJECT_DIR="/mnt/d/Github/FP-Bigdata-AURORA"
COMPOSE_FILE="$PROJECT_DIR/backend/docker-compose.yml"
OSRM_COMPOSE_FILE="$PROJECT_DIR/backend/docker-compose.osrm.yml"
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
CYAN='\033[0;36m'
NC='\033[0m'

log() { echo -e "${GREEN}[AURORA]${NC} $1"; }
warn() { echo -e "${YELLOW}[WARN]${NC} $1"; }
err() { echo -e "${RED}[ERROR]${NC} $1"; }
step() { echo -e "\n${CYAN}>>> $1${NC}"; }

# --- Step 1: Cleanup old containers ---
step "Membersihkan container lama..."
cd "$PROJECT_DIR/backend"
docker-compose -f "$COMPOSE_FILE" down --remove-orphans 2>/dev/null || true
log "Container lama dihapus."

# --- Step 2: Start Docker containers ---
step "Menjalankan Big Data containers..."
docker-compose -f "$COMPOSE_FILE" up -d
log "Containers dimulai."

# --- Step 3: Wait for ZooKeeper ---
step "Menunggu ZooKeeper siap..."
for i in $(seq 1 30); do
  if docker exec zookeeper echo "ok" 2>/dev/null; then
    log "ZooKeeper siap setelah ${i}s."
    break
  fi
  sleep 1
done

# --- Step 4: Wait for Kafka (it may exit once due to ZK timing) ---
step "Menunggu Kafka siap..."
for i in $(seq 1 20); do
  STATUS=$(docker ps --filter name=kafka --format "{{.Status}}" 2>/dev/null)
  if echo "$STATUS" | grep -q "Up"; then
    log "Kafka berjalan."
    break
  fi
  docker start kafka 2>/dev/null || true
  sleep 3
done

# --- Step 5: Create Kafka topics ---
step "Membuat Kafka topics..."
docker exec kafka kafka-topics \
  --bootstrap-server kafka:29092 \
  --create \
  --topic aurora_tps_volume \
  --partitions 3 \
  --replication-factor 1 \
  --if-not-exists 2>/dev/null
log "Topic aurora_tps_volume siap."
docker exec kafka kafka-topics --bootstrap-server kafka:29092 --list 2>/dev/null

# --- Step 6: Wait for HDFS ---
step "Menunggu HDFS Namenode siap..."
for i in $(seq 1 30); do
  if docker exec namenode hdfs dfsadmin -report 2>/dev/null | grep -q "Live datanodes"; then
    log "HDFS siap."
    break
  fi
  sleep 1
done

# --- Step 7: Create HDFS directories ---
step "Membuat direktori HDFS..."
docker exec namenode hdfs dfs -mkdir -p \
  /aurora/raw/tps_volume \
  /aurora/aggregated/tps_volume_by_kecamatan \
  /aurora/aggregated/tps_volume_by_waste_type \
  /aurora/aggregated/tps_critical \
  /aurora/aggregated/event_type_distribution \
  /aurora/checkpoints 2>/dev/null || true
docker exec namenode hdfs dfs -chmod -R 777 /aurora 2>/dev/null || true
log "Direktori HDFS dibuat."

# --- Step 8: Submit Spark job ---
step "Mengirim Spark streaming job..."
bash "$SCRIPT_DIR/submit-spark.sh"
log "Spark job berjalan."

# --- Step 9: (M4) Start OSRM routing engine ---
step "M4: Menjalankan OSRM routing engine..."
if [ -f "$PROJECT_DIR/backend/osrm-data/java/java-latest.osrm" ]; then
  docker compose -f "$COMPOSE_FILE" -f "$OSRM_COMPOSE_FILE" up -d osrm 2>/dev/null || true
  sleep 3
  if curl -sf "http://localhost:5000/route/v1/driving/112.620,-7.234;112.768,-7.250" > /dev/null 2>&1; then
    log "OSRM routing engine siap di :5000."
  else
    warn "OSRM belum siap — route akan pakai fallback straight-line."
    warn "Untuk setup OSRM, jalankan: bash backend/scripts/prepare-osrm.sh"
  fi
else
  warn "OSRM map data belum disiapkan."
  warn "Download & preprocessing: bash backend/scripts/prepare-osrm.sh"
  warn "Route akan pakai fallback untuk saat ini."
fi

# --- Step 10: Start Backend API ---
step "Menjalankan Backend API..."
echo ""
echo -e "  ${YELLOW}Silakan jalankan ini di terminal Windows (PowerShell):${NC}"
echo -e "  cd D:\\Github\\FP-Bigdata-AURORA\\backend\\api"
echo -e "  npx tsx src/index.ts"
echo ""

# --- Step 10: Start Analytics Engine (optional) ---
step "Menjalankan Analytics Engine (opsional)..."
echo ""
echo -e "  ${YELLOW}Untuk analytics engine, jalankan di WSL:${NC}"
echo -e "  cd /mnt/d/Github/FP-Bigdata-AURORA/backend/analytics-engine"
echo -e "  pip install -r requirements.txt"
echo -e "  uvicorn main:app --host 0.0.0.0 --port 4001"
echo ""

echo "============================================"
echo -e "${GREEN}  AURORA Pipeline Siap!${NC}"
echo ""
echo -e "  Backend API:  ${CYAN}http://localhost:4000${NC}"
echo -e "  Spark Master: ${CYAN}http://localhost:8080${NC}"
echo -e "  HDFS Namenode:${CYAN}http://localhost:9870${NC}"
echo -e "  Kafka Broker: ${CYAN}localhost:9092${NC}"
echo -e "  OSRM Routing: ${CYAN}http://localhost:5000${NC} (M4)"
echo -e "  SSE Fleet:    ${CYAN}http://localhost:4000/api/fleet/live${NC} (M4)"
echo ""
echo -e "  ${YELLOW}Jalankan backend API dan frontend untuk mulai.${NC}"
echo "============================================"
