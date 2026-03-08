function assert(cond, code, meta = {}) {
  if (!cond) {
    const e = new Error(code) as Error & { code?: string; meta?: any };
    e.code = code;
    e.meta = meta;
    throw e;
  }
}

function getEndpointsByOrder(segment) {
  assert(Array.isArray(segment.nodes), "entwine_segment_nodes_missing");
  assert(segment.nodes.length > 0, "entwine_segment_nodes_empty");
  return {
    start: segment.nodes[0],
    end: segment.nodes[segment.nodes.length - 1],
  };
}

function prefixNode(prefix, label) {
  return `${prefix}${label}`;
}

export function entwineCore({ input }) {
  const segments = input?.segments;
  const basePrefix = input?.namespace?.prefix ?? "S";

  assert(Array.isArray(segments), "entwine_requires_segments", {
    got: typeof segments,
  });
  assert(segments.length > 0, "entwine_requires_nonempty_segments");

  const nodes = [];
  const edges = [];
  let prevEnd = null;

  for (let i = 0; i < segments.length; i++) {
    const seg = segments[i];

    assert(
      seg && Array.isArray(seg.nodes) && Array.isArray(seg.edges),
      "entwine_segment_invalid",
      {
        index: i,
      },
    );

    const prefix = `${basePrefix}${i + 1}:`;

    for (const n of seg.nodes) nodes.push(prefixNode(prefix, n));
    for (const [a, b] of seg.edges)
      edges.push([prefixNode(prefix, a), prefixNode(prefix, b)]);

    const { start, end } = getEndpointsByOrder(seg);
    const startN = prefixNode(prefix, start);
    const endN = prefixNode(prefix, end);

    if (prevEnd) edges.push([prevEnd, startN]);
    prevEnd = endN;
  }

  const graph = {
    kind: "Graph",
    nodes,
    edges,
    root: nodes[0] ?? null,
    meta: {
      ...(segments[0]?.meta ?? {}),
      entwined: true,
      segmentCount: segments.length,
      namespacePrefix: basePrefix,
    },
  };

  return { ok: true, value: { graph } };
}
