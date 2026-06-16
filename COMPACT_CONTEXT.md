# AURORA — Compact Context Document

## Project Overview
**AURORA** is a Surabaya Smart Waste Management & Big Data Pipeline platform.  
**Stack:** React + TypeScript (Vite), Node.js + Express + Prisma (MongoDB), Apache Kafka, Spark Streaming, HDFS, OSRM routing.

**Repo:** `D:\Github\FP-Bigdata-AURORA`  
**Backend:** `D:\Github\FP-Bigdata-AURORA\backend\api` — `npx tsx src/index.ts` (port 4000)  
**Frontend:** `D:\Github\FP-Bigdata-AURORA\dashboard` — `npm run dev` (port 5173)  
**MongoDB:** localhost:27017, database `aurora_marketplace`  
**All demo passwords:** `password123`  
**Admin:** `admin@aurora.go.id`

---

## Architecture

```
IoT/TPS → Kafka → Spark Streaming → HDFS (Parquet)
                ↓
        Backend API (Express + Prisma + MongoDB)
                ↓
        Frontend (React + Leaflet + Recharts)
                ↓
        OSRM Routing Engine (public: router.project-osrm.org)
                ↓
        TomTom Traffic API (congestion detection)
```

---

## Roles & Access

| Role | Sidebar Tabs | Description |
|---|---|---|
| ADMIN | Realtime Monitor, Armada & Rute, Sorting Hub, Data Pipeline, Manajemen TPS, Manajemen Akun, Marketplace, Pengaturan | Full access |
| DRIVER | Dashboard Supir, Pengaturan | Truck claim + workflow only |
| Others | Marketplace, Pengaturan | Marketplace only |

---

## Key Files — Backend

### Auth Module
| File | Purpose |
|---|---|
| `src/modules/auth/auth.routes.ts` | Auth routes + admin user CRUD |
| `src/modules/auth/auth.controller.ts` | register, login, adminCreateUser, listUsers, adminUpdateUser, adminDeleteUser |
| `src/modules/auth/auth.service.ts` | Business logic for auth + user management |
| `src/middleware/auth.ts` | JWT auth middleware, `requireAuth`, `AuthRequest` |
| `src/middleware/rbac.ts` | `requireRole`, `getUserPermissions` |

### Fleet Module
| File | Purpose |
|---|---|
| `src/modules/fleet/fleet.routes.ts` | Fleet + driver routes (SSE, truck CRUD, driver workflow) |
| `src/modules/fleet/fleet.controller.ts` | Fleet status, truck list, assign, updateLocation |
| `src/modules/fleet/fleet.service.ts` | Fleet status aggregation, truck queries |
| `src/modules/fleet/driver.controller.ts` | Driver workflow: me, claim, release, start, arrive, loading, complete, arrive-hub, unload |
| `src/modules/fleet/route.service.ts` | OSRM client (multi-server fallback), `getRoute`, `interpolateAlongRoute`, `checkOsrmHealth` |
| `src/modules/fleet/truck.simulation.ts` | 5s tick: move trucks, assign AVAILABLE trucks with multi-TPS smart scoring |
| `src/modules/fleet/fleet.sse.ts` | SSE endpoint `/api/fleet/live` — broadcasts truck positions |
| `src/modules/fleet/traffic.service.ts` | TomTom Traffic Flow API integration |

### Pipeline Module
| File | Purpose |
|---|---|
| `src/modules/pipeline/pipeline.routes.ts` | `/api/pipeline/status`, `/stats`, `/events`, `/hdfs` |
| `src/modules/pipeline/pipeline.controller.ts` | Controller for pipeline endpoints |
| `src/modules/pipeline/pipeline.service.ts` | Health checks (Kafka TCP, Spark HTTP, HDFS, OSRM, MongoDB), events, HDFS file browser |

### Analytics Module
| File | Purpose |
|---|---|
| `src/modules/analytics/analytics.routes.ts` | `/api/analytics/tps-summary`, `/critical-tps`, `/waste-types` |
| `src/modules/analytics/analytics.service.ts` | HDFS-first, MongoDB-fallback analytics |

