import { createTatHandlerResult } from "../../../lib/tatHandlers"
import { createRuntimeError } from "../../../lib/runtime/createRuntimeError.js"

export const SUPPORTED_ACTIONS_BY_PROGRAM = {
  addItem: new Set(["ADD_ITEM", "UPDATE_THRESHOLD", "UPDATE_EXPIRATION_COUNTS"]),
  consumeItem: new Set(["CONSUME_ITEM"]),
  removeItem: new Set(["REMOVE_ITEM"]),
  analyzeInventory: new Set(["ANALYZE_INVENTORY"]),
  analyzeItemById: new Set(["ANALYZE_ITEM_BY_ID"]),
  recommendPantryActions: new Set(["RECOMMEND_PANTRY_ACTIONS"]),
  rankPantryPriorities: new Set(["RANK_PANTRY_PRIORITIES"]),
  updateRestockPolicy: new Set(["UPDATE_RESTOCK_POLICY"]),
  updateItemCategory: new Set(["UPDATE_ITEM_CATEGORY"]),
  updateItemName: new Set(["UPDATE_ITEM_NAME"]),
  updateItemShelfLife: new Set(["UPDATE_ITEM_SHELF_LIFE"]),
  resolveRecommendation: new Set(["RESOLVE_RECOMMENDATION"]),
  generateShoppingList: new Set(["GENERATE_SHOPPING_LIST"]),
}

export function nowIso() {
  return new Date().toISOString()
}

export function timestampFromContext(context) {
  if (typeof context?.meta?.now === "string") {
    const parsed = Date.parse(context.meta.now)
    if (Number.isFinite(parsed)) return new Date(parsed).toISOString()
  }
  return nowIso()
}

export function normalizeItemId(value) {
  if (typeof value !== "string" || value.length === 0) return null
  return value.startsWith("item:") ? value : `item:${value}`
}

export function titleFromItemId(itemId) {
  return itemId.replace(/^item:/, "").replace(/^./, (ch) => ch.toUpperCase())
}

export function normalizeItemNameForComparison(name) {
  if (typeof name !== "string") return ""
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

export function asPositiveNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value <= 0) return null
  return value
}

export function asNonNegativeNumber(value) {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  if (value < 0) return null
  return value
}

export function asSafeNonNegative(value, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  if (value < 0) return fallback
  return value
}

export function toDerivedTotalQuantity({ healthyCount, expiringSoonCount, expiredCount }) {
  return Math.max(0, healthyCount) + Math.max(0, expiringSoonCount) + Math.max(0, expiredCount)
}

export function normalizeSource(source, fallbackKind, fallbackLabel) {
  const value = source ?? {}
  const kind = value.kind === "seed" || value.kind === "user" ? value.kind : fallbackKind
  const label = typeof value.label === "string" && value.label.length > 0 ? value.label : fallbackLabel
  return { kind, label }
}

export function createEvent(context, type, subjectId, subjectName, payload = {}) {
  return {
    id: `${type}:${subjectId}:${Date.now()}`,
    type,
    featureName: context.featureName,
    programName: context.programName,
    actionName: context.actionName,
    subjectId,
    subjectName,
    payload,
    timestamp: nowIso(),
  }
}

export function createHandlerError(context, type, message, details = {}) {
  return createRuntimeError({
    type,
    layer: "handler",
    featureName: context.featureName,
    programName: context.programName,
    actionName: context.actionName,
    message,
    details,
  })
}

export function findItemState(context, itemId) {
  const pantry = context.state?.pantry ?? {}
  const items = Array.isArray(pantry?.items?.items) ? pantry.items.items : []
  const inventory = Array.isArray(pantry?.inventory?.records) ? pantry.inventory.records : []
  const history = Array.isArray(pantry?.inventoryHistory?.records) ? pantry.inventoryHistory.records : []
  const restockPolicy = Array.isArray(pantry?.restockPolicy?.records) ? pantry.restockPolicy.records : []

  return {
    items,
    inventory,
    history,
    restockPolicy,
    itemRecord: items.find((item) => item.id === itemId) ?? null,
    inventoryRecord: inventory.find((record) => record.itemId === itemId) ?? null,
    historyRecord: history.find((record) => record.itemId === itemId) ?? null,
    restockPolicyRecord: restockPolicy.find((record) => record.itemId === itemId) ?? null,
  }
}

export function withValidatedAction(context) {
  const supported = SUPPORTED_ACTIONS_BY_PROGRAM[context.programName] ?? null
  if (!supported) return null
  if (supported.has(context.actionName)) return null

  return createTatHandlerResult({
    ok: false,
    errors: [
      createHandlerError(
        context,
        "HANDLER_UNSUPPORTED_ACTION",
        `Unsupported action ${context.actionName} for program ${context.programName}`,
        {
          supportedActions: Array.from(supported),
        },
      ),
    ],
  })
}
