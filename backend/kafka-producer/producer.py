import json
import time
import random
from kafka import KafkaProducer
from datetime import datetime

# Initialize Kafka Producer
producer = KafkaProducer(
    bootstrap_servers='localhost:9092',
    value_serializer=lambda v: json.dumps(v).encode('utf-8')
)

TOPIC_NAME = 'aurora_waste_flow'
TPS_LIST = ['TPS Benowo', 'TPS Bratang', 'TPS Keputih', 'TPS Wonorejo']
WASTE_TYPES = ['Organik', 'Plastik', 'Kertas', 'Logam', 'E-Waste']

print("Starting AURORA Kafka Producer...")

while True:
    data = {
        'timestamp': datetime.now().isoformat(),
        'tps_origin': random.choice(TPS_LIST),
        'waste_type': random.choice(WASTE_TYPES),
        'weight_kg': round(random.uniform(10.0, 500.0), 2),
        'status': 'Menuju Sorting Hub'
    }
    
    producer.send(TOPIC_NAME, value=data)
    print(f"Sent: {data}")
    time.sleep(1) # Send 1 event per second
