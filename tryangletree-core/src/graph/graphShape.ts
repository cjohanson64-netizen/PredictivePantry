import { err } from "../runtime/errors.js";

function coerceEdgePair(edge) {
  if (Array.isArray(edge)) {
    if (edge.length >= 3) return [edge[0], edge[2]];
    if (edge.length >= 2) return [edge[0], edge[1]];
    return null;
  }
  if (edge && typeof edge === "object") {
    const from = edge.from ?? edge.subject;
    const to = edge.to ?? edge.object;
    if (from != null && to != null) return [from, to];
  }
  return null;
}

function normalizeGraphLike(v, { pairEdges = false } = {}) {
  const src = v && typeof v === "object" ? v : {};
  const nodes = Array.isArray(src.nodes) ? src.nodes.slice() : [];
  const edgesRaw = Array.isArray(src.edges) ? src.edges : [];
  const edges = pairEdges
    ? edgesRaw
        .map((e) => coerceEdgePair(e))
        .filter((e) => Array.isArray(e) && e.length === 2)
    : edgesRaw.map((e) => (Array.isArray(e) ? e.slice() : e));
  const root = Object.prototype.hasOwnProperty.call(src, "root")
    ? src.root
    : nodes[0] ?? null;
  return { ...src, nodes, edges, root };
}

function isGraphShape(v) {
  return !!(v && typeof v === "object" && Array.isArray(v.nodes) && Array.isArray(v.edges));
}

function expectGraph(v, op) {
  if (!isGraphShape(v)) {
    err(`${op} expects graph shape {nodes:[], edges:[], root}`);
  }
}

export { isGraphShape, expectGraph, normalizeGraphLike };
