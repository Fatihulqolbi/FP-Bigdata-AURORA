#!/bin/bash
set -e

echo "================================================"
echo " AURORA Big Data Pipeline - Quick Start"
echo "================================================"
echo ""

COMPOSE_FILE="docker-compose.test.yml"

check_docker() {
    if ! command -v docker &> /dev/null; then
        echo "Error: Docker is not installed"
        exit 1
    fi
    if ! command -v docker-compose &> /dev/null && ! docker compose version &> /dev/null; then
        echo "Error: Docker Compose is not installed"
        exit 1
    fi
    echo "✓ Docker and Docker Compose are available"
}

start_services() {
    echo ""
    echo "Starting AURORA services..."
    echo "This may take a few minutes on first run..."
    echo ""
    
    docker-compose -f $COMPOSE_FILE up -d
    
    echo ""
    echo "Waiting for services to be healthy..."
    sleep 30
    
    echo ""
    echo "Checking service status..."
    docker-compose -f $COMPOSE_FILE ps
}

show_logs() {
    echo ""
    echo "Showing logs (Ctrl+C to exit)..."
    docker-compose -f $COMPOSE_FILE logs -f --tail=50
}

stop_services() {
    echo "Stopping AURORA services..."
    docker-compose -f $COMPOSE_FILE down
    echo "✓ Services stopped"
}

restart_services() {
    stop_services
    echo ""
    start_services
}

run_producer() {
    echo "Running Kafka producer locally..."
    cd kafka-producer
    pip install -q kafka-python
    python producer.py --interval 2 --speed 1
}

run_tests() {
    echo "Running pipeline tests..."
    pip install -q kafka-python requests
    python scripts/test_pipeline.py
}

case "${1:-start}" in
    start)
        check_docker
        start_services
        echo ""
        echo "================================================"
        echo " AURORA Services Started!"
        echo "================================================"
        echo ""
        echo "Services:"
        echo "  - API:         http://localhost:3000"
        echo "  - Kafka:       localhost:9092"
        echo "  - Spark UI:    http://localhost:8080"
        echo "  - HDFS UI:     http://localhost:9870"
        echo "  - MongoDB:     localhost:27017"
        echo ""
        echo "API Endpoints:"
        echo "  - Health:      GET /api/health"
        echo "  - WRI:         GET /api/metrics/wri/regions"
        echo "  - Overload:    GET /api/metrics/overload/predictions"
        echo "  - Facility:    GET /api/metrics/facility/utilization"
        echo "  - Alerts:      GET /api/metrics/alerts/active"
        echo ""
        echo "Run './start.sh logs' to view logs"
        ;;
    stop)
        stop_services
        ;;
    restart)
        check_docker
        restart_services
        ;;
    logs)
        show_logs
        ;;
    producer)
        run_producer
        ;;
    test)
        run_tests
        ;;
    *)
        echo "Usage: $0 {start|stop|restart|logs|producer|test}"
        exit 1
        ;;
esac
