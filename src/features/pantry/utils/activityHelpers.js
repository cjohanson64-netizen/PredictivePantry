function asTimeMs(value, fallbackMs) {
  if (typeof value !== "string") return fallbackMs
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? parsed : fallbackMs
}

function isConsumedWithinRecentWindow({
  activityRecords,
  itemId,
  nowMs,
  windowDays = 30,
}) {
  if (!Array.isArray(activityRecords) || !itemId) return false
  const windowMs = windowDays * 24 * 60 * 60 * 1000
  const earliest = nowMs - windowMs

  return activityRecords.some((record) => {
    if (record?.itemId !== itemId) return false
    if (record?.type !== "consumed") return false
    const atMs = asTimeMs(record?.at, Number.NaN)
    if (!Number.isFinite(atMs)) return false
    return atMs >= earliest && atMs <= nowMs
  })
}

export { asTimeMs, isConsumedWithinRecentWindow }
