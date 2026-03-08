import { err } from "../runtime/errors.js";
import { isGraphShape } from "../graph/graphShape.js";
import { derivePathFromGraph } from "../graph/derivePathFromGraph.js";

function utteranceCore({ input, args }) {
  const septoken = typeof args.septoken === "string" ? args.septoken : " ";
  const endtoken = typeof args.endtoken === "string" ? args.endtoken : "";
  const groupsRaw = args.groups ?? [];
  if (!Array.isArray(groupsRaw)) err("Utterance groups must be an array");

  const groups = groupsRaw.map((g, idx) => {
    if (!g || typeof g !== "object") err(`Utterance group at index ${idx} must be an object`);
    const interval = Number(g.interval);
    if (!Number.isInteger(interval) || interval <= 0) {
      err(`Utterance group interval must be a positive integer at index ${idx}`);
    }
    const token = g.token;
    if (typeof token !== "string") err(`Utterance group token must be a string at index ${idx}`);
    return { interval, token };
  });

  let tokens;
  if (Array.isArray(input)) tokens = input.slice();
  else if (isGraphShape(input)) tokens = derivePathFromGraph(input);
  else err("Utterance expects path array or graph");

  const safeTokens = tokens.map((t) => String(t));
  const parts = [];

  for (let i = 0; i < safeTokens.length; i++) {
    parts.push(safeTokens[i]);

    const pos = i + 1;
    for (const rule of groups) {
      if (pos % rule.interval === 0) parts.push(rule.token);
    }

    if (i < safeTokens.length - 1) parts.push(septoken);
  }

  if (endtoken) parts.push(endtoken);
  const text = parts.join("");

  return { kind: "utterance", tokens: safeTokens, text };
}

export { utteranceCore };
