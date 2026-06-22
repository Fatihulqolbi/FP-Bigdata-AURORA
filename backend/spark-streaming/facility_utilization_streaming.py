from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, window, avg, sum, count,
    when, lit, expr, to_timestamp, max as max_col, min as min_col,
    coalesce, greatest
)
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

spark = SparkSession.builder \
    .appName("AURORA_FacilityUtilization_Streaming") \
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

FACILITY_DAILY_CAPACITY = {
    "PLTSa_BENOWO": 1000000.0,
    "TPA_BENOWO": 2000000.0,
    "SORTING_BRATANG": 500000.0,
    "SORTING_KEPUTIH": 450000.0,
    "COMPOST_WONOREJO": 300000.0,
    "RECYCLING_SUWARINGIN": 250000.0
}

FACILITY_TYPES = {
    "PLTSa_BENOWO": "INCINERATOR",
    "TPA_BENOWO": "LANDFILL",
    "SORTING_BRATANG": "SORTING_HUB",
    "SORTING_KEPUTIH": "SORTING_HUB",
    "COMPOST_WONOREJO": "COMPOSTING",
    "RECYCLING_SUWARINGIN": "RECYCLING"
}

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

facility_windowed = parsed_df \
    .withWatermark("timestamp", "25 hours") \
    .groupBy(
        window(col("timestamp"), "1 hour"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan")
    ) \
    .agg(
        sum("outflow_rate_kg_per_hour").alias("processed_kg_1h"),
        sum("inflow_rate_kg_per_hour").alias("received_kg_1h"),
        avg("current_volume_m3").alias("current_volume_m3"),
        avg("capacity_m3").alias("capacity_m3"),
        sum("truck_count").alias("truck_count_1h"),
        count("*").alias("event_count"),
        max_col("timestamp").alias("last_update")
    )

facility_utilization = facility_windowed \
    .withColumn("daily_capacity_kg", lit(500000.0)) \
    .withColumn("processed_24h_estimate", col("processed_kg_1h") * 24) \
    .withColumn("in_transit_estimate", col("received_kg_1h") * 2) \
    .withColumn("utilization_numerator", 
        col("processed_24h_estimate") + col("in_transit_estimate")
    ) \
    .withColumn("utilization_rate",
        when(col("daily_capacity_kg") > 0,
            (col("utilization_numerator") / col("daily_capacity_kg")) * 100.0
        ).otherwise(lit(0.0))
    ) \
    .withColumn("capacity_used_pct",
        when(col("capacity_m3") > 0,
            (col("current_volume_m3") / col("capacity_m3")) * 100.0
        ).otherwise(lit(0.0))
    ) \
    .withColumn("throughput_efficiency",
        when(col("received_kg_1h") > 0,
            (col("processed_kg_1h") / col("received_kg_1h")) * 100.0
        ).otherwise(lit(100.0))
    )

facility_utilization = facility_utilization \
    .withColumn("utilization_status",
        when(col("utilization_rate") >= 95.0, lit("OVERLOADED"))
        .when(col("utilization_rate") >= 80.0, lit("NEAR_CAPACITY"))
        .when(col("utilization_rate") >= 60.0, lit("MODERATE"))
        .when(col("utilization_rate") >= 40.0, lit("NORMAL"))
        .otherwise(lit("LOW"))
    ) \
    .withColumn("available_capacity_kg",
        col("daily_capacity_kg") - col("processed_24h_estimate")
    ) \
    .withColumn("hours_until_full",
        when((col("received_kg_1h") - col("processed_kg_1h")) > 0,
            col("available_capacity_kg") / (col("received_kg_1h") - col("processed_kg_1h"))
        ).otherwise(lit(-1.0))
    )

facility_output = facility_utilization.select(
    col("window.start").alias("window_start"),
    col("window.end").alias("window_end"),
    col("tps_id").alias("facility_id"),
    col("tps_name").alias("facility_name"),
    col("kecamatan"),
    col("processed_kg_1h"),
    col("received_kg_1h"),
    col("processed_24h_estimate"),
    col("in_transit_estimate"),
    col("daily_capacity_kg"),
    col("utilization_rate"),
    col("capacity_used_pct"),
    col("throughput_efficiency"),
    col("utilization_status"),
    col("available_capacity_kg"),
    col("hours_until_full"),
    col("truck_count_1h"),
    col("event_count"),
    col("last_update")
)

facility_console_query = facility_output \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .trigger(processingTime="1 hour") \
    .start()

facility_hdfs_query = facility_output \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/metrics/facility_utilization/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/facility_utilization/") \
    .trigger(processingTime="1 hour") \
    .start()

spark.streams.awaitAnyTermination()
