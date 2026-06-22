#!/usr/bin/env python3
"""
AURORA Spark Streaming - Unified Entry Point
Runs all streaming jobs in a single process for local development
"""
import subprocess
import sys
import time
import signal
import os

SPARK_MASTER = os.getenv("SPARK_MASTER", "spark://spark-master:7077")
KAFKA_PACKAGE = "org.apache.spark:spark-sql-kafka-0-10_2.12:3.3.2"

STREAMING_JOBS = [
    "wri_streaming.py",
    "overload_streaming.py",
    "facility_utilization_streaming.py",
    "alert_streaming.py",
    "metrics_kafka_sink.py"
]

processes = []

def signal_handler(sig, frame):
    print("\nShutting down all streaming jobs...")
    for p in processes:
        if p.poll() is None:
            p.terminate()
            p.wait()
    print("All jobs terminated.")
    sys.exit(0)

def wait_for_kafka(kafka_broker="kafka:29092", timeout=60):
    print(f"Waiting for Kafka at {kafka_broker}...")
    import socket
    start = time.time()
    host, port = kafka_broker.split(":")
    while time.time() - start < timeout:
        try:
            sock = socket.socket(socket.AF_INET, socket.SOCK_STREAM)
            sock.settimeout(1)
            result = sock.connect_ex((host, int(port)))
            sock.close()
            if result == 0:
                print("Kafka is ready!")
                return True
        except:
            pass
        time.sleep(2)
    print("Timeout waiting for Kafka")
    return False

def submit_job(job_name):
    script_dir = os.path.dirname(os.path.abspath(__file__))
    job_path = os.path.join(script_dir, job_name)
    
    cmd = [
        "spark-submit",
        "--master", SPARK_MASTER,
        "--packages", KAFKA_PACKAGE,
        "--conf", "spark.streaming.backpressure.enabled=true",
        "--conf", "spark.streaming.kafka.maxRatePerPartition=1000",
        "--conf", "spark.executor.memory=1g",
        "--conf", "spark.driver.memory=1g",
        job_path
    ]
    
    print(f"Submitting: {job_name}")
    p = subprocess.Popen(cmd, stdout=subprocess.PIPE, stderr=subprocess.STDOUT, text=True)
    processes.append(p)
    return p

if __name__ == "__main__":
    signal.signal(signal.SIGINT, signal_handler)
    signal.signal(signal.SIGTERM, signal_handler)
    
    if len(sys.argv) > 1:
        if sys.argv[1] == "--single":
            wait_for_kafka()
            for job in sys.argv[2:]:
                if job in STREAMING_JOBS:
                    submit_job(job)
                else:
                    print(f"Unknown job: {job}")
                    print(f"Available: {', '.join(STREAMING_JOBS)}")
                    sys.exit(1)
        elif sys.argv[1] == "--list":
            print("Available streaming jobs:")
            for job in STREAMING_JOBS:
                print(f"  - {job}")
            sys.exit(0)
        else:
            print("Usage:")
            print("  python run_all_jobs.py              # Run all jobs")
            print("  python run_all_jobs.py --single <job1> <job2>  # Run specific jobs")
            print("  python run_all_jobs.py --list       # List available jobs")
            sys.exit(1)
    else:
        wait_for_kafka()
        for job in STREAMING_JOBS:
            submit_job(job)
        print(f"All {len(STREAMING_JOBS)} streaming jobs submitted!")
    
    for p in processes:
        if p.poll() is None:
            for line in iter(p.stdout.readline, ""):
                if line:
                    print(line, end="")
    
    for p in processes:
        p.wait()
