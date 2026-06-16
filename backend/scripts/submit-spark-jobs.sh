#!/bin/bash
# AURORA M2 — Submit Spark Streaming jobs
# Run this after Kafka topics are created and producer is running.

echo "Submitting AURORA TPS Volume Streaming job..."

# Copy the streaming script into the Spark master container
docker cp backend/spark-streaming/tps_volume_streaming.py spark-master:/opt/spark/work-dir/

# Submit the job
docker exec -it spark-master /opt/spark/bin/spark-submit \
  --master spark://spark-master:7077 \
  --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.4.0 \
  --conf spark.sql.streaming.checkpointLocation=hdfs://namenode:8020/aurora/checkpoints/ \
  /opt/spark/work-dir/tps_volume_streaming.py

echo "Spark job submitted."
