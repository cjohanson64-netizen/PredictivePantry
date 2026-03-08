import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function pathCore({ input, args }) {
  expectGraph(input, "Path");
  const from = args.from;
  const to = args.to;
  const mode = args.mode ?? "bfs";

  if (typeof from !== "string" || typeof to !== "string") {
    err('Path expects from="X", to="Y"');
  }
  if (mode !== "bfs" && mode !== "dfs") err('Path mode must be "bfs" or "dfs"');

  if (!input.nodes.includes(from) || !input.nodes.includes(to)) return [];

  const adj = {};
  for (const n of input.nodes) adj[n] = [];
  for (const [a, b] of input.edges) {
    if (!adj[a]) adj[a] = [];
    adj[a].push(b);
  }

  const parent = new Map();
  const seen = new Set([from]);

  if (mode === "bfs") {
    const q = [from];
    while (q.length) {
      const cur = q.shift();
      if (cur === to) break;
      for (const nxt of adj[cur] ?? []) {
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        parent.set(nxt, cur);
        q.push(nxt);
      }
    }
  } else {
    const st = [from];
    while (st.length) {
      const cur = st.pop();
      if (cur === to) break;
      const nexts = adj[cur] ?? [];
      for (let i = nexts.length - 1; i >= 0; i--) {
        const nxt = nexts[i];
        if (seen.has(nxt)) continue;
        seen.add(nxt);
        parent.set(nxt, cur);
        st.push(nxt);
      }
    }
  }

  if (from !== to && !parent.has(to)) return [];
  const out = [to];
  let cur = to;
  while (cur !== from) {
    cur = parent.get(cur);
    if (cur == null) return [];
    out.push(cur);
  }
  out.reverse();
  return out;
}

export { pathCore };
