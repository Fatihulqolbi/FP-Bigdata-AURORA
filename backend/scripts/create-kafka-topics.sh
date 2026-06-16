#!/bin/bash
# AURORA M2 — Create required Kafka topics
# Run after docker-compose up -d

echo "Creating Kafka topics..."

docker exec -it kafka kafka-topics \
  --bootstrap-server kafka:29092 \
  --create \
  --topic aurora_tps_volume \
  --partitions 3 \
  --replication-factor 1 \
  --if-not-exists

docker exec -it kafka kafka-topics \
  --bootstrap-server kafka:29092 \
  --list

echo "Kafka topics initialised."
