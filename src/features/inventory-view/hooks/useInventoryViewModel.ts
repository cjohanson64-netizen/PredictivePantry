import { useCallback, useMemo, useState } from "react"
import {
  buildAddExistingQuantityPayload,
  buildAddNewItemPayload,
  buildRemoveItemPayload,
  buildConsumeQuantityPayload,
  buildUpdateExpirationPayload,
  buildUpdateItemCategoryPayload,
  buildUpdateItemNamePayload,
  buildUpdateItemShelfLifePayload,
  buildUpdateRestockPolicyPayload,
  buildUpdateThresholdPayload,
  deriveItemIdFromName,
  type ExistingItemInput,
  type NewItemInput,
} from "../../pantry/utils/consoleInputIntents"
import type { PantryRuntimeDispatchArgs } from "../../../lib/runtime/usePantryWorkspaceRuntime"
import {
  ITEM_CATEGORIES,
  getDefaultShelfLifeDays,
  normalizeItemCategory,
} from "../../pantry/utils/itemCategory"

export type PantryItemView = {
  id: string
  name: string
  category?: string
  shelfLifeDays?: number
}

export type PantryInventoryView = {
  itemId: string
  healthyCount: number
  totalQuantity: number
  lowStockThreshold: number
  expiringSoonCount: number
  expiredCount: number
  lastStockedAt?: string | null
}

export type PantryAnalysisView = {
  itemId: string
  status: string
}

