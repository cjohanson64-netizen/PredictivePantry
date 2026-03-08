export type SourceMeta = {
  kind: "seed" | "user"
  label: string
}

export type PantryItemRecord = {
  id: string
  name: string
  category: string
  shelfLifeDays: number
  tags?: string[]
  source: SourceMeta
}

export type PantryInventoryRecord = {
  itemId: string
  healthyCount: number
  totalQuantity: number
  locations: string[]
  expiringSoonCount: number
  expiredCount: number
  lowStockThreshold: number
  lastStockedAt: string | null
  updatedAt: string
  source: SourceMeta
}

export type InventoryHistoryRecord = {
  id: string
  itemId: string
  addedCount: number
  consumedCount: number
  expiredCount: number
  expiringSoonCount: number
  lastEventAt: string
  source: SourceMeta
}

export type PantryItemAnalysisRecord = {
  itemId: string
  status: "healthy" | "low-stock" | "replenish-soon" | "expiring-soon" | "expired"
  flags: {
    isLowStock: boolean
    isReplenishmentCandidate: boolean
    isExpiringSoon: boolean
    isExpired: boolean
  }
  reasons: Array<
    | "quantity-below-threshold"
    | "low-stock-and-consumed-before"
    | "expiring-items-present"
    | "expired-items-present"
  >
  metrics: {
    healthyCount: number
    totalQuantity: number
    lowStockThreshold: number
    addedCount: number
    consumedCount: number
    expiringSoonCount: number
    expiredCount: number
  }
  updatedAt: string
}

export type PantryRecommendationRecord = {
  itemId: string
  recommendation: "check-item" | "use-soon" | "restock-soon" | "none"
  priority: 100 | 80 | 60 | 0
  reasons: Array<"item-expired" | "item-expiring-soon" | "item-needs-restock">
  sourceStatus: PantryItemAnalysisRecord["status"]
  updatedAt: string
}

export type PantryPriorityRecord = {
  itemId: string
  itemName: string
  rank: number
  recommendation: PantryRecommendationRecord["recommendation"]
  priority: PantryRecommendationRecord["priority"]
  reasons: PantryRecommendationRecord["reasons"]
  sourceStatus: PantryRecommendationRecord["sourceStatus"]
  metrics: {
    healthyCount: number
    expiringSoonCount: number
    expiredCount: number
    consumedCount: number
  }
  updatedAt: string
}

export type RestockPolicyRecord = {
  itemId: string
  policy: "always" | "never" | "learn"
  createdAt: string
  updatedAt: string
}

export type PantryActivityRecord = {
  id: string
  itemId: string
  type: "consumed" | "added"
  amount: number
  at: string
}

export type PantryShoppingListRecord = {
  itemId: string
  itemName: string
  category: string
  rank: number
  sourceRecommendation: "restock-soon"
  sourcePriority: number
  sourceStatus: PantryItemAnalysisRecord["status"] | "unknown"
  addedAt: string
}

export type RecommendationResolutionRecord = {
  id: string
  itemId: string
  recommendation: "check-item" | "use-soon" | "restock-soon"
  resolution: "still-good" | "discarded" | "used" | "done" | "bought"
  suppressedUntil: string | null
  updatedAt: string
}

export type EventLogEntry = {
  id: string
  type: string
  featureName: string
  programName: string
  actionName: string
  subjectId: string
  subjectName: string
  payload: Record<string, unknown>
  timestamp: string
}

export type PantryDomainState = {
  pantry: {
    items: { items: PantryItemRecord[] }
    inventory: { records: PantryInventoryRecord[] }
    inventoryHistory: { records: InventoryHistoryRecord[] }
    itemAnalysis: { records: PantryItemAnalysisRecord[] }
    recommendations: { records: PantryRecommendationRecord[] }
    priorities: { records: PantryPriorityRecord[] }
    recommendationResolutions: { records: RecommendationResolutionRecord[] }
    restockPolicy: { records: RestockPolicyRecord[] }
    activityLog: { records: PantryActivityRecord[] }
    shoppingList: { records: PantryShoppingListRecord[] }
  }
  eventLog: EventLogEntry[]
  session: {
    seedMode: boolean
    seedScenario: string | null
    lastUpdatedAt: string | null
    bootStatus: "booting" | "ready" | "failed"
  }
}

