# Predictive Pantry

Predictive Pantry is a **domain-driven web application** that models a real-world pantry and derives insights about inventory, expiration, and replenishment over time.

The system demonstrates a **structure-first architecture** built around a custom DSL called **TryAngleTree (TAT)**. Application semantics are defined structurally, while UI layers simply render runtime state.

The goal of the project is to explore how **structural domain modeling can simplify application development and AI-assisted programming**.

---

# Live System Capabilities

Predictive Pantry currently supports:

### Inventory Management

* Add items to pantry
* Track grouped inventory counts
* Adjust stock levels
* Set low-stock thresholds
* Define item categories
* Define shelf life

### Intelligent Analysis

* Detect low stock
* Detect expiration risk
* Track expiration automatically based on shelf life
* Generate inventory recommendations

### Recommendation Engine

The system can recommend actions such as:

* **Check item** (expired items)
* **Use soon** (approaching expiration)
* **Restock soon** (low stock)

Recommendations are ranked and surfaced to the user.

### Shopping List Generation

The app can generate a shopping list derived from:

```
inventory state
→ analysis
→ recommendation ranking
→ shopping list
```

### Persistence

Runtime state is persisted in browser storage so inventory survives page reloads.

### Scenario Testing

The project includes a **scenario harness** that allows deterministic testing of pantry logic and edge cases.

---

# Architectural Philosophy

Predictive Pantry follows a strict architectural hierarchy:

```
TAT → Structure and semantics
JSX → Rendering of runtime state
CSS → Visual styling only
```

This ensures that:

* **Application behavior lives in the domain layer**
* **UI never becomes the source of truth**
* **Structure drives implementation**

This design also makes the project highly compatible with **AI-assisted development tools**.

---

# What is TryAngleTree (TAT)?

TryAngleTree is a **structural DSL for modeling application behavior**.

Instead of defining behavior inside UI code, TAT describes:

* domain structure
* allowed mutations
* execution programs
* handler contracts

A TAT program is executed by the runtime and produces:

```
state updates
events
outputs
warnings
errors
```

UI components simply render this runtime state.

This separation enables:

* deterministic program execution
* scenario testing
* clear domain modeling
* reduced UI complexity

---

# Domain Model

Predictive Pantry models a **real-world pantry system**.

The top-level domain is **Pantry**.

```
Pantry
 │
 ├── Item
 │      Identity of a thing (Eggs, Milk, Spinach)
 │
 ├── Inventory
 │      Aggregated view of pantry contents
 │
 ├── Inventory History
 │      Time-based record of inventory changes
 │
 ├── Item Analysis
 │      Derived insights about pantry state
 │
 └── Inventory Panel
        Interaction and visualization layer
```

---

# Domain Flow

The application models a real pantry through layered projections:

```
Real Pantry
     ↓
Inventory (current state projection)
     ↓
Inventory History (time dimension)
     ↓
Item Analysis (derived insights)
     ↓
Recommendations
     ↓
Shopping List
```

Each layer derives information from the previous one.

---

# Core Pantry Features

## Item

Items represent **identities of things** independent of inventory.

Examples:

* Eggs
* Milk
* Spinach

Items themselves **do not expire**.

Example structure:

```
Item
id
name
category
tags
source
```

---

## Inventory

Inventory represents the **current grouped state of the pantry**.

Rather than tracking every individual container, inventory aggregates item quantities.

Example structure:

```
InventoryRecord
itemId
totalQuantity
healthyCount
expiringSoonCount
expiredCount
lowStockThreshold
locations
updatedAt
source
```

Important rule:

**Inventory records represent grouped pantry state, not individual instances.**

---

## Inventory History

Tracks **aggregated changes over time**.

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

History provides the **time dimension** of the pantry.

---

## Item Analysis

Item Analysis derives insights from:

```
Items
Inventory
Inventory History
Shelf Life
```

Examples of insights:

* low stock detection
* expiration warnings
* replenishment timing
* usage patterns (future)

Item Analysis **never mutates pantry state**.

---

## Recommendations

Derived from item analysis.

Examples:

```
check-item
use-soon
restock-soon
```

Recommendations are ranked and displayed to the user.

---

## Shopping List

A shopping list can be generated from ranked recommendations.

```
recommendations
→ priority ranking
→ shopping list
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

### components/

JSX rendering layer.

### data/

TAT program definitions and registries.

### styles/

Feature CSS.

### hooks/

Feature-specific React hooks.

### handlers/

Runtime execution handlers.

### utils/

Feature utilities.

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

Handlers mutate state and emit events.

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

# CSS Architecture

CSS follows a **broad → specific naming pattern** using kebab-case.

### Root App Class

```
tat-app
```

Defines global CSS variables.

---

### Feature Root

```
tat-feature-{feature-name}
```

Allows feature-level CSS variable overrides.

---

### Component Naming

```
{feature}-{component}
```

Example:

```
inventory-panel
inventory-row
```

---

### CSS Variables

Variables are **semantic**, not color-based.

Examples:

```
--color-surface
--color-text
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

Components never hardcode colors.

---

# Development Rules

The application always follows:

```
Structure → Logic → UI → Styling
```

Or more specifically:

```
TAT → JSX → CSS
```

Meaning:

1. **Define structure**
2. **Implement runtime logic**
3. **Render with JSX**
4. **Improve readability with CSS**

UI should never become the source of truth for domain logic.

---

# Scenario Testing

The project includes a scenario harness used to test pantry behavior.

Scenarios execute TAT programs directly through the runtime without requiring UI.

```
bootTatApp(...)
runtime.dispatch(...)
```

This allows deterministic testing of edge cases such as:

* expiration transitions
* recommendation generation
* restocking logic
* inventory mutations

---

# Future Expansion

Predictive Pantry is designed to support additional domains.

### Recipes (Future Feature)

Recipes will reference pantry data but remain a **separate domain**.

```
Pantry → informs Recipes
Recipes reference Items
Recipes are not inside Pantry
```

Potential features:

```
Recipe Library
Recipe Builder
Recipe Suggestions
```

---

## Purpose of This Document

This README serves as the **architectural contract** for the project.

All development — human or AI-assisted — should align with this specification.

If the implementation diverges from the architecture, the specification should be updated intentionally rather than bypassed.

## License

© 2026 Carl Biggers-Johanson

This project is provided for educational, portfolio, and demonstration purposes.

You are free to:
- view the source
- study the architecture
- learn from the implementation

You may not reproduce, distribute, or use this code commercially without explicit permission from the author.

Predictive Pantry and the TryAngleTree (TAT) architecture are original works created and developed by **Carl Biggers-Johanson.**

For licensing inquiries or collaboration opportunities, please contact:

cjohanson64@gmail.com
