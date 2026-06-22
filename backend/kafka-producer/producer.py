import json
import time
import random
import uuid
import math
import os
import argparse
from datetime import datetime, timedelta
from kafka import KafkaProducer
from kafka.errors import KafkaError

KAFKA_BROKER = os.getenv("KAFKA_BROKER", "localhost:9092")
TOPIC_NAME = "aurora_waste_flow"

TPS_SURABAYA = [
    {"id": "TPS-001", "name": "TPS Benowo", "kecamatan": "Benowo", "capacity_m3": 50.0, "lat": -7.235, "lng": 112.625},
    {"id": "TPS-002", "name": "TPS Bratang", "kecamatan": "Gubeng", "capacity_m3": 45.0, "lat": -7.295, "lng": 112.765},
    {"id": "TPS-003", "name": "TPS Keputih", "kecamatan": "Sukolilo", "capacity_m3": 40.0, "lat": -7.290, "lng": 112.790},
    {"id": "TPS-004", "name": "TPS Wonorejo", "kecamatan": "Rungkut", "capacity_m3": 35.0, "lat": -7.320, "lng": 112.800},
    {"id": "TPS-005", "name": "TPS Jemur Wonosari", "kecamatan": "Wonocolo", "capacity_m3": 38.0, "lat": -7.340, "lng": 112.750},
    {"id": "TPS-006", "name": "TPS Tambak Osowilangun", "kecamatan": "Benowo", "capacity_m3": 42.0, "lat": -7.225, "lng": 112.655},
    {"id": "TPS-007", "name": "TPS Rungkut Industri", "kecamatan": "Rungkut", "capacity_m3": 55.0, "lat": -7.310, "lng": 112.820},
    {"id": "TPS-008", "name": "TPS Sawahan", "kecamatan": "Sawahan", "capacity_m3": 30.0, "lat": -7.280, "lng": 112.730},
    {"id": "TPS-009", "name": "TPS Gubeng", "kecamatan": "Gubeng", "capacity_m3": 32.0, "lat": -7.270, "lng": 112.755},
    {"id": "TPS-010", "name": "TPS Kenjeran", "kecamatan": "Bulak", "capacity_m3": 48.0, "lat": -7.230, "lng": 112.800},
    {"id": "TPS-011", "name": "TPS Bulak Banteng", "kecamatan": "Kenjeran", "capacity_m3": 28.0, "lat": -7.240, "lng": 112.790},
    {"id": "TPS-012", "name": "TPS Pacar Keling", "kecamatan": "Pabean Cantian", "capacity_m3": 25.0, "lat": -7.250, "lng": 112.740},
]

WASTE_TYPES = ["ORGANIK", "PLASTIK", "KERTAS", "LOGAM", "E_WASTE", "KACA", "TEKSTIL"]
WASTE_DISTRIBUTION = [0.55, 0.15, 0.10, 0.05, 0.03, 0.07, 0.05]

KECAMATAN_MULTIPILER = {
    "Benowo": 0.8,
    "Gubeng": 1.2,
    "Sukolilo": 1.1,
    "Rungkut": 1.3,
    "Wonocolo": 0.9,
    "Sawahan": 1.0,
    "Bulak": 0.85,
    "Kenjeran": 0.75,
    "Pabean Cantian": 0.95,
}

def diurnal_multiplier(hour: int) -> float:
    morning_peak = math.exp(-((hour - 8) ** 2) / 8)
    evening_peak = math.exp(-((hour - 19) ** 2) / 8)
    night_valley = 0.3 if 0 <= hour < 5 else 0.5 if 22 <= hour else 1.0
    base = 0.4 + 0.6 * (morning_peak + evening_peak)
    return max(0.2, base * night_valley)

def calculate_fill_rate(current_volume: float, capacity: float, hour: int) -> float:
    occupancy = current_volume / capacity if capacity > 0 else 0
    base_rate = 2.0 + random.uniform(-0.5, 0.5)
    if occupancy > 0.8:
        base_rate *= 0.3
    elif occupancy > 0.6:
        base_rate *= 0.6
    return base_rate * diurnal_multiplier(hour)

