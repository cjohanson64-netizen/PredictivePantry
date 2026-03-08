import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function canopyCore({ input, args }) {
  expectGraph(input, "Canopy");
  const mode = args.mode ?? "surface";
  if (mode !== "surface") err('Canopy currently supports mode="surface" only');

  const adj = {};
  for (const n of input.nodes) adj[n] = [];
  for (const [a, b] of input.edges) {
    if (!adj[a]) adj[a] = [];
    adj[a].push(b);
  }

  const root = input.root;
  if (!root) return { mode, root: null, reachable: [], adjacency: {} };

  const q = [root];
  const seen = new Set([root]);
  while (q.length) {
    const cur = q.shift();
    for (const nxt of adj[cur] ?? []) {
      if (!seen.has(nxt)) {
        seen.add(nxt);
        q.push(nxt);
      }
    }
  }

  const reachable = Array.from(seen);
  const adjacency = {};
  for (const n of reachable) adjacency[n] = (adj[n] ?? []).filter((x) => seen.has(x));
  return { mode, root, reachable, adjacency };
}

export { canopyCore };
