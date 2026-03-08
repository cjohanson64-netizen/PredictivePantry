import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function retipCore({ input, args }) {
  expectGraph(input, "Retip");

  const oldNode = args.node;
  const newNode = args.with;

  if (typeof oldNode !== "string" || typeof newNode !== "string") {
    err('Retip expects node="X", with="Y"');
  }
  if (!input.nodes.includes(oldNode)) {
    err(`Retip node not found: ${oldNode}`);
  }

  const map = (s) => (s === oldNode ? newNode : s);

  const nodesOut = [];
  const seenNodes = new Set();
  for (const n of input.nodes) {
    const nn = map(n);
    if (!seenNodes.has(nn)) {
      seenNodes.add(nn);
      nodesOut.push(nn);
    }
  }
  if (!seenNodes.has(newNode)) {
    nodesOut.push(newNode);
    seenNodes.add(newNode);
  }

  const edgesOut = [];
  const seenEdges = new Set();
  for (const [a, b] of input.edges) {
    const aa = map(a);
    const bb = map(b);
    const key = `${aa}→${bb}`;
    if (!seenEdges.has(key)) {
      seenEdges.add(key);
      edgesOut.push([aa, bb]);
    }
  }

  const rootOut = input.root ? map(input.root) : null;
  return { ...input, nodes: nodesOut, edges: edgesOut, root: rootOut };
}

export { retipCore };
