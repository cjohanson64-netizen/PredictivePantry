type ScenarioSourcePanelProps = {
  scenario: Record<string, any> | null
}

export default function ScenarioSourcePanel({ scenario }: ScenarioSourcePanelProps) {
  return (
    <section className="scenario-source-panel">
      <h2>Scenario Source</h2>
      <pre className="panel-json">{JSON.stringify(scenario ?? {}, null, 2)}</pre>
    </section>
  )
}
