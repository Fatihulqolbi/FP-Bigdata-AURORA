# AURORA Implementation Plan: Big Data Metrics Enhancement

**Created**: 2026-06-20  
**Status**: EXECUTING  
**Mode**: Cold-Start (no historical data available)  
**Timeline**: 5 days intensive build

---

## Executive Summary

This document outlines the implementation plan to enhance AURORA with Big Data metrics from Revision.md. The system will implement:

1. **WRI (Waste Risk Index)** - per kecamatan risk assessment
2. **TPS Overload Prediction** - 24/48/72 hour probability forecasting
3. **Facility Utilization Tracking** - real-time load monitoring
4. **Event Calendar System** - waste spike prediction from scheduled events
5. **Operational Constraints** - real DLH Surabaya rules integration

**Approach**: Incremental enhancement (no deprecation of existing marketplace/citizen features)

---

## Phase 0: Data Preparation Foundation

### 0.1 Prisma Schema Updates

**New Model: ScheduledEvent**
```prisma
model ScheduledEvent {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  eventId           String   @unique
  eventName         String
  month             Int?
  day               Int?
  dayOfWeek         Int?
  targetKecamatan   String
  targetKelurahan   String?
  volumeMultiplier  Float
  locations         String[]
  createdAt         DateTime @default(now())
  updatedAt         DateTime @updatedAt
  @@map("scheduled_events")
}
```

**New Model: WasteRiskIndex**
```prisma
model WasteRiskIndex {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  regionId          String
  regionName        String
  timestamp         DateTime @default(now())
  avgFillLevel      Float
  volumeTrend       Float
  populationDensity Float
  wriValue          Float
  alpha             Float    @default(0.4)
  beta              Float    @default(0.35)
  gamma             Float    @default(0.25)
  alertStatus       String
  recommendedAction String?
  createdAt         DateTime @default(now())
  @@index([regionId, timestamp])
  @@map("waste_risk_index")
}
```

**New Model: TpsOverloadPrediction**
```prisma
model TpsOverloadPrediction {
  id                   String   @id @default(auto()) @map("_id") @db.ObjectId
  tpsId                String   @db.ObjectId
  tpsCode              String
  tpsName              String
  timestamp            DateTime @default(now())
  currentVolumeKg      Float
  capacityKg           Float
  fillLevel            Float
  inflowRateKgPerHour  Float
  outflowRateKgPerHour Float
  netRateKgPerHour     Float
  lambda               Float
  overloadProb24h      Float
  overloadProb48h      Float
  overloadProb72h      Float
  estimatedHoursToFull Float?
  estimatedFullAt      DateTime?
  riskLevel            String
  createdAt            DateTime @default(now())
  @@index([tpsId, timestamp])
  @@map("tps_overload_predictions")
}
```

**New Model: FacilityUtilization**
```prisma
model FacilityUtilization {
  id                String   @id @default(auto()) @map("_id") @db.ObjectId
  facilityId        String   @db.ObjectId
  facilityCode      String
  facilityName      String
  timestamp         DateTime @default(now())
  processed24hKg    Float
  inTransitKg       Float
  dailyCapacityKg   Float
  utilizationRate   Float
  status            String
  canAcceptMore     Boolean
  trucksEnRoute     Int
  createdAt         DateTime @default(now())
  @@index([facilityId, timestamp])
  @@map("facility_utilization")
}
```

**New Model: RegionalPopulationDensity**
```prisma
model RegionalPopulationDensity {
  id                          String   @id @default(auto()) @map("_id") @db.ObjectId
  regionId                    String   @unique
  regionName                  String
  kecamatan                   String
  population                  Int
  areaKm2                     Float
  densityPerKm2               Float
  wasteGenKgPerCapitaPerDay   Float    @default(0.7)
  densityMultiplier           Float
  createdAt                   DateTime @default(now())
  updatedAt                   DateTime @updatedAt
  @@map("regional_population_density")
}
```

