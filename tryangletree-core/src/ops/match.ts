import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function globMatch(text, pattern) {
  if (pattern === "*") return true;
  const starCount = (pattern.match(/\*/g) ?? []).length;
  if (starCount === 0) return text === pattern;
  if (starCount === 1 && pattern.startsWith("*")) return text.endsWith(pattern.slice(1));
  if (starCount === 1 && pattern.endsWith("*")) return text.startsWith(pattern.slice(0, -1));
  if (starCount === 2 && pattern.startsWith("*") && pattern.endsWith("*")) {
    return text.includes(pattern.slice(1, -1));
  }
  const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`).test(text);
}

function matchCore({ input, args }) {
  expectGraph(input, "Match");
  const pattern = args.glob;
  const where = args.in ?? "nodes";
  if (typeof pattern !== "string") err('Match expects glob="..."');
  if (where !== "nodes" && where !== "edges") err('Match in must be "nodes" or "edges"');

  if (where === "nodes") {
    return input.nodes.filter((n) => globMatch(n, pattern));
  }

  const matched = new Set();
  for (const [a, b] of input.edges) {
    if (globMatch(a, pattern)) matched.add(a);
    if (globMatch(b, pattern)) matched.add(b);
  }
  return input.nodes.filter((n) => matched.has(n));
}

export { matchCore };
