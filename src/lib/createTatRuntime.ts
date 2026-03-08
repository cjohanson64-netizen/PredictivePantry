import type { TatHandlerContext, TatHandlerResult } from "./tatHandlers"
import { createTatHandlerResult } from "./tatHandlers"
import { createRuntimeError, normalizeRuntimeError } from "./runtime/createRuntimeError.js"

type TatRegistry = {
  featureName: string
  programs: Record<string, any>
  handlers?: Record<string, Function>
}

type RuntimeReducerInput = {
  state: Record<string, unknown>
  eventLog: Array<Record<string, unknown>>
  stateUpdates: Record<string, unknown>
  newEvents: Array<Record<string, unknown>>
  context: TatHandlerContext
  result: TatHandlerResult
}

type RuntimeUtils = Record<string, unknown> & {
  stateReducer?: (input: RuntimeReducerInput) => Record<string, unknown>
}

type CreateTatRuntimeArgs = {
  registries: TatRegistry[]
  initialState: Record<string, unknown>
  initialEventLog: Array<Record<string, unknown>>
  utils?: RuntimeUtils
}

export type TatRuntimeSnapshot = {
  activeFeature: string | null
  activeProgram: string | null
  state: Record<string, unknown>
  eventLog: Array<Record<string, unknown>>
  currentOutputs: Array<Record<string, unknown>>
  currentWarnings: Array<Record<string, unknown>>
  currentErrors: Array<Record<string, unknown>>
  history: Array<Record<string, unknown>>
}

type RuntimeDispatchArgs = {
  featureName: string
  programName: string
  actionName?: string
  payload?: Record<string, unknown>
  meta?: Record<string, unknown>
}

const AUTO_PIPELINE_ANALYSIS_TRIGGER_ACTIONS = new Set([
  "ADD_ITEM",
  "CONSUME_ITEM",
  "UPDATE_THRESHOLD",
  "UPDATE_EXPIRATION_COUNTS",
  "UPDATE_RESTOCK_POLICY",
  "UPDATE_ITEM_SHELF_LIFE",
  "RESOLVE_RECOMMENDATION",
])

const AUTO_PIPELINE_SHOPPING_LIST_ONLY_TRIGGER_ACTIONS = new Set(["UPDATE_ITEM_CATEGORY"])
const AUTO_PIPELINE_DISPLAY_REFRESH_TRIGGER_ACTIONS = new Set(["UPDATE_ITEM_NAME", "REMOVE_ITEM"])

const AUTO_PIPELINE_RECOMMENDATION_CHAIN = [
  {
    programName: "recommendPantryActions",
    actionName: "RECOMMEND_PANTRY_ACTIONS",
    payload: {},
  },
  {
    programName: "rankPantryPriorities",
    actionName: "RANK_PANTRY_PRIORITIES",
    payload: {},
  },
  {
    programName: "generateShoppingList",
    actionName: "GENERATE_SHOPPING_LIST",
    payload: {},
  },
] as const

