import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function swapCore({ input, args }) {
  expectGraph(input, "Swap");
  if (typeof args.nodea !== "string" || typeof args.nodeb !== "string") {
    err('Swap expects nodeA="X", nodeB="Y"');
  }
  const map = (s) => (s === args.nodea ? args.nodeb : s === args.nodeb ? args.nodea : s);
  return {
    ...input,
    nodes: input.nodes.map(map),
    edges: input.edges.map(([a, b]) => [map(a), map(b)]),
    root: input.root ? map(input.root) : null,
  };
}

export { swapCore };
