# AURORA — Compact Change Log (Full Session)

## Status: M4 COMPLETE, M5 (Polishing) In Progress

---

## 1. Perubahan Terakhir (Sesi Ini)

### 1.1 Warna Marker TPS3R & PLTSa

**File:** `dashboard/src/features/fleet/components/FleetMap.tsx`

- **TPS3R** → biru (`#3b82f6`)
- **PLTSa Benowo** → merah (`#ef4444`)
- **TPS3R penuh (>80%)** → oranye (`#f59e0b`)
- Menggunakan `SortingHub` (facility) dari `fleet.sse.ts`

```tsx
// Facility Markers
{facilities.map((f) => {
  const isPltsa = f.type === "PLTSa";
  const isTps3r = f.type === "TPS3R";
  const isFull = f.capacityKg > 0 && f.currentLoadKg >= f.capacityKg * 0.8;
  const icon = isPltsa ? pltsaIcon : (isTps3r && isFull) ? tps3rFullIcon : facilityIcon;
  ...
})}
```

### 1.2 Backend: Kirim `allFacilities` via SSE

**File:** `backend/api/src/modules/fleet/fleet.sse.ts`

```typescript
// SSE init sekarang mengirim semua SortingHub
const [trucks, tpsList, allFacilities] = await Promise.all([
  prisma.truck.findMany({...}),
  prisma.tps.findMany({...}),
  prisma.sortingHub.findMany(), // ← TAMBAHAN BARU
]);
res.write(`data: ${JSON.stringify({ type: "init", trucks, tps: tpsList, facilities, allFacilities })}\n\n`);
```

### 1.3 Frontend FleetApi + useFleetStream

**File:** `dashboard/src/features/fleet/api/fleetApi.ts`
```typescript
export interface FleetUpdate {
  type: string;
  trucks?: TruckData[];
  tps?: TpsData[];
  facilities?: FacilityData[];
  allFacilities?: FacilityData[]; // ← TAMBAHAN BARU
  criticalTps?: ...;
  timestamp: string;
}
```

**File:** `dashboard/src/features/fleet/hooks/useFleetStream.ts`
```typescript
interface FleetStreamState {
  trucks: TruckData[];
  tps: TpsData[];
  facilities: FacilityData[];
  allFacilities: FacilityData[]; // ← TAMBAHAN BARU
  criticalTps: ...;
  lastUpdate: string | null;
  connected: boolean;
}

// SSE handler:
setState((prev) => ({
  ...prev,
  allFacilities: (data as any).allFacilities || data.facilities || [],
  ...
}));
```

### 1.4 LogisticPage

**File:** `dashboard/src/pages/LogisticsPage.tsx`
```tsx
// Before:
const { trucks, tps, facilities, lastUpdate, connected } = useFleetStream();
<FleetMap facilities={facilities} ... />

// After:
const { trucks, tps, facilities, allFacilities, lastUpdate, connected } = useFleetStream();
<FleetMap facilities={allFacilities} ... />
```

### 1.5 Smart Facility Selection

**File:** `backend/api/src/modules/fleet/truck.simulation.ts` + `driver.controller.ts`

```typescript
function findBestFacility(truckPos: Coordinate, facilities: FacilityWithCapacity[]): FacilityWithCapacity | null {
  // Hitung jarak ke semua facility
  const ranked = facilities
    .filter((f) => isValidCoord(f.lat, f.lng))
    .map((f) => ({ ...f, distKm: haversineKm(truckPos, { lat: f.lat, lng: f.lng }) }))
    .sort((a, b) => a.distKm - b.distKm);

  // TPS3R terdekat dengan kapasitas (max 120%)
  const tps3rAvailable = ranked.filter((f) => {
    if (f.type !== "TPS3R") return false;
    const dailyCap = f.dailyCapacityKg ?? 50000;
    const intake = f.dailyIntakeKg ?? 0;
    return intake < dailyCap * 1.2;
  });

  // Prefer TPS3R jika dalam 2x jarak PLTSa
  if (tps3rAvailable.length > 0) {
    const pltsa = ranked.find((f) => f.type === "PLTSa");
    const tps3rDist = tps3rAvailable[0].distKm;
    const pltsaDist = pltsa ? pltsa.distKm : Infinity;
    if (tps3rDist <= pltsaDist * 2 || !pltsa) {
      return tps3rAvailable[0];
    }
  }

  // Fallback: PLTSa (always available)
  return ranked.find((f) => f.type === "PLTSa") || ranked[0];
}
```

---

## 2. Perubahan Sebelumnya (Sesi Lalu)

### 2.1 OSRM Routing