type PantryStateUpdates = Partial<{
  pantry: Partial<{
    items: { items: PantryItemRecord[]; replace?: boolean }
    inventory: { records: PantryInventoryRecord[]; replace?: boolean }
    inventoryHistory: { records: InventoryHistoryRecord[]; replace?: boolean }
    itemAnalysis: { records: PantryItemAnalysisRecord[]; replace?: boolean }
    recommendations: { records: PantryRecommendationRecord[]; replace?: boolean }
    priorities: { records: PantryPriorityRecord[]; replace?: boolean }
    recommendationResolutions: { records: RecommendationResolutionRecord[]; replace?: boolean }
    restockPolicy: { records: RestockPolicyRecord[]; replace?: boolean }
    activityLog: { records: PantryActivityRecord[]; replace?: boolean }
    shoppingList: { records: PantryShoppingListRecord[]; replace?: boolean }
  }>
  session: Partial<PantryDomainState["session"]>
}>

type GraphLike = {
  nodes?: unknown[]
  edges?: unknown[]
  state?: Record<string, Record<string, unknown>>
  meta?: Record<string, Record<string, unknown>>
}

function nowIso() {
  return new Date().toISOString()
}

function asString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback
}

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

function toInventoryRecord(raw: PantryInventoryRecord): PantryInventoryRecord {
  const healthyCount = Math.max(0, asNumber((raw as any).healthyCount, 0))
  const expiringSoonCount = Math.max(0, asNumber((raw as any).expiringSoonCount, 0))
  const expiredCount = Math.max(0, asNumber((raw as any).expiredCount, 0))
  return {
    ...raw,
    healthyCount,
    expiringSoonCount,
    expiredCount,
    totalQuantity: healthyCount + expiringSoonCount + expiredCount,
    lastStockedAt:
      typeof (raw as any).lastStockedAt === "string" || (raw as any).lastStockedAt === null
        ? ((raw as any).lastStockedAt as string | null)
        : null,
  }
}

function titleFromItemId(itemId: string) {
  const raw = itemId.replace(/^item:/, "")
  if (!raw) return itemId
  return raw.charAt(0).toUpperCase() + raw.slice(1)
}

function defaultShelfLifeDaysForCategory(category: string) {
  switch (category) {
    case "Produce":
      return 7
    case "Dairy":
      return 14
    case "Meat":
      return 5
    case "Seafood":
      return 3
    case "Bakery":
      return 6
    case "Pantry":
      return 180
    case "Frozen":
      return 90
    case "Snacks":
      return 60
    case "Beverages":
      return 30
    case "Household":
      return 30
    default:
      return 30
  }
}

function toSourceMeta(value: unknown, fallbackKind: SourceMeta["kind"], fallbackLabel: string): SourceMeta {
  const source = value as Partial<SourceMeta>
  const kind = source?.kind === "seed" || source?.kind === "user" ? source.kind : fallbackKind
  const label = typeof source?.label === "string" && source.label ? source.label : fallbackLabel
  return { kind, label }
}

function toEventLogEntry(raw: Record<string, unknown>, index: number): EventLogEntry {
  return {
    id: asString(raw.id, `evt:${index + 1}`),
    type: asString(raw.type, "DOMAIN_EVENT"),
    featureName: asString(raw.featureName, "unknown"),
    programName: asString(raw.programName, "unknown"),
    actionName: asString(raw.actionName, "unknown"),
    subjectId: asString(raw.subjectId, "unknown"),
    subjectName: asString(raw.subjectName, "unknown"),
    payload: (raw.payload as Record<string, unknown>) ?? {},
    timestamp: asString(raw.timestamp, nowIso()),
  }
}

