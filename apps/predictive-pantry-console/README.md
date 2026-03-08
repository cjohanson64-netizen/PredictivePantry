# Predictive Pantry Console

Console-only TryAngleTree starter for the Predictive Pantry MVP.

## What is included

- TAT graph foundation for the pantry domain
- TAT actions that model the first decision routes
- Scenario runners for:
  - bootstrap structure
  - low-stock routing
  - expiry routing
  - grocery prediction routing

## Run

From the repo root:

```bash
node apps/predictive-pantry-console/src/index.mjs
node apps/predictive-pantry-console/src/index.mjs stock
node apps/predictive-pantry-console/src/index.mjs expiry
node apps/predictive-pantry-console/src/index.mjs predict
```
