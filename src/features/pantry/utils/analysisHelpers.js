import { resolveItemStatusFromTat } from "./resolveItemStatusFromTat"
import { isConsumedWithinRecentWindow } from "./activityHelpers"
import { normalizeRestockPolicy } from "./restockPolicyHelpers"
import { inferExpirationSignals, resolveShelfLifeDays } from "./shelfLifeHelpers"

function buildItemAnalysisRecord({
  inventoryRecord,
  historyRecord,
  itemRecord,
  restockPolicy,
  activityRecords,
  nowMs,
  updatedAt,
}) {
  const healthyCount = Number.isFinite(inventoryRecord?.healthyCount) ? inventoryRecord.healthyCount : 0
  const totalQuantity = Number.isFinite(inventoryRecord?.totalQuantity) ? inventoryRecord.totalQuantity : 0
  const lowStockThreshold = Number.isFinite(inventoryRecord?.lowStockThreshold)
    ? inventoryRecord.lowStockThreshold
    : 0
  const addedCount = Number.isFinite(historyRecord?.addedCount) ? historyRecord.addedCount : 0
  const consumedCount = Number.isFinite(historyRecord?.consumedCount) ? historyRecord.consumedCount : 0
  const expiringSoonCount = Number.isFinite(inventoryRecord?.expiringSoonCount)
    ? inventoryRecord.expiringSoonCount
    : 0
  const expiredCount = Number.isFinite(inventoryRecord?.expiredCount) ? inventoryRecord.expiredCount : 0
  const shelfLifeDays = resolveShelfLifeDays({
    explicitShelfLifeDays: itemRecord?.shelfLifeDays,
    category: itemRecord?.category,
  })
  const lastStockedAt =
    typeof inventoryRecord?.lastStockedAt === "string" ? inventoryRecord.lastStockedAt : null
  const inferredExpiration = inferExpirationSignals({
    nowMs,
    lastStockedAt,
    shelfLifeDays,
  })

  const policy = normalizeRestockPolicy(restockPolicy, "learn")
  const recentlyConsumed = isConsumedWithinRecentWindow({
    activityRecords,
    itemId: inventoryRecord?.itemId,
    nowMs,
  })
  const allowReplenishmentEscalation = policy !== "never"
  const hasActiveRestockIntent =
    policy === "always" ? consumedCount > 0 : policy === "learn" ? recentlyConsumed : false

  const isLowStock = healthyCount <= lowStockThreshold
  const isReplenishmentCandidate = isLowStock && hasActiveRestockIntent && allowReplenishmentEscalation
  const isExpiringSoon = expiringSoonCount > 0 || inferredExpiration.isInferredExpiringSoon
  const isExpired = expiredCount > 0 || inferredExpiration.isInferredExpired

  const flags = {
    isLowStock,
    isReplenishmentCandidate,
    isExpiringSoon,
    isExpired,
  }

  const resolution = resolveItemStatusFromTat({ flags })
  const status = resolution.status

  const reasons = []
  if (isLowStock) {
    reasons.push("quantity-below-threshold")
  }
  if (isReplenishmentCandidate) {
    reasons.push("low-stock-and-consumed-before")
  }
  if (isExpiringSoon) {
    reasons.push("expiring-items-present")
  }
  if (isExpired) {
    reasons.push("expired-items-present")
  }

  return {
    itemId: inventoryRecord.itemId,
    status,
    flags,
    reasons,
    metrics: {
      healthyCount,
      totalQuantity,
      lowStockThreshold,
      addedCount,
      consumedCount,
      expiringSoonCount,
      expiredCount,
      shelfLifeDays,
      lastStockedAt,
      daysSinceLastStocked: inferredExpiration.daysSinceLastStocked,
    },
    updatedAt,
  }
}

export { buildItemAnalysisRecord }
