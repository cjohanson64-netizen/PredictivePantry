import { runTat } from "../../../tryangletree-core/dist/index.js";
import { loadTatSource, listScenarios } from "./lib/loadTat.mjs";
import { renderGraphSummary } from "./lib/renderGraph.mjs";

const scenario = process.argv[2] ?? "bootstrap";

if (!listScenarios().includes(scenario)) {
  console.error(`Unknown scenario: ${scenario}`);
  console.error(`Available scenarios: ${listScenarios().join(", ")}`);
  process.exit(1);
}

const source = loadTatSource(scenario);
const result = runTat(source, undefined, {
  mode: "console",
  trace: false,
  meta: { source: `predictive-pantry:${scenario}` },
});

renderGraphSummary(result, scenario);
