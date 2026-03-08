function asSafeNonNegative(value, fallback = 0) {
  if (typeof value !== "number" || !Number.isFinite(value)) return fallback
  if (value < 0) return fallback
  return value
}

function normalizeDisplayName(value, fallback) {
  const raw = typeof value === "string" && value.trim().length > 0 ? value.trim() : fallback
  return raw
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, " ")
    .trim()
}

function buildPriorityRecords({
  recommendationRecords,
  inventoryRecords,
  inventoryHistoryRecords,
  itemRecords,
  updatedAt,
}) {
  const itemById = new Map((Array.isArray(itemRecords) ? itemRecords : []).map((item) => [item.id, item]))
  const inventoryByItemId = new Map(
    (Array.isArray(inventoryRecords) ? inventoryRecords : []).map((record) => [record.itemId, record]),
  )
  const historyByItemId = new Map(
    (Array.isArray(inventoryHistoryRecords) ? inventoryHistoryRecords : []).map((record) => [
      record.itemId,
      record,
    ]),
  )

  const rankedBase = (Array.isArray(recommendationRecords) ? recommendationRecords : []).map(
    (recommendation) => {
      const itemId = recommendation.itemId
      const item = itemById.get(itemId) ?? null
      const inventoryRecord = inventoryByItemId.get(itemId) ?? null
      const historyRecord = historyByItemId.get(itemId) ?? null
      const itemName = typeof item?.name === "string" && item.name.length > 0 ? item.name : itemId

      return {
        itemId,
        itemName,
        recommendation: recommendation.recommendation,
        priority: recommendation.priority,
        reasons: Array.isArray(recommendation.reasons) ? recommendation.reasons : [],
        sourceStatus: recommendation.sourceStatus,
        metrics: {
          healthyCount: asSafeNonNegative(inventoryRecord?.healthyCount, 0),
          expiringSoonCount: asSafeNonNegative(inventoryRecord?.expiringSoonCount, 0),
          expiredCount: asSafeNonNegative(inventoryRecord?.expiredCount, 0),
          consumedCount: asSafeNonNegative(historyRecord?.consumedCount, 0),
        },
        normalizedItemName: normalizeDisplayName(itemName, itemId),
        updatedAt,
      }
    },
  )

  rankedBase.sort((a, b) => {
    if (b.priority !== a.priority) return b.priority - a.priority
    if (b.metrics.expiredCount !== a.metrics.expiredCount) {
      return b.metrics.expiredCount - a.metrics.expiredCount
    }
    if (b.metrics.expiringSoonCount !== a.metrics.expiringSoonCount) {
      return b.metrics.expiringSoonCount - a.metrics.expiringSoonCount
    }
    if (a.metrics.healthyCount !== b.metrics.healthyCount) {
      return a.metrics.healthyCount - b.metrics.healthyCount
    }
    if (b.metrics.consumedCount !== a.metrics.consumedCount) {
      return b.metrics.consumedCount - a.metrics.consumedCount
    }
    if (a.normalizedItemName !== b.normalizedItemName) {
      return a.normalizedItemName.localeCompare(b.normalizedItemName)
    }
    return String(a.itemId).localeCompare(String(b.itemId))
  })

  return rankedBase.map((record, index) => ({
    itemId: record.itemId,
    itemName: record.itemName,
    rank: index + 1,
    recommendation: record.recommendation,
    priority: record.priority,
    reasons: record.reasons,
    sourceStatus: record.sourceStatus,
    metrics: record.metrics,
    updatedAt: record.updatedAt,
  }))
}

export { buildPriorityRecords }