function upsertByKey<T>(items: T[], patch: T, key: keyof T): T[] {
  const keyValue = patch[key]
  const index = items.findIndex((item) => item[key] === keyValue)
  if (index === -1) return [...items, patch]
  const next = [...items]
  next[index] = patch
  return next
}

export function createInitialDomainState(seedMode = false, seedScenario: string | null = null): PantryDomainState {
  return {
    pantry: {
      items: { items: [] },
      inventory: { records: [] },
      inventoryHistory: { records: [] },
      itemAnalysis: { records: [] },
      recommendations: { records: [] },
      priorities: { records: [] },
      recommendationResolutions: { records: [] },
      restockPolicy: { records: [] },
      activityLog: { records: [] },
      shoppingList: { records: [] },
    },
    eventLog: [],
    session: {
      seedMode,
      seedScenario,
      lastUpdatedAt: null,
      bootStatus: "booting",
    },
  }
}

export function buildDomainStateFromGraph(graph: unknown, seedMode = true): {
  state: PantryDomainState
  eventLog: EventLogEntry[]
} {
  const source = (graph ?? {}) as GraphLike
  const timestamp = nowIso()
  const seedScenario = seedMode ? "graph-import" : null

  const base = createInitialDomainState(seedMode, seedScenario)

  const nodes = Array.isArray(source.nodes) ? source.nodes.map(String) : []
  const stateMap = source.state ?? {}
  const metaMap = source.meta ?? {}

  let items = [...base.pantry.items.items]
  let inventory = [...base.pantry.inventory.records]
  let history = [...base.pantry.inventoryHistory.records]
  const itemAnalysis: PantryItemAnalysisRecord[] = []
  const recommendations: PantryRecommendationRecord[] = []
  const priorities: PantryPriorityRecord[] = []
  const recommendationResolutions: RecommendationResolutionRecord[] = []
  const restockPolicy: RestockPolicyRecord[] = []
  const activityLog: PantryActivityRecord[] = []
  const events: EventLogEntry[] = []

  for (const node of nodes) {
    if (!node.startsWith("item:")) continue

    const rawState = stateMap[node] ?? {}
    const rawMeta = metaMap[node] ?? {}
    const quantity = Math.max(0, asNumber(rawState.quantity, 0))
    const expiringSoonCount = Math.max(0, asNumber(rawState.expiring_soon_count, 0))
    const expiredCount = Math.max(0, asNumber(rawState.expired_count, 0))
    const lowStockThreshold = Math.max(0, asNumber(rawState.min_quantity, 1))
    const sourceMeta = toSourceMeta(rawMeta.source, "seed", seedScenario ?? "graph-import")

    const itemRecord: PantryItemRecord = {
      id: node,
      name: asString(rawMeta.display_name, titleFromItemId(node)),
      category: asString(rawMeta.category, "Other") || "Other",
      shelfLifeDays: Math.max(
        1,
        asNumber(rawMeta.shelf_life_days, defaultShelfLifeDaysForCategory(asString(rawMeta.category, "Other"))),
      ),
      tags: Array.isArray(rawMeta.tags) ? rawMeta.tags.map(String) : undefined,
      source: sourceMeta,
    }

    const inventoryRecord: PantryInventoryRecord = {
      itemId: node,
      healthyCount: quantity,
      totalQuantity: quantity + expiringSoonCount + expiredCount,
      locations: Array.isArray(rawMeta.locations) ? rawMeta.locations.map(String) : [],
      expiringSoonCount,
      expiredCount,
      lowStockThreshold,
      lastStockedAt: timestamp,
      updatedAt: timestamp,
      source: sourceMeta,
    }

    const historyRecord: InventoryHistoryRecord = {
      id: `invhist:${node}`,
      itemId: node,
      addedCount: quantity,
      consumedCount: 0,
      expiredCount: inventoryRecord.expiredCount,
      expiringSoonCount: inventoryRecord.expiringSoonCount,
      lastEventAt: timestamp,
      source: sourceMeta,
    }

    items = upsertByKey(items, itemRecord, "id")
    inventory = upsertByKey(inventory, inventoryRecord, "itemId")
    history = upsertByKey(history, historyRecord, "itemId")

    events.push({
      id: `seed:${node}`,
      type: "ITEM_ADDED",
      featureName: "pantry",
      programName: "addItem",
      actionName: "ADD_ITEM",
      subjectId: node,
      subjectName: itemRecord.name,
      payload: {
        quantity,
        source: sourceMeta,
      },
      timestamp,
    })
  }

  const state: PantryDomainState = {
    pantry: {
      items: { items },
      inventory: { records: inventory },
      inventoryHistory: { records: history },
      itemAnalysis: { records: itemAnalysis },
      recommendations: { records: recommendations },
      priorities: { records: priorities },
      recommendationResolutions: { records: recommendationResolutions },
      restockPolicy: { records: restockPolicy },
      activityLog: { records: activityLog },
      shoppingList: { records: [] },
    },
    eventLog: events,
    session: {
      seedMode,
      seedScenario,
      lastUpdatedAt: timestamp,
      bootStatus: "booting",
    },
  }

  return {
    state,
    eventLog: events,
  }
}