**New Model: CostOptimizationBaseline**
```prisma
model CostOptimizationBaseline {
  id                       String   @id @default(auto()) @map("_id") @db.ObjectId
  periodStart              DateTime
  periodEnd                DateTime
  staticTotalDistanceKm    Float
  staticTotalFuelL         Float
  staticTotalCostRp        Float
  staticAvgKmPerTon        Float
  optimizedTotalDistanceKm Float
  optimizedTotalFuelL      Float
  optimizedTotalCostRp     Float
  optimizedAvgKmPerTon     Float
  distanceSavedKm          Float
  fuelSavedL               Float
  costSavedRp              Float
  efficiencyGainPct        Float
  testGroupSize            Int
  controlGroupSize         Int
  statisticalSignificance  Float
  createdAt                DateTime @default(now())
  @@map("cost_optimization_baseline")
}
```

**Truck Model Additions:**
```prisma
model Truck {
  // ... existing fields
  
  volumeM3          Float    // Physical volume capacity
  canCompact        Boolean  @default(false)
  isJalanProtokol   Boolean  @default(false)
  maxTpsPerRoute    Int      @default(4)
  
  // ... rest
}
```

**TPS Model Additions:**
```prisma
model Tps {
  // ... existing fields
  
  volMasukM3       Float?
  volDikelolaM3    Float?
  volDiangkutM3    Float?
  estimasiBeratKg  Float?
  isJalanProtokol  Boolean  @default(false)
  klasifikasiPengangkutan String?
  
  // ... rest
}
```

---

### 0.2 Real Data Specifications

**Fleet Data (DLH Surabaya 2025) - 225 Units:**

| Type | Count | Volume | Weight Capacity |
|------|-------|--------|-----------------|
| Compactor 10m³ | 62 | 10m³ | 16,000 kg |
| Compactor 6.5m³ | 19 | 6.5m³ | 10,400 kg |
| Dump Truck | 26 | 4.5m³ | 12,500 kg |
| Armroll 14m³ | 38 | 14m³ | 23,300 kg |
| Armroll 8m³ | 5 | 8m³ | 13,300 kg |
| Armroll 6m³ | 11 | 6m³ | 10,000 kg |
| Pick Up | 79 | 1.5m³ | 2,500 kg |

**Daily Waste Generation:**
- Total: 1,810.81 tons/day
- Plastic: ~305 tons (16.8%)
- Organic: ~940 tons (52%)
- Paper: ~254 tons (14%)
- Metal: ~145 tons (8%)
- Residue: ~91 tons (5%)
- E-Waste: ~76 tons (4%)

**Event Calendar (6 Major Events):**

| Event | Timing | Multiplier | Impact |
|-------|--------|------------|--------|
| Malam Tahun Baru | Dec 31 | 3.5x | +15.2 tons |
| CFD + Parade | May (CFD) | 4.0x | +30 tons |
| CFD Rutin | Sunday | 2.5x | 2-3x normal |
| Kerja Bakti Massal | Aug 17 (H+1) | 1.8x | 700 points |
| Festival Rujak Uleg | May | 2.0x | SBEC area |
| Festival Cahaya | May/Jun | 1.5x | Multiple parks |

**Operational Constraints:**
- Route limit: 3-4 TPS per truck before 15:00 WIB
- Afternoon shift (>15:00): Main roads only
- Hard deadline: Arrive at TPA Benowo by 18:00 WIB
- TPA Benowo closes: 20:00 WIB
- Volume vs Weight: Track both (plastic takes space but light)

---

### 0.3 TPS Data Cleansing Protocol

**Before importing 1000+ TPS from real-tps-data.json:**

**Step 1: String Standardization**
```
jenis_fasilitas.upper().replace(' ', '') → "TPS3R" uniform
klasifikasi_pengangkutan.upper() → "ARMROLL" or "COMPACTOR"
```

**Step 2: Null Coordinate Geocoding**
```
IF lat IS NULL OR lng IS NULL:
  address = f"{alamat}, {kelurahan}, {kecamatan}, Surabaya"
  coords = geocode_nominatim(address)
  lat, lng = coords
```

**Step 3: Synthetic ID Generation**
```
IF id_tps IS NULL:
  id_tps = f"TPS-{UUID[:8].upper()}"
```