- Public server: `https://router.project-osrm.org`
- Fallback: `https://routing.openstreetmap.de/routed-car`
- Koordinat dibulatkan 6 desimal (`Math.round(n * 1e6) / 1e6`)
- `alternatives=3` untuk multiple routes, pilih terpendek

### 2.2 Multi-TPS Route Queue

```typescript
// Truck model
interface RouteQueueItem {
  type: "TPS" | "FACILITY";
  tpsId?: string; tpsName?: string; tpsLat?: number; tpsLng?: number;
  facilityId?: string; facilityName?: string; facilityLat?: number; facilityLng?: number;
  collectedKg?: number;
  status: "pending" | "active" | "done";
}

// Truck fields
routeQueue: Json?    // [{type, tpsId?, facilityId?, status}]
routeLegIndex: Int   @default(0)
```

### 2.3 Smart Route Scoring

```
score = fill × 0.40 + distance × 0.35 + fuel × 0.15 + emission × 0.10

Fill: 75% threshold (<5km), 50% (>=5km)
Distance: Haversine
Fuel: Pertamina Dex Rp24.800/liter
CO2: 2.68 kg/liter diesel
```

### 2.4 Driver Workflow State Machine

```
AVAILABLE → claim → AVAILABLE → start → EN_ROUTE_TO_TPS → arrive → LOADING
  → complete → EN_ROUTE_TO_TPS (next) / EN_ROUTE_TO_HUB → arrive → UNLOADING
  → unload → AVAILABLE
```

- Driver-driven trucks wait for driver (not auto-advance)
- Auto-advance timeout: 4 menit

### 2.5 Auto-Assign Logic

- 1 TPS = 1 truck enforcement (`assignedTpsIds` tracking)
- `routeLegIndex` update saat truck berpindah leg
- `assignedCounts` di-update setelah setiap batch assign

### 2.6 TomTom Traffic Integration

- API Key: `7p76EsdyEm4vshtRPeSYairOu7Ljpqsc`
- Endpoint: `https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json`
- Traffic check setiap 5 menit (3 titik per rute)
- Reroute otomatis jika avgCongestion < 0.5

### 2.7 Fuel & Emission Constants

```typescript
const FUEL_PRICE = 24800; // Pertamina Dex
const FUEL_EFFICIENCY = { COMPACTOR: 8, DUMP_TRUCK: 6, ARM_ROLL: 7 }; // km/liter
const CO2_PER_LITER = 2.68; // kg CO2/liter
```

### 2.8 Depot Locations

```typescript
const DEPOTS = [
  { name: "PLTSa Benowo", lat: -7.2185017137913645, lng: 112.6258223434186 },
  { name: "DLH Surabaya", lat: -7.278405714355262, lng: 112.76320233999931 },
  { name: "Depo Utara", lat: -7.2100, lng: 112.7300 },
  { name: "Depo Selatan", lat: -7.3000, lng: 112.7300 },
];
```

### 2.9 Seed Files

- `seed-facilities.ts`: 1 PLTSa + 13 TPS3R (dengan `dailyCapacityKg`)
- `seed-trucks.ts`: 4 depot, `lat: garage.lat`, `lng: garage.lng` (tanpa random offset)
- `reset-trucks.ts`: Reset semua truk ke AVAILABLE di 4 depot (tanpa random offset)

---

## 3. Prisma Schema

### Truck
```prisma
model Truck {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  code            String   @unique
  name            String
  type            String   // COMPACTOR | DUMP_TRUCK | ARM_ROLL
  capacityKg      Float
  currentLoadKg   Float    @default(0)
  status          String   @default("AVAILABLE")
  lat             Float?
  lng             Float?
  heading         Float?
  driverId        String?  @db.ObjectId
  assignedTpsId   String?  @db.ObjectId
  destinationLat  Float?
  destinationLng  Float?
  facilityId      String?  @db.ObjectId
  route           Json?
  routeProgress   Float    @default(0)
  routeDistance   Float?
  routeDuration   Float?
  routeWaypoints  Json?
  routeQueue      Json?    // [{type, tpsId?, facilityId?, status}]
  routeLegIndex   Int      @default(0)
  @@map("trucks")
}
```

### SortingHub
```prisma
model SortingHub {
  id              String   @id @default(auto()) @map("_id") @db.ObjectId
  code            String   @unique
  name            String
  type            String   // PLTSa | TPS3R | ...
  kecamatan       String?
  lat             Float
  lng             Float
  capacityKg      Float
  currentLoadKg   Float    @default(0)
  dailyCapacityKg Float?   // Kapasitas harian (null = unlimited, seperti PLTSa)
  dailyIntakeKg   Float    @default(0)
  lastIntakeReset DateTime @default(now())
  acceptsTypes    String[] @default([])
  @@map("sorting_hubs")
}
```

