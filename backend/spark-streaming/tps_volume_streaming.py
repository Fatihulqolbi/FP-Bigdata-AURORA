"""
AURORA TPS Volume Streaming (M2)
Consumes aurora_tps_volume Kafka topic, aggregates windowed data,
and writes to HDFS as Parquet for data lake / analytics.

This is a NEW module — does NOT modify the existing app.py.
"""

from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window, sum as spark_sum, avg, count, max as spark_max
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType

# Initialize Spark Session
spark = SparkSession.builder \
    .appName("AURORA_TpsVolumeStreaming") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2") \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

# Define Schema matching TpsVolumeEvent from backend
schema = StructType([
    StructField("timestamp", StringType(), True),
    StructField("event_type", StringType(), True),
    StructField("tps_code", StringType(), True),
    StructField("tps_name", StringType(), True),
    StructField("kecamatan", StringType(), True),
    StructField("kelurahan", StringType(), True),
    StructField("type", StringType(), True),          # TPS_BIASA | COMPACTOR
    StructField("waste_type", StringType(), True),     # ORGANIK | PLASTIK_PET | KERTAS | LOGAM | E_WASTE | RESIDU
    StructField("volume_change_kg", DoubleType(), True),
    StructField("current_volume_kg", DoubleType(), True),
    StructField("capacity_kg", DoubleType(), True),
    StructField("fill_level", DoubleType(), True),
    StructField("tps_status", StringType(), True),
    StructField("truck_code", StringType(), True),
    StructField("facility_code", StringType(), True),
])

# Read from Kafka
df = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "aurora_tps_volume") \
    .option("startingOffsets", "latest") \
    .load()

# Parse JSON
parsed_df = df.selectExpr("CAST(value AS STRING)") \
    .select(from_json(col("value"), schema).alias("data")) \
    .select("data.*")

# Convert timestamp to proper type
parsed_df = parsed_df.withColumn("timestamp", col("timestamp").cast("timestamp"))

# === Aggregation 1: Volume by Kecamatan, 10-min window ===
agg_by_kecamatan = parsed_df \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("kecamatan"),
    ) \
    .agg(
        spark_sum("volume_change_kg").alias("total_change_kg"),
        avg("fill_level").alias("avg_fill_level"),
        count("*").alias("event_count"),
        spark_max("current_volume_kg").alias("peak_volume_kg"),
    )

# === Aggregation 2: Volume by Waste Type, 10-min window ===
agg_by_waste = parsed_df \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("waste_type"),
    ) \
    .agg(
        spark_sum("volume_change_kg").alias("total_change_kg"),
        count("*").alias("event_count"),
    )

# === Aggregation 3: Critical TPS (fill_level >= 0.9), per tick ===
critical_tps_df = parsed_df \
    .filter(col("fill_level") >= 0.9) \
    .select(
        col("timestamp"),
        col("tps_code"),
        col("tps_name"),
        col("kecamatan"),
        col("fill_level"),
        col("current_volume_kg"),
        col("capacity_kg"),
        col("tps_status"),
    )

# === Aggregation 4: Event type distribution per 10 min ===
agg_by_event_type = parsed_df \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("event_type"),
    ) \
    .agg(
        spark_sum("volume_change_kg").alias("total_change_kg"),
        count("*").alias("event_count"),
    )

# === Write to HDFS Parquet ===

# Raw events (data lake)
raw_query = parsed_df \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/raw/tps_volume/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/tps_volume_raw/") \
    .trigger(processingTime="60 seconds") \
    .start()

# Aggregated by kecamatan
kecamatan_query = agg_by_kecamatan \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/aggregated/tps_volume_by_kecamatan/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/tps_volume_kecamatan/") \
    .trigger(processingTime="60 seconds") \
    .start()

# Aggregated by waste type
waste_query = agg_by_waste \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/aggregated/tps_volume_by_waste_type/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/tps_volume_waste_type/") \
    .trigger(processingTime="60 seconds") \
    .start()

# Critical TPS
critical_query = critical_tps_df \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/aggregated/tps_critical/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/tps_critical/") \
    .trigger(processingTime="60 seconds") \
    .start()

# Event type distribution
event_type_query = agg_by_event_type \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/aggregated/event_type_distribution/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/event_type/") \
    .trigger(processingTime="60 seconds") \
    .start()

# Also print to console for debugging
console_query = parsed_df \
    .writeStream \
    .outputMode("append") \
    .format("console") \
    .option("truncate", "false") \
    .start()

print("AURORA TPS Volume Streaming started!")
print("Topics: aurora_tps_volume")
print("Output:")
print("  raw:          hdfs://namenode:8020/aurora/raw/tps_volume/")
print("  by kecamatan: hdfs://namenode:8020/aurora/aggregated/tps_volume_by_kecamatan/")
print("  by waste:     hdfs://namenode:8020/aurora/aggregated/tps_volume_by_waste_type/")
print("  critical:     hdfs://namenode:8020/aurora/aggregated/tps_critical/")
print("  event types:  hdfs://namenode:8020/aurora/aggregated/event_type_distribution/")

# Wait for termination
spark.streams.awaitAnyTermination()
