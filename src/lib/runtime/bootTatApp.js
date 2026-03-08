import { createTatRuntime } from "../createTatRuntime"
import { createRuntimeError } from "./createRuntimeError.js"
import { createInitialDomainState } from "../../state/pantryStateEngine"

const REQUIRED_TAT_FIELDS = [
  "kind",
  "program",
  "feature",
  "purpose",
  "inputs",
  "stateRead",
  "actions",
  "decisions",
  "transitions",
  "outputs",
  "events",
  "notes",
  "source",
]

function isPlainObject(value) {
  return !!value && typeof value === "object" && !Array.isArray(value)
}

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function deepMerge(base, overlay) {
  if (!isPlainObject(base) || !isPlainObject(overlay)) {
    return clone(overlay)
  }

  const out = { ...base }
  for (const [key, value] of Object.entries(overlay)) {
    if (Array.isArray(value)) {
      out[key] = clone(value)
      continue
    }

    if (isPlainObject(value) && isPlainObject(out[key])) {
      out[key] = deepMerge(out[key], value)
      continue
    }

    out[key] = clone(value)
  }
  return out
}

function parseInitialProgram(initialProgram) {
  if (!initialProgram) return null

  if (typeof initialProgram === "string") {
    const [featureName, programName] = initialProgram.split(".")
    return {
      featureName: featureName ?? null,
      programName: programName ?? null,
      actionName: null,
      payload: {},
      meta: {},
    }
  }

  if (isPlainObject(initialProgram)) {
    return {
      featureName: typeof initialProgram.featureName === "string" ? initialProgram.featureName : null,
      programName: typeof initialProgram.programName === "string" ? initialProgram.programName : null,
      actionName: typeof initialProgram.actionName === "string" ? initialProgram.actionName : null,
      payload: isPlainObject(initialProgram.payload) ? initialProgram.payload : {},
      meta: isPlainObject(initialProgram.meta) ? initialProgram.meta : {},
    }
  }

  return null
}

function validateBaseInitialState(state) {
  if (!isPlainObject(state)) return false
  if (!isPlainObject(state.pantry)) return false
  if (!isPlainObject(state.pantry.items) || !Array.isArray(state.pantry.items.items)) return false
  if (!isPlainObject(state.pantry.inventory) || !Array.isArray(state.pantry.inventory.records)) return false
  if (!isPlainObject(state.pantry.inventoryHistory) || !Array.isArray(state.pantry.inventoryHistory.records)) return false
  if (!isPlainObject(state.pantry.itemAnalysis) || !Array.isArray(state.pantry.itemAnalysis.records)) return false
  if (!isPlainObject(state.pantry.recommendations) || !Array.isArray(state.pantry.recommendations.records)) return false
  if (!isPlainObject(state.pantry.priorities) || !Array.isArray(state.pantry.priorities.records)) return false
  if (
    !isPlainObject(state.pantry.recommendationResolutions) ||
    !Array.isArray(state.pantry.recommendationResolutions.records)
  )
    return false
  if (!isPlainObject(state.pantry.restockPolicy) || !Array.isArray(state.pantry.restockPolicy.records)) return false
  if (!isPlainObject(state.pantry.activityLog) || !Array.isArray(state.pantry.activityLog.records)) return false
  if (!isPlainObject(state.pantry.shoppingList) || !Array.isArray(state.pantry.shoppingList.records)) return false
  if (!Array.isArray(state.eventLog)) return false
  if (!isPlainObject(state.session)) return false
  if (typeof state.session.seedMode !== "boolean") return false
  if (!(typeof state.session.seedScenario === "string" || state.session.seedScenario === null)) return false
  if (!(typeof state.session.lastUpdatedAt === "string" || state.session.lastUpdatedAt === null)) return false
  if (!["booting", "ready", "failed"].includes(state.session.bootStatus)) return false
  return true
}

