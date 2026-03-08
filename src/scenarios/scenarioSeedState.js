import { createInitialDomainState } from "../state/pantryStateEngine"

function nowIso() {
  return new Date().toISOString()
}

function normalizeSource(source, fallbackLabel = "scenario-seed") {
  const value = source ?? {}
  return {
    kind: value.kind === "seed" || value.kind === "user" ? value.kind : "seed",
    label: typeof value.label === "string" && value.label.length > 0 ? value.label : fallbackLabel,
  }
}

function defaultShelfLifeDaysForCategory(category) {
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

export function createSeedItem({ id, name, category, shelfLifeDays, tags = [], source } = {}) {
  const safeCategory = typeof category === "string" && category.length > 0 ? category : "Other"
  return {
    id,
    name,
    category: safeCategory,
    shelfLifeDays:
      typeof shelfLifeDays === "number" && Number.isFinite(shelfLifeDays) && shelfLifeDays > 0
        ? Math.round(shelfLifeDays)
        : defaultShelfLifeDaysForCategory(safeCategory),
    tags,
    source: normalizeSource(source),
  }
}

export function createSeedInventoryRecord({
  itemId,
  healthyCount = null,
  totalQuantity = null,
  locations = [],
  expiringSoonCount = 0,
  expiredCount = 0,
  lowStockThreshold = 1,
  lastStockedAt = null,
  source,
} = {}) {
  const normalizedHealthy =
    typeof healthyCount === "number" && Number.isFinite(healthyCount)
      ? Math.max(0, healthyCount)
      : typeof totalQuantity === "number" && Number.isFinite(totalQuantity)
        ? Math.max(0, totalQuantity) - Math.max(0, expiringSoonCount) - Math.max(0, expiredCount)
        : 0
  const safeHealthy = Math.max(0, normalizedHealthy)
  const safeExpiringSoon = Math.max(0, expiringSoonCount)
  const safeExpired = Math.max(0, expiredCount)
  return {
    itemId,
    healthyCount: safeHealthy,
    totalQuantity: safeHealthy + safeExpiringSoon + safeExpired,
    locations,
    expiringSoonCount: safeExpiringSoon,
    expiredCount: safeExpired,
    lowStockThreshold,
    lastStockedAt: typeof lastStockedAt === "string" ? lastStockedAt : nowIso(),
    updatedAt: nowIso(),
    source: normalizeSource(source),
  }
}

function normalizeInventoryRecord(record) {
  return createSeedInventoryRecord({
    itemId: record?.itemId,
    healthyCount: record?.healthyCount,
    totalQuantity: record?.totalQuantity,
    locations: Array.isArray(record?.locations) ? record.locations : [],
    expiringSoonCount: record?.expiringSoonCount,
    expiredCount: record?.expiredCount,
    lowStockThreshold: record?.lowStockThreshold,
    lastStockedAt: record?.lastStockedAt,
    source: record?.source,
  })
}

export function createSeedInventoryHistoryRecord({
  itemId,
  addedCount = 0,
  consumedCount = 0,
  expiredCount = 0,
  expiringSoonCount = 0,
  source,
} = {}) {
  return {
    id: `invhist:${itemId}`,
    itemId,
    addedCount,
    consumedCount,
    expiredCount,
    expiringSoonCount,
    lastEventAt: nowIso(),
    source: normalizeSource(source),
  }
}

export function createSeedItemAnalysisRecord({
  itemId,
  status = "healthy",
  isLowStock = false,
  isReplenishmentCandidate = false,
  isExpiringSoon = false,
  isExpired = false,
  reasons = [],
  totalQuantity = 0,
  healthyCount = 0,
  lowStockThreshold = 0,
  addedCount = 0,
  consumedCount = 0,
  expiringSoonCount = 0,
  expiredCount = 0,
} = {}) {
  return {
    itemId,
    status,
    flags: {
      isLowStock,
      isReplenishmentCandidate,
      isExpiringSoon,
      isExpired,
    },
    reasons,
    metrics: {
      healthyCount,
      totalQuantity,
      lowStockThreshold,
      addedCount,
      consumedCount,
      expiringSoonCount,
      expiredCount,
    },
    updatedAt: nowIso(),
  }
}

export function createSeedRecommendationRecord({
  itemId,
  recommendation = "none",
  priority = 0,
  reasons = [],
  sourceStatus = "healthy",
} = {}) {
  return {
    itemId,
    recommendation,
    priority,
    reasons,
    sourceStatus,
    updatedAt: nowIso(),
  }
}

export function createSeedPriorityRecord({
  itemId,
  itemName,
  rank = 1,
  recommendation = "none",
  priority = 0,
  reasons = [],
  sourceStatus = "healthy",
  healthyCount = 0,
  expiringSoonCount = 0,
  expiredCount = 0,
  consumedCount = 0,
} = {}) {
  return {
    itemId,
    itemName: typeof itemName === "string" && itemName.length > 0 ? itemName : itemId,
    rank,
    recommendation,
    priority,
    reasons,
    sourceStatus,
    metrics: {
      healthyCount,
      expiringSoonCount,
      expiredCount,
      consumedCount,
    },
    updatedAt: nowIso(),
  }
}

export function createSeedShoppingListRecord({
  itemId,
  itemName,
  category = "Other",
  rank = 1,
  sourceRecommendation = "restock-soon",
  sourcePriority = 60,
  sourceStatus = "low-stock",
  addedAt,
} = {}) {
  return {
    itemId,
    itemName: typeof itemName === "string" && itemName.length > 0 ? itemName : itemId,
    category,
    rank,
    sourceRecommendation,
    sourcePriority,
    sourceStatus,
    addedAt: typeof addedAt === "string" ? addedAt : nowIso(),
  }
}

export function createSeedRestockPolicyRecord({ itemId, policy = "learn", createdAt, updatedAt } = {}) {
  const safePolicy = policy === "always" || policy === "never" || policy === "learn" ? policy : "learn"
  const timestamp = nowIso()
  return {
    itemId,
    policy: safePolicy,
    createdAt: typeof createdAt === "string" ? createdAt : timestamp,
    updatedAt: typeof updatedAt === "string" ? updatedAt : timestamp,
  }
}

export function createSeedRecommendationResolutionRecord({
  itemId,
  recommendation = "use-soon",
  resolution = "done",
  suppressedUntil = "until-expired",
  updatedAt,
} = {}) {
  return {
    id: `reco-resolution:${itemId}:${recommendation}`,
    itemId,
    recommendation,
    resolution,
    suppressedUntil,
    updatedAt: typeof updatedAt === "string" ? updatedAt : nowIso(),
  }
}

export function createScenarioSeedState({
  itemRecords = [],
  inventoryRecords = [],
  inventoryHistoryRecords = [],
  itemAnalysisRecords = [],
  recommendationRecords = [],
  priorityRecords = [],
  shoppingListRecords = [],
  restockPolicyRecords = [],
  recommendationResolutionRecords = [],
  activityLogRecords = [],
  eventLog = [],
  seedMode = true,
  seedScenario = "scenario-seed",
} = {}) {
  const base = createInitialDomainState(seedMode, seedScenario)
  return {
    ...base,
    pantry: {
      items: { items: [...itemRecords] },
      inventory: { records: inventoryRecords.map((record) => normalizeInventoryRecord(record)) },
      inventoryHistory: { records: [...inventoryHistoryRecords] },
      itemAnalysis: { records: [...itemAnalysisRecords] },
      recommendations: { records: [...recommendationRecords] },
      priorities: { records: [...priorityRecords] },
      recommendationResolutions: { records: [...recommendationResolutionRecords] },
      shoppingList: { records: [...shoppingListRecords] },
      restockPolicy: { records: [...restockPolicyRecords] },
      activityLog: { records: [...activityLogRecords] },
    },
    eventLog: [...eventLog],
    session: {
      ...base.session,
      seedMode,
      seedScenario,
      lastUpdatedAt: nowIso(),
    },
  }
}
