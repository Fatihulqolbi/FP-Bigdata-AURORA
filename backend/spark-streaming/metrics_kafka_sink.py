from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, to_json, col, window, avg, sum, count,
    when, lit, expr, to_timestamp, max as max_col, struct
)
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, IntegerType

spark = SparkSession.builder \
    .appName("AURORA_MetricsKafka_Sink") \
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
AVG_DENSITY_KG_PER_M3 = 250.0

metrics_aggregated = parsed_df \
    .withWatermark("timestamp", "15 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan")
    ) \
    .agg(
        avg("fill_rate_percent_per_hour").alias("fill_rate_pct"),
        avg("inflow_rate_kg_per_hour").alias("inflow_rate"),
        avg("outflow_rate_kg_per_hour").alias("outflow_rate"),
        avg("capacity_m3").alias("capacity_m3"),
        avg("current_volume_m3").alias("current_volume_m3"),
        avg("avg_density_kg_per_m3").alias("density"),
        sum("truck_count").alias("truck_count"),
        count("*").alias("event_count"),
        max_col("timestamp").alias("last_update")
    ) \
    .withColumn("delta_volume", col("inflow_rate") - col("outflow_rate")) \
    .withColumn("fill_rate_norm", when(col("fill_rate_pct") > 0, col("fill_rate_pct") / 100.0).otherwise(lit(0.0))) \
    .withColumn("delta_vol_norm", when(col("delta_volume") > 0, col("delta_volume") / (col("capacity_m3") * 1000)).otherwise(lit(0.0))) \
    .withColumn("density_norm", when(col("density") > 0, col("density") / 500.0).otherwise(lit(0.0))) \
    .withColumn("wri_score",
        expr(f"{WRI_WEIGHT_FILL_RATE} * fill_rate_norm + " +
             f"{WRI_WEIGHT_TREND} * delta_vol_norm + " +
             f"{WRI_WEIGHT_DENSITY} * density_norm")
    ) \
    .withColumn("remaining_capacity_m3", col("capacity_m3") - col("current_volume_m3")) \
    .withColumn("lambda_rate",
        when((col("remaining_capacity_m3") > 0) & (col("delta_volume") > 0),
            col("delta_volume") / (col("remaining_capacity_m3") * AVG_DENSITY_KG_PER_M3)
        ).otherwise(lit(0.0))
    ) \
    .withColumn("overload_prob_24h", expr("1 - exp(-1 * lambda_rate * 24)")) \
    .withColumn("utilization_pct",
        when(col("capacity_m3") > 0, (col("current_volume_m3") / col("capacity_m3")) * 100.0).otherwise(lit(0.0))
    ) \
    .withColumn("wri_level",
        when(col("wri_score") >= 0.85, lit("CRITICAL"))
        .when(col("wri_score") >= 0.70, lit("WARNING"))
        .when(col("wri_score") >= 0.50, lit("ELEVATED"))
        .otherwise(lit("NORMAL"))
    ) \
    .withColumn("overload_level",
        when(col("overload_prob_24h") >= 0.80, lit("CRITICAL"))
        .when(col("overload_prob_24h") >= 0.50, lit("HIGH"))
        .when(col("overload_prob_24h") >= 0.30, lit("MODERATE"))
        .otherwise(lit("LOW"))
    ) \
    .withColumn("util_level",
        when(col("utilization_pct") >= 95.0, lit("OVERLOADED"))
        .when(col("utilization_pct") >= 80.0, lit("NEAR_CAPACITY"))
        .when(col("utilization_pct") >= 60.0, lit("MODERATE"))
        .otherwise(lit("NORMAL"))
    )

metrics_output = metrics_aggregated.select(
    col("window.start").alias("window_start"),
    col("window.end").alias("window_end"),
    col("tps_id"),
    col("tps_name"),
    col("kecamatan"),
    col("fill_rate_pct"),
    col("inflow_rate"),
    col("outflow_rate"),
    col("delta_volume"),
    col("capacity_m3"),
    col("current_volume_m3"),
    col("remaining_capacity_m3"),
    col("density"),
    col("wri_score"),
    col("wri_level"),
    col("lambda_rate"),
    col("overload_prob_24h"),
    col("overload_level"),
    col("utilization_pct"),
    col("util_level"),
    col("truck_count"),
    col("event_count"),
    col("last_update")
)

metrics_kafka = metrics_output \
    .withColumn("value", to_json(struct(
        col("window_start"),
        col("window_end"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan"),
        col("fill_rate_pct"),
        col("inflow_rate"),
        col("outflow_rate"),
        col("delta_volume"),
        col("capacity_m3"),
        col("current_volume_m3"),
        col("remaining_capacity_m3"),
        col("density"),
        col("wri_score"),
        col("wri_level"),
        col("lambda_rate"),
        col("overload_prob_24h"),
        col("overload_level"),
        col("utilization_pct"),
        col("util_level"),
        col("truck_count"),
        col("event_count"),
        col("last_update")
    ))) \
    .select("value")

metrics_kafka_query = metrics_kafka \
    .writeStream \
    .outputMode("update") \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("topic", "aurora_metrics") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/metrics_kafka/") \
    .trigger(processingTime="10 minutes") \
    .start()

metrics_console_query = metrics_output \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .trigger(processingTime="10 minutes") \
    .start()

spark.streams.awaitAnyTermination()
