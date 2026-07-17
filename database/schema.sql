-- ============================================================================
-- ML-Tools — Production-Ready SQLite3 DDL
-- ============================================================================
-- Generated from:
--   • docs/data_dictionary.md      (18 entities, normalized to 3NF)
--   • docs/erd_relationships.md    (21 FK relationships with ON DELETE rules)
--   • docs/normalization_and_performance.md (indexing & type corrections)
--
-- SQLite3 Adaptations:
--   UUID       → TEXT (hex string, e.g. '550e8400-e29b-41d4-a716-446655440000')
--   BIGSERIAL  → INTEGER PRIMARY KEY AUTOINCREMENT
--   ENUM       → TEXT + CHECK(column IN (...))
--   TIMESTAMP  → TEXT (audit cols) or INTEGER (high-volume time-series, Unix epoch)
--   JSONB      → TEXT (JSON stored as text; use json_extract() for queries)
--   BOOLEAN    → INTEGER CHECK(column IN (0, 1))
--   FLOAT/REAL → REAL
--   BIGINT     → INTEGER
-- ============================================================================

PRAGMA foreign_keys = ON;
PRAGMA journal_mode = WAL;          -- Write-Ahead Logging for concurrent reads
PRAGMA busy_timeout = 5000;         -- 5s retry on lock contention
PRAGMA synchronous = NORMAL;        -- Safe with WAL; faster than FULL

-- ============================================================================
-- § 1  INDEPENDENT ROOT ENTITIES (no FK dependencies)
-- ============================================================================

-- ── 1.1  user ───────────────────────────────────────────────────────────────
-- Hidden infrastructure entity. Supports multi-user auth & audit trail.
CREATE TABLE user (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    email           TEXT    NOT NULL UNIQUE,
    display_name    TEXT    NOT NULL,
    password_hash   TEXT    NOT NULL,
    avatar_url      TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    last_login_at   TEXT,
    is_active       INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1))
);

