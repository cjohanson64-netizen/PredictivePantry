type RecommendationKind = "check-item" | "use-soon" | "restock-soon" | "none"

type RecommendationCardCopyInput = {
  itemName: string
  recommendation: RecommendationKind
  sourceStatus?: string
  reasons?: string[]
  metrics?: {
    healthyCount?: unknown
    expiringSoonCount?: unknown
    lowStockThreshold?: unknown
  }
}

type RecommendationCardCopy = {
  title: string
  detail: string
}

function asSafeWholeCount(value: unknown): number | null {
  if (typeof value !== "number" || !Number.isFinite(value)) return null
  return Math.max(0, Math.round(value))
}

function hasReason(reasons: string[] | undefined, reason: string) {
  return Array.isArray(reasons) && reasons.includes(reason)
}

function buildCheckItemDetail({
  sourceStatus,
  reasons,
}: {
  sourceStatus?: string
  reasons?: string[]
}) {
  if (sourceStatus === "expired" || hasReason(reasons, "item-expired")) {
    return "It appears to have passed its shelf life."
  }

  return "This item may be expired based on when it was last stocked."
}

function buildUseSoonDetail(expiringSoonCount: number | null) {
  if (expiringSoonCount == null || expiringSoonCount <= 0) {
    return "This item is approaching expiration."
  }

  return expiringSoonCount === 1
    ? "You have 1 that is about to expire."
    : `You have ${expiringSoonCount} that are about to expire.`
}

function buildRestockSoonDetail({
  healthyCount,
  lowStockThreshold,
}: {
  healthyCount: number | null
  lowStockThreshold: number | null
}) {
  if (healthyCount != null) {
    return `You only have ${healthyCount} left.`
  }

  if (lowStockThreshold != null) {
    return `Stock is below the threshold of ${lowStockThreshold}.`
  }

  return "Stock is running low."
}

export function buildRecommendationCardCopy({
  itemName,
  recommendation,
  sourceStatus,
  reasons,
  metrics,
}: RecommendationCardCopyInput): RecommendationCardCopy {
  const safeName = itemName.trim().length > 0 ? itemName.trim() : "this item"
  const expiringSoonCount = asSafeWholeCount(metrics?.expiringSoonCount)
  const healthyCount = asSafeWholeCount(metrics?.healthyCount)
  const lowStockThreshold = asSafeWholeCount(metrics?.lowStockThreshold)

  if (recommendation === "check-item") {
    return {
      title: `Check ${safeName} before consuming`,
      detail: buildCheckItemDetail({ sourceStatus, reasons }),
    }
  }

  if (recommendation === "use-soon") {
    return {
      title: `Use ${safeName} soon`,
      detail: buildUseSoonDetail(expiringSoonCount),
    }
  }

  if (recommendation === "restock-soon") {
    return {
      title: `Restock ${safeName}`,
      detail: buildRestockSoonDetail({ healthyCount, lowStockThreshold }),
    }
  }

  return {
    title: safeName,
    detail: "",
  }
}
