import { useCallback, useMemo, useRef, useState } from "react"
import { createTatRuntime, type TatRuntimeSnapshot } from "../createTatRuntime"
import { bootTatApp } from "./bootTatApp.js"
import { tatFeatureRegistries } from "../../features/Directory.jsx"
import { createInitialDomainState, reduceDomainState } from "../../state/pantryStateEngine"
import {
  clearPersistedRuntimeState,
  loadPersistedRuntimeState,
  readPersistedRuntimeEnvelope,
  savePersistedRuntimeState,
} from "./runtimePersistence.js"

type ConsoleStateReducerInput = {
  state: Record<string, unknown>
  eventLog: Array<Record<string, unknown>>
  stateUpdates: Record<string, unknown>
  newEvents: Array<Record<string, unknown>>
}

export type PantryRuntimeDispatchArgs = {
  programName:
    | "addItem"
    | "consumeItem"
    | "removeItem"
    | "updateRestockPolicy"
    | "updateItemCategory"
    | "updateItemName"
    | "updateItemShelfLife"
    | "resolveRecommendation"
    | "recommendPantryActions"
    | "rankPantryPriorities"
    | "generateShoppingList"
    | "analyzeInventory"
    | "analyzeItemById"
  actionName:
    | "ADD_ITEM"
    | "CONSUME_ITEM"
    | "REMOVE_ITEM"
    | "UPDATE_THRESHOLD"
    | "UPDATE_EXPIRATION_COUNTS"
    | "UPDATE_RESTOCK_POLICY"
    | "UPDATE_ITEM_CATEGORY"
    | "UPDATE_ITEM_NAME"
    | "UPDATE_ITEM_SHELF_LIFE"
    | "RESOLVE_RECOMMENDATION"
    | "RECOMMEND_PANTRY_ACTIONS"
    | "RANK_PANTRY_PRIORITIES"
    | "GENERATE_SHOPPING_LIST"
    | "ANALYZE_INVENTORY"
    | "ANALYZE_ITEM_BY_ID"
  payload: Record<string, unknown>
  meta?: Record<string, unknown>
}

function createWorkspaceRuntime() {
  const persistedEnvelope = readPersistedRuntimeEnvelope()
  if (!persistedEnvelope.ok && persistedEnvelope.reason !== "missing" && persistedEnvelope.reason !== "storage-unavailable") {
    console.warn("Predictive Pantry persistence load fallback:", persistedEnvelope.reason)
  }
  const persistedState = loadPersistedRuntimeState()

  const boot = bootTatApp({
    registries: tatFeatureRegistries,
    hydratedState: persistedState,
    seedMode: false,
    seedState: null,
    initialProgram: "pantry.pantryRoot",
    utils: {
      stateReducer: ({ state, eventLog, stateUpdates, newEvents }: ConsoleStateReducerInput) =>
        reduceDomainState({
          state: state as any,
          eventLog: [...eventLog, ...newEvents],
          stateUpdates,
        }) as unknown as Record<string, unknown>,
    },
  })

  if (boot.ok && boot.runtime && boot.snapshot) {
    return {
      runtime: boot.runtime,
      snapshot: boot.snapshot,
    }
  }

  const failureRuntime = createTatRuntime({
    registries: [
      {
        featureName: "__boot",
        programs: { runtimeBootFailure: {} },
        handlers: {
          runtimeBootFailure: () => ({
            ok: false,
            stateUpdates: {},
            events: [],
            outputs: [],
            warnings: [],
            errors: Array.isArray(boot.errors) ? boot.errors : [],
          }),
        },
      },
    ],
    initialState: createInitialDomainState(false) as unknown as Record<string, unknown>,
    initialEventLog: [],
  })

  return {
    runtime: failureRuntime,
    snapshot: failureRuntime.runProgram({
      featureName: "__boot",
      programName: "runtimeBootFailure",
      actionName: "runtimeBootFailure",
      payload: {},
      meta: {},
    }),
  }
}

function serializeStateForCompare(state: unknown) {
  try {
    return JSON.stringify(state)
  } catch {
    return ""
  }
}

export function usePantryWorkspaceRuntime() {
  const bootSession = useMemo(() => createWorkspaceRuntime(), [])
  const runtimeRef = useRef<any>(bootSession.runtime)
  const [snapshot, setSnapshot] = useState<TatRuntimeSnapshot>(bootSession.snapshot)

  const dispatchRuntimeAction = useCallback((args: PantryRuntimeDispatchArgs) => {
    const runtime = runtimeRef.current
    if (!runtime) return snapshot

    const previousSnapshot = runtime.getSnapshot()
    const nextSnapshot = runtime.dispatch({
      featureName: "pantry",
      programName: args.programName,
      actionName: args.actionName,
      payload: args.payload,
      meta: {
        source: "app-shell-dispatch",
        ...(args.meta ?? {}),
      },
    })

    const didStateChange =
      serializeStateForCompare(previousSnapshot?.state) !== serializeStateForCompare(nextSnapshot?.state)
    if (didStateChange) {
      savePersistedRuntimeState({ snapshot: nextSnapshot })
    }

    setSnapshot(nextSnapshot)
    return nextSnapshot
  }, [snapshot])

  const resetRuntime = useCallback(() => {
    clearPersistedRuntimeState()
    const next = createWorkspaceRuntime()
    runtimeRef.current = next.runtime
    setSnapshot(next.snapshot)
  }, [])

  return {
    snapshot,
    dispatchRuntimeAction,
    resetRuntime,
  }
}