function cloneValue<T>(value: T): T {
  return typeof structuredClone === "function"
    ? structuredClone(value)
    : JSON.parse(JSON.stringify(value))
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function deepMerge(base: Record<string, unknown>, patch: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = { ...base }

  for (const [key, incoming] of Object.entries(patch)) {
    const current = out[key]
    if (isPlainObject(current) && isPlainObject(incoming)) {
      out[key] = deepMerge(current, incoming)
      continue
    }
    out[key] = cloneValue(incoming)
  }

  return out
}

function syncStateEventLog(
  state: Record<string, unknown>,
  eventLog: Array<Record<string, unknown>>,
): Record<string, unknown> {
  return {
    ...state,
    eventLog: cloneValue(eventLog),
  }
}

export function createTatRuntime({
  registries,
  initialState,
  initialEventLog,
  utils = {},
}: CreateTatRuntimeArgs) {
  const registryMap = new Map<string, TatRegistry>()
  for (const registry of registries) {
    registryMap.set(registry.featureName, registry)
  }

  const baseState = cloneValue(initialState)
  const baseEventLog = cloneValue(initialEventLog)

  let activeFeature: string | null = null
  let activeProgram: string | null = null
  let state = syncStateEventLog(cloneValue(baseState), baseEventLog)
  let eventLog = cloneValue(baseEventLog)
  let currentOutputs: Array<Record<string, unknown>> = []
  let currentWarnings: Array<Record<string, unknown>> = []
  let currentErrors: Array<Record<string, unknown>> = []
  let history: Array<Record<string, unknown>> = []

  const resolveHandler = (registry: TatRegistry, programName: string, actionName?: string) => {
    const handlers = registry.handlers ?? {}

    if (typeof handlers[programName] === "function") {
      return handlers[programName] as (context: TatHandlerContext) => TatHandlerResult
    }

    return null
  }

  const resolveAffectedItemId = ({
    payload,
    events,
    stateUpdates,
  }: {
    payload: Record<string, unknown>
    events: Array<Record<string, unknown>>
    stateUpdates: Record<string, unknown>
  }) => {
    for (const event of events) {
      const subjectId = (event as any)?.subjectId
      if (typeof subjectId === "string" && subjectId.startsWith("item:")) {
        return subjectId
      }
    }

    const payloadItemId = (payload as any)?.itemId
    if (typeof payloadItemId === "string" && payloadItemId.length > 0) {
      return payloadItemId.startsWith("item:") ? payloadItemId : `item:${payloadItemId}`
    }

    const updatedInventoryItemId = (stateUpdates as any)?.pantry?.inventory?.records?.[0]?.itemId
    if (typeof updatedInventoryItemId === "string" && updatedInventoryItemId.length > 0) {
      return updatedInventoryItemId
    }

    const updatedItemId = (stateUpdates as any)?.pantry?.items?.items?.[0]?.id
    if (typeof updatedItemId === "string" && updatedItemId.length > 0) {
      return updatedItemId
    }

    return null
  }

  const getSnapshot = (): TatRuntimeSnapshot => ({
    activeFeature,
    activeProgram,
    state: cloneValue(state),
    eventLog: cloneValue(eventLog),
    currentOutputs: cloneValue(currentOutputs),
    currentWarnings: cloneValue(currentWarnings),
    currentErrors: cloneValue(currentErrors),
    history: cloneValue(history),
  })

  const pushFailure = ({
    featureName,
    programName,
    actionName,
    payload,
    meta,
    error,
  }: {
    featureName: string
    programName: string
    actionName?: string
    payload?: Record<string, unknown>
    meta?: Record<string, unknown>
    error: unknown
  }) => {
    const normalized = normalizeRuntimeError(error, {
      layer: "runtime",
      featureName,
      programName,
      actionName: actionName ?? programName,
    })

    currentOutputs = []
    currentWarnings = []
    currentErrors = [normalized]
    activeFeature = featureName
    activeProgram = programName

    history = [
      ...history,
      {
        at: new Date().toISOString(),
        featureName,
        programName,
        actionName: actionName ?? programName,
        payload: cloneValue(payload ?? {}),
        meta: cloneValue(meta ?? {}),
        ok: false,
        eventCount: 0,
        outputCount: 0,
        warningCount: 0,
        errorCount: 1,
      },
    ]

    return getSnapshot()
  }

  const runAutoPipeline = ({
    featureName,
    actionName,
    payload,
    meta,
    stateUpdates,
    appendedEvents,
  }: {
    featureName: string
    actionName: string
    payload: Record<string, unknown>
    meta: Record<string, unknown>
    stateUpdates: Record<string, unknown>
    appendedEvents: Array<Record<string, unknown>>
  }) => {
    if (featureName !== "pantry") return null
    if ((meta as Record<string, unknown> | undefined)?.__autoPipelineFollowup) return null

    const followups: Array<{
      programName: string
      actionName: string
      payload: Record<string, unknown>
    }> = []

    if (AUTO_PIPELINE_ANALYSIS_TRIGGER_ACTIONS.has(actionName)) {
      const affectedItemId = resolveAffectedItemId({
        payload,
        events: appendedEvents,
        stateUpdates: stateUpdates ?? {},
      })
      if (!affectedItemId) return null
      followups.push({
        programName: "analyzeItemById",
        actionName: "ANALYZE_ITEM_BY_ID",
        payload: { itemId: affectedItemId },
      })
      followups.push(...AUTO_PIPELINE_RECOMMENDATION_CHAIN)
    } else if (AUTO_PIPELINE_SHOPPING_LIST_ONLY_TRIGGER_ACTIONS.has(actionName)) {
      followups.push({
        programName: "generateShoppingList",
        actionName: "GENERATE_SHOPPING_LIST",
        payload: {},
      })
    } else if (AUTO_PIPELINE_DISPLAY_REFRESH_TRIGGER_ACTIONS.has(actionName)) {
      followups.push(...AUTO_PIPELINE_RECOMMENDATION_CHAIN)
    } else {
      return null
    }

    let lastSnapshot: TatRuntimeSnapshot | null = null
    for (const followup of followups) {
      lastSnapshot = invoke({
        featureName: "pantry",
        programName: followup.programName,
        actionName: followup.actionName,
        payload: followup.payload,
        meta: {
          ...(meta as Record<string, unknown>),
          __autoPipelineFollowup: true,
          followsAction: actionName,
        },
      })

      const latestHistoryEntry = history[history.length - 1]
      if (!latestHistoryEntry || latestHistoryEntry.ok !== true || currentErrors.length > 0) {
        return lastSnapshot
      }
    }

    return lastSnapshot
  }

  const invoke = ({
    featureName,
    programName,
    actionName,
    payload = {},
    meta = {},
  }: RuntimeDispatchArgs): TatRuntimeSnapshot => {
    const resolvedActionName = actionName ?? programName
    const registry = registryMap.get(featureName)
    if (!registry) {
      return pushFailure({
        featureName,
        programName,
        actionName,
        payload,
        meta,
        error: createRuntimeError({
          type: "UnknownRegistry",
          layer: "registry",
          featureName,
          programName,
          actionName: resolvedActionName,
          message: `Unknown feature registry: ${featureName}`,
          details: { registeredFeatures: Array.from(registryMap.keys()) },
        }),
      })
    }

    if (!registry.programs?.[programName]) {
      return pushFailure({
        featureName,
        programName,
        actionName,
        payload,
        meta,
        error: createRuntimeError({
          type: "UnknownProgram",
          layer: "registry",
          featureName,
          programName,
          actionName: resolvedActionName,
          message: `Unknown program ${featureName}.${programName}`,
          details: { availablePrograms: Object.keys(registry.programs ?? {}) },
        }),
      })
    }

    const handler = resolveHandler(registry, programName, actionName)
    if (!handler) {
      return pushFailure({
        featureName,
        programName,
        actionName,
        payload,
        meta,
        error: createRuntimeError({
          type: "MissingHandler",
          layer: "registry",
          featureName,
          programName,
          actionName: resolvedActionName,
          message: `No handler registered for ${featureName}.${programName}`,
          details: {
            availableHandlers: Object.keys(registry.handlers ?? {}),
          },
        }),
      })
    }

    const context: TatHandlerContext = {
      featureName,
      programName,
      actionName: resolvedActionName,
      payload,
      state: cloneValue(state) as any,
      eventLog: cloneValue(eventLog) as any,
      utils,
      runtime: {
        activeFeature,
        activeProgram,
      },
      meta,
    }

    let result: TatHandlerResult
    try {
      result = handler(context)
    } catch (error: any) {
      result = createTatHandlerResult({
        ok: false,
        errors: [
          createRuntimeError({
            type: "HandlerException",
            layer: "handler",
            featureName,
            programName,
            actionName: resolvedActionName,
            message: String(error?.message ?? error),
            details: {
              name: error?.name,
              stack: error?.stack,
            },
          }),
        ],
      })
    }

    const appendedEvents = Array.isArray(result.events)
      ? result.events.map((event, index) => ({
          id: (event as any)?.id ?? `runtime:evt:${eventLog.length + index + 1}`,
          timestamp:
            typeof (event as any)?.timestamp === "string"
              ? (event as any).timestamp
              : new Date().toISOString(),
          ...(event as Record<string, unknown>),
        }))
      : []

    const nextEventLog = [...eventLog, ...appendedEvents]

    try {
      if (typeof utils.stateReducer === "function") {
        state = utils.stateReducer({
          state,
          eventLog,
          stateUpdates: result.stateUpdates,
          newEvents: appendedEvents,
          context,
          result,
        })
      } else {
        state = deepMerge(state, result.stateUpdates)
      }
    } catch (error: any) {
      return pushFailure({
        featureName,
        programName,
        actionName,
        payload,
        meta,
        error: createRuntimeError({
          type: "StateReducerError",
          layer: "state",
          featureName,
          programName,
          actionName: resolvedActionName,
          message: String(error?.message ?? error),
          details: {
            name: error?.name,
            stack: error?.stack,
          },
        }),
      })
    }

    eventLog = nextEventLog
    state = syncStateEventLog(state, eventLog)
    currentOutputs = (Array.isArray(result.outputs) ? result.outputs : []).map((entry) => ({
      featureName,
      programName,
      actionName: resolvedActionName,
      ...entry,
    }))
    currentWarnings = (Array.isArray(result.warnings) ? result.warnings : []).map((entry) => ({
      featureName,
      programName,
      actionName: resolvedActionName,
      ...entry,
    }))
    currentErrors = (Array.isArray(result.errors) ? result.errors : []).map((entry) =>
      normalizeRuntimeError(entry, {
        layer: "handler",
        featureName,
        programName,
        actionName: resolvedActionName,
      }),
    )

    activeFeature = featureName
    activeProgram = programName

    history = [
      ...history,
      {
        at: new Date().toISOString(),
        featureName,
        programName,
        actionName: resolvedActionName,
        payload: cloneValue(payload),
        meta: cloneValue(meta),
        ok: !!result.ok,
        eventCount: appendedEvents.length,
        outputCount: currentOutputs.length,
        warningCount: currentWarnings.length,
        errorCount: currentErrors.length,
      },
    ]

    if (result.ok && currentErrors.length === 0) {
      const autoPipelineSnapshot = runAutoPipeline({
        featureName,
        actionName: resolvedActionName,
        payload,
        meta: meta as Record<string, unknown>,
        stateUpdates: (result.stateUpdates ?? {}) as Record<string, unknown>,
        appendedEvents,
      })
      if (autoPipelineSnapshot) return autoPipelineSnapshot
    }

    return getSnapshot()
  }

  const reset = (): TatRuntimeSnapshot => {
    activeFeature = null
    activeProgram = null
    state = syncStateEventLog(cloneValue(baseState), baseEventLog)
    eventLog = cloneValue(baseEventLog)
    currentOutputs = []
    currentWarnings = []
    currentErrors = []
    history = []
    return getSnapshot()
  }

  return {
    runProgram: invoke,
    dispatch: invoke,
    getSnapshot,
    reset,
  }
}