**Step 4: Volume Imputation**
```
IF vol_masuk IS NULL:
  vol_masuk = mean(kecamatan_vol_masuk) OR kapasitas
  
IF vol_diangkut IS NULL:
  vol_diangkut = vol_masuk * 0.85  // 85% collection rate
```

**Step 5: Volume-to-Mass Conversion**
```
estimasi_berat_kg = vol_masuk_m3 * 200  // 200 kg/m³ for mixed waste
capacity_kg = kapasitas_m3 * 250  // 250 kg/m³ for compacted
```

**Step 6: Status Filtering**
```
KEEP ONLY: status == "aktif"
DROP: status == "tidak aktif" OR status == null
```

---

## Phase 1: Kafka Topic Expansion

### 1.1 New Topics

| Topic | Purpose | Schema |
|-------|---------|--------|
| topic_tps_telemetry | TPS IoT data | Schema 2 |
| topic_waste_generation | Regional generation | Schema 1 |
| topic_fleet_gps | Fleet GPS tracking | Schema 3 |
| topic_wri_metrics | WRI calculations | Gold layer |
| topic_overload_predictions | Overload forecasts | Gold layer |

### 1.2 Event Schemas

**Schema 1: WasteGenerationEvent**
```typescript
{
  event_time: string;
  region_id: string;
  population_multiplier: number;
  generated_volume_kg: number;
  waste_fraction: "ORGANIC" | "PLASTIC" | "PAPER" | "METAL" | "RESIDUE";
}
```

**Schema 2: TpsTelemetryEvent**
```typescript
{
  event_time: string;
  tps_id: string;
  max_capacity_kg: number;
  current_load_kg: number;
  fill_ratio: number;
  event_type: "PUBLIC_DISPOSAL" | "TRUCK_COLLECTION" | "SCHEDULED_SPIKE";
}
```

**Schema 3: FleetGpsEvent**
```typescript
{
  event_time: string;
  truck_id: string;
  lat: number;
  lon: number;
  current_payload_kg: number;
  operational_status: "IDLE" | "TRANSIT_TO_TPS" | "COLLECTING" | "TRANSIT_TO_FACILITY" | "DUMPING";
}
```

---

## Phase 2: Spark Streaming Jobs

### 2.1 TPS Volume Streaming (tps_volume_streaming.py)

**Bronze Layer**: Raw TPS telemetry → HDFS
**Silver Layer**: 6-hour windowed aggregations for WRI
**Gold Layer**: WRI components (μ_fill, ΔV_trend)

### 2.2 Overload Prediction Streaming (overload_prediction_streaming.py)

**Calculates**:
- R_in (inflow rate kg/hour)
- R_out (outflow rate kg/hour)
- λ = (R_in - R_out) / (C_max - V_current)
- P(Overload) = 1 - e^(-λt) for t=24h, 48h, 72h

---

## Phase 3: Metric Computation Services

### 3.1 WRI Service (wri.service.ts)

**Formula**: `WRI = (α × μ_fill) + (β × ΔV_trend) + (γ × ρ_density)`

**Default weights**: α=0.4, β=0.35, γ=0.25

**Alert thresholds**:
- WRI >= 0.85 → CRITICAL (trigger preemptive dispatch)
- WRI >= 0.70 → WARNING
- WRI < 0.70 → NORMAL

### 3.2 Overload Prediction Service (overload-prediction.service.ts)

**Risk levels**:
- P(24h) >= 0.8 → CRITICAL
- P(24h) >= 0.5 → HIGH
- P(24h) >= 0.2 → MEDIUM
- P(24h) < 0.2 → LOW

### 3.3 Facility Utilization Service (enhance facility.service.ts)

**Formula**: `U = (V_processed_24h + V_in_transit) / C_daily_max × 100%`

**Status thresholds**:
- U >= 95% → OVERLOADED (reject new routes)
- U >= 80% → NEAR_CAPACITY
- U < 80% → AVAILABLE

---

## Phase 4: Enhanced Simulation Logic

### 4.1 Diurnal Volume Simulation

