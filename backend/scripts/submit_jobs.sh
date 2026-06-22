#!/bin/bash
set -e

SPARK_MASTER="spark://spark-master:7077"
KAFKA_BROKER="kafka:29092"
HDFS_PATH="hdfs://namenode:8020/aurora"

echo "Waiting for Kafka to be ready..."
until nc -z kafka 29092; do
    echo "Kafka not ready, waiting..."
    sleep 5
done
echo "Kafka is ready!"

echo "Waiting for HDFS to be ready..."
until hdfs dfs -ls / 2>/dev/null; do
    echo "HDFS not ready, waiting..."
    sleep 10
done
echo "HDFS is ready!"

echo "Creating HDFS directories..."
hdfs dfs -mkdir -p $HDFS_PATH/metrics/wri
hdfs dfs -mkdir -p $HDFS_PATH/metrics/overload
hdfs dfs -mkdir -p $HDFS_PATH/metrics/facility_utilization
hdfs dfs -mkdir -p $HDFS_PATH/metrics/alerts
hdfs dfs -mkdir -p $HDFS_PATH/checkpoints/wri
hdfs dfs -mkdir -p $HDFS_PATH/checkpoints/overload
hdfs dfs -mkdir -p $HDFS_PATH/checkpoints/facility_utilization
hdfs dfs -mkdir -p $HDFS_PATH/checkpoints/alerts
hdfs dfs -mkdir -p $HDFS_PATH/checkpoints/metrics_kafka
hdfs dfs -mkdir -p $HDFS_PATH/waste_data
echo "HDFS directories created!"

echo "Creating Kafka topics..."
kafka-topics --bootstrap-server $KAFKA_BROKER --create --if-not-exists --topic aurora_metrics --partitions 3 --replication-factor 1
kafka-topics --bootstrap-server $KAFKA_BROKER --create --if-not-exists --topic aurora_alerts --partitions 3 --replication-factor 1
echo "Kafka topics created!"

echo "Submitting WRI Streaming Job..."
$SPARK_HOME/bin/spark-submit \
    --master $SPARK_MASTER \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
    --conf spark.streaming.backpressure.enabled=true \
    --conf spark.streaming.kafka.maxRatePerPartition=1000 \
    /app/wri_streaming.py &

echo "Submitting Overload Prediction Streaming Job..."
$SPARK_HOME/bin/spark-submit \
    --master $SPARK_MASTER \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
    --conf spark.streaming.backpressure.enabled=true \
    --conf spark.streaming.kafka.maxRatePerPartition=1000 \
    /app/overload_streaming.py &

echo "Submitting Facility Utilization Streaming Job..."
$SPARK_HOME/bin/spark-submit \
    --master $SPARK_MASTER \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
    --conf spark.streaming.backpressure.enabled=true \
    /app/facility_utilization_streaming.py &

echo "Submitting Alert Detection Streaming Job..."
$SPARK_HOME/bin/spark-submit \
    --master $SPARK_MASTER \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
    --conf spark.streaming.backpressure.enabled=true \
    /app/alert_streaming.py &

echo "Submitting Metrics Kafka Sink Job..."
$SPARK_HOME/bin/spark-submit \
    --master $SPARK_MASTER \
    --packages org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2 \
    --conf spark.streaming.backpressure.enabled=true \
    /app/metrics_kafka_sink.py &

echo "All Spark streaming jobs submitted!"
echo "Monitoring jobs..."

wait
