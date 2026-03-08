import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function pruneCore({ input, args }) {
  expectGraph(input, "Prune");
  const range = args.range;
  if (!Array.isArray(range) || range.length !== 2) err("Prune expects range=[start,end]");
  const [start, end] = range.map(Number);
  if (!Number.isInteger(start) || !Number.isInteger(end)) err("Prune range must be integers");
  const removed = new Set(input.nodes.slice(start, end));
  const nodes = input.nodes.filter((n) => !removed.has(n));
  const edges = input.edges.filter(([a, b]) => !removed.has(a) && !removed.has(b));
  const root = removed.has(input.root) ? (nodes[0] ?? null) : input.root;
  return { ...input, nodes, edges, root };
}

export { pruneCore };
