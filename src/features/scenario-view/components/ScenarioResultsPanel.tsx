type ScenarioResultsPanelProps = {
  result: Record<string, any> | null
}

export default function ScenarioResultsPanel({ result }: ScenarioResultsPanelProps) {
  const ok = !!result?.ok
  const errors = Array.isArray(result?.errors) ? result.errors : []
  const statusClass = result
    ? ok
      ? "scenario-results-status--pass"
      : "scenario-results-status--fail"
    : "scenario-results-status--no-run"

  return (
    <section className="scenario-results-panel">
      <h2>Scenario Results</h2>
      <div className={`scenario-results-status ${statusClass}`}>
        {result ? (ok ? "PASS" : "FAIL") : "No Run Yet"}
      </div>
      {errors.length > 0 ? (
        <ul className="scenario-results-errors">
          {errors.map((error: any, index: number) => (
            <li key={`${String(error?.type ?? "error")}:${index}`}>{String(error?.message ?? "Unknown error")}</li>
          ))}
        </ul>
      ) : null}
      <pre className="panel-json">{JSON.stringify(result ?? {}, null, 2)}</pre>
    </section>
  )
}
