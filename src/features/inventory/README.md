# Inventory Feature

This feature is responsible for **physical pantry state management**.

It represents the real-world inventory layer — quantities, expiration states,
thresholds, and mutation of stock counts.

## Responsibilities

Inventory programs will eventually manage:

- Quantity mutations (add, consume, adjust)
- Expiration state transitions
- Threshold updates
- Inventory history pruning
- Data integrity for item counts

## Relationship to Other Features

Inventory acts as the **state layer** beneath the Pantry domain.
