import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const tatDir = path.resolve(__dirname, "../tat");

const scenarioMap = {
  bootstrap: "bootstrap.tat",
  stock: "stock-decision.tat",
  expiry: "expiry-decision.tat",
  predict: "predict-rebuy.tat",
};

export function listScenarios() {
  return Object.keys(scenarioMap);
}

export function loadTatSource(name = "bootstrap") {
  const scenarioFile = scenarioMap[name] ?? scenarioMap.bootstrap;
  const commonFiles = ["foundation.tat"];
  const files = [...commonFiles, path.join("scenarios", scenarioFile)];

  return files
    .map((relativeFile) => fs.readFileSync(path.join(tatDir, relativeFile), "utf8").trim())
    .join("\n\n");
}
