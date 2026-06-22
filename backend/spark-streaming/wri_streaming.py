from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, window, avg, sum, count, 
    when, lit, expr, to_timestamp, max as max_col, min as min_col
)
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

spark = SparkSession.builder \
    .appName("AURORA_WRI_Streaming") \
    .config("spark.jars.packages", "org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2") \
    .getOrCreate()

spark.sparkContext.setLogLevel("WARN")

INPUT_SCHEMA = StructType([
    StructField("event_id", StringType(), True),
    StructField("timestamp", StringType(), True),
    StructField("tps_id", StringType(), True),
    StructField("tps_name", StringType(), True),
    StructField("kecamatan", StringType(), True),
    StructField("capacity_m3", DoubleType(), True),
    StructField("current_volume_m3", DoubleType(), True),
    StructField("fill_rate_percent_per_hour", DoubleType(), True),
    StructField("inflow_rate_kg_per_hour", DoubleType(), True),
    StructField("outflow_rate_kg_per_hour", DoubleType(), True),
    StructField("waste_type", StringType(), True),
    StructField("weight_kg", DoubleType(), True),
    StructField("avg_density_kg_per_m3", DoubleType(), True),
    StructField("truck_count", IntegerType(), True),
    StructField("status", StringType(), True)
])

kafka_df = spark \
    .readStream \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("subscribe", "aurora_waste_flow") \
    .option("startingOffsets", "latest") \
    .load()

parsed_df = kafka_df.selectExpr("CAST(value AS STRING)") \
    .select(from_json(col("value"), INPUT_SCHEMA).alias("data")) \
    .select("data.*") \
    .withColumn("timestamp", to_timestamp(col("timestamp")))

WRI_WEIGHT_FILL_RATE = 0.40
WRI_WEIGHT_TREND = 0.35
WRI_WEIGHT_DENSITY = 0.25

wri_windowed = parsed_df \
    .withWatermark("timestamp", "15 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("kecamatan")
    ) \
    .agg(
        avg("fill_rate_percent_per_hour").alias("mu_fill_rate"),
        (sum("inflow_rate_kg_per_hour") - sum("outflow_rate_kg_per_hour")).alias("delta_volume"),
        avg("avg_density_kg_per_m3").alias("rho_density"),
        avg("current_volume_m3").alias("avg_volume"),
        avg("capacity_m3").alias("avg_capacity"),
        count("*").alias("event_count"),
        max_col("timestamp").alias("window_end")
    ) \
    .withColumn("delta_volume_normalized", 
        when(col("delta_volume") > 0, 
            col("delta_volume") / (col("avg_capacity") * 1000)
        ).otherwise(lit(0.0))
    ) \
    .withColumn("density_normalized",
        when(col("rho_density") > 0,
            col("rho_density") / 500.0
        ).otherwise(lit(0.0))
    ) \
    .withColumn("fill_rate_normalized",
        when(col("mu_fill_rate") > 0,
            col("mu_fill_rate") / 100.0
        ).otherwise(lit(0.0))
    ) \
    .withColumn("wri_score", 
        expr(f"{WRI_WEIGHT_FILL_RATE} * fill_rate_normalized + " +
             f"{WRI_WEIGHT_TREND} * delta_volume_normalized + " +
             f"{WRI_WEIGHT_DENSITY} * density_normalized")
    ) \
    .withColumn("wri_level",
        when(col("wri_score") >= 0.85, lit("CRITICAL"))
        .when(col("wri_score") >= 0.70, lit("WARNING"))
        .when(col("wri_score") >= 0.50, lit("ELEVATED"))
        .otherwise(lit("NORMAL"))
    )

wri_output = wri_windowed.select(
    col("window.start").alias("window_start"),
    col("window.end").alias("window_end"),
    col("kecamatan"),
    col("mu_fill_rate"),
    col("delta_volume"),
    col("rho_density"),
    col("wri_score"),
    col("wri_level"),
    col("event_count"),
    col("avg_volume"),
    col("avg_capacity")
)

def write_wri_to_parquet(df, epoch_id):
    if df.count() > 0:
        df.write \
            .mode("append") \
            .partitionBy("kecamatan") \
            .parquet("hdfs://namenode:8020/aurora/metrics/wri/")

wri_query = wri_output \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .trigger(processingTime="10 minutes") \
    .start()

wri_hdfs_query = wri_output \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/metrics/wri/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/wri/") \
    .trigger(processingTime="10 minutes") \
    .start()

spark.streams.awaitAnyTermination()
