function normalizeRestockPolicy(value, fallback = "learn") {
  if (value === "always" || value === "never" || value === "learn") return value
  return fallback
}

function createRestockPolicyMap(records) {
  return new Map(
    (Array.isArray(records) ? records : []).map((record) => [
      record.itemId,
      normalizeRestockPolicy(record.policy, "learn"),
    ]),
  )
}

export { normalizeRestockPolicy, createRestockPolicyMap }
