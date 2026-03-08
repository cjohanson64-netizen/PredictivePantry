import { createTatHandlerResult } from "../../../lib/tatHandlers"
import { nowIso } from "./pantryHandlerCore"

export function pantryRootHandler(context) {
  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      session: {
        lastUpdatedAt: nowIso(),
      },
    },
    events: [],
    outputs: [
      {
        message: "Pantry root loaded",
        featureName: context.featureName,
        programName: context.programName,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function itemRootHandler(context) {
  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      session: {
        lastUpdatedAt: nowIso(),
      },
    },
    events: [],
    outputs: [
      {
        message: "Item root loaded",
        featureName: context.featureName,
        programName: context.programName,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function inventoryRootHandler(context) {
  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      session: {
        lastUpdatedAt: nowIso(),
      },
    },
    events: [],
    outputs: [
      {
        message: "Inventory root loaded",
        featureName: context.featureName,
        programName: context.programName,
      },
    ],
    warnings: [],
    errors: [],
  })
}
