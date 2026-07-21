# Use Case Specification: Hardware Monitoring

| Field | Value |
|---|---|
| **UC ID** | UC-HM-001 (UC-4) |
| **Version** | 1.0 |
| **Date** | 2026-07-22 |
| **Status** | Approved |
| **Source** | [general_use_case_model.md](file:///c:/Users/PC/Desktop/ml-tools/docs/general_use_case_model.md) — Module H; [detailed_use_case_decomposition.md](file:///c:/Users/PC/Desktop/ml-tools/docs/detailed_use_case_decomposition.md) — Workflow 4 |

---

## Table of Contents

- [1. Use Case Name & ID](#1-use-case-name--id)
- [2. Actors](#2-actors)
  - [2.1 Primary Actor](#21-primary-actor)
  - [2.2 Secondary Actors (System)](#22-secondary-actors-system)
- [3. Description](#3-description)
- [4. Pre-conditions](#4-pre-conditions)
- [5. Post-conditions](#5-post-conditions)
  - [5.1 Success Post-conditions](#51-success-post-conditions)
  - [5.2 Failure Post-conditions](#52-failure-post-conditions)
- [6. Basic Flow](#6-basic-flow)
  - [Phase A — Telemetry Daemon Initialization & State Resolution](#phase-a--telemetry-daemon-initialization--state-resolution)
  - [Phase B — Telemetry Streaming & DB Persistence (Dual-Mode Execution)](#phase-b--telemetry-streaming--db-persistence-dual-mode-execution)
  - [Phase C — Dynamic Visual Rendering & Dashboard Synchronization](#phase-c--dynamic-visual-rendering--dashboard-synchronization)
- [7. Alternative Flows](#7-alternative-flows)
  - [AF-1: Scrub Historical Epoch Timeline](#af-1-scrub-historical-epoch-timeline)
  - [AF-2: Multi-GPU View Toggle & Individual Core Focus](#af-2-multi-gpu-view-toggle--individual-core-focus)
  - [AF-3: Dynamic Polling Interval Adjustment](#af-3-dynamic-polling-interval-adjustment)
- [8. Exception Flows](#8-exception-flows)
  - [EF-1: Telemetry Daemon Crash / Disconnection ("No Signal" State)](#ef-1-telemetry-daemon-crash--disconnection-no-signal-state)
  - [EF-2: Critical Thermal Throttle / OOM Threshold Triggered](#ef-2-critical-thermal-throttle--oom-threshold-triggered)
  - [EF-3: Database Write Lock / Storage Space Exhaustion](#ef-3-database-write-lock--storage-space-exhaustion)
- [9. Data Entity & Schema Mapping](#9-data-entity--schema-mapping)
- [10. UI Component Mapping](#10-ui-component-mapping)

---

## 1. Use Case Name & ID

| Attribute | Specification |
|---|---|
| **ID** | **UC-HM-001** (Legacy Ref: **UC-4**) |
| **Name** | **Hardware Monitoring** |
| **Package** | Module H: Hardware Telemetry & Resource Visualization |
| **Priority** | High — essential for compute cost optimization, thermal management, and OOM prevention |

---

## 2. Actors

### 2.1 Primary Actor

| Actor | Description & Role |
|---|---|
| **Data Scientist / ML Engineer** | Authenticated user who inspects real-time hardware performance, monitors resource utilization during active model training runs, analyzes historical telemetry via epoch scrubbing, and detects compute hardware bottlenecks. |

### 2.2 Secondary Actors (System)

| Actor | Role | Trigger Condition |
|---|---|---|
| **Hardware Monitor Daemon** | Lightweight background process (`hw_monitor_daemon`) that polls NVML/sysfs at 1.0s–1.2s intervals, aggregates metrics, and writes to `hardware_metric`. | System service — starts on OS boot or daemon start; runs continuously regardless of training state. |
| **Training Engine** | Core ML training worker process. Links active `training_run.id` and current `epoch` index into the shared daemon context when executing training. | System — active during `'running'` status of a `training_run`. |

---

## 3. Description

The **Hardware Monitoring** module provides comprehensive real-time telemetry and historical analysis of compute hardware resources across the ML infrastructure. The screen displays machine metadata from `hardware_config` (GPU model, total count, CPU model, total RAM, storage type) alongside real-time telemetry metrics stored in `hardware_metric`.

Visual panels on the Hardware Monitoring screen include:
1. **GPU Utilization Circular Gauges**: Radial percent dials (0%–100%) showing real-time compute load for each GPU core (0..N-1).
2. **SM Temperature Heatmap Grid**: Color-coded matrix representing Streaming Multiprocessor (SM) temperature distribution in Celsius (°C).
3. **Resource Area Charts**: Stacked/overlapping time-series area charts tracking GPU Utilization (%), CPU Utilization (%), VRAM Consumption (GB used vs GB total), and RAM Usage (GB used vs GB total).
4. **Network & Disk Throughput Line Charts**: Real-time throughput indicators measuring Disk Read/Write rates (`disk_read_gbps`, `disk_write_gbps`) and Network Rx/Tx bandwidth (`net_rx_gbps`, `net_tx_gbps`).
5. **Epoch Timeline Scrubber**: Interactive historical range slider mapping hardware metrics to specific training epochs when linked to a training run.

---

## 4. Pre-conditions

Before this use case starts, the system must validate the following state requirements:

| # | Pre-condition | Validation / System Check |
|---|---|---|
| **PRE-1** | User is authenticated and has active session rights. | `SELECT 1 FROM user WHERE id = :user_id AND is_active = 1` returns a row. |
| **PRE-2** | Active project is selected. | `SELECT 1 FROM project WHERE id = :project_id AND is_archived = 0` returns a row. |
| **PRE-3** | System `hardware_config` entry is registered. | `SELECT 1 FROM hardware_config WHERE id = :hardware_config_id` returns a valid hardware specification record. |
| **PRE-4** | `Hardware Monitor Daemon` process is active. | Background daemon process `hw_monitor_daemon` is running, holding an active handle to NVML / system metrics interfaces. |
| **PRE-5** | SQLite3 database is accessible in WAL mode. | `PRAGMA journal_mode` returns `wal` and database write access is non-blocking. |

---

## 5. Post-conditions

### 5.1 Success Post-conditions

| # | Condition | Database / System State | UI State |
|---|---|---|---|
| **POST-S1** | Continuous Telemetry Ingestion | `hardware_metric` table receives continuous `INSERT` rows every sampling interval (1.0s–1.2s). | Real-time charts update smoothly without frame drops. Gauges reflect current compute load. |
| **POST-S2** | Idle State Categorization | Telemetry rows inserted while no run is executing have `run_id IS NULL` and `epoch IS NULL`. | UI displays top status badge: `SYSTEM IDLE (IDLE METRICS STREAMING)`. |
| **POST-S3** | Active Run Categorization | Telemetry rows inserted during an active run have `run_id = :active_run_id` and `epoch = :current_epoch`. | UI displays top status badge: `RUNNING: run-XXXX` with live step counter. |
| **POST-S4** | Timeline Range Synchronization | Telemetry time-series indexed via `idx_hw_metric_run_time` or `idx_hw_metric_epoch`. | Timeline scrubber bounds are dynamically set between epoch 0 and `epochs_completed`. |

### 5.2 Failure Post-conditions

| # | Condition | Database / System State | UI State |
|---|---|---|---|
| **POST-F1** | Daemon Disconnection | Daemon stops writing to `hardware_metric`; `max(recorded_at)` stops advancing. | UI enters gracefully degraded state with visual overlay: `NO SIGNAL — TELEMETRY DAEMON OFFLINE`. Gauges freeze at 0%; live charts pause. |
| **POST-F2** | Database Timeout / Lock | DB write lock contention causes telemetry dropping; last valid row timestamp > 5s ago. | UI displays yellow warning pill: `STALE METRICS (LATENCY > 5000ms)`. |
| **POST-F3** | Hardware Critical Fault | Daemon writes `gpu_temp_c > 95.0` or `vram_used_gb >= vram_total_gb`. | Red alert banner triggers on top navigation bar; system emits critical log row into `run_log`. |

---

## 6. Basic Flow (Step-by-Step Interaction & State Transitions)

> **Notation:** `[Actor]` → `{UI Element}` → `«System Action»` → `[DB Query / Action]`

### Phase A — Telemetry Daemon Initialization & State Resolution

| Step | Actor / System | UI Element | System Action & Database Query |
|---|---|---|---|
| **BF-1** | Hardware Monitor Daemon | (Background) | Daemon initializes NVML host bindings and queries system hardware config on boot. Registers hardware specs if not already present. |
| | | | ```sql
| | | | SELECT id, gpu_model, gpu_count, cpu_model, ram_total_gb, storage_type 
| | | | FROM hardware_config 
| | | | LIMIT 1;
| | | | ``` |
| **BF-2** | System | (Internal State) | Daemon checks if a training run is currently active by querying `training_run`. |
| | | | ```sql
| | | | SELECT id, run_id, epochs_completed 
| | | | FROM training_run 
| | | | WHERE status = 'running' 
| | | | LIMIT 1;
| | | | ``` |
| **BF-3a** | System | `{Status Badge}` | **State: IDLE (`run_id IS NULL`).** If no row is returned, daemon sets internal context `active_run_id = NULL` and `active_epoch = NULL`. UI renders status `IDLE`. |
| **BF-3b** | System | `{Status Badge}` | **State: ACTIVE (`run_id IS NOT NULL`).** If a running row is found, daemon sets internal context `active_run_id = training_run.id` and `active_epoch = training_run.epochs_completed`. UI renders status `TRAINING: run-XXXX`. |

### Phase B — Telemetry Streaming & DB Persistence (Dual-Mode Execution)

| Step | Actor / System | UI Element | System Action & Database Query |
|---|---|---|---|
| **BF-4** | Hardware Monitor Daemon | (Background) | Every sample tick (1.2s), daemon queries CPU, RAM, Disk, Network, and per-GPU metrics from the kernel/NVML drivers. |
| **BF-5** | Hardware Monitor Daemon | `hardware_metric` table | Daemon executes bulk batch insert into `hardware_metric` for all detected GPUs (`gpu_index = 0..gpu_count-1`). |
| | | | ```sql
| | | | INSERT INTO hardware_metric (
| | | |   run_id, epoch, gpu_index,
| | | |   gpu_util_pct, gpu_temp_c, gpu_power_w,
| | | |   vram_used_gb, vram_total_gb,
| | | |   cpu_util_pct, ram_used_gb, ram_total_gb,
| | | |   disk_read_gbps, disk_write_gbps,
| | | |   net_rx_gbps, net_tx_gbps, recorded_at
| | | | ) VALUES (
| | | |   :active_run_id, :active_epoch, :gpu_idx,
| | | |   :gpu_util, :gpu_temp, :gpu_power,
| | | |   :vram_used, :vram_total,
| | | |   :cpu_util, :ram_used, :ram_total,
| | | |   :disk_read, :disk_write,
| | | |   :net_rx, :net_tx, CAST(strftime('%s','now') AS INTEGER)
| | | | );
| | | | ``` |

### Phase C — Dynamic Visual Rendering & Dashboard Synchronization

| Step | Actor / System | UI Element | System Action & Database Query |
|---|---|---|---|
| **BF-6** | Data Scientist | Sidebar → `{Hardware Nav Item}` | User clicks "Hardware" tab. UI issues initial hydration fetch for machine spec and latest 60-second telemetry window. |
| | | | ```sql
| | | | -- Query Machine Header Specs
| | | | SELECT gpu_model, gpu_count, cpu_model, ram_total_gb, storage_type 
| | | | FROM hardware_config WHERE id = :hardware_config_id;
| | | | 
| | | | -- Query Latest Telemetry Window (Active or Idle)
| | | | SELECT * FROM hardware_metric 
| | | | WHERE (run_id = :active_run_id OR (:active_run_id IS NULL AND run_id IS NULL))
| | | |   AND recorded_at >= (CAST(strftime('%s','now') AS INTEGER) - 60)
| | | | ORDER BY recorded_at ASC;
| | | | ``` |
| **BF-7** | UI Frontend | `{Hardware Header}` | UI header displays machine profile: `NVIDIA A100 80GB (x4) | 32-core Xeon | 512GB RAM | NVMe RAID-0`. |
| **BF-8** | UI Frontend | `{GPU Radial Gauges}` | Renders $N$ circular gauges. SVG stroke offset maps to `gpu_util_pct`. Color gradient: Green (`<70%`), Amber (`70-89%`), Red (`>=90%`). |
| **BF-9** | UI Frontend | `{SM Temperature Heatmap}` | Heatmap grid interpolates `gpu_temp_c` across SM cores. Matrix tiles transition between Cool Blue (`<50°C`), Emerald (`50-70°C`), Orange (`71-85°C`), and Crimson (`>85°C`). |
| **BF-10** | UI Frontend | `{Resource Area Charts}` | Smooth multi-line area chart appends incoming point. Renders GPU Util %, CPU Util %, VRAM (GB), and RAM (GB) with filled background opacity (0.15). |
| **BF-11** | UI Frontend | `{Disk & Network Throughput}` | Dual-axis line charts render read/write rates (`disk_read_gbps`, `disk_write_gbps`) and network Rx/Tx (`net_rx_gbps`, `net_tx_gbps`). |
| **BF-12** | UI Frontend | `{Polling Event Loop}` | React frontend polls endpoint or listens to SSE/WebSocket channel every 1.2s. On response, appends new tick to FIFO buffer of length 50. |

---

## 7. Alternative Flows

### AF-1: Scrub Historical Epoch Timeline

> **Scenario:** The user pauses live streaming and drags the "Scrub Epoch Timeline" slider to inspect hardware metrics from an earlier training epoch.

| Step | Actor / System | UI Element | Action & System Behavior |
|---|---|---|---|
| **AF-1.1** | Data Scientist | `{Epoch Scrub Slider}` | User clicks and drags slider handle from `LIVE` position to `Epoch 14`. |
| **AF-1.2** | UI Frontend | `{Live Telemetry Badge}` | `LIVE` pulsing dot changes to amber `HISTORICAL PAUSE (EPOCH 14)`. Real-time polling loop suspends chart FIFO pushes. |
| **AF-1.3** | UI Frontend | `hardware_metric` | Frontend queries historical metrics matching selected epoch and active `run_id`. |
| | | | ```sql
| | | | SELECT * FROM hardware_metric 
| | | | WHERE run_id = :run_id AND epoch = 14 
| | | | ORDER BY recorded_at ASC;
| | | | ``` |
| **AF-1.4** | UI Frontend | `{All Panel Components}` | Gauges, heatmaps, area charts, and throughput panels instantly re-render data snapshot corresponding to Epoch 14. |
| **AF-1.5** | Data Scientist | `{Resume Live Button}` | User clicks "Resume Live" button. Slider snaps back to rightmost edge (`LIVE`), live polling resumes, and streaming updates restart. |

### AF-2: Multi-GPU View Toggle & Individual Core Focus

> **Scenario:** User switches hardware monitoring view from aggregated average mode to individual GPU core focus (e.g., inspecting GPU 2 only).

| Step | Actor / System | UI Element | Action & System Behavior |
|---|---|---|---|
| **AF-2.1** | Data Scientist | `{GPU Selector Tabs}` | User clicks `GPU 2` tab button (switching from `ALL GPUs` view). |
| **AF-2.2** | UI Frontend | `{Hardware Gauges & Charts}` | UI filters stream memory buffer where `gpu_index == 2`. Charts transition smoothly to isolate GPU 2 VRAM, power, and SM temperatures. |

### AF-3: Dynamic Polling Interval Adjustment

> **Scenario:** User opens settings dropdown to change telemetry refresh frequency (e.g., from 1.2s high-frequency mode to 5.0s low-overhead mode).

| Step | Actor / System | UI Element | Action & System Behavior |
|---|---|---|---|
| **AF-3.1** | Data Scientist | `{Refresh Rate Dropdown}` | User selects `5.0s (Power Saver)` polling frequency. |
| **AF-3.2** | UI Frontend | (Client Timer) | UI timer interval updates to 5000ms. Database query interval scales down, reducing API load. |

---

## 8. Exception Flows

### EF-1: Telemetry Daemon Crash / Disconnection ("No Signal" State)

> **Branches from:** Phase C, Step BF-12 (polling interval check).  
> **Trigger:** `Hardware Monitor Daemon` crashes, host service fails, or database stops receiving new metric inserts for $> 5.0$ seconds.

```
       [Normal Polling Loop (BF-12)]
                    │
                    ▼
     «Check timestamp of last sample»
                    │
           ┌────────┴────────┐
           │ > 5.0s elapsed  │
           ▼                 ▼
     [Normal Render]   [Trigger EF-1]
                             │
                             ▼
              «Set Telemetry Status = OFFLINE»
                             │
                             ▼
             {Display Overlay: "NO SIGNAL"}
             {Freeze Gauges at 0% / Last Value}
             {Display Disconnection Toast}
```

| Step | Actor / System | UI Element | System Action & Diagnostic Behavior |
|---|---|---|---|
| **EF-1.1** | UI Frontend | (Internal Watchdog) | Frontend client watchdog detects `now - max(recorded_at) > 5.0s`. |
| **EF-1.2** | UI Frontend | `{Hardware Screen Container}` | Application sets internal state `telemetry_status = 'OFFLINE'`. |
| **EF-1.3** | UI Frontend | `{Telemetry Overlay Panel}` | Semitransparent dark overlay rendered over charts with glowing amber icon:  <br>**`⚠️ NO SIGNAL — TELEMETRY DAEMON DISCONNECTED`**  <br>*"Hardware Monitor daemon is not responding. Retrying connection..."* |
| **EF-1.4** | UI Frontend | `{Gauges & Heatmap}` | Circular gauges render grayed-out state (0% fill). Heatmap displays neutral slate tiles. Live charts stop shifting. |
| **EF-1.5** | UI Frontend | (Retry Loop) | UI initiates exponential backoff reconnect attempt (1s, 2s, 4s, 8s).  <br>`SELECT recorded_at FROM hardware_metric ORDER BY id DESC LIMIT 1;` |
| **EF-1.6** | UI Frontend | `{Hardware Screen Container}` | When new rows appear in `hardware_metric`, overlay auto-dismisses, toast alerts `"Telemetry Restored"`, and live rendering resumes seamlessly without app crash. |

### EF-2: Critical Thermal Throttle / OOM Threshold Triggered

> **Branches from:** Phase B, Step BF-5 (metric evaluation).  
> **Trigger:** GPU temperature exceeds 95.0°C or VRAM utilization reaches 100% capacity (`vram_used_gb >= vram_total_gb`).

| Step | Actor / System | UI Element | System Action & Diagnostic Behavior |
|---|---|---|---|
| **EF-2.1** | Hardware Monitor Daemon | (Detection) | Daemon reads `gpu_temp_c > 95.0` OR `vram_used_gb >= vram_total_gb`. |
| **EF-2.2** | Hardware Monitor Daemon | `run_log` table | System automatically inserts critical alert log record into `run_log`. |
| | | | ```sql
| | | | INSERT INTO run_log (run_id, line_number, level, message, logged_at)
| | | | VALUES (
| | | |   :run_id, :next_seq, 'GPU',
| | | |   'CRITICAL: GPU 0 Thermal Limit Exceeded (96.4°C). Throttling core clock.',
| | | |   CAST(strftime('%s','now') AS INTEGER)
| | | | );
| | | | ``` |
| **EF-2.3** | UI Frontend | `{Top Bar Alert Banner}` | Pulsing crimson warning banner displays at top of screen:  <br>**`CRITICAL HARDWARE ALERT: GPU 0 OVERHEATING (96.4°C)`** |
| **EF-2.4** | UI Frontend | `{GPU Circular Gauge 0}` | Gauge 0 stroke color turns bright red (`#ff4d4f`) with animated warning pulse. |

### EF-3: Database Write Lock / Storage Space Exhaustion

> **Branches from:** Phase B, Step BF-5 (`INSERT INTO hardware_metric`).  
> **Trigger:** SQLite3 database encounters `SQLITE_BUSY` or `SQLITE_FULL` disk exception.

| Step | Actor / System | UI Element | System Action & Diagnostic Behavior |
|---|---|---|---|
| **EF-3.1** | Hardware Monitor Daemon | (Exception Handler) | Daemon catches database write failure. Logs local exception to daemon log file without terminating process. |
| **EF-3.2** | Hardware Monitor Daemon | (In-Memory Ring Buffer) | Metrics stored temporarily in internal C++/Python ring buffer (max 300 points) to avoid loss during 5-second `busy_timeout`. |
| **EF-3.3** | Hardware Monitor Daemon | `hardware_metric` | When lock clears, daemon flushes accumulated ring buffer to `hardware_metric` in a single transaction. |

---

## 9. Data Entity & Schema Mapping

The Hardware Monitoring use case interacts directly with two primary database entities defined in `database/schema.sql`:

```
┌──────────────────────────────────────┐       ┌──────────────────────────────────────────────┐
│           hardware_config            │       │               hardware_metric                │
├──────────────────────────────────────┤       ├──────────────────────────────────────────────┤
│ id (PK, TEXT/UUID)                   │       │ id (PK, INTEGER AUTOINCREMENT)               │
│ gpu_model (TEXT) ──► 'NVIDIA A100'   │       │ run_id (FK, TEXT, NULLABLE) ──► training_run │
│ gpu_count (INTEGER) ──► 4            │ 1   * │ epoch (INTEGER, NULLABLE)                    │
│ cpu_model (TEXT) ──► '32-core Xeon'  │───────│ gpu_index (INTEGER) ──► 0..3                 │
│ ram_total_gb (INTEGER) ──► 512       │       │ gpu_util_pct (REAL) ──► 0.0-100.0            │
│ storage_type (TEXT) ──► 'NVMe RAID'  │       │ gpu_temp_c (REAL) ──► Celsius                │
│ created_at (TEXT)                    │       │ vram_used_gb / vram_total_gb (REAL)          │
└──────────────────────────────────────┘       │ cpu_util_pct / ram_used_gb (REAL)            │
                                               │ disk_read_gbps / disk_write_gbps (REAL)      │
                                               │ net_rx_gbps / net_tx_gbps (REAL)            │
                                               │ recorded_at (INTEGER, Unix Epoch)           │
                                               └──────────────────────────────────────────────┘
```

### Key Performance Indexes (from `schema.sql`)

1. **`idx_hw_metric_run_time`**: `ON hardware_metric (run_id, recorded_at)` — Enables ultra-fast time-range queries for active training runs.
2. **`idx_hw_metric_epoch`**: `ON hardware_metric (run_id, epoch)` — Supports instant data retrieval when scrubbing the Epoch Timeline slider.
3. **`idx_hw_metric_idle`**: `ON hardware_metric (recorded_at) WHERE run_id IS NULL` — Partial index covering system-level idle metrics without full table scans.

---

## 10. UI Component Mapping

| UI Section | Visual Component | Data Mapping / Calculation | Source Entity |
|---|---|---|---|
| **Machine Header Bar** | Metadata Specs Pill | `gpu_model` + `gpu_count` + `cpu_model` + `ram_total_gb` + `storage_type` | `hardware_config` |
| **GPU Utilization** | Circular SVG Radial Gauges | `gpu_util_pct` (Per GPU index `0..gpu_count-1`) | `hardware_metric` |
| **Thermal Distribution** | SM Heatmap Grid Matrix | `gpu_temp_c` mapped to color gradient scale | `hardware_metric` |
| **VRAM Memory Panel** | Progress Bar + Ratio Text | `vram_used_gb` / `vram_total_gb` + Percentage calculation | `hardware_metric` |
| **System Load Trends** | Dual Stacked Area Charts | `gpu_util_pct` vs `cpu_util_pct` over time | `hardware_metric` |
| **Disk Throughput** | Dual Line Plot (Read/Write) | `disk_read_gbps` (blue) and `disk_write_gbps` (amber) | `hardware_metric` |
| **Network Throughput** | Dual Line Plot (Rx/Tx) | `net_rx_gbps` (green) and `net_tx_gbps` (purple) | `hardware_metric` |
| **Timeline Scrubber** | Interactive Range Slider | `epoch` column mapping to slider step index | `hardware_metric` |
| **Status Overlay** | Full-width Semi-transparent Modal | Watchdog timeout trigger when `now - max(recorded_at) > 5s` | Application State |

---
