---
date_created: 2026-06-20T14:30
date_modified: 2026-06-20T14:31
---

# **PIPELINE ARCHITECTURE SPECIFICATION**

- **Feature Deprecation** $\rightarrow$ Excision of Waste Exchange Marketplace, Citizen Reporting App, and Eco Reward System $\rightarrow$ Elimination of OLTP CRUD workloads violating Big Data processing parameters.
- **Ingestion (Bronze)** $\rightarrow$ Apache Kafka producers ingest IoT sensor (TPS capacity) and GPS (fleet routing) telemetry $\rightarrow$ Decoupled, fault-tolerant raw data stream.
- **Storage (Silver)** $\rightarrow$ Hadoop Distributed File System (HDFS) coupled with Delta Lake $\rightarrow$ ACID transactions, time travel, and strict schema enforcement applied to raw batch/streaming parquet files.
- **Processing (Gold)** $\rightarrow$ Apache Spark Structured Streaming and Spark MLlib $\rightarrow$ Real-time state aggregation, Waste Risk Index computation, waste flow prediction, and routing optimization execution.
- **Serving** $\rightarrow$ Low-latency queries against Gold Delta tables $\rightarrow$ Waste Digital Twin telemetry rendering and dashboard synchronization.

---

# **DATA SCHEMA SPECIFICATION AND GENERATION ARCHITECTURE**

**1. Telemetry and Dimensional Data Schemas**

All streaming data must be serialized in JSON for Kafka ingestion, then transformed to Snappy-compressed Parquet in the Delta Lake Bronze layer.

- **Schema 1: Regional Waste Generation (Stream: `topic_waste_generation`)**
    - `event_time` (Timestamp): High-precision event log.
    - `region_id` (String): Surabaya administrative boundary (e.g., `KEC_GUBENG`).
    - `population_multiplier` (Float): Coefficient for demographic density.
    - `generated_volume_kg` (Float): Computed mass of waste.
    - `waste_fraction` (String): ENUM(`ORGANIC`, `PLASTIC`, `PAPER`, `METAL`, `RESIDUE`).
- **Schema 2: TPS/TPS3R IoT Capacity Sensors (Stream: `topic_tps_telemetry`)**
    - `tps_id` (String): Unique identifier mapping to static coordinate registry.
    - `max_capacity_kg` (Float): Maximum structural load limit.
    - `current_load_kg` (Float): Real-time mass reading from load cells.
    - `fill_ratio` (Float): `current_load_kg / max_capacity_kg`.
    - `event_time` (Timestamp).
- **Schema 3: Fleet Operational Telemetry (Stream: `topic_fleet_gps`)**
    - `truck_id` (String): Unique vehicle identifier.
    - `lat` (Float) / `lon` (Float): Real-time WGS84 coordinates.
    - `current_payload_kg` (Float): Onboard weight.
    - `operational_status` (String): ENUM(`IDLE`, `TRANSIT_TO_TPS`, `COLLECTING`, `TRANSIT_TO_FACILITY`, `DUMPING`).
    - `event_time` (Timestamp).
- **Schema 4: Facility Registry (Static/Slowly Changing Dimension - Silver Layer)**
    - `facility_id` (String): Unique facility identifier.
    - `facility_type` (String): ENUM(`TPA`, `PLTSA`, `RECYCLING_PLANT`, `COMPOSTING_CENTER`).
    - `processing_capacity_kg_day` (Float): Maximum daily throughput.
    - `operational_cost_per_kg` (Float): Base metric for financial optimization modeling.
    - `lat` (Float) / `lon` (Float): WGS84 coordinates for spatial routing.

**2. Synthetic Data Generation Strategy (Dummy Data Methodology)**

Due to the absence of physical sensor endpoints, data must be generated programmatically using statistical modeling to simulate realistic Surabaya urban dynamics.

- **TPS Volume Simulation Mechanism:** Implement a Python script utilizing diurnal sine wave functions mixed with Gaussian noise to simulate human disposal patterns. Peaks must align with Indonesian domestic norms (e.g., primary surge at 06:00 WIB, secondary surge at 17:00 WIB).
    - _Formula basis:_ $V(t) = Base + Amp \cdot \sin(2\pi(t - offset)/24) + \mathcal{N}(0, \sigma^2)$
- **Historical Data Bootstrapping:** Run the volume simulation script with a randomized time-seed covering the past 365 days. Inject artificial anomalies (e.g., +40% volume spikes during national holidays/weekends) to train the Spark MLlib predictive models effectively.
- **Fleet Telemetry Simulation:** Utilize the Open Source Routing Machine (OSRM) API or a predefined network graph of Surabaya's arterial roads. Trucks move along coordinate arrays between TPS and Facility nodes at velocities modulated by simulated traffic conditions (randomized speed penalties during peak hours).

**3. Lakehouse Data Flow Integration**

- **Mechanism:** Python producer scripts generate the statistical data $\rightarrow$ push to Apache Kafka topics $\rightarrow$ Spark Structured Streaming consumes micro-batches $\rightarrow$ writes to HDFS/Delta Lake `bronze_tables` with `.append()` mode.
- **Architecture Reasoning:** Separating the synthetic generation logic (Python) from the ingestion engine (Kafka) ensures the data pipeline remains structurally identical to a real-world deployment, fulfilling the literal brief requirement that the solution can be implemented in reality.

---

## **OBJECTIVE METRIC FORMULATION SPECIFICATION**

**1. Waste Risk Index (WRI) per Wilayah**

