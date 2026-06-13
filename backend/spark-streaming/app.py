from pyspark.sql import SparkSession
from pyspark.sql.functions import from_json, col, window
from pyspark.sql.types import StructType, StructField, StringType, DoubleType

# Initialize Spark Session
spark = SparkSession.builder \
    .appName("AURORA_WasteFlowStreaming") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2") \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

# Define Schema
schema = StructType([
    StructField("timestamp", StringType(), True),
    StructField("tps_origin", StringType(), True),
    StructField("waste_type", StringType(), True),
    StructField("weight_kg", DoubleType(), True),
    StructField("status", StringType(), True)
])

# Read from Kafka
df = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "aurora_waste_flow") \
    .load()

# Parse JSON
parsed_df = df.selectExpr("CAST(value AS STRING)") \
    .select(from_json(col("value"), schema).alias("data")) \
    .select("data.*")

# Add Watermark and Group by Window and Waste Type
aggregated_df = parsed_df \
    .withColumn("timestamp", col("timestamp").cast("timestamp")) \
    .withWatermark("timestamp", "10 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("waste_type")
    ) \
    .sum("weight_kg") \
    .withColumnRenamed("sum(weight_kg)", "total_weight_kg")

# Write to Console (or HDFS in production)
query = aggregated_df \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .start()

# Alternatively, write to HDFS as Parquet
hdfs_query = parsed_df \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/waste_data/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/") \
    .start()

query.awaitTermination()