export type PantryRestockPolicyView = {
  itemId: string
  policy: "always" | "never" | "learn"
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

export function useInventoryViewModel({
  snapshot,
  dispatchRuntimeAction,
  dispatchAiRefreshPipeline,
  resetRuntime,
}: {
  snapshot: Record<string, any>
  dispatchRuntimeAction: (args: PantryRuntimeDispatchArgs) => Record<string, any>
  dispatchAiRefreshPipeline: (meta?: Record<string, unknown>) => Record<string, any>
  resetRuntime: () => void
}) {
  const [newItemInput, setNewItemInput] = useState<NewItemInput>({
    name: "",
    quantity: 1,
    threshold: 1,
    shelfLifeDays: 30,
    location: "location:pantry",
    restockPolicy: "learn",
    category: "Other",
  })

  const pantryItems = Array.isArray(snapshot?.state?.pantry?.items?.items)
    ? (snapshot.state.pantry.items.items as PantryItemView[])
    : []

  const inventoryRecords = Array.isArray(snapshot?.state?.pantry?.inventory?.records)
    ? (snapshot.state.pantry.inventory.records as PantryInventoryView[])
    : []
  const inventoryByItemId = useMemo(
    () => new Map(inventoryRecords.map((record) => [String(record.itemId), record])),
    [inventoryRecords],
  )

  const itemAnalysisRecords = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
    ? (snapshot.state.pantry.itemAnalysis.records as PantryAnalysisView[])
    : []

  const recommendationRecords = Array.isArray(snapshot?.state?.pantry?.recommendations?.records)
    ? (snapshot.state.pantry.recommendations.records as Array<Record<string, unknown>>)
    : []
  const priorityRecords = Array.isArray(snapshot?.state?.pantry?.priorities?.records)
    ? (snapshot.state.pantry.priorities.records as Array<Record<string, unknown>>)
    : []
  const restockPolicyRecords = Array.isArray(snapshot?.state?.pantry?.restockPolicy?.records)
    ? (snapshot.state.pantry.restockPolicy.records as PantryRestockPolicyView[])
    : []

  const shoppingListView = useMemo(() => {
    const state = snapshot?.state ?? {}
    if (state?.pantry?.shoppingList) return state.pantry.shoppingList
    if (state?.shoppingList) return state.shoppingList
    if (state?.groceryList) return state.groceryList
    return { items: [] }
  }, [snapshot])

  const itemNameById = useMemo(() => {
    const byId: Record<string, string> = {}
    for (const item of pantryItems) {
      byId[String(item.id)] = String(item.name ?? item.id)
    }
    return byId
  }, [pantryItems])

  const itemCategoryById = useMemo(() => {
    const byId: Record<string, string> = {}
    for (const item of pantryItems) {
      byId[String(item.id)] = normalizeItemCategory(item.category, "Other")
    }
    return byId
  }, [pantryItems])

  const itemShelfLifeById = useMemo(() => {
    const byId: Record<string, number> = {}
    for (const item of pantryItems) {
      const category = normalizeItemCategory(item.category, "Other")
      byId[String(item.id)] =
        typeof item.shelfLifeDays === "number" && Number.isFinite(item.shelfLifeDays) && item.shelfLifeDays > 0
          ? Math.round(item.shelfLifeDays)
          : getDefaultShelfLifeDays(category)
    }
    return byId
  }, [pantryItems])

  const analysisStatusByItemId = useMemo(() => {
    const byId: Record<string, string> = {}
    for (const record of itemAnalysisRecords) {
      byId[String(record.itemId)] = String(record.status ?? "unknown")
    }
    return byId
  }, [itemAnalysisRecords])

  const restockPolicyByItemId = useMemo(() => {
    const byId: Record<string, "always" | "never" | "learn"> = {}
    for (const record of restockPolicyRecords) {
      const itemId = String(record.itemId)
      const policy =
        record.policy === "always" || record.policy === "never" || record.policy === "learn"
          ? record.policy
          : "learn"
      byId[itemId] = policy
    }
    return byId
  }, [restockPolicyRecords])

  const toExistingInput = useCallback(
    (record: PantryInventoryView): ExistingItemInput => ({
      itemId: String(record.itemId),
      addQuantity: 1,
      consumeQuantity: 1,
      threshold: asNumber(record.lowStockThreshold, 1),
      expiringSoonCount: asNumber(record.expiringSoonCount, 0),
      expiredCount: asNumber(record.expiredCount, 0),
      shelfLifeDays: itemShelfLifeById[String(record.itemId)] ?? getDefaultShelfLifeDays("Other"),
      restockPolicy: restockPolicyByItemId[String(record.itemId)] ?? "learn",
      category: itemCategoryById[String(record.itemId)] ?? "Other",
    }),
    [itemCategoryById, itemShelfLifeById, restockPolicyByItemId],
  )

  const dispatchCreateNewItem = useCallback(() => {
    const payload = buildAddNewItemPayload(newItemInput)
    if (!payload.itemId || !payload.name) return

    dispatchRuntimeAction({
      programName: "addItem",
      actionName: "ADD_ITEM",
      payload,
    })

    setNewItemInput((prev) => ({
      ...prev,
      name: "",
      quantity: 1,
      threshold: prev.threshold,
      shelfLifeDays: prev.shelfLifeDays,
      restockPolicy: prev.restockPolicy,
      category: prev.category,
    }))
  }, [dispatchRuntimeAction, newItemInput])

  const dispatchAddQuantity = useCallback(
    (itemId: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "ADD_ITEM",
        payload: buildAddExistingQuantityPayload({
          ...toExistingInput(record),
          addQuantity: 1,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchAddFreshStock = useCallback(
    (itemId: string, quantity: number, metaNow?: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      const safeQuantity = Math.max(1, Math.round(quantity))
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "ADD_ITEM",
        payload: buildAddExistingQuantityPayload({
          ...toExistingInput(record),
          addQuantity: safeQuantity,
        }),
        ...(typeof metaNow === "string" ? { meta: { now: metaNow } } : {}),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchBatchAddFreshStock = useCallback(
    (entries: Array<{ itemId: string; quantity: number }>) => {
      const batchTimestamp = new Date().toISOString()
      for (const entry of entries) {
        if (!entry?.itemId) continue
        const safeQuantity = Math.round(Number(entry.quantity))
        if (!Number.isFinite(safeQuantity) || safeQuantity <= 0) continue
        dispatchAddFreshStock(entry.itemId, safeQuantity, batchTimestamp)
      }
    },
    [dispatchAddFreshStock],
  )

  const dispatchConsumeQuantity = useCallback(
    (itemId: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "consumeItem",
        actionName: "CONSUME_ITEM",
        payload: buildConsumeQuantityPayload(toExistingInput(record)),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchStepThreshold = useCallback(
    (itemId: string, step: -1 | 1) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      const current = asNumber(record.lowStockThreshold, 0)
      const next = Math.max(0, current + step)
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_THRESHOLD",
        payload: buildUpdateThresholdPayload({
          ...toExistingInput(record),
          threshold: next,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchSetThreshold = useCallback(
    (itemId: string, nextValue: number) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_THRESHOLD",
        payload: buildUpdateThresholdPayload({
          ...toExistingInput(record),
          threshold: Math.max(0, Math.round(nextValue)),
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchStepExpiringSoon = useCallback(
    (itemId: string, step: -1 | 1) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      const current = asNumber(record.expiringSoonCount, 0)
      const next = Math.max(0, current + step)
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_EXPIRATION_COUNTS",
        payload: buildUpdateExpirationPayload({
          ...toExistingInput(record),
          expiringSoonCount: next,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchSetExpiringSoon = useCallback(
    (itemId: string, nextValue: number) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_EXPIRATION_COUNTS",
        payload: buildUpdateExpirationPayload({
          ...toExistingInput(record),
          expiringSoonCount: Math.max(0, Math.round(nextValue)),
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchStepExpired = useCallback(
    (itemId: string, step: -1 | 1) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      const current = asNumber(record.expiredCount, 0)
      const next = Math.max(0, current + step)
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_EXPIRATION_COUNTS",
        payload: buildUpdateExpirationPayload({
          ...toExistingInput(record),
          expiredCount: next,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchSetExpired = useCallback(
    (itemId: string, nextValue: number) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "addItem",
        actionName: "UPDATE_EXPIRATION_COUNTS",
        payload: buildUpdateExpirationPayload({
          ...toExistingInput(record),
          expiredCount: Math.max(0, Math.round(nextValue)),
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchRefreshAi = useCallback(() => {
    dispatchAiRefreshPipeline({ trigger: "manual-refresh-button" })
  }, [dispatchAiRefreshPipeline])

  const dispatchRankPantryPriorities = useCallback(() => {
    dispatchRuntimeAction({
      programName: "rankPantryPriorities",
      actionName: "RANK_PANTRY_PRIORITIES",
      payload: {},
    })
  }, [dispatchRuntimeAction])

  const dispatchUpdateRestockPolicy = useCallback(
    (itemId: string, policy: "always" | "never" | "learn") => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "updateRestockPolicy",
        actionName: "UPDATE_RESTOCK_POLICY",
        payload: buildUpdateRestockPolicyPayload({
          ...toExistingInput(record),
          restockPolicy: policy,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchUpdateItemCategory = useCallback(
    (itemId: string, category: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "updateItemCategory",
        actionName: "UPDATE_ITEM_CATEGORY",
        payload: buildUpdateItemCategoryPayload({
          ...toExistingInput(record),
          category: normalizeItemCategory(category, "Other"),
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchUpdateItemName = useCallback(
    (itemId: string, name: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) {
        return {
          ok: false,
          message: "Item not found.",
        }
      }
      const nextSnapshot = dispatchRuntimeAction({
        programName: "updateItemName",
        actionName: "UPDATE_ITEM_NAME",
        payload: buildUpdateItemNamePayload({
          itemId: record.itemId,
          name,
        }),
      })
      const errors = Array.isArray(nextSnapshot?.currentErrors) ? nextSnapshot.currentErrors : []
      if (errors.length === 0) {
        return {
          ok: true,
          message: "",
        }
      }
      const renameError =
        errors.find(
          (entry) =>
            entry?.actionName === "UPDATE_ITEM_NAME" ||
            entry?.type === "UPDATE_ITEM_NAME_DUPLICATE_NAME" ||
            entry?.type === "UPDATE_ITEM_NAME_INVALID_NAME",
        ) ?? errors[0]
      return {
        ok: false,
        message: String(renameError?.message ?? "Rename failed."),
      }
    },
    [dispatchRuntimeAction, inventoryByItemId],
  )

  const dispatchRemoveItem = useCallback(
    (itemId: string) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "removeItem",
        actionName: "REMOVE_ITEM",
        payload: buildRemoveItemPayload({
          itemId: record.itemId,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId],
  )

  const dispatchStepShelfLife = useCallback(
    (itemId: string, step: -1 | 1) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      const current = itemShelfLifeById[itemId] ?? getDefaultShelfLifeDays(itemCategoryById[itemId] ?? "Other")
      const next = Math.max(1, Math.round(current + step))
      dispatchRuntimeAction({
        programName: "updateItemShelfLife",
        actionName: "UPDATE_ITEM_SHELF_LIFE",
        payload: buildUpdateItemShelfLifePayload({
          ...toExistingInput(record),
          shelfLifeDays: next,
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, itemCategoryById, itemShelfLifeById, toExistingInput],
  )

  const dispatchSetShelfLife = useCallback(
    (itemId: string, nextValue: number) => {
      const record = inventoryByItemId.get(itemId)
      if (!record) return
      dispatchRuntimeAction({
        programName: "updateItemShelfLife",
        actionName: "UPDATE_ITEM_SHELF_LIFE",
        payload: buildUpdateItemShelfLifePayload({
          ...toExistingInput(record),
          shelfLifeDays: Math.max(1, Math.round(nextValue)),
        }),
      })
    },
    [dispatchRuntimeAction, inventoryByItemId, toExistingInput],
  )

  const dispatchGenerateShoppingList = useCallback(() => {
    dispatchRuntimeAction({
      programName: "generateShoppingList",
      actionName: "GENERATE_SHOPPING_LIST",
      payload: {},
    })
  }, [dispatchRuntimeAction])

  const dispatchResolveRecommendation = useCallback(
    (args: {
      itemId: string
      recommendation: "check-item" | "use-soon" | "restock-soon"
      resolution: "still-good" | "discarded" | "used" | "done" | "bought"
      quantity?: number
    }) => {
      const payload: Record<string, unknown> = {
        itemId: args.itemId,
        recommendation: args.recommendation,
        resolution: args.resolution,
      }
      if (typeof args.quantity === "number") {
        payload.quantity = args.quantity
      }
      dispatchRuntimeAction({
        programName: "resolveRecommendation",
        actionName: "RESOLVE_RECOMMENDATION",
        payload,
      })
    },
    [dispatchRuntimeAction],
  )

  return {
    newItemInput,
    setNewItemInput,
    pantryItems,
    inventoryRecords,
    recommendationRecords,
    priorityRecords,
    shoppingListView,
    categoryOptions: ITEM_CATEGORIES,
    itemNameById,
    itemCategoryById,
    itemShelfLifeById,
    analysisStatusByItemId,
    restockPolicyByItemId,
    dispatchCreateNewItem,
    dispatchAddFreshStock,
    dispatchBatchAddFreshStock,
    dispatchAddQuantity,
    dispatchConsumeQuantity,
    dispatchStepThreshold,
    dispatchSetThreshold,
    dispatchStepExpiringSoon,
    dispatchSetExpiringSoon,
    dispatchStepExpired,
    dispatchSetExpired,
    dispatchUpdateRestockPolicy,
    dispatchUpdateItemCategory,
    dispatchUpdateItemName,
    dispatchRemoveItem,
    dispatchStepShelfLife,
    dispatchSetShelfLife,
    dispatchRefreshAi,
    dispatchRankPantryPriorities,
    dispatchGenerateShoppingList,
    dispatchResolveRecommendation,
    resetRuntime,
    derivedNewItemId: deriveItemIdFromName(newItemInput.name),
  }
}