export function reduceDomainState({
  state,
  eventLog,
  stateUpdates,
}: {
  state: PantryDomainState
  eventLog: Array<Record<string, unknown>>
  stateUpdates: Record<string, unknown>
}): PantryDomainState {
  const timestamp = nowIso()
  const updates = (stateUpdates ?? {}) as PantryStateUpdates
  const normalizedEventLog = eventLog.map((entry, index) => toEventLogEntry(entry, index))

  let nextItems = [...state.pantry.items.items]
  if (Array.isArray(updates.pantry?.items?.items)) {
    if (updates.pantry.items.replace === true) {
      nextItems = [...updates.pantry.items.items]
    } else {
      for (const item of updates.pantry.items.items) {
        nextItems = upsertByKey(nextItems, item, "id")
      }
    }
  }

  let nextInventory = [...state.pantry.inventory.records]
  if (Array.isArray(updates.pantry?.inventory?.records)) {
    if (updates.pantry.inventory.replace === true) {
      nextInventory = updates.pantry.inventory.records.map((record) => toInventoryRecord(record))
    } else {
      for (const record of updates.pantry.inventory.records) {
        nextInventory = upsertByKey(nextInventory, toInventoryRecord(record), "itemId")
      }
    }
  }

  let nextHistory = [...state.pantry.inventoryHistory.records]
  if (Array.isArray(updates.pantry?.inventoryHistory?.records)) {
    if (updates.pantry.inventoryHistory.replace === true) {
      nextHistory = [...updates.pantry.inventoryHistory.records]
    } else {
      for (const record of updates.pantry.inventoryHistory.records) {
        nextHistory = upsertByKey(nextHistory, record, "itemId")
      }
    }
  }

  let nextItemAnalysis = [...state.pantry.itemAnalysis.records]
  if (Array.isArray(updates.pantry?.itemAnalysis?.records)) {
    if (updates.pantry.itemAnalysis.replace === true) {
      nextItemAnalysis = [...updates.pantry.itemAnalysis.records]
    } else {
      for (const record of updates.pantry.itemAnalysis.records) {
        nextItemAnalysis = upsertByKey(nextItemAnalysis, record, "itemId")
      }
    }
  }

  let nextRecommendations = [...state.pantry.recommendations.records]
  if (Array.isArray(updates.pantry?.recommendations?.records)) {
    if (updates.pantry.recommendations.replace === true) {
      nextRecommendations = [...updates.pantry.recommendations.records]
    } else {
      for (const record of updates.pantry.recommendations.records) {
        nextRecommendations = upsertByKey(nextRecommendations, record, "itemId")
      }
    }
  }

  let nextPriorities = [...state.pantry.priorities.records]
  if (Array.isArray(updates.pantry?.priorities?.records)) {
    if (updates.pantry.priorities.replace === true) {
      nextPriorities = [...updates.pantry.priorities.records]
    } else {
      for (const record of updates.pantry.priorities.records) {
        nextPriorities = upsertByKey(nextPriorities, record, "itemId")
      }
    }
  }

  let nextRecommendationResolutions = [...state.pantry.recommendationResolutions.records]
  if (Array.isArray(updates.pantry?.recommendationResolutions?.records)) {
    if (updates.pantry.recommendationResolutions.replace === true) {
      nextRecommendationResolutions = [...updates.pantry.recommendationResolutions.records]
    } else {
      for (const record of updates.pantry.recommendationResolutions.records) {
        const key = `${record.itemId}:${record.recommendation}`
        const index = nextRecommendationResolutions.findIndex(
          (entry) => `${entry.itemId}:${entry.recommendation}` === key,
        )
        if (index === -1) {
          nextRecommendationResolutions = [...nextRecommendationResolutions, record]
        } else {
          const next = [...nextRecommendationResolutions]
          next[index] = record
          nextRecommendationResolutions = next
        }
      }
    }
  }

  let nextRestockPolicy = [...state.pantry.restockPolicy.records]
  if (Array.isArray(updates.pantry?.restockPolicy?.records)) {
    if (updates.pantry.restockPolicy.replace === true) {
      nextRestockPolicy = [...updates.pantry.restockPolicy.records]
    } else {
      for (const record of updates.pantry.restockPolicy.records) {
        nextRestockPolicy = upsertByKey(nextRestockPolicy, record, "itemId")
      }
    }
  }

  let nextActivityLog = [...state.pantry.activityLog.records]
  if (Array.isArray(updates.pantry?.activityLog?.records)) {
    if (updates.pantry.activityLog.replace === true) {
      nextActivityLog = [...updates.pantry.activityLog.records]
    } else {
      nextActivityLog = [...nextActivityLog, ...updates.pantry.activityLog.records]
    }
  }

  let nextShoppingList = [...state.pantry.shoppingList.records]
  if (Array.isArray(updates.pantry?.shoppingList?.records)) {
    if (updates.pantry.shoppingList.replace === true) {
      nextShoppingList = [...updates.pantry.shoppingList.records]
    } else {
      for (const record of updates.pantry.shoppingList.records) {
        nextShoppingList = upsertByKey(nextShoppingList, record, "itemId")
      }
    }
  }

  return {
    pantry: {
      items: { items: nextItems },
      inventory: { records: nextInventory },
      inventoryHistory: { records: nextHistory },
      itemAnalysis: { records: nextItemAnalysis },
      recommendations: { records: nextRecommendations },
      priorities: { records: nextPriorities },
      recommendationResolutions: { records: nextRecommendationResolutions },
      restockPolicy: { records: nextRestockPolicy },
      activityLog: { records: nextActivityLog },
      shoppingList: { records: nextShoppingList },
    },
    eventLog: normalizedEventLog,
    session: {
      seedMode:
        typeof updates.session?.seedMode === "boolean" ? updates.session.seedMode : state.session.seedMode,
      seedScenario:
        typeof updates.session?.seedScenario === "string" || updates.session?.seedScenario === null
          ? updates.session.seedScenario
          : state.session.seedScenario,
      lastUpdatedAt: updates.session?.lastUpdatedAt ?? timestamp,
      bootStatus:
        updates.session?.bootStatus === "booting" ||
        updates.session?.bootStatus === "ready" ||
        updates.session?.bootStatus === "failed"
          ? updates.session.bootStatus
          : state.session.bootStatus,
    },
  }
}
