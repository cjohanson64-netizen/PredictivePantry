import { createTatHandlerResult } from "../../../lib/tatHandlers"
import { asTimeMs } from "../utils/activityHelpers"
import { buildItemAnalysisRecord } from "../utils/analysisHelpers"
import { buildPriorityRecords } from "../utils/priorityHelpers"
import { buildRecommendationRecords } from "../utils/recommendationHelpers"
import { buildShoppingListRecords } from "../utils/shoppingListHelpers"
import { createRestockPolicyMap } from "../utils/restockPolicyHelpers"
import {
  createEvent,
  createHandlerError,
  normalizeItemId,
  nowIso,
  timestampFromContext,
  withValidatedAction,
} from "./pantryHandlerCore"

export function analyzeInventoryHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const pantry = context.state?.pantry ?? {}
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const restockPolicies = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []
  const activityRecords = Array.isArray(pantry?.activityLog?.records) ? pantry.activityLog.records : []
  const nowMs = asTimeMs(context.meta?.now, Date.now())
  const timestamp = timestampFromContext(context)
  const restockPolicyByItemId = createRestockPolicyMap(restockPolicies)

  const analysisRecords = inventory.map((inventoryRecord) => {
    const itemRecord = items.find((item) => item.id === inventoryRecord.itemId) ?? null
    const historyRecord = history.find((record) => record.itemId === inventoryRecord.itemId) ?? null
    const restockPolicy = restockPolicyByItemId.get(inventoryRecord.itemId) ?? "learn"
    return buildItemAnalysisRecord({
      inventoryRecord,
      historyRecord,
      itemRecord,
      restockPolicy,
      activityRecords,
      nowMs,
      updatedAt: timestamp,
    })
  })

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        itemAnalysis: {
          records: analysisRecords,
          replace: true,
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "INVENTORY_ANALYZED", "pantry:inventory", "Pantry Inventory", {
        analyzedCount: analysisRecords.length,
      }),
    ],
    outputs: [
      {
        message: `Analyzed ${analysisRecords.length} inventory item(s)`,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function analyzeItemByIdHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const payloadKeys = Object.keys(context.payload ?? {})
  if (!payloadKeys.includes("itemId") || payloadKeys.some((key) => key !== "itemId")) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "ANALYZE_ITEM_BY_ID_INVALID_PAYLOAD",
          "analyzeItemById requires payload shape { itemId } only",
          {
            payloadKeys,
          },
        ),
      ],
    })
  }

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "ANALYZE_ITEM_BY_ID_MISSING_ID",
          "analyzeItemById requires payload.itemId",
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const restockPolicies = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []
  const activityRecords = Array.isArray(pantry?.activityLog?.records) ? pantry.activityLog.records : []
  const nowMs = asTimeMs(context.meta?.now, Date.now())
  const inventoryRecord = inventory.find((record) => record.itemId === itemId) ?? null
  if (!inventoryRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "ANALYZE_ITEM_BY_ID_NOT_FOUND",
          `Cannot analyze missing inventory record for ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const timestamp = nowIso()
  const historyRecord = history.find((record) => record.itemId === itemId) ?? null
  const itemRecord = items.find((item) => item.id === itemId) ?? null
  const restockPolicy = restockPolicies.find((record) => record.itemId === itemId)?.policy ?? "learn"
  const analysisRecord = buildItemAnalysisRecord({
    inventoryRecord,
    historyRecord,
    itemRecord,
    restockPolicy,
    activityRecords,
    nowMs,
    updatedAt: timestamp,
  })

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        itemAnalysis: {
          records: [analysisRecord],
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_ANALYZED", itemId, itemId.replace(/^item:/, ""), {
        status: analysisRecord.status,
      }),
    ],
    outputs: [
      {
        message: `Analyzed ${itemId}`,
        itemId,
        status: analysisRecord.status,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function recommendPantryActionsHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const payloadKeys = Object.keys(context.payload ?? {})
  if (payloadKeys.length > 0) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "RECOMMEND_PANTRY_ACTIONS_INVALID_PAYLOAD",
          "recommendPantryActions requires empty payload shape {}",
          { payloadKeys },
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const analysis = Array.isArray(pantry?.itemAnalysis?.records) ? pantry.itemAnalysis.records : []
  const restockPolicies = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []
  const recommendationResolutions = Array.isArray(pantry?.recommendationResolutions?.records)
    ? pantry.recommendationResolutions.records
    : []
  const timestamp = nowIso()
  const historyItemIds = new Set(history.map((record) => record.itemId))
  const recommendations = buildRecommendationRecords({
    inventoryRecords: inventory,
    analysisRecords: analysis,
    restockPolicyRecords: restockPolicies,
    recommendationResolutionRecords: recommendationResolutions,
    updatedAt: timestamp,
    now: timestamp,
  })

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        recommendations: {
          records: recommendations,
          replace: true,
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(
        context,
        "PANTRY_RECOMMENDATIONS_GENERATED",
        "pantry:recommendations",
        "Pantry Recommendations",
        {
          recommendationCount: recommendations.length,
        },
      ),
    ],
    outputs: [
      {
        message: `Generated ${recommendations.length} pantry recommendation(s)`,
        historyCoverageCount: recommendations.filter((record) => historyItemIds.has(record.itemId)).length,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function rankPantryPrioritiesHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const payloadKeys = Object.keys(context.payload ?? {})
  if (payloadKeys.length > 0) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "RANK_PANTRY_PRIORITIES_INVALID_PAYLOAD",
          "rankPantryPriorities requires empty payload shape {}",
          { payloadKeys },
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const recommendations = Array.isArray(pantry?.recommendations?.records) ? pantry.recommendations.records : []
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const timestamp = nowIso()
  const priorities = buildPriorityRecords({
    recommendationRecords: recommendations,
    inventoryRecords: inventory,
    inventoryHistoryRecords: history,
    itemRecords: items,
    updatedAt: timestamp,
  })

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        priorities: {
          records: priorities,
          replace: true,
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(
        context,
        "PANTRY_PRIORITIES_RANKED",
        "pantry:priorities",
        "Pantry Priorities",
        {
          priorityCount: priorities.length,
        },
      ),
    ],
    outputs: [
      {
        message: `Ranked ${priorities.length} pantry priority record(s)`,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function generateShoppingListHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const payloadKeys = Object.keys(context.payload ?? {})
  if (payloadKeys.length > 0) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "GENERATE_SHOPPING_LIST_INVALID_PAYLOAD",
          "generateShoppingList requires empty payload shape {}",
          { payloadKeys },
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const priorities = Array.isArray(pantry?.priorities?.records) ? pantry.priorities.records : []
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const timestamp = nowIso()

  const shoppingListRecords = buildShoppingListRecords({
    priorityRecords: priorities,
    itemRecords: items,
    addedAt: timestamp,
  })

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        shoppingList: {
          records: shoppingListRecords,
          replace: true,
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(
        context,
        "SHOPPING_LIST_GENERATED",
        "pantry:shopping-list",
        "Pantry Shopping List",
        {
          shoppingListCount: shoppingListRecords.length,
        },
      ),
    ],
    outputs: [
      {
        message: `Generated ${shoppingListRecords.length} shopping list item(s)`,
      },
    ],
    warnings: [],
    errors: [],
  })
}
