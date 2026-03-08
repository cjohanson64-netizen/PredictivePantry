import { useMemo, useState } from "react"
import { runTatScenario } from "../../scenarios"
import { getScenarioLibrary } from "./data/scenarioCategories"
import ScenarioLibraryPanel from "./components/ScenarioLibraryPanel"
import ScenarioSourcePanel from "./components/ScenarioSourcePanel"
import ScenarioResultsPanel from "./components/ScenarioResultsPanel"
import "./styles/scenario-view.css"

export default function ScenarioView() {
  const scenarios = useMemo(() => getScenarioLibrary(), [])
  const [selectedScenarioName, setSelectedScenarioName] = useState<string>(
    String(scenarios[0]?.name ?? ""),
  )
  const [lastResult, setLastResult] = useState<Record<string, any> | null>(null)

  const selectedScenario = useMemo(
    () => scenarios.find((scenario) => String(scenario.name) === selectedScenarioName) ?? null,
    [scenarios, selectedScenarioName],
  )

  const runSelectedScenario = (name: string) => {
    const scenario = scenarios.find((candidate) => String(candidate.name) === name) ?? null
    if (!scenario) return
    setSelectedScenarioName(name)
    const result = runTatScenario({ scenario })
    setLastResult(result)
  }

  return (
    <div className="scenario-view">
      <ScenarioLibraryPanel
        scenarios={scenarios}
        selectedScenarioName={selectedScenarioName}
        onSelectScenario={setSelectedScenarioName}
        onRunScenario={runSelectedScenario}
      />
      <ScenarioSourcePanel scenario={selectedScenario} />
      <ScenarioResultsPanel result={lastResult} />
    </div>
  )
}
