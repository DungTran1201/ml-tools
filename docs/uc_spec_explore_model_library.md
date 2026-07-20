# Use Case Specification: Explore Model Library

| Field | Value |
|---|---|
| **UC ID** | UC-ML-001 |
| **Version** | 1.0 |
| **Date** | 2026-07-20 |
| **Status** | Draft |
| **Source** | [general_use_case_model.md](file:///d:/ml-tools/docs/general_use_case_model.md) — Module E; [detailed_use_case_decomposition.md](file:///d:/ml-tools/docs/detailed_use_case_decomposition.md) — Workflow 3 |

---

## Table of Contents

- [1. Use Case Overview](#1-use-case-overview)
- [2. Actors](#2-actors)
- [3. Pre-conditions (Global)](#3-pre-conditions-global)
- [4. Post-conditions (Global)](#4-post-conditions-global)
- [5. UC-ML-002: Browse Model Cards (E1)](#5-uc-ml-002-browse-model-cards-e1)
  - [5.1 Sub-UC: Search Models (E1.1)](#51-sub-uc-search-models-e11)
  - [5.2 Sub-UC: Filter by Family (E1.2)](#52-sub-uc-filter-by-family-e12)
  - [5.3 Sub-UC: Sort Models (E1.3)](#53-sub-uc-sort-models-e13)
- [6. UC-ML-003: View Architecture Detail (E2)](#6-uc-ml-003-view-architecture-detail-e2)
  - [6.1 Sub-UC: Download Model Weights (E2.1)](#61-sub-uc-download-model-weights-e21)
- [7. UC-ML-004: Star / Unstar Model (E3)](#7-uc-ml-004-star--unstar-model-e3)
- [8. UC-ML-005: Select Model as Base for Run (E4)](#8-uc-ml-005-select-model-as-base-for-run-e4)
  - [8.1 Sub-UC: Show Base Model Toast (E4.1)](#81-sub-uc-show-base-model-toast-e41)
- [9. UC-ML-006: View Summary Statistics (E5)](#9-uc-ml-006-view-summary-statistics-e5)
- [10. Data Entity Reference](#10-data-entity-reference)
- [11. UC-to-UI Mapping Summary](#11-uc-to-ui-mapping-summary)
- [12. Traceability Matrix](#12-traceability-matrix)

---

## 1. Use Case Overview

| | |
|---|---|
| **ID** | UC-ML-001 |
| **Name** | Explore Model Library |
| **Package** | Model Library / Registry (Models screen) |
| **Priority** | High — model selection is a required input for configuring training runs |

The Explore Model Library workflow enables users to discover, evaluate, and select pre-trained model architectures from a central registry. The workflow supports browsing a responsive card grid with search, family-based filtering, and multi-criteria sorting. Users may inspect detailed architecture information in a full-screen modal, star favourite models for quick access, select a model as the base architecture for a new training run, and download pre-trained weights.

**Primary Screen:** Models (single-page layout: summary stat cards → toolbar → responsive card grid)

**Key DB Entities:** `model` (architecture registry), `model_tag` (classification chips), `user_model_star` (per-user favourites junction table)

---

## 2. Actors

### 2.1 Primary Actors

| Actor | Role |
|---|---|
| **Data Scientist / ML Engineer** | Authenticated user who browses, searches, filters, sorts, stars, and selects models. Has full access to all Module E use cases including "Use as Base" and "Download Weights". |
| **Guest User (Read-Only)** | Unauthenticated viewer who can browse the model card grid (E1), search/filter/sort models, and view architecture details (E2). Cannot star models (E3), select a model as base for a run (E4), or download weights (E2.1). |

### 2.2 Secondary Actors

None. The Model Library is a read-heavy, user-driven screen with no background system actors.

---

## 3. Pre-conditions (Global)

Every pre-condition must be true **before** the respective flow begins. The system validates each and rejects with a descriptive error if any fails.

| # | Pre-condition | Validation | Applies To |
|---|---|---|---|
| **PRE-1** | The Models screen is loaded and the model catalogue has been fetched from the API. | `SELECT * FROM model WHERE is_public = TRUE` returns ≥ 1 row. | All (E1–E5) |
| **PRE-2** | User is authenticated and active (for write operations). | `SELECT 1 FROM user WHERE id = ? AND is_active = 1` returns a row. | Star (E3), Use as Base (E4), Download (E2.1) |
| **PRE-3** | An active project is selected (for "Use as Base"). | `SELECT 1 FROM project WHERE id = ? AND user_id = ? AND is_archived = 0` returns a row. | Use as Base (E4) |

> [!NOTE]
> PRE-2 and PRE-3 are **not** required for browse (E1), view detail (E2), or summary statistics (E5). Guest Users can access those flows without authentication.

---

## 4. Post-conditions (Global)

### 4.1 Success Post-conditions

| # | Post-condition | Applies To |
|---|---|---|
| **POST-S1** | The card grid displays all models matching the current search, filter, and sort criteria. | Browse (E1) |
| **POST-S2** | The architecture modal displays complete model metadata including all `model` columns and associated `model_tag` rows. | View Detail (E2) |
| **POST-S3** | A row exists in `user_model_star` with composite PK `(user_id, model_id)` and `starred_at` timestamp (on star); or the row has been deleted (on unstar). | Star (E3) |
| **POST-S4** | `training_run.base_model_id` is set to the selected `model.id` for the next run configuration, and a success toast has been displayed and auto-dismissed. | Use as Base (E4) |
| **POST-S5** | The 6 summary stat cards reflect accurate aggregate counts derived from the `model` table and `user_model_star` junction table. | Summary Stats (E5) |
| **POST-S6** | The pre-trained weight file has been delivered to the user's browser (download initiated). | Download Weights (E2.1) |

### 4.2 Failure Post-conditions

| # | Post-condition | Applies To |
|---|---|---|
| **POST-F1** | No `user_model_star` row is created or deleted; the star icon reverts to its previous state. | Star (E3) — on error |
| **POST-F2** | `training_run.base_model_id` is unchanged; an error toast is displayed. | Use as Base (E4) — on error |

---

## 5. UC-ML-002: Browse Model Cards (E1)

| | |
|---|---|
| **UC ID** | UC-ML-002 |
| **Name** | Browse Model Cards |
| **Relationship** | `«include»` from UC-ML-001 (Explore Model Library) |
| **Mapped From** | General UC: E1; Decomposition: UC-3.1 |

### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Browses, searches, filters, and sorts models. |
| **Guest User** | Same browsing capability as Data Scientist (read-only). |

### Description

The user navigates to the Models screen and is presented with a responsive card grid layout (CSS `auto-fill`, minimum column width 210px). Each model card renders the following elements from the `model` and `model_tag` entities:

- **Architecture thumbnail** (SVG diagram derived from `model.architecture_svg`)
- **Family badge** (coloured chip from `model.family` enum)
- **Star toggle** (filled amber = starred, outline = unstarred; state from `user_model_star`)
- **Model name** (`model.name`)
- **Source label** (`model.source`)
- **Description excerpt** (`model.description`, truncated)
- **Stats grid**: Parameters (`model.param_count`, formatted), FLOPs (`model.flops`, formatted), Top-1 Accuracy (`model.top1_acc`, formatted as percentage), Input Size (`model.input_size`)
- **Tag chips** (from `model_tag.tag` via R16 relationship)
- **Fork count** (`model.fork_count`)
- **Action buttons**: "View Arch" and "Use as Base"

### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-1 | Model catalogue has been fetched (global). |

### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Navigates to the Models screen via sidebar navigation. | |
| 2 | | Fetches model list: `SELECT m.*, COUNT(s.user_id) AS star_count FROM model m LEFT JOIN user_model_star s ON m.id = s.model_id WHERE m.is_public = TRUE GROUP BY m.id`. |
| 3 | | For each model, fetches tags: `SELECT tag FROM model_tag WHERE model_id = ?` (R16). |
| 4 | | Renders the card grid in default sort order (by `fork_count` DESC). Displays "N / total" count in the filter bar header (e.g., "12 / 12"). |
| 5 | Scrolls through the card grid to browse available models. | Grid layout responsively adjusts columns based on viewport width. |

### Post-conditions

| # | Post-condition |
|---|---|
| POST-S1 | All public, non-deleted models are rendered as cards in the grid. |

### Data Requirements & Constraints

| Entity | Attributes Used | Constraints |
|---|---|---|
| `model` | `id`, `slug`, `name`, `full_name`, `family`, `param_count`, `flops`, `top1_acc`, `input_size`, `depth`, `source`, `description`, `fork_count`, `architecture_svg`, `is_public` | `family` constrained by `CHECK` to: `'CNN'`, `'Transformer'`, `'Segmentation'`, `'Detection'`, `'Lightweight'`, `'Multimodal'`, `'Classical'`. `slug` is `UNIQUE`. |
| `model_tag` | `model_id`, `tag` | FK `model_tag.model_id → model.id` (R16), `ON DELETE CASCADE`. |
| `user_model_star` | `user_id`, `model_id` | Composite PK `(user_id, model_id)`. Used to render star state for authenticated users. |

### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Card grid (auto-fill responsive layout) | Models | Scroll to browse | UC-3.1 |

---

### 5.1 Sub-UC: Search Models (E1.1)

| | |
|---|---|
| **UC ID** | UC-ML-002a |
| **Name** | Search Models |
| **Relationship** | `«include»` from UC-ML-002 (Browse Model Cards) |
| **Mapped From** | General UC: E2 (Search & Filter Models); Decomposition: UC-3.1.1 |

#### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Types search query to filter models. |
| **Guest User** | Same capability. |

#### Description

The user types a query into the search input in the toolbar. The system filters the card grid in real-time, matching against `model.name` and `model.description` (case-insensitive substring match). The filter bar updates the count display ("N / total") to reflect the narrowed result set.

#### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks on the search input in the Models toolbar. | Search input receives focus. |
| 2 | Types a search query (e.g., "efficient"). | |
| 3 | | Applies client-side filter: cards where `model.name ILIKE '%query%'` OR `model.description ILIKE '%query%'` are retained. Non-matching cards are hidden. |
| 4 | | Updates the count display in the filter bar (e.g., "3 / 12"). |
| 5 | Reviews filtered results. | |

#### Alternate Flow: No Results Found

| Step | Actor | System |
|---|---|---|
| 3a | | Filter produces zero matches. |
| 4a | | Displays an empty-state message in the card grid area (e.g., "No models match your search"). Count display shows "0 / total". |

#### Alternate Flow: Clear Search

| Step | Actor | System |
|---|---|---|
| 6 | Clicks the ✕ clear button on the search input. | |
| 7 | | Clears the query string. Removes the search filter. All models (subject to active family filter) are re-displayed. Count resets. |

#### Data Requirements & Constraints

| Entity | Attributes Used | Notes |
|---|---|---|
| `model` | `name`, `description` | Search matches against these two fields. |

#### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Search input in toolbar (with ✕ clear button) | Models (toolbar) | Type to filter | UC-3.1.1 |

---

### 5.2 Sub-UC: Filter by Family (E1.2)

| | |
|---|---|
| **UC ID** | UC-ML-002b |
| **Name** | Filter by Family |
| **Relationship** | `«include»` from UC-ML-002 (Browse Model Cards) |
| **Mapped From** | General UC: E2 (Search & Filter Models); Decomposition: UC-3.1.2 |

#### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Selects a family chip to filter the card grid. |
| **Guest User** | Same capability. |

#### Description

The toolbar displays a horizontal bar of coloured toggle chips representing model families. Exactly one chip is active at a time. The "All" chip is selected by default, showing every model. Clicking a family chip filters the grid to models whose `model.family` matches the selected value. The count display updates to "N / total".

#### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks a family chip (e.g., "Transformer") in the filter bar. | |
| 2 | | Highlights the selected chip (active = coloured, previous chip reverts to default). |
| 3 | | Filters the card grid: retains only cards where `model.family = 'Transformer'`. |
| 4 | | Updates count display (e.g., "3 / 12"). |
| 5 | Reviews the filtered results. | |

#### Alternate Flow: Select "All"

| Step | Actor | System |
|---|---|---|
| 1a | Clicks the "All" chip. | |
| 2a | | Removes the family filter. All models (subject to active search query) are displayed. Count resets to "total / total". |

#### Data Requirements & Constraints

| Entity | Attributes Used | Constraints |
|---|---|---|
| `model` | `family` | `ENUM('CNN','Transformer','Segmentation','Detection','Lightweight','Multimodal','Classical')`. CHECK constraint enforces valid values. |

> [!IMPORTANT]
> The family chip bar must present **all 7 enum values plus "All"** (8 chips total). The chip labels and available filter values are derived directly from the `model.family` CHECK constraint. Adding a new family requires a schema migration to update the ENUM.

#### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Family chip filter bar (8 coloured toggle chips) | Models (toolbar) | Click chip to filter (one active at a time) | UC-3.1.2 |

---

### 5.3 Sub-UC: Sort Models (E1.3)

| | |
|---|---|
| **UC ID** | UC-ML-002c |
| **Name** | Sort Models |
| **Relationship** | `«include»` from UC-ML-002 (Browse Model Cards) |
| **Mapped From** | General UC: E3 (Sort Models); Decomposition: UC-3.1.3 |

#### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Selects a sort criterion to reorder the card grid. |
| **Guest User** | Same capability. |

#### Description

The header right area displays 4 toggle sort buttons. Exactly one button is active at a time (highlighted in green). Clicking a sort button reorders the card grid by the corresponding `model` attribute in descending order. The default sort is "Forks" (by `model.fork_count` DESC).

#### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks a sort button (e.g., "Accuracy") in the header. | |
| 2 | | Highlights the selected sort button (active = green). Previously active button reverts to default. |
| 3 | | Re-sorts the card grid by `model.top1_acc` DESC. |
| 4 | Reviews the reordered results. | |

#### Data Requirements & Constraints

| Sort Button | DB Column | Type | Sort Direction |
|---|---|---|---|
| Forks | `model.fork_count` | `INT` | DESC (default) |
| Accuracy | `model.top1_acc` | `FLOAT` | DESC |
| Params | `model.param_count` | `BIGINT` | DESC |
| Name | `model.name` | `VARCHAR(60)` | ASC (alphabetical) |

> [!NOTE]
> Models with `NULL` values for `top1_acc` or `param_count` should sort to the end of the list (NULLS LAST behaviour).

#### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Sort toggle buttons (Forks, Accuracy, Params, Name) | Models (header right) | Click to change sort (active = green highlight) | UC-3.1.3 |

---

## 6. UC-ML-003: View Architecture Detail (E2)

| | |
|---|---|
| **UC ID** | UC-ML-003 |
| **Name** | View Architecture Detail |
| **Relationship** | `«extend»` from UC-ML-001 (Explore Model Library) |
| **Extension Point** | User clicks "View Arch" button on any model card |
| **Mapped From** | General UC: E4; Decomposition: UC-3.2 |

### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Views full model details; can download weights and use as base. |
| **Guest User** | Views full model details; download and "Use as Base" are auth-gated. |

### Description

When the user clicks the "View Arch" button on any model card, a full-screen modal overlay opens. The modal presents comprehensive model information:

- **Header**: Family badge (coloured chip from `model.family`) + full model name (`model.full_name`)
- **Architecture diagram**: Enlarged SVG visualization (`model.architecture_svg`)
- **Description**: Full paragraph (`model.description`)
- **Stats grid** (3×2 layout):
  - Parameters (`model.param_count`, formatted as e.g., "350M")
  - FLOPs (`model.flops`, formatted as e.g., "4.2B")
  - Top-1 Accuracy (`model.top1_acc`, formatted as e.g., "83.0%")
  - Input Size (`model.input_size`)
  - Depth (`model.depth`)
  - Source (`model.source`)
- **Tag chips**: All associated tags from `model_tag`
- **Action buttons**: Download (icon button) and "Use as Base" (text button)

### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-1 | Model catalogue has been fetched (global). |
| PRE-4 | The target model exists in the `model` table and `is_public = TRUE`. |

### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks "View Arch" button on a model card. | |
| 2 | | Fetches full model record: `SELECT * FROM model WHERE id = ?`. |
| 3 | | Fetches associated tags: `SELECT tag FROM model_tag WHERE model_id = ?`. |
| 4 | | Renders the full-screen architecture modal with all fields populated. |
| 5 | Reviews model architecture, stats, and description. | |
| 6 | Clicks outside the modal or presses Escape to close. | |
| 7 | | Dismisses the modal overlay. Returns to the card grid view. |

### Alternate Flow: Trigger "Use as Base" from Modal

| Step | Actor | System |
|---|---|---|
| 5a | Clicks "Use as Base" button inside the modal. | |
| 5b | | Invokes UC-ML-005 (Select Model as Base for Run). |

### Alternate Flow: Guest User Attempts Auth-Gated Action

| Step | Actor | System |
|---|---|---|
| 5c | Guest User clicks "Use as Base" or "Download" in the modal. | |
| 5d | | Displays an authentication prompt or redirects to login. The modal remains open. |

### Post-conditions

| # | Post-condition |
|---|---|
| POST-S2 | Modal displays complete model metadata from all relevant `model` columns and associated `model_tag` rows. |

### Data Requirements & Constraints

| Entity | Attributes Used | Constraints |
|---|---|---|
| `model` | `id`, `full_name`, `family`, `param_count`, `flops`, `top1_acc`, `input_size`, `depth`, `source`, `description`, `architecture_svg`, `download_url`, `weight_path` | `slug` UNIQUE. `family` CHECK constraint. `architecture_svg` may be NULL (fallback to placeholder). |
| `model_tag` | `model_id`, `tag` | FK `model_tag.model_id → model.id` (R16), `ON DELETE CASCADE`. |

### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| "View Arch" button on card | Models (per card) | Click → opens full-screen modal overlay | UC-3.2 |
| Architecture modal (header, SVG, description, stats grid, tags, actions) | Models → Arch Modal | View details; interact with action buttons | UC-3.2 |

---

### 6.1 Sub-UC: Download Model Weights (E2.1)

| | |
|---|---|
| **UC ID** | UC-ML-003a |
| **Name** | Download Model Weights |
| **Relationship** | `«extend»` from UC-ML-003 (View Architecture Detail) |
| **Extension Point** | User clicks download icon button in the modal footer |
| **Mapped From** | General UC: E7; Decomposition: UC-3.2.1 |

#### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Downloads pre-trained model weights. |

> [!NOTE]
> Guest Users cannot download model weights. This action is auth-gated (PRE-2 required).

#### Description

From within the architecture modal, the authenticated user clicks the download icon button in the modal footer. The system initiates a file download of the pre-trained model weights using the URL stored in `model.download_url` or the file path from `model.weight_path`.

#### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-2 | User is authenticated and active. |
| PRE-4 | The architecture modal is open for a valid model. |
| PRE-5 | `model.download_url` or `model.weight_path` is not NULL for the selected model. |

#### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks the download icon button in the modal footer. | |
| 2 | | Resolves the download source from `model.download_url` (preferred) or `model.weight_path` (fallback). |
| 3 | | Initiates browser file download. |
| 4 | | Browser download manager handles file transfer. |

#### Alternate Flow: No Weights Available

| Step | Actor | System |
|---|---|---|
| 2a | | Both `model.download_url` and `model.weight_path` are NULL. |
| 3a | | Download button is disabled (greyed out) with a tooltip: "Weights not available". |

#### Post-conditions

| # | Post-condition |
|---|---|
| POST-S6 | Pre-trained weight file download has been initiated in the user's browser. |

#### Data Requirements & Constraints

| Entity | Attributes Used | Constraints |
|---|---|---|
| `model` | `download_url`, `weight_path` | Both are `VARCHAR(512)`, nullable. At least one should be non-NULL for the download button to be active. |

#### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Download icon button (modal footer) | Models → Arch Modal | Click → initiates file download | UC-3.2.1 |

---

## 7. UC-ML-004: Star / Unstar Model (E3)

| | |
|---|---|
| **UC ID** | UC-ML-004 |
| **Name** | Star / Unstar Model |
| **Relationship** | `«extend»` from UC-ML-001 (Explore Model Library) |
| **Extension Point** | Authenticated user clicks the star icon on a model card |
| **Mapped From** | General UC: E5; Decomposition: UC-3.3 |

### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Toggles star state on model cards to bookmark favourites. |

> [!IMPORTANT]
> **Guest Users cannot star models.** The star icon is either hidden or visually disabled for unauthenticated users. This action is auth-gated (PRE-2 required).

### Description

The star icon on each model card acts as a toggle for the current authenticated user. Starring a model inserts a row into the `user_model_star` junction table with the composite PK `(user_id, model_id)`. Unstarring deletes that row. The star icon visual state reflects the current toggle: filled amber when starred, outline when not starred. The "Starred" count in the summary stat cards (E5) updates accordingly.

### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-1 | Model catalogue has been fetched (global). |
| PRE-2 | User is authenticated and active. |

### Main Flow — Star (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks the outline star icon on a model card. | |
| 2 | | Verifies no existing row: `SELECT 1 FROM user_model_star WHERE user_id = ? AND model_id = ?`. |
| 3 | | Inserts: `INSERT INTO user_model_star (user_id, model_id, starred_at) VALUES (?, ?, NOW())`. |
| 4 | | Updates the star icon to filled amber. |
| 5 | | Increments the "Starred" summary stat card count. |

### Alternate Flow — Unstar

| Step | Actor | System |
|---|---|---|
| 1a | Clicks the filled amber star icon on a model card (already starred). | |
| 2a | | Verifies existing row: `SELECT 1 FROM user_model_star WHERE user_id = ? AND model_id = ?`. |
| 3a | | Deletes: `DELETE FROM user_model_star WHERE user_id = ? AND model_id = ?`. |
| 4a | | Updates the star icon to outline. |
| 5a | | Decrements the "Starred" summary stat card count. |

### Alternate Flow — Guest User Attempts Star

| Step | Actor | System |
|---|---|---|
| 1b | Guest User clicks the star icon. | |
| 2b | | Displays authentication prompt or login redirect. No database mutation occurs. |

### Alternate Flow — Idempotency / Conflict

| Step | Actor | System |
|---|---|---|
| 3c | | `INSERT` fails due to duplicate PK `(user_id, model_id)` (race condition — user double-clicked). |
| 4c | | Uses `INSERT ... ON CONFLICT DO NOTHING`. Star state remains filled. No error displayed. |

### Post-conditions

| # | Post-condition |
|---|---|
| POST-S3 | On star: a row exists in `user_model_star` with `(user_id, model_id)` as composite PK and `starred_at = NOW()`. On unstar: that row has been deleted. |
| POST-F1 | On error: no row is created or deleted. Star icon reverts to its previous state. |

### Data Requirements & Constraints

| Entity | Attributes | Constraints |
|---|---|---|
| `user_model_star` | `user_id` (UUID FK → `user.id`), `model_id` (UUID FK → `model.id`), `starred_at` (TIMESTAMP, NOT NULL) | **PK**: `(user_id, model_id)` — composite primary key. `ON DELETE CASCADE` for both FKs (R17). A user can star a model at most once (enforced by PK). |

> [!TIP]
> The `user_model_star` table implements the M:N relationship R17 between `user` and `model`. The composite PK naturally prevents duplicate stars and provides an efficient lookup path for rendering per-user star state.

### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Star icon (card top-right) | Models (per card) | Click to toggle star state (filled amber ↔ outline) | UC-3.3 |

---

## 8. UC-ML-005: Select Model as Base for Run (E4)

| | |
|---|---|
| **UC ID** | UC-ML-005 |
| **Name** | Select Model as Base for Run |
| **Relationship** | `«extend»` from UC-ML-001 (Explore Model Library) |
| **Extension Point** | Authenticated user clicks "Use as Base" button |
| **Mapped From** | General UC: E6; Decomposition: UC-3.4 |

### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Selects a model architecture as the base for the next training run. |

> [!IMPORTANT]
> **Guest Users cannot select a model as base.** The "Use as Base" button is auth-gated (PRE-2 and PRE-3 required).

### Description

The "Use as Base" button appears on each model card and within the architecture modal. When clicked by an authenticated user, the system sets `training_run.base_model_id` to the selected `model.id` for the user's next training run configuration. A success toast notification is displayed and auto-dismissed after 2800ms. This use case participates in the broader "Manage Training Run" workflow (UC-1.1) as it establishes the FK relationship `training_run.base_model_id → model.id` (R5).

### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-2 | User is authenticated and active. |
| PRE-3 | An active project is selected. |
| PRE-4 | The target model exists and `is_public = TRUE`. |

### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Clicks "Use as Base" button on a model card or within the architecture modal. | |
| 2 | | Stores the selected `model.id` as the base model for the next training run configuration: sets `training_run.base_model_id = model.id` (R5). |
| 3 | | **Invokes UC-ML-005a** (Show Base Model Toast). |
| 4 | Reviews the toast confirmation and continues browsing. | |

### Alternate Flow: Guest User Attempts "Use as Base"

| Step | Actor | System |
|---|---|---|
| 1a | Guest User clicks "Use as Base". | |
| 2a | | Displays authentication prompt or login redirect. No database mutation occurs. |

### Alternate Flow: No Active Project

| Step | Actor | System |
|---|---|---|
| 2b | | PRE-3 validation fails — no active project selected. |
| 3b | | Displays an error toast: "Please select a project before choosing a base model." |

### Post-conditions

| # | Post-condition |
|---|---|
| POST-S4 | `training_run.base_model_id` is set to the selected `model.id` for the next run configuration. The FK relationship R5 (`training_run.base_model_id → model.id`) is established. A toast has been displayed and auto-dismissed. |
| POST-F2 | On error: `training_run.base_model_id` is unchanged. An error toast is displayed. |

### Data Requirements & Constraints

| Entity | Attributes | Constraints |
|---|---|---|
| `training_run` | `base_model_id` (UUID FK → `model.id`) | NULLABLE — `ON DELETE SET NULL` (R5). Model removal doesn't break run history. |
| `model` | `id` | PK. Must exist and `is_public = TRUE`. |

### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| "Use as Base" button | Models (per card) / Models → Arch Modal | Click → sets base model + toast | UC-3.4 |

---

### 8.1 Sub-UC: Show Base Model Toast (E4.1)

| | |
|---|---|
| **UC ID** | UC-ML-005a |
| **Name** | Show Base Model Toast |
| **Relationship** | `«include»` from UC-ML-005 (Select Model as Base for Run) |
| **Mapped From** | Decomposition: UC-3.4.1 |

#### Description

A temporary success toast notification appears at the bottom of the screen after a model is successfully selected as the base. The toast displays: **"✓ {model.name} set as base model"** and auto-dismisses after a **2800ms timeout**.

#### Main Flow

| Step | System |
|---|---|
| 1 | Renders a success toast at the bottom of the viewport with the message: "✓ {model.name} set as base model". |
| 2 | Starts a 2800ms timer. |
| 3 | After 2800ms, the toast auto-dismisses with a fade-out animation. |

#### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| Toast notification (floating, bottom of screen) | Models (floating overlay) | Auto-dismiss after 2.8s; no user interaction required | UC-3.4.1 |

---

## 9. UC-ML-006: View Summary Statistics (E5)

| | |
|---|---|
| **UC ID** | UC-ML-006 |
| **Name** | View Summary Statistics |
| **Relationship** | `«extend»` from UC-ML-001 (Explore Model Library) |
| **Extension Point** | Always visible — auto-computed on page load |
| **Mapped From** | Decomposition: UC-3.5 |

### Actors

| Actor | Role |
|---|---|
| **Data Scientist** | Views summary stats (all 6 cards). |
| **Guest User** | Views summary stats; "Starred" card shows 0 or is hidden for unauthenticated users. |

### Description

The Models screen header displays a row of 6 summary stat cards. These cards provide at-a-glance aggregate counts computed from the `model` table and the `user_model_star` junction table. The cards are view-only and auto-computed — no user interaction is required beyond loading the page.

### Stat Card Definitions

| # | Card Label | Aggregation Query | Source |
|---|---|---|---|
| 1 | **Total Models** | `SELECT COUNT(*) FROM model WHERE is_public = TRUE` | `model` |
| 2 | **CNN Architectures** | `SELECT COUNT(*) FROM model WHERE family = 'CNN' AND is_public = TRUE` | `model.family` |
| 3 | **Transformers** | `SELECT COUNT(*) FROM model WHERE family = 'Transformer' AND is_public = TRUE` | `model.family` |
| 4 | **Classical ML** | `SELECT COUNT(*) FROM model WHERE family = 'Classical' AND is_public = TRUE` | `model.family` |
| 5 | **Seg/Det** | `SELECT COUNT(*) FROM model WHERE family IN ('Segmentation', 'Detection') AND is_public = TRUE` | `model.family` |
| 6 | **Starred** | `SELECT COUNT(*) FROM user_model_star WHERE user_id = ?` | `user_model_star` |

### Pre-conditions

| # | Pre-condition |
|---|---|
| PRE-1 | Model catalogue has been fetched (global). |

### Main Flow (Happy Path)

| Step | Actor | System |
|---|---|---|
| 1 | Navigates to the Models screen. | |
| 2 | | Computes aggregate counts (see Stat Card Definitions above). |
| 3 | | Renders 6 stat cards in a horizontal row in the page header. |
| 4 | Observes summary statistics. | Cards are view-only; no interaction required. |

### Post-conditions

| # | Post-condition |
|---|---|
| POST-S5 | All 6 stat cards display accurate counts reflecting the current state of `model` and `user_model_star`. |

### Data Requirements & Constraints

| Entity | Attributes Used | Notes |
|---|---|---|
| `model` | `family`, `is_public` | Aggregated by `family` enum values. |
| `user_model_star` | `user_id` | Count filtered by authenticated user's ID. Returns 0 for Guest Users. |

### UI/UX Mapping

| UI Element | Screen | Interaction | Decomposition Ref |
|---|---|---|---|
| 6 summary stat cards in page header | Models (header) | View-only (auto-computed, no user action) | UC-3.5 |

---

## 10. Data Entity Reference

Complete summary of all database entities involved in Module E use cases.

### 10.1 `model` — Architecture Registry (§6, Data Dictionary)

| Column | Type | Nullable | UC Reference |
|---|---|---|---|
| `id` | `UUID` / PK | ✗ | All |
| `slug` | `VARCHAR(60)` / UK | ✗ | URL routing |
| `name` | `VARCHAR(60)` | ✗ | E1 (card title), E4 (toast) |
| `full_name` | `VARCHAR(120)` | ✗ | E2 (modal title) |
| `family` | `ENUM(...)` | ✗ | E1 (badge), E1.2 (filter), E5 (stats) |
| `param_count` | `BIGINT` | ✓ | E1 (stats grid), E1.3 (sort), E2 (stats), E5 |
| `flops` | `BIGINT` | ✓ | E1 (stats grid), E2 (stats) |
| `top1_acc` | `FLOAT` | ✓ | E1 (stats grid), E1.3 (sort), E2 (stats) |
| `input_size` | `VARCHAR(20)` | ✓ | E1 (stats grid), E2 (stats) |
| `depth` | `INT` | ✓ | E2 (stats grid) |
| `source` | `VARCHAR(40)` | ✓ | E1 (card), E2 (stats) |
| `description` | `TEXT` | ✓ | E1 (excerpt), E1.1 (search), E2 (full) |
| `fork_count` | `INT` | ✗ | E1 (card), E1.3 (sort) |
| `architecture_svg` | `TEXT` | ✓ | E1 (thumbnail), E2 (enlarged) |
| `download_url` | `VARCHAR(512)` | ✓ | E2.1 (download) |
| `weight_path` | `VARCHAR(512)` | ✓ | E2.1 (download fallback) |
| `is_public` | `BOOLEAN` | ✗ | All (visibility filter) |
| `created_at` | `TIMESTAMP` | ✗ | — |
| `updated_at` | `TIMESTAMP` | ✗ | — |

### 10.2 `model_tag` — Tag Chips (§7, Data Dictionary)

| Column | Type | Nullable | UC Reference |
|---|---|---|---|
| `id` | `UUID` / PK | ✗ | — |
| `model_id` | `UUID` / FK → `model.id` | ✗ | E1 (card chips), E2 (modal chips) |
| `tag` | `VARCHAR(40)` | ✗ | E1, E2 |

> FK constraint: `ON DELETE CASCADE` (R16). Deleting a model removes all its tags.

### 10.3 `user_model_star` — Per-User Starred Models (§8, Data Dictionary)

| Column | Type | Nullable | UC Reference |
|---|---|---|---|
| `user_id` | `UUID` / FK → `user.id` | ✗ (PK) | E3 (star toggle), E5 (starred count) |
| `model_id` | `UUID` / FK → `model.id` | ✗ (PK) | E3 (star toggle) |
| `starred_at` | `TIMESTAMP` | ✗ | E3 (audit trail) |

> **PK**: `(user_id, model_id)` — composite primary key. Both FKs cascade on delete (R17).

### 10.4 `training_run` — FK Reference Only

| Column | Type | Nullable | UC Reference |
|---|---|---|---|
| `base_model_id` | `UUID` / FK → `model.id` | ✓ | E4 (Use as Base) |

> FK constraint: `ON DELETE SET NULL` (R5). Removing a model from the registry does not break existing training run history.

---

## 11. UC-to-UI Mapping Summary

Consolidated mapping from all Module E use cases to their corresponding UI elements, as defined in the Detailed Use Case Decomposition (Workflow 3, §3.2).

| Sub-UC | UC ID | UI Element | Screen | Interaction |
|---|---|---|---|---|
| Browse Model Cards | UC-ML-002 | Card grid (auto-fill responsive layout) | Models | Scroll to browse |
| Search Models | UC-ML-002a | Search input in toolbar (with ✕ clear) | Models (toolbar) | Type to filter |
| Filter by Family | UC-ML-002b | Family chip filter bar (8 coloured chips) | Models (toolbar) | Click chip to filter |
| Sort Models | UC-ML-002c | Sort toggle buttons (4 options) | Models (header right) | Click to change sort |
| View Architecture Detail | UC-ML-003 | Architecture modal (full-screen overlay) | Models → Arch Modal | Click "View Arch" → modal opens |
| Download Model Weights | UC-ML-003a | Download icon button (modal footer) | Models → Arch Modal | Click → downloads weights |
| Star / Unstar Model | UC-ML-004 | Star icon (card top-right) | Models (per card) | Click to toggle star state |
| Select as Base for Run | UC-ML-005 | "Use as Base" button (card + modal) | Models (per card / modal) | Click → toast + sets base model |
| Show Base Model Toast | UC-ML-005a | Toast notification (floating) | Models (floating) | Auto-dismiss after 2.8s |
| View Summary Statistics | UC-ML-006 | 6 summary stat cards in page header | Models (header) | View-only (auto-computed) |

---

## 12. Traceability Matrix

| General UC (Module E) | Decomposition UC | Spec UC ID | Relationship |
|---|---|---|---|
| E1 — Browse Model Library | UC-3.1 — Browse Model Cards | UC-ML-002 | `«include»` |
| E2 — Search & Filter Models | UC-3.1.1 — Search Models | UC-ML-002a | `«include»` |
| E2 — Search & Filter Models | UC-3.1.2 — Filter by Family | UC-ML-002b | `«include»` |
| E3 — Sort Models | UC-3.1.3 — Sort Models | UC-ML-002c | `«include»` |
| E4 — View Architecture Detail | UC-3.2 — View Architecture Detail | UC-ML-003 | `«extend»` |
| E7 — Download Model Weights | UC-3.2.1 — Download Model Weights | UC-ML-003a | `«extend»` |
| E5 — Star / Unstar Model | UC-3.3 — Star / Unstar Model | UC-ML-004 | `«extend»` |
| E6 — Select Model as Base for Run | UC-3.4 — Select as Base for Run | UC-ML-005 | `«extend»` |
| — | UC-3.4.1 — Show Base Model Toast | UC-ML-005a | `«include»` |
| — (Summary) | UC-3.5 — View Summary Statistics | UC-ML-006 | `«extend»` |
