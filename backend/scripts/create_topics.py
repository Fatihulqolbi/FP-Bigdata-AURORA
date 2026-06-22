#!/usr/bin/env python3
import subprocess
import sys
import time
import os

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
ZOOKEEPER = os.getenv("ZOOKEEPER", "localhost:2181")

TOPICS = [
    {"name": "aurora_waste_flow", "partitions": 3, "replication": 1},
    {"name": "aurora_metrics", "partitions": 3, "replication": 1},
    {"name": "aurora_alerts", "partitions": 3, "replication": 1},
]

def run_command(cmd, check=True):
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if check and result.returncode != 0:
        print(f"Error: {result.stderr}")
        return False
    return True

def wait_for_kafka(max_retries=30, delay=5):
    print("Waiting for Kafka to be ready...")
    for i in range(max_retries):
        result = subprocess.run(
            f"kafka-topics --bootstrap-server {KAFKA_BROKER} --list",
            shell=True,
            capture_output=True,
            text=True,
        )
        if result.returncode == 0:
            print("Kafka is ready!")
            return True
        print(f"Attempt {i+1}/{max_retries}: Kafka not ready, waiting {delay}s...")
        time.sleep(delay)
    return False

def create_topics():
    for topic in TOPICS:
        cmd = f"kafka-topics --bootstrap-server {KAFKA_BROKER} --create --if-not-exists --topic {topic['name']} --partitions {topic['partitions']} --replication-factor {topic['replication']}"
        print(f"Creating topic: {topic['name']}...")
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"  Created: {topic['name']}")
        elif "already exists" in result.stderr.lower():
            print(f"  Already exists: {topic['name']}")
        else:
            print(f"  Error: {result.stderr}")

def list_topics():
    print("\nAvailable topics:")
    cmd = f"kafka-topics --bootstrap-server {KAFKA_BROKER} --list"
    result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
    if result.returncode == 0:
        for line in result.stdout.strip().split("\n"):
            if line:
                print(f"  - {line}")

def describe_topics():
    print("\nTopic details:")
    for topic in TOPICS:
        cmd = f"kafka-topics --bootstrap-server {KAFKA_BROKER} --describe --topic {topic['name']}"
        result = subprocess.run(cmd, shell=True, capture_output=True, text=True)
        if result.returncode == 0:
            print(f"\n{result.stdout}")

def main():
    if len(sys.argv) > 1:
        if sys.argv[1] == "--list":
            list_topics()
        elif sys.argv[1] == "--describe":
            describe_topics()
        elif sys.argv[1] == "--delete":
            for topic in TOPICS:
                cmd = f"kafka-topics --bootstrap-server {KAFKA_BROKER} --delete --topic {topic['name']}"
                print(f"Deleting: {topic['name']}...")
                subprocess.run(cmd, shell=True)
        else:
            print(f"Unknown command: {sys.argv[1]}")
            print("Usage: python create_topics.py [--list|--describe|--delete]")
    else:
        if not wait_for_kafka():
            print("Failed to connect to Kafka")
            sys.exit(1)
        create_topics()
        list_topics()

if __name__ == "__main__":
    main()