### Marketplace Module
| File | Purpose |
|---|---|
| `src/modules/marketplace/tps.simulation.ts` | 60s tick: TPS volume simulation + Kafka publish |
| `src/modules/marketplace/tps.kafka.ts` | Kafka producer for `aurora_tps_volume` topic |
| `src/modules/marketplace/tps.routes.ts` | TPS CRUD + verify |
| `src/modules/marketplace/tps.controller.ts` | TPS controller |
| `src/modules/marketplace/tps.service.ts` | TPS service |

### Prisma Schema
| File | Purpose |
|---|---|
| `prisma/schema.prisma` | All models: User, Tps, Truck (with driverId, route, routeWaypoints), SortingHub, etc. |
| `prisma/seed-trucks.ts` | Seed 152 trucks across 4 depots |
| `prisma/seed-facilities.ts` | Seed 14 facilities (1 PLTSa + 13 TPS3R) |
| `prisma/seed-all.ts` | Combined seed |
| `prisma/reset-trucks.ts` | Reset all trucks to AVAILABLE at depots |

### Config
| File | Purpose |
|---|---|
| `.env` | DATABASE_URL, JWT_SECRET, PORT, OSRM_BASE_URL, TOMTOM_API_KEY, KAFKA_BROKERS |
| `.env.example` | Template with all env vars documented |

---

## Key Files — Frontend

### Pages
| File | Purpose |
|---|---|
| `src/App.tsx` | Main app, sidebar, tab routing, simulation state |
| `src/pages/LogisticsPage.tsx` | Fleet map with floating live feed overlay |
| `src/pages/DriverPage.tsx` | Driver workflow: claim truck → navigate → load → deliver |
| `src/pages/TpsManagement.tsx` | TPS CRUD + verification + map |
| `src/pages/UserManagement.tsx` | Admin user CRUD (create, edit, suspend, activate) |
| `src/pages/PipelineDashboard.tsx` | Pipeline monitoring: service status, data flow, events, HDFS browser |
| `src/pages/SettingsPage.tsx` | User settings |

### Fleet Components
| File | Purpose |
|---|---|
| `src/features/fleet/components/FleetMap.tsx` | Leaflet map with trucks, TPS, facilities, route polylines, waypoint markers, depot markers |
| `src/features/fleet/components/TruckPanel.tsx` | Truck list panel with filters, status, progress bars |
| `src/features/fleet/api/fleetApi.ts` | Fleet API client + types (TruckData, TpsData, FacilityData, WaypointStop) |
| `src/features/fleet/hooks/useFleetStream.ts` | SSE hook for real-time truck/TPS updates |

### Monitoring Components
| File | Purpose |
|---|---|
| `src/features/monitoring/pages/RealtimeDashboard.tsx` | Dashboard with charts, map, weather, stats |
| `src/features/monitoring/pages/PredictionTable.tsx` | TPS prediction table + TPS3R waste report |
| `src/features/monitoring/pages/WeatherCard.tsx` | Surabaya weather card |
| `src/features/monitoring/pages/types.ts` | TpsNode, TruckSim interfaces |

### Marketplace
| File | Purpose |
|---|---|
| `src/features/marketplace/api/marketplaceApi.ts` | All API calls: auth, tps, analytics, fleet, driver, pipeline |
| `src/features/marketplace/MarketplaceLayout.tsx` | Marketplace UI |
| `src/contexts/AuthContext.tsx` | Auth context with login/register/logout |

---

## Prisma Schema — Key Models

### Truck
```prisma
model Truck {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  code            String   @unique        // TRK-C-001, TRK-D-001, TRK-A-001
  name            String
  type            String                  // COMPACTOR | DUMP_TRUCK | ARM_ROLL
  capacityKg      Float                   // 16000 | 20000 | 10000
  currentLoadKg   Float    @default(0)
  status          String   @default("AVAILABLE") // AVAILABLE | EN_ROUTE_TO_TPS | LOADING | EN_ROUTE_TO_HUB | UNLOADING
  lat             Float?
  lng             Float?
  heading         Float?
  driverId        String?  @db.ObjectId    // Links to User (DRIVER role)
  assignedTpsId   String?  @db.ObjectId
  destinationLat  Float?
  destinationLng  Float?
  facilityId      String?  @db.ObjectId
  route           Json?                   // GeoJSON LineString geometry
  routeProgress   Float    @default(0)    // 0.0 to 1.0
  routeDistance   Float?                  // meters
  routeDuration   Float?                  // seconds
  routeWaypoints  Json?                   // [{tpsId, tpsName, tpsLat, tpsLng, collectedKg}]
  @@map("trucks")
}
```