**Formula**: `V(t) = [Base + Amp × sin(2π(t - offset)/24) + N(0, σ²)] × EVENT_MULTIPLIER`

**Peak hours**:
- Primary: 06:00 WIB (morning disposal)
- Secondary: 17:00 WIB (evening disposal)

**Event integration**:
```typescript
volume = diurnalVolume(hour, config) * eventMultiplier;
```

### 4.2 Operational Time Windows

**Constraint 1**: Route limit
```typescript
if (hour < 15 && tpsCount > 4) reject("Max 4 TPS per route");
```

**Constraint 2**: Afternoon shift
```typescript
if (hour >= 15 && !tps.isJalanProtokol) reject("After 15:00, main roads only");
```

**Constraint 3**: Benowo deadline
```typescript
if (facility === "PLTSa" && arrivalHour >= 18) reject("Must arrive before 18:00");
```

---

## Phase 5: Frontend Dashboard

### 5.1 New Components

1. **WRIMap.tsx** - Choropleth map by kecamatan
2. **OverloadPredictionPanel.tsx** - Critical TPS countdown
3. **FacilityUtilizationChart.tsx** - Real-time facility load
4. **CostSavingsChart.tsx** - A/B test comparison

### 5.2 New API Endpoints

```
GET  /api/metrics/wri/all
GET  /api/metrics/wri/:kecamatan
GET  /api/metrics/overload/critical
GET  /api/metrics/overload/tps/:tpsId
GET  /api/metrics/utilization/facilities
GET  /api/metrics/cost/baseline
```

---

## Phase 6: Testing & Validation

### 6.1 Data Validation

- [ ] All 1000+ TPS imported with valid coordinates
- [ ] 225 trucks seeded with correct capacities
- [ ] 6 events in calendar with correct multipliers
- [ ] Volume-to-mass conversions accurate

### 6.2 Metric Validation

- [ ] WRI calculations match manual computations
- [ ] Overload predictions calibrated against known fill rates
- [ ] Utilization rates reflect real facility loads
- [ ] Event multipliers produce expected spikes

### 6.3 Operational Constraint Testing

- [ ] Route limits enforced (max 4 TPS)
- [ ] Afternoon shift routing correct
- [ ] Benowo deadline rejection working
- [ ] Truck-facility compatibility enforced

---

## Execution Timeline (5 Days)

### Day 1: Data Foundation
- [x] Create planning.md
- [ ] Update Prisma schema
- [ ] Run db push
- [ ] Create cleansing script
- [ ] Import 1000+ TPS

### Day 2: Fleet & Events
- [ ] Update fleet seed (225 trucks)
- [ ] Create event calendar seed
- [ ] Run all seed scripts
- [ ] Verify data integrity

### Day 3: Metric Services
- [ ] Implement WRI service
- [ ] Implement overload prediction
- [ ] Enhance facility utilization
- [ ] Update simulation logic

### Day 4: Streaming & API
- [ ] Create Kafka producer
- [ ] Create Spark streaming jobs
- [ ] Build API endpoints
- [ ] Test end-to-end flow

### Day 5: Frontend & Testing
- [ ] Build dashboard components
- [ ] Integrate SSE streaming
- [ ] Validation testing
- [ ] Performance testing

---

## Success Criteria

1. ✅ Real TPS data (1000+) imported with clean coordinates
2. ✅ Fleet reflects 225 real DLH Surabaya units
3. ✅ Event calendar predicts waste spikes
4. ✅ WRI alerts trigger at 0.85 threshold
5. ✅ Overload predictions accurate within 10% margin
6. ✅ Operational constraints enforced (time windows, route limits)
7. ✅ Marketplace/citizen features intact (no deprecation)
8. ✅ Dashboard displays real-time metrics

---

## Notes

- **Cold-Start Mode**: No historical data → collect 30 days real-time before enabling predictive models
- **Incremental Enhancement**: Append features, don't remove existing
- **Real Data Priority**: Use DLH Surabaya 2025 operational data
- **Gemastik Focus**: Visual WRI map + overload countdown + utilization charts
