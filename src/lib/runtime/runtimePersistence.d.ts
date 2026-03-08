export const RUNTIME_PERSISTENCE_KEY: string
export const RUNTIME_PERSISTENCE_VERSION: number

export type PersistedRuntimeEnvelope = {
  version: number
  savedAt: string
  state: Record<string, unknown>
}

export function validatePersistedRuntimeState(state: unknown): boolean

export function toPersistedRuntimeEnvelope(args: {
  state: unknown
  savedAt?: string
}): PersistedRuntimeEnvelope | null

export function readPersistedRuntimeEnvelope(args?: {
  storage?: Storage | null
  storageKey?: string
}): {
  ok: boolean
  reason: string
  envelope: PersistedRuntimeEnvelope | null
  [key: string]: unknown
}

export function loadPersistedRuntimeState(args?: {
  storage?: Storage | null
  storageKey?: string
}): Record<string, unknown> | null

export function savePersistedRuntimeState(args?: {
  snapshot?: { state?: unknown } | null
  state?: unknown
  storage?: Storage | null
  storageKey?: string
}): {
  ok: boolean
  reason: string
  envelope?: PersistedRuntimeEnvelope
  [key: string]: unknown
}

export function clearPersistedRuntimeState(args?: {
  storage?: Storage | null
  storageKey?: string
}): {
  ok: boolean
  reason: string
  [key: string]: unknown
}
