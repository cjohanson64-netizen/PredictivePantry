import { normalizeRestockPolicy, createRestockPolicyMap } from "./restockPolicyHelpers"
import {
  createRecommendationResolutionMap,
  resolutionKey,
  shouldSuppressRecommendation,
} from "./recommendationResolutionHelpers"

function recommendationFromStatus(status) {
  if (status === "expired") {
    return {
      recommendation: "check-item",
      priority: 100,
      reasons: ["item-expired"],
    }
  }

  if (status === "expiring-soon") {
    return {
      recommendation: "use-soon",
      priority: 80,
      reasons: ["item-expiring-soon"],
    }
  }

  if (status === "replenish-soon" || status === "low-stock") {
    return {
      recommendation: "restock-soon",
      priority: 60,
      reasons: ["item-needs-restock"],
    }
  }

  return {
    recommendation: "none",
    priority: 0,
    reasons: [],
  }
}

function buildRecommendationRecords({
  inventoryRecords,
  analysisRecords,
  restockPolicyRecords,
  recommendationResolutionRecords,
  updatedAt,
  now,
}) {
  const policyByItemId = createRestockPolicyMap(restockPolicyRecords)
  const resolutionByKey = createRecommendationResolutionMap(recommendationResolutionRecords)
  const inventoryByItemId = new Map((Array.isArray(inventoryRecords) ? inventoryRecords : []).map((r) => [r.itemId, r]))

  return (Array.isArray(inventoryRecords) ? inventoryRecords : []).map((inventoryRecord) => {
    const itemId = inventoryRecord.itemId
    const sourceAnalysis = (Array.isArray(analysisRecords) ? analysisRecords : []).find(
      (record) => record.itemId === itemId,
    )
    const sourceStatus = sourceAnalysis?.status ?? "healthy"
    const mapped = recommendationFromStatus(sourceStatus)
    const policy = normalizeRestockPolicy(policyByItemId.get(itemId), "learn")
    const shouldSuppressRestock = policy === "never" && mapped.recommendation === "restock-soon"

    const nextRecord = {
      itemId,
      recommendation: shouldSuppressRestock ? "none" : mapped.recommendation,
      priority: shouldSuppressRestock ? 0 : mapped.priority,
      reasons: shouldSuppressRestock ? [] : mapped.reasons,
      sourceStatus,
      updatedAt,
    }

    const resolutionRecord = resolutionByKey.get(resolutionKey(itemId, nextRecord.recommendation))
    const suppressed = shouldSuppressRecommendation({
      recommendationRecord: nextRecord,
      inventoryRecord: inventoryByItemId.get(itemId) ?? null,
      resolutionRecord,
      now,
    })

    return suppressed
      ? {
          ...nextRecord,
          recommendation: "none",
          priority: 0,
          reasons: [],
        }
      : nextRecord
  })
}

export { recommendationFromStatus, buildRecommendationRecords }
