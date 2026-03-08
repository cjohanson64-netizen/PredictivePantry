import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function selectCore({ input, args }) {
  expectGraph(input, "Select");

  if (args.nodes != null) {
    if (!Array.isArray(args.nodes)) err("Select nodes must be an array");
    if (args.nodes.some((n) => typeof n !== "string")) err("Select nodes must contain strings");
  }
  if (args.root != null && typeof args.root !== "string") err("Select root must be a string");

  if (args.nodes == null) {
    return {
      ...input,
      nodes: input.nodes.slice(),
      edges: input.edges.map(([a, b]) => [a, b]),
      root: input.root ?? null,
    };
  }

  const wanted = new Set(args.nodes);
  const nodes = input.nodes.filter((n) => wanted.has(n));
  const kept = new Set(nodes);
  const edges = input.edges.filter(([a, b]) => kept.has(a) && kept.has(b)).map(([a, b]) => [a, b]);

  let root = null;
  if (typeof args.root === "string" && kept.has(args.root)) root = args.root;
  else if (kept.has(input.root)) root = input.root;
  else root = nodes[0] ?? null;

  return { ...input, nodes, edges, root };
}

export { selectCore };
