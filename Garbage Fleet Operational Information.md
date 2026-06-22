---
date_created: 2026-06-20T16:11
date_modified: 2026-06-20T16:15
---

# Surabaya Smart City: Waste Management Data Blueprint

This document summarizes the real-world data for Surabaya's waste management and explains how this data will control the project's codebase and AI predictions.

---

## Part 1: The Real-World Data (Ground Truth)

### A. Waste Volume & Composition
- **Total Daily Waste:** 1,810.81 Tons (1,810,810 kg)
- **Plastic Waste:** ~305 Tons (305,000 kg)
- _Note:_ Plastic makes up about 16.8% of the total weight, but takes up a massive amount of physical space (volume) because it is loose and light.

### B. Fleet Data (225 Total Trucks)
1. **Compactor (10 m³):** 62 trucks
2. **Compactor (6.5 m³):** 19 trucks
3. **Dump Truck (4-5 m³):** 26 trucks
4. **Armroll (14 m³):** 38 trucks
5. **Armroll (8 m³):** 5 trucks
6. **Armroll (6 m³):** 11 trucks
7. **Pick Up (1-2 m³):** 79 trucks

### C. Operational Schedule & Rules
- **Route Limit:** Trucks visit 3 to 4 TPS (stations) before the afternoon.
- **Afternoon Shift:** Starting in the afternoon (~15:00 WIB), trucks must focus only on main streets (_Jalan Protokol_).
- **Hard Deadline:** TPA Benowo closes at 20:00 WIB. All trucks must arrive there by **18:00 WIB** at the latest.

---

## Part 2: Significance to the Codebase

How this data changes the way we build the software:

1. **Volume vs. Weight Logic:** Because there is so much plastic, non-compactor trucks (like Dump Trucks and Pickups) will run out of space before they run out of weight limits. The code must track `volume_m3` (space) and `payload_kg` (weight) at the same time.
2. **Truck Type Rules:** The code must treat different trucks differently. 
    - Compactors can squish waste (holding more). 
    - Armrolls do not load waste piece-by-piece; they just swap an empty container for a full one.
    - Pickups are too small for big markets and must be assigned to small neighborhood alleys.
3. **Simulating Data:** Our Python scripts will generate exactly 1,810.81 tons of fake data across all TPS in the simulation to match reality.

---

## Part 3: Impact on AI Predictions and Routing

How this data makes the AI smarter:

1. **Destination Sorting (Where to go):**
   - If the AI detects a truck is carrying mostly plastic, it will route that truck to a Recycling Center (TPS3R) instead of the main dump.
   - If it is mixed/residue waste, the AI routes it to TPA Benowo.
2. **Time-Based Route Rejection:** * The AI calculates travel time. If a suggested route to Benowo means the truck arrives _after_ 18:00 WIB, the AI will reject that route and find a closer facility or end the truck's shift.
3. **Dynamic Shift Change:** * The AI will have a built-in clock. Once the clock hits 15:00 WIB, the AI stops sending trucks to residential areas and redirects them to clean the main roads.

---

## Part 4: Indexed Action Plan for Implementation

Here is the step-by-step plan to code these rules into the project:

- **Step 1: Create the Static Database (Silver Layer)**
  - [ ] Add the exact number of 225 trucks into the database (`tps_sampah_surabaya.json` or Prisma schema).
  - [ ] Add a `can_compact` (True/False) rule to the trucks.

- **Step 2: Update the Data Generator (`backend/scratch/generate_tps.py` / Kafka Producer)**
  - [ ] Set the maximum daily waste limit to 1,810,810 kg.
  - [ ] Give every generated waste payload a "plastic percentage" so the total plastic equals 305,000 kg.

- **Step 3: Update the Apache Spark Streaming Logic**
  - [ ] Write a function that calculates truck fullness based on both weight _and_ volume (because of the plastic).
  - [ ] Write an "IF/THEN" rule for the afternoon shift (If time > 15:00, then route = Main Roads).

- **Step 4: Update the AI Routing Engine (Feature 4)**
  - [ ] Add a hard time limit: Reject any route that arrives at TPA Benowo after 18:00 WIB.
  - [ ] Add destination logic: Route high-plastic loads to recycling, and residue to Benowo.
