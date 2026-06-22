from pyspark.sql import SparkSession
from pyspark.sql.functions import (
    from_json, col, window, avg, sum, count,
    when, lit, expr, to_timestamp, max as max_col, min as min_col,
    concat, current_timestamp, to_json, struct
)
from pyspark.sql.types import StructType, StructField, StringType, DoubleType, TimestampType, IntegerType

spark = SparkSession.builder \
    .appName("AURORA_AlertDetection_Streaming") \
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

alerts_windowed = parsed_df \
    .withWatermark("timestamp", "15 minutes") \
    .groupBy(
        window(col("timestamp"), "10 minutes"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan")
    ) \
    .agg(
        avg("fill_rate_percent_per_hour").alias("mu_fill_rate"),
        (sum("inflow_rate_kg_per_hour") - sum("outflow_rate_kg_per_hour")).alias("delta_volume"),
        avg("avg_density_kg_per_m3").alias("rho_density"),
        avg("capacity_m3").alias("capacity_m3"),
        avg("current_volume_m3").alias("current_volume_m3"),
        avg("inflow_rate_kg_per_hour").alias("avg_inflow_rate"),
        avg("outflow_rate_kg_per_hour").alias("avg_outflow_rate"),
        max_col("timestamp").alias("last_update"),
        count("*").alias("event_count")
    )

alerts_with_metrics = alerts_windowed \
    .withColumn("fill_rate_normalized",
        when(col("mu_fill_rate") > 0, col("mu_fill_rate") / 100.0).otherwise(lit(0.0))
    ) \
    .withColumn("delta_volume_normalized",
        when(col("delta_volume") > 0, col("delta_volume") / (col("capacity_m3") * 1000)).otherwise(lit(0.0))
    ) \
    .withColumn("density_normalized",
        when(col("rho_density") > 0, col("rho_density") / 500.0).otherwise(lit(0.0))
    ) \
    .withColumn("wri_score",
        expr(f"{WRI_WEIGHT_FILL_RATE} * fill_rate_normalized + " +
             f"{WRI_WEIGHT_TREND} * delta_volume_normalized + " +
             f"{WRI_WEIGHT_DENSITY} * density_normalized")
    ) \
    .withColumn("remaining_capacity_m3", col("capacity_m3") - col("current_volume_m3")) \
    .withColumn("rate_diff_kg_per_hour", col("avg_inflow_rate") - col("avg_outflow_rate")) \
    .withColumn("lambda_rate",
        when((col("remaining_capacity_m3") > 0) & (col("rate_diff_kg_per_hour") > 0),
            col("rate_diff_kg_per_hour") / (col("remaining_capacity_m3") * AVG_DENSITY_KG_PER_M3)
        ).otherwise(lit(0.0))
    ) \
    .withColumn("overload_prob_24h",
        expr("1 - exp(-1 * lambda_rate * 24)")
    ) \
    .withColumn("utilization_pct",
        when(col("capacity_m3") > 0,
            (col("current_volume_m3") / col("capacity_m3")) * 100.0
        ).otherwise(lit(0.0))
    )

alerts_df = alerts_with_metrics \
    .withColumn("wri_alert_type",
        when(col("wri_score") >= 0.85, lit("CRITICAL"))
        .when(col("wri_score") >= 0.70, lit("WARNING"))
        .otherwise(lit("NONE"))
    ) \
    .withColumn("overload_alert_type",
        when(col("overload_prob_24h") >= 0.80, lit("CRITICAL"))
        .when(col("overload_prob_24h") >= 0.50, lit("HIGH"))
        .otherwise(lit("NONE"))
    ) \
    .withColumn("utilization_alert_type",
        when(col("utilization_pct") >= 95.0, lit("OVERLOADED"))
        .when(col("utilization_pct") >= 80.0, lit("NEAR_CAPACITY"))
        .otherwise(lit("NONE"))
    ) \
    .withColumn("alert_severity_score",
        when(col("wri_alert_type") == "CRITICAL", 3)
        .when(col("wri_alert_type") == "WARNING", 2)
        .otherwise(0) +
        when(col("overload_alert_type") == "CRITICAL", 3)
        .when(col("overload_alert_type") == "HIGH", 2)
        .otherwise(0) +
        when(col("utilization_alert_type") == "OVERLOADED", 3)
        .when(col("utilization_alert_type") == "NEAR_CAPACITY", 2)
        .otherwise(0)
    )

alerts_df = alerts_df \
    .withColumn("has_alert", col("alert_severity_score") > 0) \
    .withColumn("combined_alert_level",
        when(col("alert_severity_score") >= 6, lit("CRITICAL"))
        .when(col("alert_severity_score") >= 4, lit("HIGH"))
        .when(col("alert_severity_score") >= 2, lit("WARNING"))
        .otherwise(lit("NORMAL"))
    ) \
    .withColumn("alert_message",
        when(col("has_alert"),
            concat(
                lit("TPS "), col("tps_name"),
                when(col("wri_alert_type") != "NONE", concat(lit(" | WRI: "), col("wri_alert_type"))).otherwise(lit("")),
                when(col("overload_alert_type") != "NONE", concat(lit(" | Overload: "), col("overload_alert_type"))).otherwise(lit("")),
                when(col("utilization_alert_type") != "NONE", concat(lit(" | Util: "), col("utilization_alert_type"))).otherwise(lit(""))
            )
        ).otherwise(lit(""))
    )

alerts_output = alerts_df.filter(col("has_alert")).select(
    col("window.start").alias("window_start"),
    col("window.end").alias("window_end"),
    col("tps_id"),
    col("tps_name"),
    col("kecamatan"),
    col("wri_score"),
    col("wri_alert_type"),
    col("overload_prob_24h"),
    col("overload_alert_type"),
    col("utilization_pct"),
    col("utilization_alert_type"),
    col("combined_alert_level"),
    col("alert_severity_score"),
    col("alert_message"),
    col("avg_inflow_rate"),
    col("avg_outflow_rate"),
    col("current_volume_m3"),
    col("capacity_m3"),
    col("event_count"),
    col("last_update")
)

alerts_json = alerts_output \
    .withColumn("value", to_json(struct(
        col("window_start"),
        col("window_end"),
        col("tps_id"),
        col("tps_name"),
        col("kecamatan"),
        col("wri_score"),
        col("wri_alert_type"),
        col("overload_prob_24h"),
        col("overload_alert_type"),
        col("utilization_pct"),
        col("utilization_alert_type"),
        col("combined_alert_level"),
        col("alert_severity_score"),
        col("alert_message"),
        col("avg_inflow_rate"),
        col("avg_outflow_rate"),
        col("current_volume_m3"),
        col("capacity_m3"),
        col("event_count"),
        col("last_update")
    )))

alerts_console_query = alerts_output \
    .writeStream \
    .outputMode("update") \
    .format("console") \
    .option("truncate", "false") \
    .trigger(processingTime="5 minutes") \
    .start()

alerts_hdfs_query = alerts_output \
    .writeStream \
    .outputMode("append") \
    .format("parquet") \
    .option("path", "hdfs://namenode:8020/aurora/metrics/alerts/") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/alerts/") \
    .trigger(processingTime="5 minutes") \
    .start()

alerts_kafka_query = alerts_json \
    .select("value") \
    .writeStream \
    .outputMode("update") \
    .format("kafka") \
    .option("kafka.bootstrap.servers", "kafka:29092") \
    .option("topic", "aurora_alerts") \
    .option("checkpointLocation", "hdfs://namenode:8020/aurora/checkpoints/alerts_kafka/") \
    .trigger(processingTime="5 minutes") \
    .start()

spark.streams.awaitAnyTermination()
