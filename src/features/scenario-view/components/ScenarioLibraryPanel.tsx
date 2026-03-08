type ScenarioLibraryPanelProps = {
  scenarios: Array<Record<string, any>>
  selectedScenarioName: string
  onSelectScenario: (name: string) => void
  onRunScenario: (name: string) => void
}

export default function ScenarioLibraryPanel({
  scenarios,
  selectedScenarioName,
  onSelectScenario,
  onRunScenario,
}: ScenarioLibraryPanelProps) {
  return (
    <section className="scenario-library-panel">
      <h2>Scenario Library</h2>
      <div className="scenario-library-list">
        {scenarios.map((scenario) => {
          const name = String(scenario.name ?? "")
          const isSelected = selectedScenarioName === name
          const category = String(scenario.category ?? "smoke").toLowerCase()
          return (
            <div
              key={name}
              className={`scenario-library-card ${isSelected ? "scenario-library-card--active" : ""}`}
            >
              <div className="scenario-library-meta">
                <strong>{name}</strong>
                <span className={`scenario-library-category scenario-library-category--${category}`}>
                  {String(scenario.category ?? "smoke")}
                </span>
              </div>
              <div className="scenario-library-description">{String(scenario.description ?? "")}</div>
              <div className="scenario-library-actions">
                <button className="scenario-library-button" onClick={() => onSelectScenario(name)}>
                  Select
                </button>
                <button className="scenario-library-button" onClick={() => onRunScenario(name)}>
                  Run
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </section>
  )
}
