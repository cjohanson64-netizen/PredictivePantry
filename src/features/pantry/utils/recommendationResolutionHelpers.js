export function resolutionKey(itemId, recommendation) {
  return `${itemId}:${recommendation}`
}

export function createRecommendationResolutionMap(records) {
  const map = new Map()
  for (const record of Array.isArray(records) ? records : []) {
    if (!record?.itemId || !record?.recommendation) continue
    map.set(resolutionKey(record.itemId, record.recommendation), record)
  }
  return map
}

export function shouldSuppressRecommendation({
  recommendationRecord,
  inventoryRecord,
  resolutionRecord,
  now,
}) {
  if (!recommendationRecord || !resolutionRecord) return false
  if (resolutionRecord.recommendation !== recommendationRecord.recommendation) return false

  const nowMs = Date.parse(typeof now === "string" ? now : new Date().toISOString())

  if (
    recommendationRecord.recommendation === "check-item" &&
    resolutionRecord.resolution === "still-good"
  ) {
    const suppressedUntilMs = Date.parse(String(resolutionRecord.suppressedUntil ?? ""))
    if (!Number.isFinite(suppressedUntilMs) || !Number.isFinite(nowMs)) return false
    return nowMs < suppressedUntilMs
  }

  if (resolutionRecord.resolution !== "done") return false

  const suppressedUntil = String(resolutionRecord.suppressedUntil ?? "")
  if (recommendationRecord.recommendation === "use-soon") {
    if (suppressedUntil !== "until-expired") return false
    return recommendationRecord.sourceStatus !== "expired"
  }

  if (recommendationRecord.recommendation === "restock-soon") {
    if (!suppressedUntil.startsWith("until-quantity-change:")) return false
    const baseline = Number(suppressedUntil.split(":")[1] ?? "")
    const totalQuantity =
      typeof inventoryRecord?.totalQuantity === "number" && Number.isFinite(inventoryRecord.totalQuantity)
        ? inventoryRecord.totalQuantity
        : 0
    return Number.isFinite(baseline) && totalQuantity === baseline
  }

  return false
}

export function buildResolutionRecord({
  itemId,
  recommendation,
  resolution,
  suppressedUntil = null,
  updatedAt,
}) {
  return {
    id: `reco-resolution:${itemId}:${recommendation}`,
    itemId,
    recommendation,
    resolution,
    suppressedUntil,
    updatedAt,
  }
}
