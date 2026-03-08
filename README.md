# Predictive Pantry — Architecture Specification

This document is the **locked architectural specification** for the Predictive Pantry application.
All development decisions should follow the structures and rules defined here.

This spec exists so that automated tools (Codex, Claude, etc.) and human contributors always have a **single source of truth** for the system architecture.

---

# Architecture Overview

Predictive Pantry models a **real-world pantry** and derives insights from its contents over time.

The system follows a domain-first architecture where **Pantry is the root domain**.

```
Pantry
 │
 ├── Item
 │      Identity of a thing (Eggs, Milk, Spinach)
 │
 ├── Inventory
 │      Grouped analytical view of what currently exists in the pantry
 │
 ├── Inventory History
 │      Aggregated record of how inventory changes over time
 │
 ├── Item Analysis
 │      Derived insights (low stock, expiration warnings, usage patterns)
 │
 └── Inventory Panel
        Interaction and visualization layer
```

### Domain Flow

```
Real Pantry
     ↓
Inventory (current state projection)
     ↓
Inventory History (time dimension)
     ↓
Item Analysis (derived insights)
     ↓
Inventory Panel (user interaction)
```

### Future Domain Expansion

Recipes are **not part of Pantry**, but they depend on Pantry data.

```
Pantry ──────► Recipes
       informs suggestions
```

Recipes may reference:

* Items
* Pantry inventory state
* Analysis insights

Example future features:

```
Recipes
 ├── Recipe Library
 ├── Recipe Builder
 └── Recipe Suggestions
```

### Architectural Philosophy

The application follows a strict structural hierarchy:

```
TAT → Structure and semantics
JSX → Rendering of runtime state
CSS → Visual styling only
```

This ensures the **domain model and logic remain independent of the UI layer**.

---

# Core Doctrine

The application follows a strict architectural hierarchy:

**TAT first → Render second → Beautify third**

Meaning:

* **TAT (TryAngleTree)** defines the structure and semantics of the application.
* **JSX** is responsible only for rendering the runtime state.
* **CSS** is responsible only for aesthetics.

JSX must never become the source of truth for application behavior.

---

# Domain Model

## Pantry (Root Domain)

The **Pantry** is the top-level domain of the application.

The app models and analyzes the state of a real-world pantry.

The pantry contains:

* Items (identities of things)
* Inventory (summarized current pantry state)
* Inventory History (how that state changes)
* Item Analysis (derived insights)
* Inventory Panel (interaction surface)

Pantry represents the **real-world environment** that the application models.

---

# Core Pantry Features

## Item

Defines the **identity of a thing**.

Items represent what something *is*, independent of whether it exists in the pantry.

Example items:

* Eggs
* Milk
* Spinach

Items do **not expire**.

Example structure:

```
Item
id
name
category (future)
tags (future)
source
```

---

## Inventory

Inventory represents the **analytical snapshot of what currently exists in the pantry**.

Inventory is **grouped by item**, not by physical instance.

This avoids tracking every individual carton or container.

Inventory records contain aggregated data such as:

* total quantity
* locations
* expiring soon count
* expired count
* low stock threshold

Example structure:

```
InventoryRecord
itemId
totalQuantity
locations
expiringSoonCount
expiredCount
lowStockThreshold
updatedAt
source
```

Important rule:

**Inventory stores grouped pantry state, not individual item instances.**

---

## Inventory History

Tracks **aggregated item-level changes over time**.

History does **not** track the lifecycle of every individual instance.

Instead, it records meaningful pantry changes.

Examples:

* items added
* items consumed
* items expired
* items restocked

Example structure:

```
InventoryHistoryRecord
id
itemId
addedCount
consumedCount
expiredCount
expiringSoonCount
lastEventAt
source
```

---

## Item Analysis

Item Analysis derives insights from:

* Items
* Inventory
* Inventory History

Examples of insights:

* low stock detection
* expiration warnings
* replenishment timing
* usage patterns (future)

Item Analysis **never mutates pantry state**.

---

## Inventory Panel

The **interaction surface** of the pantry.

Responsibilities:

* viewing inventory
* triggering item actions
* displaying analysis results

Rule:

**Inventory Panel renders and interacts but does not own domain truth.**

---

# Future Domain (Not Inside Pantry)

## Recipes (Future Feature)

Recipes are a separate domain that **links to Pantry**, but are **not part of Pantry itself**.

Recipes may reference:

* Items
* Pantry state
* Inventory insights

Example future features:

* Recipe Library
* Recipe Builder
* Recipe Suggestions

Relationship:

```
Pantry → informs Recipes
Recipes reference Items
Recipes are not inside Pantry
```

---

# Feature Architecture

All features follow this structure:

```
src/features/
  Directory.jsx
  feature-name/
    FeatureName.jsx
    components/
    data/
    styles/
    hooks/
    handlers/
    utils/
```

Definitions:

