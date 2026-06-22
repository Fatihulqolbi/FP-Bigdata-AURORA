from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, window, avg, sum, count,
    when, lit, expr, to_timestamp, max as max_col, min as min_col
)
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

spark = SparkSession.builder \
    .appName("AURORA_OverloadPrediction_Streaming") \
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

AVG_DENSITY_KG_PER_M3 = 250.0
CONVERSION_FACTOR = 1000.0

overload_windowed = parsed_df \
    .withWatermark("timestamp", "15 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan")
    ) \
    .agg(
        avg("capacity_m3").alias("capacity_m3"),
        avg("current_volume_m3").alias("current_volume_m3"),
        avg("inflow_rate_kg_per_hour").alias("avg_inflow_rate"),
        avg("outflow_rate_kg_per_hour").alias("avg_outflow_rate"),
        avg("fill_rate_percent_per_hour").alias("fill_rate_pct"),
        avg("avg_density_kg_per_m3").alias("density"),
        max_col("timestamp").alias("last_update"),
        count("*").alias("event_count")
    ) \
    .withColumn("current_volume_kg", col("current_volume_m3") * col("density")) \
    .withColumn("capacity_kg", col("capacity_m3") * AVG_DENSITY_KG_PER_M3) \
    .withColumn("remaining_capacity_kg", col("capacity_kg") - col("current_volume_kg")) \
    .withColumn("rate_diff_kg_per_hour", col("avg_inflow_rate") - col("avg_outflow_rate")) \
    .withColumn("lambda_rate",
        when(col("remaining_capacity_kg") > 0,
            col("rate_diff_kg_per_hour") / col("remaining_capacity_kg")
        ).otherwise(lit(10.0))
    ) \
    .withColumn("hours_to_overload",
        when((col("rate_diff_kg_per_hour") > 0) & (col("remaining_capacity_kg") > 0),
            col("remaining_capacity_kg") / col("rate_diff_kg_per_hour")
        ).otherwise(lit(999.0))
    )

PREDICTION_HORIZONS = [6, 12, 24, 48]

overload_predictions = overload_windowed

for hours in PREDICTION_HORIZONS:
    overload_predictions = overload_predictions \
        .withColumn(f"overload_prob_{hours}h",
            when(col("hours_to_overload") <= hours,
                lit(1.0)
            ).otherwise(
                expr(f"1 - exp(-1 * lambda_rate * {hours})")
            )
        )

overload_predictions = overload_predictions \
    .withColumn("max_overload_prob",
        expr("greatest(overload_prob_6h, overload_prob_12h, overload_prob_24h, overload_prob_48h)")
    ) \
    .withColumn("alert_level",
        when(col("overload_prob_24h") >= 0.80, lit("CRITICAL"))
        .when(col("overload_prob_24h") >= 0.50, lit("HIGH"))
        .when(col("overload_prob_24h") >= 0.30, lit("MODERATE"))
        .when(col("overload_prob_24h") >= 0.15, lit("LOW"))
        .otherwise(lit("MINIMAL"))
    ) \
    .withColumn("estimated_overload_hours",
        when(col("hours_to_overload") < 999,
            col("hours_to_overload")
        ).otherwise(lit(-1.0))
    )

overload_output = overload_predictions.select(
    col("window.start").alias("window_start"),
    col("window.end").alias("window_end"),
    col("tps_id"),
    col("tps_name"),
    col("kecamatan"),
    col("capacity_m3"),
    col("current_volume_m3"),
    col("fill_rate_pct"),
    col("avg_inflow_rate"),
    col("avg_outflow_rate"),
    col("hours_to_overload"),
    col("lambda_rate"),
    col("overload_prob_6h"),
    col("overload_prob_12h"),
    col("overload_prob_24h"),
    col("overload_prob_48h"),
    col("max_overload_prob"),
    col("alert_level"),
    col("event_count"),
    col("last_update")
)

overload_console_query = overload_output \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .trigger(processingTime="10 minutes") \
    .start()

overload_hdfs_query = overload_output \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/metrics/overload/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/overload/") \
    .trigger(processingTime="10 minutes") \
    .start()

spark.streams.awaitAnyTermination()
