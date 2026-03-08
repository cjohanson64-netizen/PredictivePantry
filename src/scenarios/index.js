import { tatScenarioDefinitions, getTatScenarioByName } from "./scenarioDefinitions"
import { runTatScenario, runTatScenarios } from "./runTatScenario"

export { runTatScenario, runTatScenarios, tatScenarioDefinitions, getTatScenarioByName }

export function runDefaultTatScenarios() {
  return runTatScenarios({ scenarios: tatScenarioDefinitions })
}
