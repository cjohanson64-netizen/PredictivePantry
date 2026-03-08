import { expectGraph } from "../graph/graphShape.js";

function derivePathFromGraph(input) {
  expectGraph(input, "Utterance");
  if (!input.root) return [];

  const adj = {};
  for (const n of input.nodes) adj[n] = [];
  for (const [a, b] of input.edges) {
    if (!adj[a]) adj[a] = [];
    adj[a].push(b);
  }

  const out = [input.root];
  let cur = input.root;
  const limit = Math.max(1, (input.nodes?.length ?? 0) * 2);
  for (let i = 0; i < limit; i++) {
    const nexts = adj[cur] ?? [];
    if (!nexts.length) break;
    cur = nexts[0];
    out.push(cur);
  }
  return out;
}

export { derivePathFromGraph };