**components/**
JSX rendering layer.

**data/**
TAT program definitions and registries.

**styles/**
Feature CSS.

**hooks/**
Feature-specific React hooks.

**handlers/**
TAT execution handlers.

**utils/**
Feature utilities.

---

# TAT Rules

* TAT files define application behavior.
* Registries must be **explicitly declared**.
* `.tat` files are parsed into normalized `TatProgram` objects.
* Runtime executes programs using handlers.

There is **no filesystem auto-discovery** of TAT files.

---

# Runtime Responsibilities

The runtime manages:

* application state
* event log
* program execution
* errors
* warnings
* outputs
* execution history

Handlers update state and emit events.

---

# State Model

The application uses a **domain-first state model**.

Example state shape:

```
{
  pantry: {
    items: { items: [] },
    inventory: { records: [] },
    inventoryHistory: { records: [] }
  },

  eventLog: [],

  session: {
    seedMode: boolean,
    seedScenario: string | null,
    lastUpdatedAt: string | null,
    bootStatus: "booting" | "ready" | "failed"
  }
}
```

---

# Seed / Demo State

Seed state is allowed for development and testing.

Rules:

* seed state must be explicitly injected
* seed mode must be visible in session state
* seeded records must include metadata

Example source metadata:

```
source: {
  kind: "seed" | "user",
  label: string
}
```

---

# CSS Architecture

CSS follows a **broad → specific naming pattern using kebab-case**.

## Root App Class

```
tat-app
```

Defines global CSS variables.

---

## Feature Root

```
tat-feature-{feature-name}
```

Allows feature-level CSS variable overrides.

---

## Component Naming

```
{feature}-{component}
```

Example:

```
inventory-panel
inventory-row
```

---

## Elements

```
{component}-{element}
```

Example:

```
inventory-row-name
inventory-row-quantity
```

---

## Modifiers

```
{component}--{modifier}
```

Example:

```
inventory-row--low-stock
inventory-row--expired
```

---

# CSS Variable System

Variables are **semantic**, not color-based.

Examples:

```
--color-surface
--color-surface-alt
--color-text
--color-text-muted
--color-border

--color-accent
--color-success
--color-warning
--color-danger
```

Variables cascade:

```
tat-app → tat-feature → component
```

Components must **never hardcode colors**.

---

# Development Rules

Always follow:

1. **TAT first**
2. **Render second**
3. **Beautify third**

Meaning:

* Structure is defined in TAT.
* JSX reflects runtime truth.
* CSS improves readability and aesthetics.

---

# Version 1 Scope

Initial vertical slices focus on Pantry core functionality:

* Item
* Inventory
* Inventory History

Actions implemented first:

* add item
* consume item

Analysis and recipes come later.

---

# Slice 1 Runtime Notes

Slice 1 is wired through explicit Pantry registry + TAT programs only:

* `src/features/pantry/data/registry.js`
* `src/features/pantry/data/programs/pantry-root.tat`
* `src/features/pantry/data/programs/item-root.tat`
* `src/features/pantry/data/programs/inventory-root.tat`
* `src/features/pantry/data/programs/add-item.tat`
* `src/features/pantry/data/programs/consume-item.tat`

Slice 1 state is grouped and aggregate-first:

* `pantry.items.items`
* `pantry.inventory.records`
* `pantry.inventoryHistory.records`

Scenario harness coverage for Slice 1 lives in `src/scenarios/` and executes through `bootTatApp(...)` + `runtime.dispatch(...)` (no JSX semantics).

---

## Feature Implementation Contract

Before implementing any new slice or feature, evaluate it in this order:

### 1. Structure / Semantics
- Does the required state shape already exist?
- Does the concept have a clear record contract, vocabulary, and pipeline position?
- If not, define those first.

Examples:
- state location
- record fields
- allowed values
- upstream/downstream dependencies

No implementation should begin before the semantic structure is clear.

### 2. Logic
- Does the runtime logic already exist to support the feature?
- If not, implement the behavior first.
- Scenario coverage should validate the logic before UI polish.

This includes:
- handlers
- helpers
- derivation rules
- pipeline rules
- event behavior

### 3. Component Availability
- Is there already a feature-owned component or panel where the feature belongs?
- If not, add the correct UI surface.

UI should remain a rendering and intent layer.
Business logic must stay in runtime/handlers/helpers.

### 4. Human-Readable Readiness
- Is the feature stable enough to render as human-readable UI instead of JSON?
- If yes, upgrade it from raw JSON to a human-readable presentation.
- If no, keep it in JSON until the semantics settle.

### Rule of Order
Always build in this order:

semantic structure  
→ logic  
→ component  
→ human-readable UI

Never skip ahead to UI polish if structure or logic is still unsettled.

# Purpose of This Document

This README serves as the **locked architectural contract** for the project.

All automated tooling and human development should align with this specification.

If the implementation diverges from this spec, the spec should be updated intentionally rather than silently bypassed.
