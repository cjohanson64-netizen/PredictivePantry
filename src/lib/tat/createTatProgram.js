import { createRuntimeError } from "../runtime/createRuntimeError.js"
import {
  isKnownAction,
  isKnownEvent,
  isUpperSnakeCase,
} from "../runtime/actionVocabulary.js"
import { parseTat } from "./parseTat.js"

export function createTatProgram({ rawText, fileName, featureName, registryKey }) {
  const parsed = parseTat(rawText, { fileName, featureName })

  if (!parsed.ok) {
    const error = new Error(`TAT parse failed for ${fileName}`)
    error.name = "TatParseError"
    error.details = parsed.errors
    throw error
  }

  const tatProgram = parsed.value

  if (tatProgram.program !== registryKey) {
    const error = new Error(
      `Program key mismatch in ${fileName}: registry key "${registryKey}" != program "${tatProgram.program}"`,
    )
    error.name = "TatProgramKeyMismatch"
    error.details = [
      createRuntimeError({
        type: "ProgramKeyMismatch",
        layer: "registry",
        featureName,
        programName: tatProgram.program,
        actionName: null,
        message: "Internal program value must match registry key",
        details: { fileName, registryKey, program: tatProgram.program },
      }),
    ]
    throw error
  }

  if (tatProgram.feature !== featureName) {
    const error = new Error(
      `Feature mismatch in ${fileName}: expected "${featureName}" got "${tatProgram.feature}"`,
    )
    error.name = "TatFeatureMismatch"
    error.details = [
      createRuntimeError({
        type: "FeatureMismatch",
        layer: "registry",
        featureName,
        programName: tatProgram.program,
        actionName: null,
        message: "Internal feature value must match registry feature",
        details: { fileName, expectedFeature: featureName, actualFeature: tatProgram.feature },
      }),
    ]
    throw error
  }

  for (const action of tatProgram.actions ?? []) {
    if (!isUpperSnakeCase(action)) {
      const error = new Error(`Invalid action format in ${fileName}: ${action}`)
      error.name = "TatActionFormatError"
      error.details = [
        createRuntimeError({
          type: "InvalidActionFormat",
          layer: "registry",
          featureName,
          programName: tatProgram.program,
          actionName: null,
          message: "Action names must use uppercase snake case",
          details: { fileName, action },
        }),
      ]
      throw error
    }
    if (!isKnownAction(action)) {
      const error = new Error(`Unknown action in ${fileName}: ${action}`)
      error.name = "TatActionVocabularyError"
      error.details = [
        createRuntimeError({
          type: "UnknownActionVocabulary",
          layer: "registry",
          featureName,
          programName: tatProgram.program,
          actionName: null,
          message: "Action is not part of canonical vocabulary",
          details: { fileName, action },
        }),
      ]
      throw error
    }
  }

  for (const event of tatProgram.events ?? []) {
    if (!isUpperSnakeCase(event)) {
      const error = new Error(`Invalid event format in ${fileName}: ${event}`)
      error.name = "TatEventFormatError"
      error.details = [
        createRuntimeError({
          type: "InvalidEventFormat",
          layer: "registry",
          featureName,
          programName: tatProgram.program,
          actionName: null,
          message: "Event names must use uppercase snake case",
          details: { fileName, event },
        }),
      ]
      throw error
    }
    if (!isKnownEvent(event)) {
      const error = new Error(`Unknown event in ${fileName}: ${event}`)
      error.name = "TatEventVocabularyError"
      error.details = [
        createRuntimeError({
          type: "UnknownEventVocabulary",
          layer: "registry",
          featureName,
          programName: tatProgram.program,
          actionName: null,
          message: "Event is not part of canonical vocabulary",
          details: { fileName, event },
        }),
      ]
      throw error
    }
  }

  return tatProgram
}
