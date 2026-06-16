#!/bin/bash
# Prepare OSRM map data for Surabaya / Jawa Timur
# Usage: bash scripts/prepare-osrm.sh
# Requires: docker, curl

set -e

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
DATA_DIR="$PROJECT_DIR/osrm-data/java"

GEOFABRIK_URL="https://download.geofabrik.de/asia/indonesia/java-latest.osm.pbf"
REGION_NAME="java"

echo "=== AURORA OSRM Map Preparation ==="
echo ""

mkdir -p "$DATA_DIR"

# Check if PBF already exists
if [ -f "$DATA_DIR/${REGION_NAME}-latest.osm.pbf" ]; then
    echo "[SKIP] ${REGION_NAME}-latest.osm.pbf already exists"
else
    echo "[DOWNLOAD] Downloading Jawa PBF from Geofabrik (~750 MB)..."
    # Download full Jawa island; we'll extract Surabaya region next
    curl -L -o "$DATA_DIR/${REGION_NAME}-latest.osm.pbf" "$GEOFABRIK_URL"
    echo "[DONE] Downloaded"
fi

# Run OSRM preprocess in Docker
echo ""
echo "[PREPROCESS] Running osrm-extract..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    ghcr.io/project-osrm/osrm-backend:latest \
    osrm-extract -p /opt/car.lua /data/${REGION_NAME}-latest.osm.pbf

echo "[PREPROCESS] Running osrm-partition..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    ghcr.io/project-osrm/osrm-backend:latest \
    osrm-partition /data/${REGION_NAME}-latest.osrm

echo "[PREPROCESS] Running osrm-customize..."
docker run --rm \
    -v "$DATA_DIR:/data" \
    ghcr.io/project-osrm/osrm-backend:latest \
    osrm-customize /data/${REGION_NAME}-latest.osrm

echo ""
echo "=== DONE ==="
echo "OSRM map ready at: $DATA_DIR"
echo ""
echo "Start OSRM container:"
echo "  cd $PROJECT_DIR && docker compose -f docker-compose.yml -f docker-compose.osrm.yml up -d osrm"
echo ""
echo "Test route:"
echo '  curl "http://localhost:5000/route/v1/driving/112.620,-7.234;112.768,-7.250"'
