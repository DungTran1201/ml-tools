# Use Case Specification: Launch and Track a Training Run

| Field | Value |
|---|---|
| **UC ID** | UC-LTTR-001 |
| **Version** | 1.0 |
| **Date** | 2026-07-18 |
| **Status** | Approved |
| **Source** | [general_use_case_model.md](file:///c:/Users/PC/Desktop/ml-tools/docs/general_use_case_model.md) — Modules F & G |

---

## 1. Use Case Name & ID

| | |
|---|---|
| **ID** | UC-LTTR-001 |
| **Name** | Launch and Track a Training Run |
| **Package** | Training Run Execution (Dashboard + Experiments) |
| **Priority** | Critical — core value proposition of ML-Tools |

---

## 2. Actors

### 2.1 Primary Actor

| Actor | Role |
|---|---|
| **Data Scientist / ML Engineer** | Authenticated user who configures, launches, monitors, and controls training runs through the Dashboard and Experiments screens. |

### 2.2 Secondary Actors (System)

| Actor | Role | Triggered By |
|---|---|---|
| **Training Engine** | Background process that executes the forward/backward pass loop, emitting metrics and logs per step. | System — starts when run launches |
| **Hardware Monitor** | Daemon that samples GPU/CPU/RAM/VRAM/disk/network telemetry at regular intervals. | System — always active |
| **Checkpoint Manager** | Service that serializes model weights at epoch boundaries and evaluates best-checkpoint criteria. | Training Engine — at each epoch end |
| **Aggregate Refresher** | Application-level write-through that updates denormalized columns on `training_run` whenever new metrics arrive. | Training Engine — on each `run_metric` INSERT |

---

## 3. Description

The Data Scientist launches a training run from the Dashboard after selecting a base model, a dataset, and configuring hyperparameters. Once launched, the system executes the training loop, streaming real-time metrics (loss/accuracy charts), training logs (terminal panel), and hardware telemetry (utilization gauges) to the Dashboard. The run appears in the Experiments table where the user can expand it to view detailed metrics, download checkpoints, load its config into a new run, or compare it with other runs.

**Primary Screens:** Dashboard (live monitoring), Top Bar (run controls), Experiments (history & actions)

**Key DB Entity:** `training_run` — star-schema center with 5 inbound FKs and 6 child tables fanning out.

---

## 4. Pre-conditions

Every pre-condition must be true **before** the Basic Flow begins. The system validates each at launch time and rejects with a descriptive error if any fails.

| # | Pre-condition | Validation |
|---|---|---|
| **PRE-1** | User is authenticated and active. | `SELECT 1 FROM user WHERE id = ? AND is_active = 1` returns a row. |
| **PRE-2** | An active project is selected. | `SELECT 1 FROM project WHERE id = ? AND user_id = ? AND is_archived = 0` returns a row. |
| **PRE-3** | A dataset has been selected and is not soft-deleted. | `SELECT 1 FROM dataset WHERE id = ? AND project_id = ? AND is_deleted = 0` returns a row. |
| **PRE-4** | A base model has been selected (optional — nullable FK). | If provided: `SELECT 1 FROM model WHERE id = ?` returns a row. |
| **PRE-5** | Hyperparameters have been configured (at least the required fields: `learning_rate`, `batch_size`, `optimizer`, `epochs`). | Application validates that 4 required fields are non-empty strings. |
| **PRE-6** | A hardware configuration is available (auto-detected or manually registered). | `SELECT 1 FROM hardware_config WHERE id = ?` returns a row. |
| **PRE-7** | No other run is currently in `'running'` status for this project (single-run constraint). | `SELECT COUNT(*) FROM training_run WHERE project_id = ? AND status = 'running'` returns 0. |

---

## 5. Post-conditions

### 5.1 Success Post-conditions (run completes normally)

| # | Post-condition | DB State |
|---|---|---|
| **POST-S1** | A `training_run` row exists with `status = 'completed'`. | `training_run.status = 'completed'`, `finished_at` is set. |
| **POST-S2** | `epochs_completed = epochs_total`. | `training_run.epochs_completed = training_run.epochs_total`. |
| **POST-S3** | Denormalized metrics are populated. | `best_val_acc`, `best_val_loss`, `train_acc`, `train_loss`, `training_time_sec` are all NOT NULL. |
| **POST-S4** | At least one `run_metric` row exists per completed step. | `SELECT COUNT(*) FROM run_metric WHERE run_id = ?` > 0. |
| **POST-S5** | Training logs have been recorded. | `SELECT COUNT(*) FROM run_log WHERE run_id = ?` > 0. |
| **POST-S6** | At least one checkpoint exists, and exactly one has `is_best = 1`. | `SELECT COUNT(*) FROM checkpoint WHERE run_id = ? AND is_best = 1` = 1. |
| **POST-S7** | An initial `hyperparameter_config` row exists with `version = 1`. | `SELECT 1 FROM hyperparameter_config WHERE run_id = ? AND version = 1` returns a row. |
| **POST-S8** | An immutable config snapshot is saved. | `training_run.config_json IS NOT NULL`. |
| **POST-S9** | Hardware telemetry was recorded for the run duration. | `SELECT COUNT(*) FROM hardware_metric WHERE run_id = ?` > 0. |

### 5.2 Failure Post-conditions (run fails or is stopped)

| # | Post-condition | DB State |
|---|---|---|
| **POST-F1** | `training_run.status` is either `'failed'` or `'stopped'`. | CHECK constraint: `status IN ('completed', 'running', 'failed', 'stopped')`. |
| **POST-F2** | `finished_at` timestamp is set. | `training_run.finished_at IS NOT NULL`. |
| **POST-F3** | `epochs_completed` reflects actual progress. | `training_run.epochs_completed <= epochs_total`. |
| **POST-F4** | If failed: `error_message` contains the failure reason. | `training_run.error_message IS NOT NULL` when `status = 'failed'`. |
| **POST-F5** | If stopped: `error_message` is NULL (user-initiated). | `training_run.error_message IS NULL` when `status = 'stopped'`. |
| **POST-F6** | Partial metrics/logs/checkpoints are preserved (not rolled back). | All child rows inserted before failure remain intact (no cascading delete). |

---

## 6. Basic Flow (Success Scenario)

> **Notation:** `[Actor]` → `{UI Element}` → `«System Action»` → `[DB: table.column]`

### Phase A — Configuration (Dashboard)

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **BF-1** | Data Scientist | Models → "Use as Base" button | User selects a base model from the Model Library card grid. System stores the selection in application state. |
| | | | `[DB: pending — base_model_id written at BF-5]` |
| **BF-2** | Data Scientist | Datasets → left panel row | User clicks a dataset row in the Datasets screen. System stores the selection in application state. |
| | | | `[DB: pending — dataset_id written at BF-5]` |
| **BF-3** | Data Scientist | Dashboard → Hyperparameters sidebar form | User fills in the 10 hyperparameter fields: learning_rate, batch_size, optimizer, scheduler, momentum, weight_decay, dropout, epochs, warmup_steps, grad_clip. |
| | | | `[DB: pending — hyperparameter_config row written at BF-6]` |
| **BF-4** | System | (validation) | System validates PRE-1 through PRE-7. If any fails, the flow terminates with an error notification (see EF-1 through EF-4). |

### Phase B — Launch (Top Bar)

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **BF-5** | Data Scientist | Top Bar → **"Resume"** button (▶ Play icon) | User clicks the Resume/Play button. System creates the training run record. |
| | | | ```sql |
| | | | INSERT INTO training_run ( |
| | | |   id, run_id, name, epochs_total, epochs_completed, |
| | | |   status, started_at, |
| | | |   project_id, user_id, base_model_id, |
| | | |   dataset_id, hardware_config_id, |
| | | |   config_json, created_at, updated_at |
| | | | ) VALUES ( |
| | | |   :uuid, :next_run_id, :run_name, :epochs, 0, |
| | | |   'running', strftime('%Y-%m-%dT%H:%M:%fZ','now'), |
| | | |   :project_id, :user_id, :base_model_id, |
| | | |   :dataset_id, :hardware_config_id, |
| | | |   :config_snapshot_json, |
| | | |   strftime('%Y-%m-%dT%H:%M:%fZ','now'), |
| | | |   strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | ); |
| | | | ``` |
| **BF-5a** | System | Top Bar → status indicator | Green pulsing dot appears. Label changes from "PAUSED" to "TRAINING". Top bar stat badges (RUN, EPOCH, VAL LOSS, VAL ACC) activate with initial values. |
| **BF-6** | System | (automatic) | System creates the initial hyperparameter config record (version 1). |
| | | | ```sql |
| | | | INSERT INTO hyperparameter_config ( |
| | | |   id, run_id, |
| | | |   learning_rate, batch_size, optimizer, scheduler, |
| | | |   momentum, weight_decay, dropout, epochs, |
| | | |   warmup_steps, grad_clip, |
| | | |   extra, version, applied_at |
| | | | ) VALUES ( |
| | | |   :uuid, :run_id, |
| | | |   '5e-4', '48', 'SGD', 'OneCycleLR', |
| | | |   '0.9', '1e-4', '0.3', '100', |
| | | |   '500', '1.0', |
| | | |   '{}', 1, strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | ); |
| | | | ``` |

### Phase C — Training Loop (System-Driven, Dashboard Live Updates)

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **BF-7** | Training Engine | (internal) | Training Engine begins the forward/backward pass loop. For each training step *s* within epoch *e*: |
| **BF-8** | Training Engine | Dashboard → Loss/Accuracy line charts | Engine computes `train_loss` and `train_acc` for step *s*. On evaluation steps, also computes `val_loss` and `val_acc`. System inserts a metric row. |
| | | | ```sql |
| | | | INSERT INTO run_metric ( |
| | | |   run_id, step, train_loss, val_loss, |
| | | |   train_acc, val_acc, recorded_at |
| | | | ) VALUES ( |
| | | |   :run_id, :step, :train_loss, :val_loss, |
| | | |   :train_acc, :val_acc, |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | ``` |
| | | | Dashboard chart auto-appends the new point. Loss tab or Accuracy tab renders based on active toggle. |
| **BF-9** | Aggregate Refresher | (automatic) | On each `run_metric` INSERT, the system refreshes the denormalized columns on `training_run` via write-through. |
| | | | ```sql |
| | | | UPDATE training_run SET |
| | | |   train_acc  = :latest_train_acc, |
| | | |   train_loss = :latest_train_loss, |
| | | |   best_val_acc  = MAX(best_val_acc, :new_val_acc), |
| | | |   best_val_loss = CASE |
| | | |     WHEN best_val_loss IS NULL OR :new_val_loss < best_val_loss |
| | | |     THEN :new_val_loss ELSE best_val_loss END, |
| | | |   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| | | | Top bar stat badges update: EPOCH, VAL LOSS, VAL ACC reflect latest values. |
| **BF-10** | Training Engine | Dashboard → Terminal panel | Engine emits a log line for each significant event (train step, val step, GPU status, info). System inserts a log row. |
| | | | ```sql |
| | | | INSERT INTO run_log ( |
| | | |   run_id, line_number, level, message, logged_at |
| | | | ) VALUES ( |
| | | |   :run_id, :next_line, :level, :message, |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | ``` |
| | | | Terminal panel auto-scrolls to bottom. Lines are color-coded: TRAIN=green (#00d4a0), VAL=purple (#7c6cf8), GPU=amber (#f5a623), INFO=blue (#3ba6ff). LIVE badge pulses when `isRunning = true`. |
| **BF-11** | Hardware Monitor | Dashboard → right-column gauges & mini chart | Hardware Monitor samples telemetry at regular intervals (≈1.2s in UI). System inserts per-GPU metric rows. |
| | | | ```sql |
| | | | INSERT INTO hardware_metric ( |
| | | |   run_id, epoch, gpu_index, |
| | | |   gpu_util_pct, gpu_temp_c, gpu_power_w, |
| | | |   vram_used_gb, vram_total_gb, |
| | | |   cpu_util_pct, ram_used_gb, ram_total_gb, |
| | | |   disk_read_gbps, disk_write_gbps, |
| | | |   net_rx_gbps, net_tx_gbps, |
| | | |   recorded_at |
| | | | ) VALUES ( |
| | | |   :run_id, :current_epoch, :gpu_idx, |
| | | |   :gpu_util, :gpu_temp, :gpu_power, |
| | | |   :vram_used, :vram_total, |
| | | |   :cpu_util, :ram_used, :ram_total, |
| | | |   :disk_r, :disk_w, :net_rx, :net_tx, |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | -- One INSERT per GPU (gpu_index 0–3 for 4× A100) |
| | | | ``` |
| | | | Dashboard right column updates: GPU/VRAM/CPU/RAM utilization bars animate, mini area chart appends point. |

### Phase D — Epoch Boundary (System-Driven)

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **BF-12** | Training Engine | (internal) | Epoch *e* completes. System increments the epoch counter. |
| | | | ```sql |
| | | | UPDATE training_run SET |
| | | |   epochs_completed = :epoch, |
| | | |   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| | | | Top bar badge updates: `EPOCH 48/100` → `EPOCH 49/100`. |
| **BF-13** | Checkpoint Manager | (background) | Manager serializes model weights to disk and inserts a checkpoint record. |
| | | | ```sql |
| | | | INSERT INTO checkpoint ( |
| | | |   id, run_id, epoch, file_path, |
| | | |   file_size_bytes, val_acc, val_loss, |
| | | |   is_best, created_at |
| | | | ) VALUES ( |
| | | |   :uuid, :run_id, :epoch, |
| | | |   './checkpoints/{run_name}_ep{epoch}.pt', |
| | | |   :bytes, :val_acc, :val_loss, |
| | | |   0, strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | ); |
| | | | ``` |
| **BF-14** | Checkpoint Manager | (background) | Manager evaluates if this epoch's `val_acc` exceeds the current best. If so, updates best checkpoint flags. |
| | | | ```sql |
| | | | -- Unset previous best |
| | | | UPDATE checkpoint SET is_best = 0 |
| | | | WHERE run_id = :run_id AND is_best = 1; |
| | | | |
| | | | -- Set new best |
| | | | UPDATE checkpoint SET is_best = 1 |
| | | | WHERE id = :this_checkpoint_id; |
| | | | |
| | | | -- Update run's checkpoint path |
| | | | UPDATE training_run SET |
| | | |   checkpoint_path = :best_checkpoint_file_path, |
| | | |   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| **BF-15** | Training Engine | (loop) | **Steps BF-8 through BF-14 repeat** for each epoch until `epochs_completed = epochs_total`. |

### Phase E — Completion

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **BF-16** | Training Engine | (internal) | Final epoch completes. Engine signals completion. System finalizes the run. |
| | | | ```sql |
| | | | UPDATE training_run SET |
| | | |   status = 'completed', |
| | | |   finished_at = strftime('%Y-%m-%dT%H:%M:%fZ','now'), |
| | | |   training_time_sec = CAST( |
| | | |     (julianday(finished_at) - julianday(started_at)) |
| | | |     * 86400 AS INTEGER), |
| | | |   updated_at = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| **BF-17** | System | Top Bar → status indicator | Green pulsing dot stops. Label changes to "PAUSED". Pause/Resume button returns to "Resume" state. Top bar stat badges show final values. |
| **BF-18** | System | Experiments → table | Run appears in the Experiments list (via `v_experiment_list` view) with `status = 'completed'` badge (green checkmark). Sparkline chart, Best Val Acc, Val Loss, and all other columns are populated from the denormalized fields. |

---

## 7. Alternative Flows

### AF-1: Update Hyperparameters Mid-Run

> **Branches from:** BF-8 (any training step while `status = 'running'`)
> **Condition:** User edits one or more fields in the Hyperparameters sidebar and clicks "Apply".

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **AF-1.1** | Data Scientist | Dashboard → Hyperparameters sidebar → inline text inputs | User modifies one or more fields (e.g., changes `learning_rate` from `5e-4` to `3e-4`). |
| **AF-1.2** | Data Scientist | Dashboard → Hyperparameters sidebar → **"Apply"** button | User clicks the green "Apply" button in the top-right of the Hyperparameters panel. |
| **AF-1.3** | System | (automatic) | System determines the next version number and inserts a new `hyperparameter_config` row. |
| | | | ```sql |
| | | | INSERT INTO hyperparameter_config ( |
| | | |   id, run_id, |
| | | |   learning_rate, batch_size, optimizer, scheduler, |
| | | |   momentum, weight_decay, dropout, epochs, |
| | | |   warmup_steps, grad_clip, |
| | | |   extra, version, applied_at |
| | | | ) VALUES ( |
| | | |   :uuid, :run_id, |
| | | |   '3e-4', '48', 'SGD', 'OneCycleLR', |
| | | |   '0.9', '1e-4', '0.3', '100', |
| | | |   '500', '1.0', |
| | | |   '{}', |
| | | |   (SELECT MAX(version) + 1 |
| | | |    FROM hyperparameter_config |
| | | |    WHERE run_id = :run_id), |
| | | |   strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | ); |
| | | | -- UNIQUE(run_id, version) enforces no duplicates. |
| | | | ``` |
| **AF-1.4** | Training Engine | (automatic) | Engine reads new hyperparams via `v_latest_hyperparams` view and applies them starting from the next training step. |
| **AF-1.5** | System | Dashboard → Terminal panel | System emits an INFO-level log line: `"Hyperparameters updated → v{N} applied"`. |
| | | | Flow resumes at **BF-8**. |

---

### AF-2: Pause and Resume Training Run

> **Branches from:** BF-8 (any training step while `status = 'running'`)
> **Condition:** User clicks the Pause button in the Top Bar.

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **AF-2.1** | Data Scientist | Top Bar → **"Pause"** button (⏸ icon, green) | User clicks Pause. |
| **AF-2.2** | System | Top Bar → status indicator | Green pulsing dot stops. Label changes from "TRAINING" to "PAUSED". Button label changes to "Resume" with amber coloring. Timer (02:14:33) freezes. |
| **AF-2.3** | Training Engine | (internal) | Engine completes the current step, then suspends the training loop. Metric/log/hardware emission stops. No DB writes during pause. |
| **AF-2.4** | Data Scientist | Top Bar → **"Resume"** button (▶ icon, amber) | User clicks Resume to continue training. |
| **AF-2.5** | System | Top Bar → status indicator | Green pulsing dot resumes. Label returns to "TRAINING". Timer resumes counting. |
| **AF-2.6** | Training Engine | (internal) | Engine resumes the training loop from the next step. |
| | | | Flow resumes at **BF-8**. |

---

### AF-3: View Real-Time Training Log

> **Branches from:** BF-10 (any time during training)
> **Condition:** User toggles the terminal panel open or closed.

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **AF-3.1** | Data Scientist | Dashboard → Terminal panel header | User clicks the "Training Log" header bar (with chevron ▼/▲). |
| **AF-3.2** | System | Dashboard → Terminal panel | Panel expands (height 160px) or collapses (height 36px). When expanded: |
| | | | — Last 80 log lines are displayed with auto-scroll. |
| | | | — Lines are color-coded by `level`: TRAIN (#00d4a0), VAL (#7c6cf8), GPU (#f5a623), INFO (#3ba6ff). |
| | | | — Timestamp prefix (22 chars) is dimmed. |
| | | | — LIVE badge with spinning RefreshCw icon appears when `isRunning = true`. |
| | | | No DB change — read-only. Query: |
| | | | ```sql |
| | | | SELECT * FROM run_log |
| | | | WHERE run_id = ? |
| | | | ORDER BY line_number DESC |
| | | | LIMIT 200; |
| | | | -- Uses idx_run_log_tail |
| | | | ``` |
| | | | Flow continues at current step (no interruption). |

---

### AF-4: Compare Selected Runs

> **Branches from:** BF-18 (after run appears in Experiments table)
> **Condition:** User selects ≥ 2 runs via checkboxes.

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **AF-4.1** | Data Scientist | Experiments → table row checkboxes | User checks 2+ run rows. Each checkbox toggles entry in `selected` Set. |
| **AF-4.2** | System | Experiments → header action bar | "Compare N" button appears (purple border, purple text) when `selected.size > 0`. |
| **AF-4.3** | Data Scientist | Experiments → **"Compare N"** button | User clicks the compare button. |
| **AF-4.4** | System | (comparison view) | System loads metrics for all selected runs. |
| | | | ```sql |
| | | | SELECT r.run_id, r.name, r.best_val_acc, |
| | | |        r.best_val_loss, r.train_acc, r.train_loss, |
| | | |        r.training_time_sec, r.param_count, |
| | | |        m.name AS model_name, d.name AS dataset_name |
| | | | FROM training_run r |
| | | | LEFT JOIN model m ON m.id = r.base_model_id |
| | | | LEFT JOIN dataset d ON d.id = r.dataset_id |
| | | | WHERE r.id IN (:selected_ids) |
| | | |   AND r.is_deleted = 0; |
| | | | ``` |
| | | | No DB mutation — read-only. |

---

### AF-5: Clone Run / Load Config

> **Branches from:** BF-18 (after run appears in Experiments table)
> **Condition:** User expands a completed run and clicks "Load Config".

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **AF-5.1** | Data Scientist | Experiments → table row | User clicks a run row to expand the inline detail panel (4-column grid). Chevron rotates 90°. |
| **AF-5.2** | Data Scientist | Experiments → expanded row → **"Load Config"** action button (purple) | User clicks "Load Config". |
| **AF-5.3** | System | Dashboard → Hyperparameters sidebar | System reads `config_json` from the source run and deserializes it into the hyperparameter form fields. |
| | | | ```sql |
| | | | SELECT config_json FROM training_run |
| | | | WHERE id = :source_run_id; |
| | | | ``` |
| | | | Dashboard sidebar fields are pre-filled with the cloned values. User can modify before launching. |
| | | | No DB mutation — read-only until user clicks "Resume" (flow restarts at BF-5). |

---

## 8. Exception Flows

### EF-1: Training Fails (Engine Error)

> **Branches from:** BF-8, BF-12, or BF-13 (any point during training)
> **Trigger:** Training Engine encounters an unrecoverable error (NaN loss, CUDA OOM, data loader crash).

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **EF-1.1** | Training Engine | (internal) | Engine catches the exception. Captures the error message string (e.g., `"CUDA out of memory. Tried to allocate 2.3 GB"`). |
| **EF-1.2** | System | (automatic) | System terminates the training loop and writes the failure state to the database. |
| | | | ```sql |
| | | | UPDATE training_run SET |
| | | |   status        = 'failed', |
| | | |   error_message = :error_string, |
| | | |   finished_at   = strftime('%Y-%m-%dT%H:%M:%fZ','now'), |
| | | |   training_time_sec = CAST( |
| | | |     (julianday('now') - julianday(started_at)) |
| | | |     * 86400 AS INTEGER), |
| | | |   updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| **EF-1.3** | System | Dashboard → Terminal panel | System emits a final log line at level `INFO` with the error message. |
| | | | ```sql |
| | | | INSERT INTO run_log ( |
| | | |   run_id, line_number, level, message, logged_at |
| | | | ) VALUES ( |
| | | |   :run_id, :next_line, 'INFO', |
| | | |   'FATAL: ' || :error_string, |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | ``` |
| **EF-1.4** | System | Top Bar → status indicator | Green pulsing dot stops. Button returns to "Resume" state. |
| **EF-1.5** | System | Experiments → table | Run appears with `status = 'failed'` badge (red ✕ icon). `error_message` is available in the expanded detail row under "Run Info". |
| **EF-1.6** | System | (preservation) | **All partial data is preserved.** Metrics, logs, checkpoints, and hardware telemetry written before the failure remain in the database. No rollback occurs. `epochs_completed` reflects the last successfully completed epoch. |

---

### EF-2: User Stops Training Run

> **Branches from:** BF-8 (any training step while `status = 'running'`)
> **Trigger:** User clicks the "Stop" button in the Top Bar.

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **EF-2.1** | Data Scientist | Top Bar → **"Stop"** button (■ icon, red) | User clicks the red Stop button. |
| **EF-2.2** | Training Engine | (internal) | Engine receives the stop signal. Completes the current step, then terminates the loop gracefully. |
| **EF-2.3** | System | (automatic) | System writes the stopped state. **No `error_message` is set** (user-initiated stop is not an error). |
| | | | ```sql |
| | | | UPDATE training_run SET |
| | | |   status        = 'stopped', |
| | | |   error_message = NULL, |
| | | |   finished_at   = strftime('%Y-%m-%dT%H:%M:%fZ','now'), |
| | | |   training_time_sec = CAST( |
| | | |     (julianday('now') - julianday(started_at)) |
| | | |     * 86400 AS INTEGER), |
| | | |   updated_at    = strftime('%Y-%m-%dT%H:%M:%fZ','now') |
| | | | WHERE id = :run_id; |
| | | | ``` |
| **EF-2.4** | System | Dashboard → Terminal panel | System emits an INFO log: `"Training stopped by user at epoch {e}/{total}"`. |
| **EF-2.5** | System | Top Bar → status indicator | Pulsing dot stops. Label shows "PAUSED". |
| **EF-2.6** | System | Experiments → table | Run appears with `status = 'stopped'` badge (gray ■ icon). Epoch column shows partial progress (e.g., `72/100` with no progress bar). |

---

### EF-3: Hardware Fault During Training

> **Branches from:** BF-11 (hardware telemetry sampling)
> **Trigger:** Hardware Monitor detects a critical condition (GPU temperature > 95°C, VRAM exhaustion, or GPU falling offline).

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **EF-3.1** | Hardware Monitor | (detection) | Monitor detects `gpu_temp_c > 95` or `vram_used_gb >= vram_total_gb` for any GPU index. |
| **EF-3.2** | Hardware Monitor | Dashboard → Terminal panel | System emits a GPU-level log: `"GPU {idx}: CRITICAL — temp {T}°C / VRAM {used}/{total}GB"`. |
| | | | ```sql |
| | | | INSERT INTO run_log ( |
| | | |   run_id, line_number, level, message, logged_at |
| | | | ) VALUES ( |
| | | |   :run_id, :next_line, 'GPU', |
| | | |   'CRITICAL — GPU ' || :idx || ': temp=' || :temp || '°C, VRAM=' || :used || '/' || :total || 'GB', |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | ``` |
| **EF-3.3** | System | (automatic) | If the condition persists (> 3 consecutive samples), the system triggers **EF-1** (Training Fails) with `error_message = 'Hardware fault: GPU {idx} thermal throttle / OOM'`. |

---

### EF-4: Checkpoint Save Failure

> **Branches from:** BF-13 (checkpoint serialization at epoch boundary)
> **Trigger:** Disk write fails (disk full, I/O error, permissions).

| Step | Actor / System | UI Element | Action & DB Change |
|---|---|---|---|
| **EF-4.1** | Checkpoint Manager | (internal) | Manager catches the I/O exception during model weight serialization. |
| **EF-4.2** | System | Dashboard → Terminal panel | System emits a warning log. Training **does not stop** — checkpoint failure is non-fatal. |
| | | | ```sql |
| | | | INSERT INTO run_log ( |
| | | |   run_id, line_number, level, message, logged_at |
| | | | ) VALUES ( |
| | | |   :run_id, :next_line, 'INFO', |
| | | |   'WARNING: Checkpoint save failed at epoch ' || :epoch || ': ' || :error_detail, |
| | | |   CAST(strftime('%s','now') AS INTEGER) |
| | | | ); |
| | | | ``` |
| **EF-4.3** | System | (automatic) | **No checkpoint row is inserted** for this epoch. The `is_best` flag from the previous best checkpoint remains valid. Training continues at **BF-15** (next epoch). |
| **EF-4.4** | System | (automatic) | If checkpoint failures persist for 3+ consecutive epochs, system escalates to **EF-1** with `error_message = 'Persistent checkpoint save failure — aborting'`. |

---

## 9. UI-to-DB State Mapping Summary

| UI Element | DB Table(s) | Operation | Frequency |
|---|---|---|---|
| Top Bar → "Resume" button | `training_run` | INSERT (status='running') | Once per run |
| Top Bar → "Pause" button | (application state only) | — | Per click |
| Top Bar → "Stop" button | `training_run` | UPDATE (status='stopped') | Once per run |
| Top Bar → EPOCH badge | `training_run.epochs_completed` | Read | Continuous |
| Top Bar → VAL LOSS / VAL ACC badges | `training_run.best_val_loss/acc` | Read | Continuous |
| Dashboard → Loss/Accuracy charts | `run_metric` | INSERT per step, Read for chart | 500K–5M/run |
| Dashboard → Terminal panel | `run_log` | INSERT per event, Read tail 200 | 100K–1M/run |
| Dashboard → HW gauges + mini chart | `hardware_metric` | INSERT per tick per GPU | 100K–1M/run |
| Dashboard → Hyperparams → "Apply" | `hyperparameter_config` | INSERT (version+1) | Per user click |
| Experiments → table row | `v_experiment_list` (view) | Read | On navigate |
| Experiments → expanded row → "Download Checkpoint" | `checkpoint` | Read (file_path) | Per user click |
| Experiments → expanded row → "Load Config" | `training_run.config_json` | Read | Per user click |
| Experiments → expanded row → "View Metrics" | `run_metric` | Read (chart query) | Per user click |

---

## 10. Non-Functional Constraints

| Constraint | Requirement | Implementation Detail |
|---|---|---|
| **Concurrency** | WAL mode for concurrent reads during training writes. | `PRAGMA journal_mode = WAL;` in schema.sql L21. |
| **Lock Contention** | 5-second retry on lock contention. | `PRAGMA busy_timeout = 5000;` in schema.sql L22. |
| **Chart Query Performance** | Loss/accuracy chart must load in < 200ms for 5M rows. | Composite index `idx_run_metric_chart(run_id, step)` in schema.sql L361. |
| **Terminal Tail Performance** | Last 200 log lines must load in < 50ms. | Descending index `idx_run_log_tail(run_id, line_number DESC)` in schema.sql L384. |
| **Sparkline Performance** | Experiments table sparkline must render without full metric scan. | Denormalized `accCurve` derived from last N `run_metric` rows via `idx_run_metric_spark(run_id, step DESC)`. |
| **Data Integrity** | Status must be one of 4 valid values. | `CHECK (status IN ('completed','running','failed','stopped'))` on `training_run.status`. |
| **Referential Integrity** | Deleting a user must not cascade-delete their runs. | `user_id REFERENCES user(id) ON DELETE RESTRICT` on `training_run`. |
| **Audit Trail** | Every state change must update `updated_at`. | All UPDATE statements in this spec include `updated_at = strftime(...)`. |