### User (key fields)
```prisma
enum Role {
  ADMIN | ADMIN_TPS | BANK_SAMPAH | INDUSTRI | WARGA | UMKM | DRIVER
}
```

---

## 4. Backend Modules

| File | Purpose |
|---|---|
| `truck.simulation.ts` | Route queue, 1 TPS=1 truck, auto-assign, traffic check |
| `driver.controller.ts` | Driver workflow: claim, start, arrive, complete, unload, auto-advance |
| `fleet.service.ts` | Fleet status, task suggestions, manual dispatch |
| `fleet.sse.ts` | SSE streaming (trucks, tps, facilities, allFacilities) |
| `route.service.ts` | OSRM multi-server, coordinate rounding |
| `traffic.service.ts` | TomTom traffic check |
| `analytics.service.ts` | HDFS analytics (with MongoDB fallback) |
| `pipeline.service.ts` | Pipeline health checks, HDFS browser |

---

## 5. Frontend Components

| File | Purpose |
|---|---|
| `FleetMap.tsx` | Leaflet map: trucks, TPS, facilities, routes, waypoints, depot markers |
| `TruckPanel.tsx` | Sidebar: status, filters, live feed |
| `LogisticsPage.tsx` | Halaman Armada & Rute (SSE + map + cost chart) |
| `DriverPage.tsx` | Dashboard supir (state machine) |
| `UserManagement.tsx` | CRUD akun admin |
| `PipelineDashboard.tsx` | Status pipeline Kafka/Spark/HDFS |
| `RealtimeDashboard.tsx` | Dashboard admin utama |

---

## 6. API Endpoints

### Auth (`/api/auth`)
| Method | Endpoint | Description |
|---|---|---|
| POST | `/register` | Register |
| POST | `/login` | Login |
| GET | `/me` | Current user |
| GET | `/admin/users` | List users (admin) |
| GET | `/admin/users/stats` | User stats |
| POST | `/admin/users` | Create user |
| PATCH | `/admin/users/:id` | Update user |
| DELETE | `/admin/users/:id` | Suspend user |

### Fleet (`/api/fleet`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/live` | SSE stream |
| GET | `/status` | Fleet summary |
| GET | `/trucks` | List trucks |
| GET | `/driver/me` | Driver info |
| GET | `/driver/assignment` | Current assignment |
| GET | `/driver/available-trucks` | Available trucks list |
| POST | `/driver/claim` | Claim truck |
| POST | `/driver/release` | Release truck |
| POST | `/driver/start` | "Gas Berangkat" |
| POST | `/driver/arrive` | Arrived at TPS |
| POST | `/driver/loading` | Start loading |
| POST | `/driver/complete` | Selesai mengangkut |
| POST | `/driver/auto-advance` | Auto-advance (4 menit) |
| POST | `/driver/arrive-hub` | Arrived at facility |
| POST | `/driver/unload` | Unload + reset |
| POST | `/driver/admin-insert` | Admin insert TPS ke queue |
| GET | `/suggestions` | Task suggestions |
| POST | `/dispatch` | Manual dispatch |

### Pipeline (`/api/pipeline`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/status` | Service health |
| GET | `/stats` | Pipeline stats |
| GET | `/events?limit=N` | Recent events |
| GET | `/hdfs?path=/aurora` | Browse HDFS |

### Analytics (`/api/analytics`)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/tps-summary` | TPS summary |
| GET | `/critical-tps` | Critical TPS |
| `/waste-types` | Waste type distribution |

---

## 7. WSL Scripts

```bash
# Start pipeline
bash backend/scripts/start-pipeline.sh

# Stop pipeline
bash backend/scripts/stop-pipeline.sh

# Submit Spark job
bash backend/scripts/submit-spark.sh
```

---

## 8. Restart Commands

```bash
# Backend
cd D:\Github\FP-Bigdata-AURORA\backend\api
npx tsx src/index.ts

# Frontend
cd D:\Github\FP-Bigdata-AURORA\dashboard
npm run dev
```

---

## 9. Known Issues & Notes

1. **OSRM**: Public server works. For offline/fast, set up local Docker with Java PBF.
2. **Kafka**: Big data containers must be running in WSL Docker.
3. **Driver-Truck Relation**: `driverId` field on Truck model. Driver must "claim" truck first.
4. **Route Ordering**: Specific routes (`/driver/me`) must come BEFORE wildcard (`/driver/:id`).
5. **Coordinate Precision**: Always round to 6 decimal places for OSRM.
6. **Prisma Schema Changes**: After modifying `schema.prisma`, run `npx prisma generate && npx prisma db push --accept-data-loss`.
7. **Seed Data**: Run seed scripts after schema changes.
