export type TatScenarioDefinition = {
  name: string
  description?: string
  category?: string
  seedMode?: boolean
  seedState?: Record<string, unknown> | null
  initialProgram?: string | null
  now?: string
  steps?: Array<Record<string, unknown>>
  expectations?: Array<Record<string, unknown>>
}

export type TatScenarioResult = {
  ok: boolean
  scenarioName: string
  bootInfo: Record<string, unknown>
  stepResults: Array<Record<string, unknown>>
  finalSnapshot: Record<string, unknown> | null
  errors: Array<Record<string, unknown>>
}

export function runTatScenario(args: {
  scenario: TatScenarioDefinition
  registries?: Array<Record<string, unknown>>
  utils?: Record<string, unknown>
}): TatScenarioResult

export function runTatScenarios(args: {
  scenarios: TatScenarioDefinition[]
  registries?: Array<Record<string, unknown>>
  utils?: Record<string, unknown>
}): {
  ok: boolean
  total: number
  passed: number
  failed: number
  results: TatScenarioResult[]
}

export const tatScenarioDefinitions: TatScenarioDefinition[]
export function getTatScenarioByName(name: string): TatScenarioDefinition | null
export function runDefaultTatScenarios(): {
  ok: boolean
  total: number
  passed: number
  failed: number
  results: TatScenarioResult[]
}