export function bootTatApp({
  registries,
  hydratedState = null,
  seedMode = false,
  seedState = null,
  utils,
  initialProgram = null,
}) {
  const timestamp = new Date().toISOString()
  const bootInfo = {
    status: "booting",
    seedMode: !!seedMode,
    loadedFeatures: [],
    loadedPrograms: [],
    initialProgram,
    timestamp,
  }

  const errors = []

  if (!Array.isArray(registries) || registries.length === 0) {
    errors.push(
      createRuntimeError({
        type: "BOOT_REGISTRY_VALIDATION_FAILED",
        layer: "registry",
        featureName: null,
        programName: null,
        actionName: null,
        message: "Boot requires explicit non-empty registries array",
        details: { registriesType: typeof registries },
        timestamp,
      }),
    )
  }

  const registryMap = new Map()

  if (errors.length === 0) {
    for (const registry of registries) {
      const featureName = registry?.featureName
      const programs = registry?.programs

      if (typeof featureName !== "string" || !featureName.length) {
        errors.push(
          createRuntimeError({
            type: "BOOT_REGISTRY_VALIDATION_FAILED",
            layer: "registry",
            featureName: null,
            programName: null,
            actionName: null,
            message: "Registry missing valid featureName",
            details: { registry },
            timestamp,
          }),
        )
        continue
      }

      if (!isPlainObject(programs)) {
        errors.push(
          createRuntimeError({
            type: "BOOT_REGISTRY_VALIDATION_FAILED",
            layer: "registry",
            featureName,
            programName: null,
            actionName: null,
            message: `Registry ${featureName} missing programs object`,
            details: { programsType: typeof programs },
            timestamp,
          }),
        )
        continue
      }

      bootInfo.loadedFeatures.push(featureName)
      registryMap.set(featureName, registry)

      for (const [programKey, programDef] of Object.entries(programs)) {
        bootInfo.loadedPrograms.push(`${featureName}.${programKey}`)

        if (!isPlainObject(programDef?.tatProgram)) {
          errors.push(
            createRuntimeError({
              type: "BOOT_PROGRAM_VALIDATION_FAILED",
              layer: "registry",
              featureName,
              programName: programKey,
              actionName: null,
              message: "Program missing parsed tatProgram object",
              details: { availableKeys: Object.keys(programDef ?? {}) },
              timestamp,
            }),
          )
          continue
        }

        const tatProgram = programDef.tatProgram

        for (const field of REQUIRED_TAT_FIELDS) {
          if (!(field in tatProgram)) {
            errors.push(
              createRuntimeError({
                type: "BOOT_PROGRAM_VALIDATION_FAILED",
                layer: "parser",
                featureName,
                programName: programKey,
                actionName: null,
                message: `Parsed TatProgram missing field: ${field}`,
                details: { field },
                timestamp,
              }),
            )
          }
        }

        if (tatProgram.kind !== "TatProgram") {
          errors.push(
            createRuntimeError({
              type: "BOOT_PROGRAM_VALIDATION_FAILED",
              layer: "parser",
              featureName,
              programName: programKey,
              actionName: null,
              message: "Parsed program kind must be TatProgram",
              details: { kind: tatProgram.kind },
              timestamp,
            }),
          )
        }

        if (tatProgram.program !== programKey || tatProgram.feature !== featureName) {
          errors.push(
            createRuntimeError({
              type: "BOOT_PROGRAM_VALIDATION_FAILED",
              layer: "registry",
              featureName,
              programName: programKey,
              actionName: null,
              message: "Registry/program alignment mismatch",
              details: {
                registryProgram: programKey,
                tatProgram: tatProgram.program,
                registryFeature: featureName,
                tatFeature: tatProgram.feature,
              },
              timestamp,
            }),
          )
        }
      }
    }
  }

  const baseState = createInitialDomainState(false, null)
  if (!validateBaseInitialState(baseState)) {
    errors.push(
      createRuntimeError({
        type: "BOOT_INITIAL_STATE_INVALID",
        layer: "state",
        featureName: null,
        programName: null,
        actionName: null,
        message: "Base initial state failed contract validation",
        details: { baseState },
        timestamp,
      }),
    )
  }

  const parsedInitialProgram = parseInitialProgram(initialProgram)
  const hydratedOverlayState = isPlainObject(hydratedState) ? hydratedState : null
  const seedOverlayState = seedMode && isPlainObject(seedState) ? seedState : null

  let assembledState = hydratedOverlayState ? deepMerge(baseState, hydratedOverlayState) : clone(baseState)
  if (seedOverlayState) {
    assembledState = deepMerge(assembledState, seedOverlayState)
  }

  assembledState.session = {
    ...(assembledState.session ?? {}),
    seedMode: !!seedMode,
    seedScenario:
      typeof assembledState.session?.seedScenario === "string" || assembledState.session?.seedScenario === null
        ? assembledState.session.seedScenario
        : seedMode
          ? "seed-overlay"
          : null,
    lastUpdatedAt: timestamp,
    bootStatus: "ready",
  }

  if (!validateBaseInitialState(assembledState)) {
    errors.push(
      createRuntimeError({
        type: "BOOT_INITIAL_STATE_INVALID",
        layer: "state",
        featureName: null,
        programName: null,
        actionName: null,
        message: "Assembled initial state failed contract validation",
        details: { seedMode: !!seedMode, hasHydratedState: !!hydratedOverlayState },
        timestamp,
      }),
    )
  }

  if (initialProgram && !parsedInitialProgram) {
    errors.push(
      createRuntimeError({
        type: "BOOT_ENTRY_PROGRAM_MISSING",
        layer: "runtime",
        featureName: null,
        programName: null,
        actionName: null,
        message: "Initial program must be string `feature.program` or object payload",
        details: { initialProgram },
        timestamp,
      }),
    )
  }

  if (parsedInitialProgram && (!parsedInitialProgram.featureName || !parsedInitialProgram.programName)) {
    errors.push(
      createRuntimeError({
        type: "BOOT_ENTRY_PROGRAM_MISSING",
        layer: "runtime",
        featureName: parsedInitialProgram.featureName,
        programName: parsedInitialProgram.programName,
        actionName: parsedInitialProgram.actionName,
        message: "Initial program is missing featureName or programName",
        details: { initialProgram },
        timestamp,
      }),
    )
  }

  if (parsedInitialProgram?.featureName && parsedInitialProgram?.programName && registryMap.size > 0) {
    const registry = registryMap.get(parsedInitialProgram.featureName)
    if (!registry || !registry.programs?.[parsedInitialProgram.programName]) {
      errors.push(
        createRuntimeError({
          type: "BOOT_ENTRY_PROGRAM_MISSING",
          layer: "registry",
          featureName: parsedInitialProgram.featureName,
          programName: parsedInitialProgram.programName,
          actionName: parsedInitialProgram.actionName,
          message: "Initial program not found in loaded registries",
          details: { loadedFeatures: bootInfo.loadedFeatures, loadedPrograms: bootInfo.loadedPrograms },
          timestamp,
        }),
      )
    }
  }

  if (errors.length > 0) {
    bootInfo.status = "failed"
    return {
      ok: false,
      runtime: null,
      snapshot: null,
      bootInfo,
      errors,
    }
  }

  let runtime = null
  try {
    runtime = createTatRuntime({
      registries,
      initialState: assembledState,
      initialEventLog: assembledState.eventLog,
      utils,
    })
  } catch (error) {
    bootInfo.status = "failed"
    return {
      ok: false,
      runtime: null,
      snapshot: null,
      bootInfo,
      errors: [
        createRuntimeError({
          type: "BOOT_RUNTIME_CREATION_FAILED",
          layer: "runtime",
          featureName: null,
          programName: null,
          actionName: null,
          message: String(error?.message ?? error),
          details: { name: error?.name, stack: error?.stack },
          timestamp,
        }),
      ],
    }
  }

  let snapshot = runtime.getSnapshot()

  if (parsedInitialProgram) {
    snapshot = runtime.runProgram({
      featureName: parsedInitialProgram.featureName,
      programName: parsedInitialProgram.programName,
      actionName: parsedInitialProgram.actionName ?? undefined,
      payload: parsedInitialProgram.payload,
      meta: parsedInitialProgram.meta,
    })

    if (Array.isArray(snapshot.currentErrors) && snapshot.currentErrors.length > 0) {
      bootInfo.status = "failed"
      return {
        ok: false,
        runtime: null,
        snapshot: null,
        bootInfo,
        errors: [
          createRuntimeError({
            type: "BOOT_INITIAL_PROGRAM_FAILED",
            layer: "runtime",
            featureName: parsedInitialProgram.featureName,
            programName: parsedInitialProgram.programName,
            actionName: parsedInitialProgram.actionName,
            message: "Initial program execution failed during boot",
            details: { runtimeErrors: snapshot.currentErrors },
            timestamp,
          }),
        ],
      }
    }
  }

  bootInfo.status = "ready"
  return {
    ok: true,
    runtime,
    snapshot,
    bootInfo,
    errors: [],
  }
}
