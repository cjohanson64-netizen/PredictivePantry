import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function graftCore({ input, args }) {
  expectGraph(input, "Graft");
  const subtree = args.subtree ?? args._;
  if (!subtree || typeof subtree !== "object") err("Graft expects subtree={nodes:[],edges:[]}");

  const nodes = input.nodes.slice();
  const nodeSet = new Set(nodes);
  for (const n of subtree.nodes ?? []) {
    if (!nodeSet.has(n)) {
      nodeSet.add(n);
      nodes.push(n);
    }
  }

  const edges = input.edges.slice();
  const edgeSet = new Set(edges.map(([a, b]) => `${a}→${b}`));
  for (const [a, b] of subtree.edges ?? []) {
    const key = `${a}→${b}`;
    if (!edgeSet.has(key)) {
      edgeSet.add(key);
      edges.push([a, b]);
    }
  }

  return { ...input, nodes, edges, root: input.root };
}

export { graftCore };
