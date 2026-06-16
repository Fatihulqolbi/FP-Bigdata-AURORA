#!/bin/bash
# ============================================
# AURORA M2 — WSL Pipeline Shutdown Script
# Run from WSL terminal:
#   bash backend/scripts/stop-pipeline.sh
# ============================================

PROJECT_DIR="/mnt/d/Github/FP-Bigdata-AURORA"
GREEN='\033[0;32m'
NC='\033[0m'

echo -e "${GREEN}[AURORA]${NC} Menghentikan pipeline..."
cd "$PROJECT_DIR/backend"

# Stop Spark streaming job (kill zombie process on spark-master)
echo "Menghentikan Spark streaming..."
docker exec spark-master bash -c 'pkill -f tps_volume_streaming' 2>/dev/null || true

# Stop all containers
echo "Menghentikan containers..."
docker-compose down --remove-orphans

echo -e "${GREEN}[AURORA]${NC} Pipeline berhenti."
