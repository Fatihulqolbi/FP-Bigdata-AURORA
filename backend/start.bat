@echo off
setlocal EnableDelayedExpansion

echo ================================================
echo  AURORA Big Data Pipeline - Quick Start (Windows)
echo ================================================
echo.

set COMPOSE_FILE=docker-compose.test.yml

if "%1"=="" goto start
if "%1"=="start" goto start
if "%1"=="stop" goto stop
if "%1"=="restart" goto restart
if "%1"=="logs" goto logs
if "%1"=="test" goto test
goto usage

:start
echo Checking Docker...
docker --version >nul 2>&1
if errorlevel 1 (
    echo Error: Docker is not installed or not running
    exit /b 1
)
echo   Docker is available
echo.

echo Starting AURORA services...
echo This may take a few minutes on first run...
echo.

docker-compose -f %COMPOSE_FILE% up -d

echo.
echo Waiting for services to be healthy...
timeout /t 30 /nobreak >nul

echo.
echo Checking service status...
docker-compose -f %COMPOSE_FILE% ps

echo.
echo ================================================
echo  AURORA Services Started!
echo ================================================
echo.
echo Services:
echo   - API:         http://localhost:3000
echo   - Kafka:       localhost:9092
echo   - Spark UI:    http://localhost:8080
echo   - HDFS UI:     http://localhost:9870
echo   - MongoDB:     localhost:27017
echo.
echo API Endpoints:
echo   - Health:      GET /api/health
echo   - WRI:         GET /api/metrics/wri/regions
echo   - Overload:    GET /api/metrics/overload/predictions
echo   - Facility:    GET /api/metrics/facility/utilization
echo   - Alerts:      GET /api/metrics/alerts/active
echo.
goto end

:stop
echo Stopping AURORA services...
docker-compose -f %COMPOSE_FILE% down
echo   Services stopped
goto end

:restart
call :stop
echo.
call :start
goto end

:logs
echo Showing logs (Ctrl+C to exit)...
docker-compose -f %COMPOSE_FILE% logs -f --tail=50
goto end

:test
echo Running pipeline tests...
pip install -q kafka-python requests
python scripts/test_pipeline.py
goto end

:usage
echo Usage: %0 {start^|stop^|restart^|logs^|test}
exit /b 1

:end
endlocal