-- ── 1.2  hardware_config ────────────────────────────────────────────────────
-- Machine spec registry. Supports Hardware Monitor header string.
CREATE TABLE hardware_config (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    gpu_model       TEXT    NOT NULL,                            -- 'NVIDIA A100 80GB'
    gpu_count       INTEGER NOT NULL,                           -- 4
    cpu_model       TEXT    NOT NULL,                            -- '32-core Xeon'
    ram_total_gb    INTEGER NOT NULL,                           -- 512
    storage_type    TEXT,                                       -- 'NVMe RAID-0'
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

-- ── 1.3  model ──────────────────────────────────────────────────────────────
-- Model library / architecture registry. UI: Model Library card grid.
CREATE TABLE model (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    slug            TEXT    NOT NULL UNIQUE,                     -- URL-safe: 'efficientnet-b4'
    name            TEXT    NOT NULL,                            -- Card title
    full_name       TEXT    NOT NULL,                            -- Modal title
    family          TEXT    NOT NULL CHECK (family IN (
                        'CNN', 'Transformer', 'Segmentation',
                        'Detection', 'Lightweight', 'Multimodal', 'Classical'
                    )),
    param_count     INTEGER,                                    -- Raw count: 350000000. API formats as '350M'.
    flops           INTEGER,                                    -- Raw count: 4200000000. API formats as '4.2B'.
    top1_acc        REAL,                                       -- 0.0–1.0. API formats as '83.0%'.
    input_size      TEXT,                                       -- '380×380', 'Tabular'
    depth           INTEGER,                                    -- Layer count / estimators
    source          TEXT,                                       -- 'Google', 'Meta AI'
    description     TEXT,
    fork_count      INTEGER NOT NULL DEFAULT 0,                 -- Community usage metric
    architecture_svg TEXT,                                      -- Diagram asset path
    download_url    TEXT,                                       -- "Download" button in modal
    weight_path     TEXT,                                       -- Pretrained weights location
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_public       INTEGER NOT NULL DEFAULT 1 CHECK (is_public IN (0, 1))
);


-- ============================================================================
-- § 2  OWNERSHIP CHAIN (depends on user)
-- ============================================================================

-- ── 2.1  project ────────────────────────────────────────────────────────────
-- Multi-project isolation. R1: user ||--o{ project
CREATE TABLE project (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    user_id         TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,
    description     TEXT,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_archived     INTEGER NOT NULL DEFAULT 0 CHECK (is_archived IN (0, 1))
);

CREATE INDEX idx_project_user ON project (user_id);


-- ============================================================================
-- § 3  DATASET CLUSTER (depends on project, user)
-- ============================================================================

-- ── 3.1  dataset ────────────────────────────────────────────────────────────
-- Dataset registry. R3: project ||--o{ dataset
CREATE TABLE dataset (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    slug            TEXT    NOT NULL UNIQUE,                     -- 'imagenet', 'coco'
    project_id      TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    name            TEXT    NOT NULL,                            -- 'ImageNet-1K'
    category        TEXT    NOT NULL CHECK (category IN (
                        'Image', 'Text', 'Tabular', 'Audio'
                    )),
    sample_count    INTEGER NOT NULL,
    disk_size       TEXT    NOT NULL,                            -- '138 GB' (display string)
    format          TEXT    NOT NULL,                            -- 'JPEG', 'CSV', 'MP3'
    class_count     INTEGER NOT NULL,
    feature_count   INTEGER NOT NULL,
    description     TEXT,
    storage_path    TEXT,                                       -- Object store / disk location
    is_preloaded    INTEGER NOT NULL DEFAULT 0 CHECK (is_preloaded IN (0, 1)),
    uploaded_by     TEXT    REFERENCES user(id) ON DELETE SET NULL,
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_deleted      INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))
);

CREATE INDEX idx_dataset_project ON dataset (project_id);

-- ── 3.2  dataset_split ──────────────────────────────────────────────────────
-- Split badges: train, val, test. R13: dataset ||--o{ dataset_split
CREATE TABLE dataset_split (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    dataset_id      TEXT    NOT NULL REFERENCES dataset(id) ON DELETE CASCADE,
    split_name      TEXT    NOT NULL,                            -- 'train', 'val', 'test', 'dev', 'full'
    sample_count    INTEGER,
    UNIQUE (dataset_id, split_name)
);

CREATE INDEX idx_dsplit_dataset ON dataset_split (dataset_id);

-- ── 3.3  dataset_column ─────────────────────────────────────────────────────
-- Schema tab metadata. R14: dataset ||--o{ dataset_column
CREATE TABLE dataset_column (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    dataset_id      TEXT    NOT NULL REFERENCES dataset(id) ON DELETE CASCADE,
    column_name     TEXT    NOT NULL,
    dtype           TEXT    NOT NULL,                            -- 'float64', 'PIL.Image', 'int64'
    non_null_count  INTEGER NOT NULL,
    stat_mean       TEXT,
    stat_min        TEXT,
    stat_max        TEXT,
    ordinal         INTEGER NOT NULL                            -- Display order
);

CREATE INDEX idx_dcol_dataset ON dataset_column (dataset_id);

-- ── 3.4  class_distribution ─────────────────────────────────────────────────
-- Overview tab bar chart. R15: dataset ||--o{ class_distribution
CREATE TABLE class_distribution (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    dataset_id      TEXT    NOT NULL REFERENCES dataset(id) ON DELETE CASCADE,
    class_name      TEXT    NOT NULL,
    sample_count    INTEGER NOT NULL,
    ordinal         INTEGER NOT NULL                            -- Display order
);

CREATE INDEX idx_classdist_dataset ON class_distribution (dataset_id);

-- ── 3.5  dataset_upload ─────────────────────────────────────────────────────
-- Upload Hub queue. R18: user ||--o{ dataset_upload
--                     R19: project ||--o{ dataset_upload
--                     R20: dataset ||--o| dataset_upload (nullable FK, linked post-validation)
CREATE TABLE dataset_upload (
    id                  TEXT    NOT NULL PRIMARY KEY,            -- UUID
    file_name           TEXT    NOT NULL,
    file_size_bytes     INTEGER NOT NULL,
    upload_progress_pct REAL    NOT NULL DEFAULT 0,             -- 0–100
    status              TEXT    NOT NULL CHECK (status IN (
                            'uploading', 'validating', 'valid', 'error'
                        )),
    user_id             TEXT    NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
    project_id          TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    mime_type           TEXT,
    storage_key         TEXT,                                   -- S3/GCS key or local path
    dataset_id          TEXT    REFERENCES dataset(id) ON DELETE SET NULL,  -- linked after validation
    error_detail        TEXT,
    started_at          TEXT,
    completed_at        TEXT,
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_dupload_user    ON dataset_upload (user_id);
CREATE INDEX idx_dupload_project ON dataset_upload (project_id);


-- ============================================================================
-- § 4  MODEL METADATA (depends on model)
-- ============================================================================

-- ── 4.1  model_tag ──────────────────────────────────────────────────────────
-- Tag chips on model cards. R16: model ||--o{ model_tag
CREATE TABLE model_tag (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    model_id        TEXT    NOT NULL REFERENCES model(id) ON DELETE CASCADE,
    tag             TEXT    NOT NULL,
    UNIQUE (model_id, tag)
);

CREATE INDEX idx_modeltag_model ON model_tag (model_id);

-- ── 4.2  user_model_star ────────────────────────────────────────────────────
-- M:N junction: user ↔ model (star toggle). R17: composite PK, both are FKs.
CREATE TABLE user_model_star (
    user_id         TEXT    NOT NULL REFERENCES user(id) ON DELETE CASCADE,
    model_id        TEXT    NOT NULL REFERENCES model(id) ON DELETE CASCADE,
    starred_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    PRIMARY KEY (user_id, model_id)
);


-- ============================================================================
-- § 5  TRAINING RUN HUB (star-schema center — depends on project, user,
--       model, dataset, hardware_config)
-- ============================================================================

-- ── 5.1  training_run ───────────────────────────────────────────────────────
-- Core experiment entity. 5 inbound FKs, 6 child tables fan out.
-- 3NF-cleaned: model_type, dataset_name, optimizer, learning_rate,
-- batch_size, gpu_model REMOVED (derivable via FK joins).
-- best_val_acc/loss, train_acc/loss KEPT as deliberate denorm (avoids
-- scanning millions of run_metric rows on Experiments list page).
CREATE TABLE training_run (
    id                  TEXT    NOT NULL PRIMARY KEY,            -- UUID
    run_id              TEXT    NOT NULL UNIQUE,                 -- User-facing short ID: 'run-0091'
    name                TEXT    NOT NULL,                        -- 'convnext-xl-finetune'
    epochs_total        INTEGER NOT NULL,
    epochs_completed    INTEGER NOT NULL DEFAULT 0,
    -- ponytail: deliberate denorm — materialized aggregates from run_metric.
    -- Refresh via trigger or app-level write-through on each run_metric INSERT.
    best_val_acc        REAL,                                   -- 0–1
    best_val_loss       REAL,
    train_acc           REAL,                                   -- Final epoch
    train_loss          REAL,                                   -- Final epoch
    training_time_sec   INTEGER,                                -- Displayed as 'Xh Ym'
    param_count         TEXT,                                   -- e.g. '350M'
    status              TEXT    NOT NULL CHECK (status IN (
                            'completed', 'running', 'failed', 'stopped'
                        )),
    started_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    -- FK relationships (R2, R4, R5, R6, R21)
    project_id          TEXT    NOT NULL REFERENCES project(id) ON DELETE CASCADE,
    user_id             TEXT    NOT NULL REFERENCES user(id) ON DELETE RESTRICT,
    base_model_id       TEXT    REFERENCES model(id) ON DELETE SET NULL,
    dataset_id          TEXT    NOT NULL REFERENCES dataset(id) ON DELETE RESTRICT,
    hardware_config_id  TEXT    REFERENCES hardware_config(id) ON DELETE SET NULL,
    -- Hidden system metadata
    finished_at         TEXT,
    error_message       TEXT,                                   -- Failure reason for status='failed'
    checkpoint_path     TEXT,                                   -- "Download Checkpoint" action
    config_json         TEXT,                                   -- JSON text: immutable snapshot for "Load Config"/"Clone Run"
    created_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    updated_at          TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    is_deleted          INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1))
);

CREATE INDEX idx_run_project   ON training_run (project_id);
CREATE INDEX idx_run_user      ON training_run (user_id);
CREATE INDEX idx_run_dataset   ON training_run (dataset_id);
CREATE INDEX idx_run_model     ON training_run (base_model_id);
CREATE INDEX idx_run_hwconfig  ON training_run (hardware_config_id);
CREATE INDEX idx_run_status    ON training_run (status);
CREATE INDEX idx_run_started   ON training_run (started_at DESC);


-- ============================================================================
-- § 6  TRAINING RUN CHILDREN — LOW VOLUME (depends on training_run)
-- ============================================================================

-- ── 6.1  run_tag ────────────────────────────────────────────────────────────
-- Tag badges under run name. R9: training_run ||--o{ run_tag
CREATE TABLE run_tag (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    run_id          TEXT    NOT NULL REFERENCES training_run(id) ON DELETE CASCADE,
    tag             TEXT    NOT NULL,
    UNIQUE (run_id, tag)
);

CREATE INDEX idx_runtag_run ON run_tag (run_id);

-- ── 6.2  hyperparameter_config ──────────────────────────────────────────────
-- Dashboard "Hyperparameters" panel. Versioned — each "Apply" creates a row.
-- Hybrid storage: 10 fixed relational columns + extra TEXT (JSON) overflow.
-- R12: training_run ||--o{ hyperparameter_config
CREATE TABLE hyperparameter_config (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    run_id          TEXT    NOT NULL REFERENCES training_run(id) ON DELETE CASCADE,
    -- Fixed fields (rendered by Dashboard sidebar form)
    learning_rate   TEXT    NOT NULL,                            -- '5e-4'
    batch_size      TEXT    NOT NULL,
    optimizer       TEXT    NOT NULL,
    scheduler       TEXT,                                       -- 'OneCycleLR'
    momentum        TEXT,
    weight_decay    TEXT,
    dropout         TEXT,
    epochs          TEXT    NOT NULL,
    warmup_steps    TEXT,
    grad_clip       TEXT,
    -- Overflow: custom/experimental hyperparams (JSON text)
    -- Query with json_extract(extra, '$.label_smoothing')
    extra           TEXT    NOT NULL DEFAULT '{}',
    version         INTEGER NOT NULL DEFAULT 1,
    applied_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    UNIQUE (run_id, version)
);

CREATE INDEX idx_hpconfig_run ON hyperparameter_config (run_id);

-- ── 6.3  checkpoint ─────────────────────────────────────────────────────────
-- "Download Checkpoint" action. R10: training_run ||--o{ checkpoint
CREATE TABLE checkpoint (
    id              TEXT    NOT NULL PRIMARY KEY,                -- UUID
    run_id          TEXT    NOT NULL REFERENCES training_run(id) ON DELETE CASCADE,
    epoch           INTEGER NOT NULL,
    file_path       TEXT    NOT NULL,
    file_size_bytes INTEGER,
    val_acc         REAL,
    val_loss        REAL,
    is_best         INTEGER NOT NULL DEFAULT 0 CHECK (is_best IN (0, 1)),
    created_at      TEXT    NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now'))
);

CREATE INDEX idx_ckpt_run   ON checkpoint (run_id);
CREATE INDEX idx_ckpt_best  ON checkpoint (run_id, is_best) WHERE is_best = 1;


-- ============================================================================
-- § 7  TRAINING RUN CHILDREN — HIGH VOLUME / TIME-SERIES
--      (millions of rows — optimized indexes are critical)
-- ============================================================================

-- ── 7.1  run_metric ─────────────────────────────────────────────────────────
-- Dashboard loss/accuracy charts, Experiments sparkline.
-- Est. 500K–5M rows per run. R7: training_run ||--o{ run_metric
--
-- Uses INTEGER (Unix epoch) for recorded_at — faster ordering than TEXT ISO-8601.
CREATE TABLE run_metric (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,          -- BIGSERIAL equivalent
    run_id          TEXT    NOT NULL REFERENCES training_run(id) ON DELETE CASCADE,
    step            INTEGER NOT NULL,                           -- Global step counter
    train_loss      REAL    NOT NULL,
    val_loss        REAL,                                       -- Only on eval steps
    train_acc       REAL    NOT NULL,
    val_acc         REAL,                                       -- Only on eval steps
    recorded_at     INTEGER NOT NULL                            -- Unix epoch (seconds)
);

-- Chart query: SELECT step, train_loss, val_loss FROM run_metric WHERE run_id = ? ORDER BY step
-- This composite index enables fast range scans scoped to a single run.
CREATE INDEX idx_run_metric_chart ON run_metric (run_id, step);

-- Sparkline query: last N points for a run, ordered by step DESC
CREATE INDEX idx_run_metric_spark ON run_metric (run_id, step DESC);

-- Time-range filter (e.g. "show metrics from last hour")
CREATE INDEX idx_run_metric_time ON run_metric (run_id, recorded_at);

-- ── 7.2  run_log ────────────────────────────────────────────────────────────
-- Dashboard terminal panel. Est. 100K–1M rows per run.
-- R8: training_run ||--o{ run_log
CREATE TABLE run_log (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT    NOT NULL REFERENCES training_run(id) ON DELETE CASCADE,
    line_number     INTEGER NOT NULL,                           -- Ordering
    level           TEXT    NOT NULL CHECK (level IN (
                        'TRAIN', 'VAL', 'GPU', 'INFO'
                    )),
    message         TEXT    NOT NULL,
    logged_at       INTEGER NOT NULL                            -- Unix epoch
);

-- Terminal tail query: SELECT * FROM run_log WHERE run_id = ? ORDER BY line_number DESC LIMIT 200
CREATE INDEX idx_run_log_tail ON run_log (run_id, line_number DESC);

-- Level filter: SELECT * FROM run_log WHERE run_id = ? AND level = 'GPU' ORDER BY line_number
CREATE INDEX idx_run_log_level ON run_log (run_id, level, line_number);

-- ── 7.3  hardware_metric ────────────────────────────────────────────────────
-- Hardware Monitor gauges, area charts, temperature heatmap.
-- Est. 100K–1M rows per run. R11: training_run ||--o{ hardware_metric
-- FK nullable — system-level metrics exist when no run is active.
CREATE TABLE hardware_metric (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          TEXT    REFERENCES training_run(id) ON DELETE SET NULL,  -- nullable
    epoch           INTEGER,                                   -- Maps to epoch timeline slider
    gpu_index       INTEGER NOT NULL,                          -- 0–3 (multi-GPU)
    gpu_util_pct    REAL    NOT NULL,                           -- 0–100
    gpu_temp_c      REAL    NOT NULL,                           -- Celsius
    gpu_power_w     REAL,                                      -- Watts
    vram_used_gb    REAL    NOT NULL,
    vram_total_gb   REAL    NOT NULL,
    cpu_util_pct    REAL    NOT NULL,
    ram_used_gb     REAL    NOT NULL,
    ram_total_gb    REAL    NOT NULL,
    disk_read_gbps  REAL,
    disk_write_gbps REAL,
    net_rx_gbps     REAL,
    net_tx_gbps     REAL,
    recorded_at     INTEGER NOT NULL                            -- Unix epoch
);

-- Time-series query: SELECT * FROM hardware_metric WHERE run_id = ? ORDER BY recorded_at
CREATE INDEX idx_hw_metric_run_time ON hardware_metric (run_id, recorded_at);

-- Epoch slider: SELECT * FROM hardware_metric WHERE run_id = ? AND epoch = ?
CREATE INDEX idx_hw_metric_epoch ON hardware_metric (run_id, epoch);

-- System-level metrics (no run): SELECT * FROM hardware_metric WHERE run_id IS NULL ORDER BY recorded_at DESC
CREATE INDEX idx_hw_metric_idle ON hardware_metric (recorded_at) WHERE run_id IS NULL;


-- ============================================================================
-- § 8  VIEWS — Pre-computed queries for common frontend patterns
-- ============================================================================

-- Latest hyperparameter config per run (replaces the dropped flat columns on training_run)
CREATE VIEW v_latest_hyperparams AS
SELECT h.*
FROM   hyperparameter_config h
INNER JOIN (
    SELECT run_id, MAX(version) AS max_ver
    FROM   hyperparameter_config
    GROUP  BY run_id
) latest ON h.run_id = latest.run_id AND h.version = latest.max_ver;

-- Experiments list: training_run + dataset name + model name + latest hyperparams
-- (replaces the 3NF-dropped denormalized columns via JOINs)
CREATE VIEW v_experiment_list AS
SELECT
    r.id,
    r.run_id,
    r.name,
    r.status,
    r.started_at,
    r.epochs_completed,
    r.epochs_total,
    r.best_val_acc,
    r.best_val_loss,
    r.train_acc,
    r.train_loss,
    r.training_time_sec,
    r.param_count,
    r.project_id,
    d.name          AS dataset_name,
    m.name          AS model_name,
    m.family        AS model_family,
    hc.gpu_model    AS gpu_model,
    h.optimizer     AS optimizer,
    h.learning_rate AS learning_rate,
    h.batch_size    AS batch_size
FROM       training_run r
LEFT JOIN  dataset d            ON d.id = r.dataset_id
LEFT JOIN  model m              ON m.id = r.base_model_id
LEFT JOIN  hardware_config hc   ON hc.id = r.hardware_config_id
LEFT JOIN  v_latest_hyperparams h ON h.run_id = r.id
WHERE      r.is_deleted = 0;