### Tps
```prisma
model Tps {
  id             String   @id @default(auto()) @map("_id") @db.ObjectId
  code           String   @unique
  name           String
  kecamatan      String
  lat            Float
  lng            Float
  capacityKg     Float    @default(0)
  currentVolume  Float    @default(0)
  status         String   @default("AKTIF") // AKTIF | WASPADA | PENUH | NONAKTIF
  type           String   @default("TPS_BIASA") // TPS_BIASA | COMPACTOR | TPS3R
  needsReview    Boolean  @default(true)
  @@map("tps")
}
```

### SortingHub
```prisma
model SortingHub {
  id            String   @id @default(auto()) @map("_id") @db.ObjectId
  code          String   @unique
  name          String
  type          String   // PLTSa | TPS3R | TRANSFER_STATION | etc.
  lat           Float
  lng           Float
  capacityKg    Float
  currentLoadKg Float    @default(0)
  acceptsTypes  String[] @default([])
  @@map("sorting_hubs")
}
```

### User (key fields)
```prisma
model User {
  id            String        @id @default(auto()) @map("_id") @db.ObjectId
  email         String        @unique
  passwordHash  String
  role          Role          // ADMIN | ADMIN_TPS | BANK_SAMPAH | INDUSTRI | WARGA | UMKM | DRIVER
  status        AccountStatus // PENDING_VERIFICATION | ACTIVE | SUSPENDED | REJECTED
  name          String
  @@map("users")
}
```

---

## API Endpoints Summary

### Auth (`/api/auth`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/register` | No | Register new user |
| POST | `/login` | No | Login, returns JWT |
| GET | `/me` | Yes | Current user info |
| GET | `/admin/users` | ADMIN | List all users (filter: role, status, search) |
| GET | `/admin/users/stats` | ADMIN | User statistics |
| POST | `/admin/users` | ADMIN | Create new user |
| PATCH | `/admin/users/:id` | ADMIN | Update user |
| DELETE | `/admin/users/:id` | ADMIN | Suspend user |

### Fleet (`/api/fleet`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/live` | No | SSE stream for real-time truck/TPS data |
| GET | `/status` | Yes | Fleet summary (total, active, idle trucks) |
| GET | `/trucks` | Yes | List trucks (filter: status, type) |
| GET | `/driver/me` | DRIVER | Current driver info + assigned truck |
| GET | `/driver/assignment` | DRIVER | Current assignment (route, waypoints, facility) |
| POST | `/driver/claim` | DRIVER | Claim an available truck |
| POST | `/driver/release` | DRIVER | Release truck (idle only) |
| POST | `/driver/start` | DRIVER | "Gas Berangkat" — find TPS + create route |
| POST | `/driver/arrive` | DRIVER | Arrived at TPS |
| POST | `/driver/loading` | DRIVER | Start loading |
| POST | `/driver/complete` | DRIVER | Done loading — next TPS or to hub |
| POST | `/driver/arrive-hub` | DRIVER | Arrived at facility |
| POST | `/driver/unload` | DRIVER | Unload + reset truck |

### Pipeline (`/api/pipeline`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/status` | Yes | Service health (Kafka, Spark, HDFS, OSRM, MongoDB) |
| GET | `/stats` | Yes | Pipeline statistics |
| GET | `/events?limit=N` | Yes | Recent TPS events |
| GET | `/hdfs?path=/aurora` | Yes | Browse HDFS directories |

### Analytics (`/api/analytics`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/tps-summary` | Yes | TPS summary (HDFS-first, MongoDB fallback) |
| GET | `/critical-tps` | Yes | Critical TPS list |
| GET | `/waste-types` | Yes | Waste type distribution |