def generate_tps_state(tps: dict, hour: int, sim_state: dict) -> dict:
    tps_id = tps["id"]
    capacity = tps["capacity_m3"]
    
    if tps_id not in sim_state:
        initial_fill = random.uniform(0.2, 0.5) * capacity
        sim_state[tps_id] = {
            "current_volume": initial_fill,
            "truck_count": random.randint(0, 3),
        }
    
    state = sim_state[tps_id]
    fill_rate = calculate_fill_rate(state["current_volume"], capacity, hour)
    inflow = fill_rate * 100 * random.uniform(0.8, 1.2)
    outflow = random.uniform(0, 50) if state["current_volume"] > capacity * 0.3 else 0
    
    state["current_volume"] = min(capacity * 1.1, max(0, state["current_volume"] + fill_rate * 0.1))
    
    if random.random() < 0.05:
        state["truck_count"] = max(0, state["truck_count"] + random.randint(-1, 2))
    
    waste_type = random.choices(WASTE_TYPES, weights=WASTE_DISTRIBUTION)[0]
    weight_kg = random.uniform(50, 300) * diurnal_multiplier(hour)
    
    kec_mult = KECAMATAN_MULTIPILER.get(tps["kecamatan"], 1.0)
    density = 200 + random.uniform(-50, 100) * kec_mult
    
    fill_pct = (state["current_volume"] / capacity) * 100
    if fill_pct >= 90:
        status = "KRITIS"
    elif fill_pct >= 75:
        status = "WARNING"
    else:
        status = "NORMAL"
    
    return {
        "event_id": str(uuid.uuid4()),
        "timestamp": datetime.now().isoformat(),
        "tps_id": tps_id,
        "tps_name": tps["name"],
        "kecamatan": tps["kecamatan"],
        "capacity_m3": capacity,
        "current_volume_m3": round(state["current_volume"], 2),
        "fill_rate_percent_per_hour": round(fill_rate, 2),
        "inflow_rate_kg_per_hour": round(inflow, 2),
        "outflow_rate_kg_per_hour": round(outflow, 2),
        "waste_type": waste_type,
        "weight_kg": round(weight_kg, 2),
        "avg_density_kg_per_m3": round(density, 2),
        "truck_count": state["truck_count"],
        "status": status,
    }

def create_producer():
    max_retries = 5
    for attempt in range(max_retries):
        try:
            producer = KafkaProducer(
                bootstrap_servers=KAFKA_BROKER,
                value_serializer=lambda v: json.dumps(v).encode("utf-8"),
                acks="all",
                retries=3,
                retry_backoff_ms=1000,
            )
            print(f"Connected to Kafka at {KAFKA_BROKER}")
            return producer
        except KafkaError as e:
            print(f"Attempt {attempt + 1}/{max_retries}: Failed to connect to Kafka - {e}")
            if attempt < max_retries - 1:
                time.sleep(5)
    raise Exception("Failed to connect to Kafka after max retries")

def main():
    parser = argparse.ArgumentParser(description="AURORA Kafka Producer")
    parser.add_argument("--interval", type=float, default=2.0, help="Interval between messages (seconds)")
    parser.add_argument("--tps", type=str, help="Specific TPS ID to simulate")
    parser.add_argument("--speed", type=float, default=1.0, help="Speed multiplier (e.g., 10 for 10x faster)")
    args = parser.parse_args()
    
    producer = create_producer()
    sim_state = {}
    
    tps_list = TPS_SURABAYA
    if args.tps:
        tps_list = [t for t in TPS_SURABAYA if t["id"] == args.tps]
        if not tps_list:
            print(f"TPS {args.tps} not found. Available: {[t['id'] for t in TPS_SURABAYA]}")
            return
    
    print(f"Starting AURORA Kafka Producer for {len(tps_list)} TPS...")
    print(f"Interval: {args.interval}s | Speed: {args.speed}x | Topic: {TOPIC_NAME}")
    print("-" * 60)
    
    message_count = 0
    start_time = time.time()
    
    try:
        while True:
            current_hour = datetime.now().hour
            
            for tps in tps_list:
                data = generate_tps_state(tps, current_hour, sim_state)
                
                try:
                    future = producer.send(TOPIC_NAME, value=data)
                    result = future.get(timeout=10)
                    message_count += 1
                    
                    if message_count % 10 == 0:
                        elapsed = time.time() - start_time
                        rate = message_count / elapsed if elapsed > 0 else 0
                        print(f"[{datetime.now().strftime('%H:%M:%S')}] Sent {message_count} messages | Rate: {rate:.1f} msg/s | {data['tps_name']}: {data['current_volume_m3']:.1f}/{data['capacity_m3']:.0f}m³ ({(data['current_volume_m3']/data['capacity_m3']*100):.0f}%) {data['status']}")
                except KafkaError as e:
                    print(f"Error sending message: {e}")
            
            time.sleep(args.interval / args.speed)
            
    except KeyboardInterrupt:
        print("\n" + "-" * 60)
        print(f"Producer stopped. Total messages sent: {message_count}")
        elapsed = time.time() - start_time
        print(f"Average rate: {message_count/elapsed:.2f} messages/second")
        producer.flush()
        producer.close()

if __name__ == "__main__":
    main()
