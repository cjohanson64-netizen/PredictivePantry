import { getDefaultShelfLifeDays as getCategoryDefaultShelfLifeDays } from "./itemCategory"

export function normalizeShelfLifeDays(value, fallback = null) {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback
  const rounded = Math.round(value)
  if (rounded <= 0) return fallback
  return rounded
}

export function getDefaultShelfLifeDays(category) {
  return getCategoryDefaultShelfLifeDays(category)
}

export function resolveShelfLifeDays({ explicitShelfLifeDays, category }) {
  return (
    normalizeShelfLifeDays(explicitShelfLifeDays, null) ??
    getDefaultShelfLifeDays(category)
  )
}

export function inferExpirationSignals({
  nowMs,
  lastStockedAt,
  shelfLifeDays,
}) {
  const parsedLastStockedAt = typeof lastStockedAt === 'string' ? Date.parse(lastStockedAt) : Number.NaN
  const hasLastStockedAt = Number.isFinite(parsedLastStockedAt)
  const safeShelfLifeDays = normalizeShelfLifeDays(shelfLifeDays, null)

  if (!hasLastStockedAt || safeShelfLifeDays == null) {
    return {
      hasInference: false,
      daysSinceLastStocked: null,
      isInferredExpired: false,
      isInferredExpiringSoon: false,
    }
  }

  const elapsedDays = Math.max(0, (nowMs - parsedLastStockedAt) / (24 * 60 * 60 * 1000))
  const thresholdExpiringSoon = safeShelfLifeDays * 0.8

  return {
    hasInference: true,
    daysSinceLastStocked: elapsedDays,
    isInferredExpired: elapsedDays >= safeShelfLifeDays,
    isInferredExpiringSoon: elapsedDays >= thresholdExpiringSoon && elapsedDays < safeShelfLifeDays,
  }
}