### TPS (`/api/tps`)
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/` | Yes | List TPS |
| POST | `/` | ADMIN | Create TPS |
| PATCH | `/:id` | ADMIN | Update TPS |
| PATCH | `/:id/verify` | ADMIN | Verify TPS |
| PATCH | `/:id/volume` | ADMIN | Update volume |
| DELETE | `/:id` | ADMIN | Delete TPS |

---

## Simulation Logic

### TPS Simulation (60s interval)
- Each TPS gets random waste accumulation
- Scheduled spikes based on `schedule` field
- Truck collection when volume > 90%
- Publishes events to Kafka topic `aurora_tps_volume`

### Truck Simulation (5s interval)
**Phase 1 — Move trucks:**
- EN_ROUTE_TO_TPS: interpolate along route geometry
- EN_ROUTE_TO_HUB: interpolate to facility
- Arrived at TPS: collect waste, check next waypoint or go to hub

**Phase 2 — Assign trucks:**
- Find AVAILABLE trucks
- Score TPS candidates: `fill×0.35 + distance×0.30 + fuel×0.20 + emission×0.15`
- Build multi-stop route via OSRM (max 3 waypoints)
- 1 truck per TPS (2nd truck only if volume > truck capacity)
- Parallel OSRM calls (max 3 concurrent)

**Phase 3 — Broadcast:**
- SSE push to all connected clients

### Route Service
- Multi-server fallback: OSRM public → routing.openstreetmap.de
- Coordinate rounding to 6 decimal places (prevents HTTP 400)
- 15s timeout per request
- Fallback: straight-line interpolation (20 segments)
- `isFallback: true` flag on fallback routes

### Traffic Service (TomTom)
- Checks congestion at 3 points along route
- `jamFactor` 0-10 (0 = free flow, 10 = gridlock)
- Auto-reroute when congestion > threshold
- API key in `.env`: `TOMTOM_API_KEY`

---

## Depot Locations
```typescript
const DEPOTS = [
  { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
  { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
  { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
  { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
];
```

## Fuel & Emission Constants
```typescript
const FUEL_PRICE = 24800; // Pertamina Dex Rp24,800/liter
const FUEL_EFFICIENCY = { COMPACTOR: 8, DUMP_TRUCK: 6, ARM_ROLL: 7 }; // km/liter
const CO2_PER_LITER = 2.68; // kg CO2/liter diesel
```

---

## Docker Services (WSL)

```bash
# Start all big data services
bash backend/scripts/start-pipeline.sh

# Stop all
bash backend/scripts/stop-pipeline.sh

# Submit Spark job only
bash backend/scripts/submit-spark.sh
```

Services: ZooKeeper, Kafka, HDFS (Namenode + Datanode), Spark (Master + Worker)

---

## Restart Instructions

```bash
# Kill old processes
# Windows PowerShell:
Get-NetTCPConnection -LocalPort 4000 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }
Get-NetTCPConnection -LocalPort 5173 -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }

# Backend
cd D:\Github\FP-Bigdata-AURORA\backend\api
npx tsx src/index.ts

# Frontend
cd D:\Github\FP-Bigdata-AURORA\dashboard
npm run dev
```

---

## Known Issues & Notes

1. **OSRM**: Using public server (`router.project-osrm.org`). For offline/fast routing, set up local OSRM Docker with Java PBF data (see `backend/scripts/prepare-osrm.sh`).

2. **Kafka**: Big data containers must be running in WSL Docker for Kafka events. Without Kafka, TPS simulation still works but events aren't published.

3. **Driver-Truck Relation**: Trucks have `driverId` field. Driver must "claim" a truck before starting workflow. Truck must be AVAILABLE and not claimed by another driver.

4. **Route Ordering**: In `fleet.routes.ts`, specific routes (`/driver/me`, `/driver/claim`) must come BEFORE wildcard (`/driver/:id`) to avoid 404 errors.

5. **Coordinate Precision**: OSRM rejects coordinates with >6 decimal places. Always round: `Math.round(n * 1e6) / 1e6`.

6. **Prisma Schema Changes**: After modifying `schema.prisma`, run:
   ```bash
   cd backend/api
   npx prisma generate
   npx prisma db push --accept-data-loss
   ```

7. **Seed Data**: After schema changes, re-seed:
   ```bash
   npx tsx prisma/seed-facilities.ts   # 14 facilities
   npx tsx prisma/seed-trucks.ts       # 152 trucks
   npx tsx prisma/reset-trucks.ts      # Reset to depots
   ```