- **Mechanism:** A composite scalar value [0.0 - 1.0] quantifying the imminent threat of uncontrolled waste accumulation in a defined administrative zone.
- **Formulation:** $WRI_{region} = (\alpha \times \mu_{fill}) + (\beta \times \Delta V_{trend}) + (\gamma \times \rho_{density})$
    - $\mu_{fill}$: Average fill ratio of all TPS within the region ($\frac{\sum V_{current}}{\sum C_{max}}$).
    - $\Delta V_{trend}$: Rate of change in waste volume over the last 6 hours (streaming aggregation).
    - $\rho_{density}$: Static regional population density multiplier.
    - $\alpha, \beta, \gamma$: Configurable MLlib-derived weights.
- **Outcome:** Automated triggering of preemptive fleet dispatch when $WRI > 0.85$.

**2. Prediksi Overload TPS (Overload Probability)**

- **Mechanism:** Real-time calculation of the time-to-failure (100% capacity) for individual TPS nodes using Spark Structured Streaming.
- **Formulation:** $P(Overload_{t}) = 1 - e^{-\lambda t}$
    - $\lambda = \frac{R_{in} - R_{out}}{C_{max} - V_{current}}$
    - $R_{in}$: Ingestion rate (kg/hour) calculated from simulated diurnal IoT load cell data.
    - $R_{out}$: Extraction rate (kg/hour) based on scheduled/active fleet collections.
- **Outcome:** Continuous probability distribution allowing for dynamic rerouting of idle trucks to high-risk nodes.

**3. Tingkat Utilisasi Fasilitas (Facility Utilization Rate)**

- **Mechanism:** Telemetry aggregation to monitor processing load against maximum design capacity for TPA, PLTSa, and Recycling Centers.
- **Formulation:** $U_{facility} = \frac{V_{processed\_24h} + V_{in\_transit}}{C_{daily\_max}} \times 100\%$
    - $V_{in\_transit}$: Sum of `current_payload_kg` from all fleet units currently routing to the facility (Gold Layer query).
- **Outcome:** Prevention of facility bottlenecks through load-balancing algorithms rejecting routing requests to facilities where $U_{facility} > 95\%$.

**4. Estimasi Pengurangan Biaya Operasional (Operational Cost Delta)**

- **Mechanism:** Differential calculus comparing standard static routing vs. AI-optimized dynamic routing.
- **Formulation:** $\Delta Cost = \sum_{i=1}^{N_{trucks}} [(D_{static, i} - D_{optimized, i}) \times F_{rate} \times C_{fuel}]$
    - $D$: Haversine distance or OSRM network distance (km).
    - $F_{rate}$: Average fuel consumption (L/km).
    - $C_{fuel}$: Cost per liter of BBM.
- **Outcome:** Objective, monetary verification of the optimization algorithm's efficacy, calculated per micro-batch and aggregated daily.

**5. Rekomendasi Distribusi Optimal (Optimal Distribution Constraint Model)**

- **Mechanism:** Linear Programming model executed via Spark MLlib to distribute waste to the correct end-node (PLTSa, TPA, Recycler) while minimizing spatial and financial cost.
- **Objective Function:** Minimize $Z = \sum_{i \in TPS} \sum_{j \in Facilities} (Dist_{i,j} \cdot C_{transport} + Cost_{processing, j}) \cdot Mass_{i,j}$
- **Constraints:**
    - $\sum_{j} Mass_{i,j} = V_{current, i}$ (All waste must be collected).
    - $\sum_{i} Mass_{i,j} \le C_{daily\_max, j}$ (No facility exceeds capacity).
- **Outcome:** Generation of the exact payload assignment matrix ($Mass_{i,j}$) for every active truck in the network.

---

## **BASELINE AND EVALUATION METHODOLOGY SPECIFICATION**

**1. Baseline Establishment (Static System Telemetry)**

- **Metric 1: Average TPS Overload Frequency (Historical)** $\rightarrow$ Ingest standard static scheduling models and historical TPS overflow logs into the Delta Lake Bronze layer $\rightarrow$ Compute baseline failure rates ($P(Overload)$) per regional node without dynamic intervention.
- **Metric 2: Fleet Spatial Efficiency Baseline (Km/Ton)** $\rightarrow$ Calculate total distance of static fleet routes via OSRM against total static volume collection over a 30-day simulation period $\rightarrow$ Establish baseline $Km/Ton$ and absolute fuel expenditure.
- **Metric 3: Facility Bottleneck Index** $\rightarrow$ Aggregate arrival timestamps of statically routed fleets at terminal nodes (TPA/PLTSa) $\rightarrow$ Establish baseline queuing delays and facility idle-time standard deviations.

**2. Quantitative Evaluation Protocol (A/B Testing Architecture)**

- **Phase 1: Shadow Mode Execution** $\rightarrow$ Deploy the Spark MLlib routing optimizer concurrently with the static baseline simulation for 14 operational days $\rightarrow$ Write optimizer-proposed $Mass_{i,j}$ (payload assignments) and predicted $\Delta Cost$ to Gold tables strictly for analytical comparison, without system actuation.
- **Phase 2: Fractional Fleet Actuation (Test vs. Control)** $\rightarrow$ Allocate 20% of the simulated fleet array to execute Gold table dynamic routing (Test Group), restricting the remaining 80% to static schedules (Control Group) $\rightarrow$ Stream comparative performance telemetry via Kafka.
- **Phase 3: Statistical Validation** $\rightarrow$ Execute Two-Sample T-tests on Gold layer telemetry $\rightarrow$ Mathematically isolate and compare $Km/Ton_{test}$ vs $Km/Ton_{control}$ and $WRI$ mitigation rates.
- **Outcome Verification** $\rightarrow$ Generate objective proof of optimization efficacy $\rightarrow$ Architecture validation requires a statistically significant ($P-value < 0.05$) reduction in operational $\Delta Cost$ and zero unhandled $WRI > 0.85$ anomalies within the Test Group vector.

