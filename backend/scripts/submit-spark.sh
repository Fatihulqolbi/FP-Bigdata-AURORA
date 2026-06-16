#!/bin/bash
# Submit Spark streaming job from within WSL
cd /mnt/d/Github/FP-Bigdata-AURORA

# Ensure HDFS directories exist
docker exec namenode hdfs dfs -mkdir -p \
  /aurora/raw/tps_volume \
  /aurora/aggregated/tps_volume_by_kecamatan \
  /aurora/aggregated/tps_volume_by_waste_type \
  /aurora/aggregated/tps_critical \
  /aurora/aggregated/event_type_distribution \
  /aurora/checkpoints 2>/dev/null || true
docker exec namenode hdfs dfs -chmod -R 777 /aurora 2>/dev/null || true

# Kill any existing tps_volume streaming process
docker exec spark-master bash -c 'pkill -f tps_volume' 2>/dev/null || true
sleep 2

# Submit job with nohup
docker cp backend/spark-streaming/tps_volume_streaming.py spark-master:/opt/spark/work-dir/

docker exec -d spark-master bash -c '
nohup /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0 \
  --conf spark.sql.streaming.checkpointLocation=hdfs://namenode:8020/aurora/checkpoints/ \
  /opt/spark/work-dir/tps_volume_streaming.py \
  > /tmp/spark-tps-volume.log 2>&1 &
'

echo "Spark job submitted. Waiting 15s..."
sleep 15

# Check status
echo ""
echo "=== Spark Processes ==="
docker exec spark-master ps aux | grep tps_volume | grep -v grep

echo ""
echo "=== HDFS Raw Data ==="
docker exec namenode hdfs dfs -ls /aurora/raw/tps_volume/ 2>&1 | tail -10

echo ""
echo "=== HDFS Aggregated ==="
docker exec namenode hdfs dfs -ls -R /aurora/aggregated/ 2>&1 | head -20

echo ""
echo "=== Spark Log (last 30 lines) ==="
docker exec spark-master tail -30 /tmp/spark-tps-volume.log 2>&1
