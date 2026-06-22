#!/usr/bin/env python3
"""
AURORA Integration Test Script
Tests the complete data pipeline: Producer -> Kafka -> Spark -> API
"""
import json
import time
import subprocess
import sys
import requests
from datetime import datetime

KAFKA_BROKER = "localhost:9092"
API_BASE = "http://localhost:3000/api"

def print_header(msg):
    print("\n" + "=" * 60)
    print(f" {msg}")
    print("=" * 60)

def print_status(status, msg):
    icon = "✓" if status else "✗"
    color = "\033[92m" if status else "\033[91m"
    print(f"{color}{icon}\033[0m {msg}")

def check_kafka():
    print_header("Checking Kafka")
    result = subprocess.run(
        f"kafka-topics --bootstrap-server {KAFKA_BROKER} --list",
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode == 0:
        topics = [t for t in result.stdout.strip().split("\n") if t]
        print_status(True, f"Kafka connected. Topics: {topics}")
        return True
    print_status(False, "Kafka not available")
    return False

def check_topics():
    print_header("Checking Topics")
    required = ["aurora_waste_flow", "aurora_metrics", "aurora_alerts"]
    result = subprocess.run(
        f"kafka-topics --bootstrap-server {KAFKA_BROKER} --list",
        shell=True,
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        print_status(False, "Failed to list topics")
        return False
    
    existing = result.stdout.strip().split("\n")
    all_exist = all(t in existing for t in required)
    
    for topic in required:
        exists = topic in existing
        print_status(exists, f"Topic '{topic}' {'exists' if exists else 'missing'}")
    
    return all_exist

def produce_test_messages(count=10):
    print_header(f"Producing {count} Test Messages")
    
    producer_code = f'''
import json
import time
import uuid
import random
from datetime import datetime
from kafka import KafkaProducer

producer = KafkaProducer(
    bootstrap_servers="{KAFKA_BROKER}",
    value_serializer=lambda v: json.dumps(v).encode("utf-8")
)

for i in range({count}):
    data = {{
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "tps_id": f"TPS-00{{i % 12 + 1}}",
        "tps_name": f"Test TPS {{i % 12 + 1}}",
        "kecamatan": "Test",
        "capacity_m3": 40.0,
        "current_volume_m3": random.uniform(10, 35),
        "fill_rate_percent_per_hour": random.uniform(1, 5),
        "inflow_rate_kg_per_hour": random.uniform(100, 500),
        "outflow_rate_kg_per_hour": random.uniform(50, 200),
        "waste_type": "ORGANIK",
        "weight_kg": random.uniform(50, 200),
        "avg_density_kg_per_m3": 250.0,
        "truck_count": random.randint(0, 5),
        "status": "NORMAL"
    }}
    producer.send("aurora_waste_flow", value=data)
    print(f"Sent message {{i+1}}/{{count}}")

producer.flush()
producer.close()
print("Done")
'''
    
    result = subprocess.run(
        ["python", "-c", producer_code],
        capture_output=True,
        text=True,
    )
    
    if result.returncode == 0:
        print_status(True, f"Produced {count} messages")
        return True
    print_status(False, f"Failed to produce: {result.stderr}")
    return False

def consume_messages(topic, timeout=5):
    print_header(f"Consuming from {topic}")
    
    result = subprocess.run(
        f"timeout {timeout}s kafka-console-consumer --bootstrap-server {KAFKA_BROKER} --topic {topic} --from-beginning --max-messages 5",
        shell=True,
        capture_output=True,
        text=True,
    )
    
    lines = [l for l in result.stdout.strip().split("\n") if l.startswith("{")]
    if lines:
        print_status(True, f"Received {len(lines)} messages from {topic}")
        for line in lines[:2]:
            try:
                data = json.loads(line)
                print(f"  Sample: tps={data.get('tps_id', 'N/A')}, status={data.get('status', 'N/A')}")
            except:
                pass
        return True
    print_status(False, f"No messages from {topic}")
    return False

def check_api():
    print_header("Checking API Endpoints")
    
    endpoints = [
        "/metrics/wri/regions",
        "/metrics/overload/predictions",
        "/metrics/facility/utilization",
        "/metrics/alerts/active",
    ]
    
    results = []
    for endpoint in endpoints:
        try:
            response = requests.get(f"{API_BASE}{endpoint}", timeout=5)
            if response.status_code == 200:
                data = response.json()
                count = len(data.get("data", [])) if isinstance(data.get("data"), list) else 1
                print_status(True, f"{endpoint} - {count} records")
                results.append(True)
            else:
                print_status(False, f"{endpoint} - Status: {response.status_code}")
                results.append(False)
        except requests.exceptions.ConnectionError:
            print_status(False, f"{endpoint} - Connection refused")
            results.append(False)
        except Exception as e:
            print_status(False, f"{endpoint} - Error: {e}")
            results.append(False)
    
    return all(results)

def run_pipeline_test():
    print_header("AURORA Pipeline Integration Test")
    print(f"Started: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}")
    
    results = {
        "Kafka Connection": check_kafka(),
        "Topics Created": check_topics(),
        "Message Production": produce_test_messages(10),
        "Waste Flow Messages": consume_messages("aurora_waste_flow", 5),
        "API Endpoints": check_api(),
    }
    
    print_header("Test Summary")
    all_passed = True
    for test, passed in results.items():
        print_status(passed, test)
        if not passed:
            all_passed = False
    
    print("\n" + "-" * 60)
    if all_passed:
        print("\033[92m✓ All tests passed!\033[0m")
    else:
        print("\033[91m✗ Some tests failed\033[0m")
    
    return all_passed

if __name__ == "__main__":
    try:
        success = run_pipeline_test()
        sys.exit(0 if success else 1)
    except KeyboardInterrupt:
        print("\nTest interrupted")
        sys.exit(1)
