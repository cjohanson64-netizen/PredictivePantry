export const RUNTIME_PERSISTENCE_KEY = "predictive-pantry.runtime.v1"
export const RUNTIME_PERSISTENCE_VERSION = 1

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function resolveStorage(explicitStorage) {
  if (explicitStorage && typeof explicitStorage.getItem === "function") return explicitStorage
  if (typeof window !== "undefined" && window.localStorage) return window.localStorage
  return null
}

function validateSession(session) {
  if (!isPlainObject(session)) return false
  if (typeof session.seedMode !== "boolean") return false
  if (!(typeof session.seedScenario === "string" || session.seedScenario === null)) return false
  if (!(typeof session.lastUpdatedAt === "string" || session.lastUpdatedAt === null)) return false
  if (!["booting", "ready", "failed"].includes(session.bootStatus)) return false
  return true
}

function validatePantry(pantry) {
  if (!isPlainObject(pantry)) return false
  if (!isPlainObject(pantry.items) || !Array.isArray(pantry.items.items)) return false
  if (!isPlainObject(pantry.inventory) || !Array.isArray(pantry.inventory.records)) return false
  if (!isPlainObject(pantry.inventoryHistory) || !Array.isArray(pantry.inventoryHistory.records)) return false
  if (!isPlainObject(pantry.itemAnalysis) || !Array.isArray(pantry.itemAnalysis.records)) return false
  if (!isPlainObject(pantry.recommendations) || !Array.isArray(pantry.recommendations.records)) return false
  if (!isPlainObject(pantry.priorities) || !Array.isArray(pantry.priorities.records)) return false
  if (
    isPlainObject(pantry.recommendationResolutions) &&
    !Array.isArray(pantry.recommendationResolutions.records)
  )
    return false
  if (!isPlainObject(pantry.restockPolicy) || !Array.isArray(pantry.restockPolicy.records)) return false
  if (!isPlainObject(pantry.activityLog) || !Array.isArray(pantry.activityLog.records)) return false
  if (!isPlainObject(pantry.shoppingList) || !Array.isArray(pantry.shoppingList.records)) return false
  return true
}

export function validatePersistedRuntimeState(state) {
  if (!isPlainObject(state)) return false
  if (!validatePantry(state.pantry)) return false
  if (!Array.isArray(state.eventLog)) return false
  if (!validateSession(state.session)) return false
  return true
}

export function toPersistedRuntimeEnvelope({ state, savedAt = new Date().toISOString() }) {
  if (!validatePersistedRuntimeState(state)) return null
  return {
    version: RUNTIME_PERSISTENCE_VERSION,
    savedAt,
    state: {
      pantry: clone(state.pantry),
      eventLog: clone(state.eventLog),
      session: clone(state.session),
    },
  }
}

export function readPersistedRuntimeEnvelope({
  storage = null,
  storageKey = RUNTIME_PERSISTENCE_KEY,
} = {}) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return { ok: false, reason: "storage-unavailable", envelope: null }

  let raw
  try {
    raw = resolvedStorage.getItem(storageKey)
  } catch (error) {
    return { ok: false, reason: "storage-read-failed", envelope: null, error }
  }

  if (!raw) return { ok: false, reason: "missing", envelope: null }

  let parsed
  try {
    parsed = JSON.parse(raw)
  } catch (error) {
    return { ok: false, reason: "invalid-json", envelope: null, error }
  }

  if (!isPlainObject(parsed)) return { ok: false, reason: "invalid-envelope", envelope: null }
  if (parsed.version !== RUNTIME_PERSISTENCE_VERSION) {
    return { ok: false, reason: "version-mismatch", envelope: null, envelopeVersion: parsed.version }
  }
  if (!validatePersistedRuntimeState(parsed.state)) {
    return { ok: false, reason: "invalid-state", envelope: null }
  }

  return { ok: true, reason: "loaded", envelope: clone(parsed) }
}

export function loadPersistedRuntimeState(args = {}) {
  const result = readPersistedRuntimeEnvelope(args)
  if (!result.ok || !result.envelope) return null
  return clone(result.envelope.state)
}

export function savePersistedRuntimeState({
  snapshot = null,
  state = null,
  storage = null,
  storageKey = RUNTIME_PERSISTENCE_KEY,
} = {}) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return { ok: false, reason: "storage-unavailable" }

  const nextState = state ?? snapshot?.state ?? null
  const envelope = toPersistedRuntimeEnvelope({
    state: nextState,
    savedAt: new Date().toISOString(),
  })

  if (!envelope) return { ok: false, reason: "invalid-state" }

  try {
    resolvedStorage.setItem(storageKey, JSON.stringify(envelope))
    return { ok: true, reason: "saved", envelope }
  } catch (error) {
    return { ok: false, reason: "storage-write-failed", error }
  }
}

export function clearPersistedRuntimeState({
  storage = null,
  storageKey = RUNTIME_PERSISTENCE_KEY,
} = {}) {
  const resolvedStorage = resolveStorage(storage)
  if (!resolvedStorage) return { ok: false, reason: "storage-unavailable" }
  try {
    resolvedStorage.removeItem(storageKey)
    return { ok: true, reason: "cleared" }
  } catch (error) {
    return { ok: false, reason: "storage-remove-failed", error }
  }
}
