import { createTatHandlerResult } from "../../../lib/tatHandlers"
import { normalizeItemCategory } from "../utils/itemCategory"
import { normalizeRestockPolicy } from "../utils/restockPolicyHelpers"
import { buildRecommendationRecords } from "../utils/recommendationHelpers"
import { buildResolutionRecord } from "../utils/recommendationResolutionHelpers"
import { normalizeShelfLifeDays, resolveShelfLifeDays } from "../utils/shelfLifeHelpers"
import {
  asNonNegativeNumber,
  asPositiveNumber,
  asSafeNonNegative,
  createEvent,
  createHandlerError,
  findItemState,
  normalizeItemNameForComparison,
  normalizeItemId,
  normalizeSource,
  timestampFromContext,
  titleFromItemId,
  toDerivedTotalQuantity,
  withValidatedAction,
} from "./pantryHandlerCore"

export function addItemHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  const quantity = asNonNegativeNumber(context.payload.quantity)

  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [createHandlerError(context, "ADD_ITEM_MISSING_ID", "addItem requires payload.itemId")],
    })
  }

  if (quantity == null) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(context, "ADD_ITEM_INVALID_QUANTITY", "addItem requires payload.quantity >= 0"),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const source = normalizeSource(context.payload.source, "user", "runtime")
  const location =
    typeof context.payload.location === "string" && context.payload.location.length > 0
      ? context.payload.location
      : "location:unknown"
  const lowStockThreshold =
    typeof context.payload.lowStockThreshold === "number" && Number.isFinite(context.payload.lowStockThreshold)
      ? Math.max(0, context.payload.lowStockThreshold)
      : 1
  const expiringSoonCount =
    typeof context.payload.expiringSoonCount === "number" && Number.isFinite(context.payload.expiringSoonCount)
      ? Math.max(0, context.payload.expiringSoonCount)
      : null
  const expiredCount =
    typeof context.payload.expiredCount === "number" && Number.isFinite(context.payload.expiredCount)
      ? Math.max(0, context.payload.expiredCount)
      : null

  const { itemRecord, inventoryRecord, historyRecord, restockPolicyRecord } = findItemState(context, itemId)

  if (!itemRecord && quantity === 0) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "ADD_ITEM_INVALID_QUANTITY",
          "New item creation requires payload.quantity > 0",
        ),
      ],
    })
  }

  const nextItem = itemRecord
    ? {
        ...itemRecord,
        shelfLifeDays: resolveShelfLifeDays({
          explicitShelfLifeDays: itemRecord.shelfLifeDays,
          category: itemRecord.category,
        }),
      }
    : {
        id: itemId,
        name:
          typeof context.payload.name === "string" && context.payload.name.length > 0
            ? context.payload.name
            : titleFromItemId(itemId),
        category: normalizeItemCategory(context.payload.category, "Other"),
        shelfLifeDays: resolveShelfLifeDays({
          explicitShelfLifeDays: context.payload.shelfLifeDays,
          category: context.payload.category,
        }),
        tags: Array.isArray(context.payload.tags) ? context.payload.tags.map(String) : undefined,
        source,
      }

  const previousHealthyCount = asSafeNonNegative(inventoryRecord?.healthyCount, 0)
  const previousExpiringSoonCount = asSafeNonNegative(inventoryRecord?.expiringSoonCount, 0)
  const previousExpiredCount = asSafeNonNegative(inventoryRecord?.expiredCount, 0)

  const nextHealthyCount = previousHealthyCount + quantity
  const nextExpiringSoonCount = expiringSoonCount ?? previousExpiringSoonCount
  const nextExpiredCount = expiredCount ?? previousExpiredCount
  const nextTotalQuantity = toDerivedTotalQuantity({
    healthyCount: nextHealthyCount,
    expiringSoonCount: nextExpiringSoonCount,
    expiredCount: nextExpiredCount,
  })

  const nextInventory = {
    itemId,
    healthyCount: nextHealthyCount,
    totalQuantity: nextTotalQuantity,
    locations: Array.from(new Set([...(inventoryRecord?.locations ?? []), location])),
    expiringSoonCount: nextExpiringSoonCount,
    expiredCount: nextExpiredCount,
    lowStockThreshold:
      typeof context.payload.lowStockThreshold === "number"
        ? lowStockThreshold
        : inventoryRecord?.lowStockThreshold ?? lowStockThreshold,
    lastStockedAt: quantity > 0 ? timestamp : inventoryRecord?.lastStockedAt ?? null,
    updatedAt: timestamp,
    source: inventoryRecord?.source ?? source,
  }

  const nextHistory = {
    id: historyRecord?.id ?? `invhist:${itemId}`,
    itemId,
    addedCount: (historyRecord?.addedCount ?? 0) + (quantity > 0 ? quantity : 0),
    consumedCount: historyRecord?.consumedCount ?? 0,
    expiredCount: historyRecord?.expiredCount ?? 0,
    expiringSoonCount: historyRecord?.expiringSoonCount ?? 0,
    lastEventAt: timestamp,
    source: historyRecord?.source ?? source,
  }

  const isNewItem = !itemRecord
  const restockPolicyValue = normalizeRestockPolicy(context.payload.restockPolicy, "learn")
  const nextRestockPolicy =
    isNewItem && !restockPolicyRecord
      ? [
          {
            itemId,
            policy: restockPolicyValue,
            createdAt: timestamp,
            updatedAt: timestamp,
          },
        ]
      : []

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        items: { items: [nextItem] },
        inventory: { records: [nextInventory] },
        inventoryHistory: { records: [nextHistory] },
        ...(nextRestockPolicy.length > 0
          ? {
              restockPolicy: { records: nextRestockPolicy },
            }
          : {}),
        ...(quantity > 0
          ? {
              activityLog: {
                records: [
                  {
                    id: `activity:added:${itemId}:${Date.now()}`,
                    itemId,
                    type: "added",
                    amount: quantity,
                    at: timestamp,
                  },
                ],
              },
            }
          : {}),
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events:
      quantity > 0
        ? [
            createEvent(context, "ITEM_ADDED", itemId, nextItem.name, {
              quantity,
              healthyCount: nextInventory.healthyCount,
              totalQuantity: nextInventory.totalQuantity,
            }),
          ]
        : [],
    outputs: [
      {
        message: quantity > 0 ? `Added ${quantity} to ${nextItem.name}` : `Updated ${nextItem.name} settings`,
        itemId,
        healthyCount: nextInventory.healthyCount,
        totalQuantity: nextInventory.totalQuantity,
        lowStockThreshold: nextInventory.lowStockThreshold,
        expiringSoonCount: nextInventory.expiringSoonCount,
        expiredCount: nextInventory.expiredCount,
        restockPolicy: nextRestockPolicy[0]?.policy ?? restockPolicyRecord?.policy ?? null,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function consumeItemHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  const amount = asPositiveNumber(context.payload.amount)

  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(context, "CONSUME_ITEM_MISSING_ID", "consumeItem requires payload.itemId"),
      ],
    })
  }

  if (amount == null) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "CONSUME_ITEM_INVALID_AMOUNT",
          "consumeItem requires payload.amount > 0",
        ),
      ],
    })
  }

  const { itemRecord, inventoryRecord, historyRecord } = findItemState(context, itemId)

  if (!itemRecord || !inventoryRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "CONSUME_ITEM_NOT_FOUND",
          `Cannot consume missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const availableHealthyCount = asSafeNonNegative(inventoryRecord.healthyCount, 0)

  if (availableHealthyCount < amount) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "CONSUME_ITEM_INVALID_AMOUNT",
          `Cannot consume ${amount}; only ${availableHealthyCount} healthy units available`,
          {
            itemId,
            requestedAmount: amount,
            availableHealthyCount,
          },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const nextHealthyCount = availableHealthyCount - amount
  const nextTotal = toDerivedTotalQuantity({
    healthyCount: nextHealthyCount,
    expiringSoonCount: asSafeNonNegative(inventoryRecord.expiringSoonCount, 0),
    expiredCount: asSafeNonNegative(inventoryRecord.expiredCount, 0),
  })

  const nextInventory = {
    ...inventoryRecord,
    healthyCount: nextHealthyCount,
    totalQuantity: nextTotal,
    updatedAt: timestamp,
  }

  const nextHistory = {
    id: historyRecord?.id ?? `invhist:${itemId}`,
    itemId,
    addedCount: historyRecord?.addedCount ?? 0,
    consumedCount: (historyRecord?.consumedCount ?? 0) + amount,
    expiredCount: historyRecord?.expiredCount ?? 0,
    expiringSoonCount: historyRecord?.expiringSoonCount ?? 0,
    lastEventAt: timestamp,
    source: historyRecord?.source ?? inventoryRecord.source,
  }

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        inventory: { records: [nextInventory] },
        inventoryHistory: { records: [nextHistory] },
        activityLog: {
          records: [
            {
              id: `activity:consumed:${itemId}:${Date.now()}`,
              itemId,
              type: "consumed",
              amount,
              at: timestamp,
            },
          ],
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_CONSUMED", itemId, itemRecord.name, {
        consumedAmount: amount,
        healthyCount: nextHealthyCount,
        totalQuantity: nextTotal,
      }),
    ],
    outputs: [
      {
        message: `Consumed ${amount} from ${itemRecord.name}`,
        itemId,
        healthyCount: nextHealthyCount,
        totalQuantity: nextTotal,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function removeItemHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [createHandlerError(context, "REMOVE_ITEM_MISSING_ID", "removeItem requires payload.itemId")],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const itemAnalysis = Array.isArray(pantry?.itemAnalysis?.records) ? pantry.itemAnalysis.records : []
  const recommendations = Array.isArray(pantry?.recommendations?.records) ? pantry.recommendations.records : []
  const priorities = Array.isArray(pantry?.priorities?.records) ? pantry.priorities.records : []
  const recommendationResolutions = Array.isArray(pantry?.recommendationResolutions?.records)
    ? pantry.recommendationResolutions.records
    : []
  const shoppingList = Array.isArray(pantry?.shoppingList?.records) ? pantry.shoppingList.records : []
  const restockPolicy = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []
  const activityLog = Array.isArray(pantry?.activityLog?.records) ? pantry.activityLog.records : []

  const existingItem = items.find((entry) => entry.id === itemId) ?? null
  if (!existingItem) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "REMOVE_ITEM_NOT_FOUND",
          `Cannot remove missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        items: {
          items: items.filter((entry) => entry.id !== itemId),
          replace: true,
        },
        inventory: {
          records: inventory.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        inventoryHistory: {
          records: history.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        itemAnalysis: {
          records: itemAnalysis.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        recommendations: {
          records: recommendations.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        priorities: {
          records: priorities.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        recommendationResolutions: {
          records: recommendationResolutions.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        shoppingList: {
          records: shoppingList.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        restockPolicy: {
          records: restockPolicy.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
        activityLog: {
          records: activityLog.filter((entry) => entry.itemId !== itemId),
          replace: true,
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_REMOVED", itemId, existingItem.name, {
        itemId,
      }),
    ],
    outputs: [
      {
        message: `Removed ${existingItem.name}`,
        itemId,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function updateRestockPolicyHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_RESTOCK_POLICY_MISSING_ID",
          "updateRestockPolicy requires payload.itemId",
        ),
      ],
    })
  }

  const policy = normalizeRestockPolicy(context.payload.policy, null)
  if (!policy) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_RESTOCK_POLICY_INVALID_POLICY",
          "updateRestockPolicy requires policy: always | never | learn",
          { policy: context.payload.policy },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const pantry = context.state?.pantry ?? {}
  const existing = Array.isArray(pantry?.restockPolicy?.records)
    ? pantry.restockPolicy.records.find((record) => record.itemId === itemId) ?? null
    : null

  const nextRecord = {
    itemId,
    policy,
    createdAt: existing?.createdAt ?? timestamp,
    updatedAt: timestamp,
  }

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        restockPolicy: {
          records: [nextRecord],
        },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "RESTOCK_POLICY_UPDATED", itemId, itemId.replace(/^item:/, ""), {
        policy,
      }),
    ],
    outputs: [
      {
        message: `Updated restock policy for ${itemId}`,
        itemId,
        policy,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function updateItemCategoryHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_CATEGORY_MISSING_ID",
          "updateItemCategory requires payload.itemId",
        ),
      ],
    })
  }

  const category = normalizeItemCategory(context.payload.category, null)
  if (!category) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_CATEGORY_INVALID_CATEGORY",
          "updateItemCategory requires a valid category",
          { category: context.payload.category },
        ),
      ],
    })
  }

  const { itemRecord } = findItemState(context, itemId)
  if (!itemRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_CATEGORY_NOT_FOUND",
          `Cannot update category for missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const nextItem = {
    ...itemRecord,
    category,
  }

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        items: { items: [nextItem] },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_CATEGORY_UPDATED", itemId, nextItem.name, {
        category,
      }),
    ],
    outputs: [
      {
        message: `Updated category for ${itemId}`,
        itemId,
        category,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function updateItemNameHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_NAME_MISSING_ID",
          "updateItemName requires payload.itemId",
        ),
      ],
    })
  }

  const rawName = typeof context.payload.name === "string" ? context.payload.name : ""
  const name = rawName.trim()
  if (!name) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_NAME_INVALID_NAME",
          "updateItemName requires non-empty payload.name",
          { name: context.payload.name },
        ),
      ],
    })
  }

  const { itemRecord } = findItemState(context, itemId)
  if (!itemRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_NAME_NOT_FOUND",
          `Cannot update name for missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const normalizedCandidate = normalizeItemNameForComparison(name)
  const duplicateItem = items.find(
    (entry) =>
      entry.id !== itemId && normalizeItemNameForComparison(String(entry?.name ?? "")) === normalizedCandidate,
  )

  if (duplicateItem) {
    const duplicateName = String(duplicateItem.name ?? name).trim() || name
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_NAME_DUPLICATE_NAME",
          `An item named ${duplicateName} already exists.`,
          {
            itemId,
            duplicateItemId: duplicateItem.id,
            duplicateName,
          },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const nextItem = {
    ...itemRecord,
    name,
  }

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        items: { items: [nextItem] },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_NAME_UPDATED", itemId, name, {
        previousName: itemRecord.name,
        name,
      }),
    ],
    outputs: [
      {
        message: `Updated name for ${itemId}`,
        itemId,
        name,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function updateItemShelfLifeHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_SHELF_LIFE_MISSING_ID",
          "updateItemShelfLife requires payload.itemId",
        ),
      ],
    })
  }

  const shelfLifeDays = normalizeShelfLifeDays(context.payload.shelfLifeDays, null)
  if (shelfLifeDays == null) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_SHELF_LIFE_INVALID_VALUE",
          "updateItemShelfLife requires payload.shelfLifeDays > 0",
          { shelfLifeDays: context.payload.shelfLifeDays },
        ),
      ],
    })
  }

  const { itemRecord } = findItemState(context, itemId)
  if (!itemRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "UPDATE_ITEM_SHELF_LIFE_NOT_FOUND",
          `Cannot update shelf life for missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const nextItem = {
    ...itemRecord,
    shelfLifeDays,
  }

  return createTatHandlerResult({
    ok: true,
    stateUpdates: {
      pantry: {
        items: { items: [nextItem] },
      },
      session: {
        lastUpdatedAt: timestamp,
      },
    },
    events: [
      createEvent(context, "ITEM_SHELF_LIFE_UPDATED", itemId, nextItem.name, {
        shelfLifeDays,
      }),
    ],
    outputs: [
      {
        message: `Updated shelf life for ${itemId}`,
        itemId,
        shelfLifeDays,
      },
    ],
    warnings: [],
    errors: [],
  })
}

export function resolveRecommendationHandler(context) {
  const actionResult = withValidatedAction(context)
  if (actionResult) return actionResult

  const itemId = normalizeItemId(context.payload.itemId)
  if (!itemId) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "RESOLVE_RECOMMENDATION_MISSING_ID",
          "resolveRecommendation requires payload.itemId",
        ),
      ],
    })
  }

  const recommendation = String(context.payload.recommendation ?? "")
  const resolution = String(context.payload.resolution ?? "")
  const allowedByRecommendation = {
    "check-item": new Set(["still-good", "discarded"]),
    "use-soon": new Set(["used", "done"]),
    "restock-soon": new Set(["bought", "done"]),
  }
  const allowedResolutions = allowedByRecommendation[recommendation] ?? null
  if (!allowedResolutions || !allowedResolutions.has(resolution)) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "RESOLVE_RECOMMENDATION_INVALID_RESOLUTION",
          "Invalid recommendation/resolution combination",
          { recommendation, resolution },
        ),
      ],
    })
  }

  const pantry = context.state?.pantry ?? {}
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const restockPolicies = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []
  const recommendationResolutions = Array.isArray(pantry?.recommendationResolutions?.records)
    ? pantry.recommendationResolutions.records
    : []
  const activityLog = Array.isArray(pantry?.activityLog?.records) ? pantry.activityLog.records : []
  const itemRecord = items.find((entry) => entry.id === itemId) ?? null
  const inventoryRecord = inventory.find((entry) => entry.itemId === itemId) ?? null
  const historyRecord = history.find((entry) => entry.itemId === itemId) ?? null
  if (!itemRecord || !inventoryRecord) {
    return createTatHandlerResult({
      ok: false,
      errors: [
        createHandlerError(
          context,
          "RESOLVE_RECOMMENDATION_ITEM_NOT_FOUND",
          `Cannot resolve recommendation for missing item ${itemId}`,
          { itemId },
        ),
      ],
    })
  }

  const timestamp = timestampFromContext(context)
  const nextUpdates = {
    pantry: {},
    session: {
      lastUpdatedAt: timestamp,
    },
  }
  const outputs = []
  const events = []
  let clearResolutionRecord = false

  if (recommendation === "check-item" && resolution === "still-good") {
    const currentShelfLifeDays = resolveShelfLifeDays({
      explicitShelfLifeDays: itemRecord.shelfLifeDays,
      category: itemRecord.category,
    })
    const nextShelfLifeDays = currentShelfLifeDays + 1
    const stockedAtMs = Date.parse(String(inventoryRecord.lastStockedAt ?? ""))
    const suppressionBoundaryMs = Number.isFinite(stockedAtMs)
      ? stockedAtMs + nextShelfLifeDays * 24 * 60 * 60 * 1000
      : Date.parse(timestamp) + 24 * 60 * 60 * 1000
    const suppressionBoundary = Number.isFinite(suppressionBoundaryMs)
      ? new Date(suppressionBoundaryMs).toISOString()
      : null

    nextUpdates.pantry.items = {
      items: [
        {
          ...itemRecord,
          shelfLifeDays: nextShelfLifeDays,
        },
      ],
    }
    nextUpdates.pantry.recommendationResolutions = {
      records: [
        buildResolutionRecord({
          itemId,
          recommendation,
          resolution,
          suppressedUntil: suppressionBoundary,
          updatedAt: timestamp,
        }),
      ],
    }
    events.push(createEvent(context, "RECOMMENDATION_RESOLVED", itemId, itemRecord.name, { recommendation, resolution }))
    outputs.push({
      message: `Marked ${itemRecord.name} as still good`,
      itemId,
      recommendation,
      resolution,
      suppressedUntil: suppressionBoundary,
    })
  }

  if (recommendation === "check-item" && resolution === "discarded") {
    const expiredCount = asSafeNonNegative(inventoryRecord.expiredCount, 0)
    const expiringSoonCount = asSafeNonNegative(inventoryRecord.expiringSoonCount, 0)
    const healthyCount = asSafeNonNegative(inventoryRecord.healthyCount, 0)
    if (expiredCount + expiringSoonCount + healthyCount <= 0) {
      return createTatHandlerResult({
        ok: false,
        errors: [createHandlerError(context, "RESOLVE_RECOMMENDATION_NOTHING_TO_REMOVE", "No inventory available to discard", { itemId })],
      })
    }

    const removeFromExpired = expiredCount > 0 ? 1 : 0
    const removeFromExpiringSoon = removeFromExpired === 0 && expiringSoonCount > 0 ? 1 : 0
    const removeFromHealthy = removeFromExpired === 0 && removeFromExpiringSoon === 0 ? 1 : 0
    const nextInventory = {
      ...inventoryRecord,
      expiredCount: expiredCount - removeFromExpired,
      expiringSoonCount: expiringSoonCount - removeFromExpiringSoon,
      healthyCount: healthyCount - removeFromHealthy,
      totalQuantity: toDerivedTotalQuantity({
        healthyCount: healthyCount - removeFromHealthy,
        expiringSoonCount: expiringSoonCount - removeFromExpiringSoon,
        expiredCount: expiredCount - removeFromExpired,
      }),
      updatedAt: timestamp,
    }
    const nextHistory = {
      id: historyRecord?.id ?? `invhist:${itemId}`,
      itemId,
      addedCount: historyRecord?.addedCount ?? 0,
      consumedCount: historyRecord?.consumedCount ?? 0,
      expiredCount: (historyRecord?.expiredCount ?? 0) + removeFromExpired,
      expiringSoonCount: historyRecord?.expiringSoonCount ?? 0,
      lastEventAt: timestamp,
      source: historyRecord?.source ?? inventoryRecord.source,
    }
    nextUpdates.pantry.inventory = { records: [nextInventory] }
    nextUpdates.pantry.inventoryHistory = { records: [nextHistory] }
    clearResolutionRecord = true
    events.push(createEvent(context, "RECOMMENDATION_RESOLVED", itemId, itemRecord.name, { recommendation, resolution }))
    outputs.push({ message: `Discarded one ${itemRecord.name}`, itemId, recommendation, resolution })
  }

  if (recommendation === "use-soon" && resolution === "used") {
    const expiringSoonCount = asSafeNonNegative(inventoryRecord.expiringSoonCount, 0)
    const healthyCount = asSafeNonNegative(inventoryRecord.healthyCount, 0)
    const expiredCount = asSafeNonNegative(inventoryRecord.expiredCount, 0)
    if (expiringSoonCount + healthyCount + expiredCount <= 0) {
      return createTatHandlerResult({
        ok: false,
        errors: [createHandlerError(context, "RESOLVE_RECOMMENDATION_NOTHING_TO_USE", "No inventory available to use", { itemId })],
      })
    }

    const removeFromExpiringSoon = expiringSoonCount > 0 ? 1 : 0
    const removeFromHealthy = removeFromExpiringSoon === 0 && healthyCount > 0 ? 1 : 0
    const removeFromExpired = removeFromExpiringSoon === 0 && removeFromHealthy === 0 ? 1 : 0
    const nextInventory = {
      ...inventoryRecord,
      expiringSoonCount: expiringSoonCount - removeFromExpiringSoon,
      healthyCount: healthyCount - removeFromHealthy,
      expiredCount: expiredCount - removeFromExpired,
      totalQuantity: toDerivedTotalQuantity({
        healthyCount: healthyCount - removeFromHealthy,
        expiringSoonCount: expiringSoonCount - removeFromExpiringSoon,
        expiredCount: expiredCount - removeFromExpired,
      }),
      updatedAt: timestamp,
    }
    const nextHistory = {
      id: historyRecord?.id ?? `invhist:${itemId}`,
      itemId,
      addedCount: historyRecord?.addedCount ?? 0,
      consumedCount: (historyRecord?.consumedCount ?? 0) + 1,
      expiredCount: historyRecord?.expiredCount ?? 0,
      expiringSoonCount: historyRecord?.expiringSoonCount ?? 0,
      lastEventAt: timestamp,
      source: historyRecord?.source ?? inventoryRecord.source,
    }
    nextUpdates.pantry.inventory = { records: [nextInventory] }
    nextUpdates.pantry.inventoryHistory = { records: [nextHistory] }
    nextUpdates.pantry.activityLog = {
      records: [
        {
          id: `activity:consumed:${itemId}:${Date.now()}`,
          itemId,
          type: "consumed",
          amount: 1,
          at: timestamp,
        },
      ],
    }
    clearResolutionRecord = true
    events.push(createEvent(context, "RECOMMENDATION_RESOLVED", itemId, itemRecord.name, { recommendation, resolution }))
    outputs.push({ message: `Used one ${itemRecord.name}`, itemId, recommendation, resolution })
  }

  if (recommendation === "restock-soon" && resolution === "bought") {
    const quantity = asPositiveNumber(context.payload.quantity)
    if (quantity == null) {
      return createTatHandlerResult({
        ok: false,
        errors: [
          createHandlerError(
            context,
            "RESOLVE_RECOMMENDATION_INVALID_QUANTITY",
            "Bought resolution requires payload.quantity > 0",
            { quantity: context.payload.quantity },
          ),
        ],
      })
    }

    const nextHealthyCount = asSafeNonNegative(inventoryRecord.healthyCount, 0) + quantity
    const nextExpiringSoonCount = asSafeNonNegative(inventoryRecord.expiringSoonCount, 0)
    const nextExpiredCount = asSafeNonNegative(inventoryRecord.expiredCount, 0)
    const nextInventory = {
      ...inventoryRecord,
      healthyCount: nextHealthyCount,
      totalQuantity: toDerivedTotalQuantity({
        healthyCount: nextHealthyCount,
        expiringSoonCount: nextExpiringSoonCount,
        expiredCount: nextExpiredCount,
      }),
      lastStockedAt: timestamp,
      updatedAt: timestamp,
    }
    const nextHistory = {
      id: historyRecord?.id ?? `invhist:${itemId}`,
      itemId,
      addedCount: (historyRecord?.addedCount ?? 0) + quantity,
      consumedCount: historyRecord?.consumedCount ?? 0,
      expiredCount: historyRecord?.expiredCount ?? 0,
      expiringSoonCount: historyRecord?.expiringSoonCount ?? 0,
      lastEventAt: timestamp,
      source: historyRecord?.source ?? inventoryRecord.source,
    }
    nextUpdates.pantry.inventory = { records: [nextInventory] }
    nextUpdates.pantry.inventoryHistory = { records: [nextHistory] }
    nextUpdates.pantry.activityLog = {
      records: [
        {
          id: `activity:added:${itemId}:${Date.now()}`,
          itemId,
          type: "added",
          amount: quantity,
          at: timestamp,
        },
      ],
    }
    clearResolutionRecord = true
    events.push(createEvent(context, "RECOMMENDATION_RESOLVED", itemId, itemRecord.name, { recommendation, resolution, quantity }))
    outputs.push({ message: `Added ${quantity} to ${itemRecord.name}`, itemId, recommendation, resolution, quantity })
  }

  if (resolution === "done") {
    const suppressedUntil =
      recommendation === "use-soon"
        ? "until-expired"
        : recommendation === "restock-soon"
          ? `until-quantity-change:${asSafeNonNegative(inventoryRecord.totalQuantity, 0)}`
          : null
    nextUpdates.pantry.recommendationResolutions = {
      records: [
        buildResolutionRecord({
          itemId,
          recommendation,
          resolution,
          suppressedUntil,
          updatedAt: timestamp,
        }),
      ],
    }
    events.push(createEvent(context, "RECOMMENDATION_RESOLVED", itemId, itemRecord.name, { recommendation, resolution }))
    outputs.push({ message: `Dismissed ${recommendation} for ${itemRecord.name}`, itemId, recommendation, resolution })
  } else if (clearResolutionRecord) {
    const filtered = recommendationResolutions.filter(
      (record) => !(record.itemId === itemId && record.recommendation === recommendation),
    )
    nextUpdates.pantry.recommendationResolutions = {
      records: filtered,
      replace: true,
    }
  }

  const nextRecommendations = buildRecommendationRecords({
    inventoryRecords: Array.isArray(nextUpdates.pantry.inventory?.records)
      ? inventory.map((record) =>
          record.itemId === itemId ? nextUpdates.pantry.inventory.records[0] : record,
        )
      : inventory,
    analysisRecords: Array.isArray(pantry?.itemAnalysis?.records) ? pantry.itemAnalysis.records : [],
    restockPolicyRecords: restockPolicies,
    recommendationResolutionRecords:
      nextUpdates.pantry.recommendationResolutions?.replace === true
        ? nextUpdates.pantry.recommendationResolutions.records
        : [
            ...recommendationResolutions.filter(
              (record) => !(record.itemId === itemId && record.recommendation === recommendation),
            ),
            ...(nextUpdates.pantry.recommendationResolutions?.records ?? []),
          ],
    updatedAt: timestamp,
    now: timestamp,
  })
  const hasActionable = nextRecommendations.some((record) => record.itemId === itemId && record.recommendation !== "none")

  return createTatHandlerResult({
    ok: true,
    stateUpdates: nextUpdates,
    events,
    outputs: [
      ...outputs,
      {
        itemId,
        recommendation,
        resolution,
        hasActionableAfterResolution: hasActionable,
      },
    ],
    warnings: [],
    errors: [],
  })
}
