const VALID_LAYERS = new Set([
  "tat",
  "parser",
  "registry",
  "runtime",
  "handler",
  "state",
  "transition",
])

function toSafeObject(value) {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value
  }
  return {}
}

function inferLayer(error, fallbackLayer) {
  if (typeof error?.layer === "string" && VALID_LAYERS.has(error.layer)) {
    return error.layer
  }

  const name = String(error?.name ?? "")
  if (name.includes("TatParse") || name.includes("Parser")) return "parser"
  if (name.includes("Registry") || name.includes("FeatureMismatch") || name.includes("ProgramKeyMismatch")) {
    return "registry"
  }
  if (name.includes("Transition")) return "transition"
  if (name.includes("State")) return "state"
  if (name.includes("Handler")) return "handler"
  if (name.includes("Tat") || name.includes("TAT")) return "tat"

  return VALID_LAYERS.has(fallbackLayer) ? fallbackLayer : "runtime"
}

export function createRuntimeError(input = {}) {
  const payload = toSafeObject(input)
  const layer = VALID_LAYERS.has(payload.layer) ? payload.layer : "runtime"

  return {
    type: String(payload.type ?? "RuntimeError"),
    layer,
    featureName: payload.featureName == null ? null : String(payload.featureName),
    programName: payload.programName == null ? null : String(payload.programName),
    actionName: payload.actionName == null ? null : String(payload.actionName),
    message: String(payload.message ?? "Unknown runtime error"),
    details: payload.details ?? {},
    timestamp: String(payload.timestamp ?? new Date().toISOString()),
  }
}

export function normalizeRuntimeError(error, defaults = {}) {
  const base = toSafeObject(error)
  const fallback = toSafeObject(defaults)

  return createRuntimeError({
    type: base.type ?? fallback.type ?? base.code ?? "RuntimeError",
    layer: inferLayer(error, fallback.layer),
    featureName: base.featureName ?? fallback.featureName ?? null,
    programName: base.programName ?? fallback.programName ?? null,
    actionName: base.actionName ?? fallback.actionName ?? null,
    message: base.message ?? String(error?.message ?? error ?? fallback.message ?? "Unknown runtime error"),
    details: base.details ?? fallback.details ?? {
      name: error?.name,
      stack: error?.stack,
      ...(base.code ? { code: base.code } : {}),
    },
    timestamp: base.timestamp ?? fallback.timestamp ?? new Date().toISOString(),
  })
}
