function toFiniteOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function normalizeWeightMap(v) {
  if (!v || typeof v !== "object" || Array.isArray(v)) return {};
  const out = {};
  for (const [k, raw] of Object.entries(v)) {
    const n = toFiniteOrNull(raw);
    if (n != null) out[k] = n;
  }
  return out;
}

function normalizeWeights(raw) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { default: 0.5 };
  }
  const defaultWeight = toFiniteOrNull(raw.default);
  return {
    default: defaultWeight ?? 0.5,
    nodes: normalizeWeightMap(raw.nodes),
    edges: normalizeWeightMap(raw.edges),
    motifs: normalizeWeightMap(raw.motifs),
    ops: normalizeWeightMap(raw.ops),
  };
}

function cloneEdge(edge) {
  if (Array.isArray(edge)) return edge.slice();
  if (edge && typeof edge === "object") return { ...edge };
  return edge;
}

function getSeedPayload(input, args) {
  const inputObj = input && typeof input === "object" ? input : {};
  const argsObj = args && typeof args === "object" ? args : {};

  const positionalPayload =
    argsObj._ && typeof argsObj._ === "object" && !Array.isArray(argsObj._) ? argsObj._ : null;

  const namedPayload =
    argsObj.payload && typeof argsObj.payload === "object" && !Array.isArray(argsObj.payload)
      ? argsObj.payload
      : argsObj.graph && typeof argsObj.graph === "object" && !Array.isArray(argsObj.graph)
        ? argsObj.graph
        : null;

  const objectFormPayload = !Array.isArray(argsObj) ? argsObj : null;
  const payload = { ...inputObj, ...(namedPayload ?? positionalPayload ?? objectFormPayload ?? {}) };

  if (Object.prototype.hasOwnProperty.call(argsObj, "weights")) {
    payload.weights = argsObj.weights;
  }

  return payload;
}

function seedgraphCore({ input, args }) {
  const v = getSeedPayload(input, args);
  const nodes = Array.isArray(v.nodes) ? v.nodes.slice() : [];
  const edges = Array.isArray(v.edges) ? v.edges.map(cloneEdge) : [];
  const root = Object.prototype.hasOwnProperty.call(v, "root") ? v.root : nodes[0] ?? null;

  return {
    ...v,
    nodes,
    edges,
    root,
    weights: normalizeWeights(v.weights),
  };
}

export { seedgraphCore };
