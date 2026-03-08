function normalizeEdge(edge) {
  if (Array.isArray(edge) && edge.length === 3) return edge;
  if (Array.isArray(edge) && edge.length === 2) return [edge[0], "entwinesWith", edge[1]];
  if (edge && typeof edge === "object") {
    return [edge.from ?? edge.subject ?? edge.a, edge.rel ?? edge.relation ?? edge.type ?? "entwinesWith", edge.to ?? edge.object ?? edge.b];
  }
  return ["?", "?", "?"];
}

function byPrefix(list, prefix) {
  return list.filter((value) => String(value).startsWith(prefix));
}

export function renderGraphSummary(result, scenario) {
  const graph = result?.value ?? {};
  const nodes = Array.isArray(graph.nodes) ? graph.nodes.map(String) : [];
  const edges = Array.isArray(graph.edges) ? graph.edges.map(normalizeEdge) : [];
  const state = graph.state ?? {};
  const meta = graph.meta ?? {};

  const itemNodes = byPrefix(nodes, "item:");
  const decisionEdges = edges.filter(([, , to]) => String(to).startsWith("decision:"));
  const groceryEdges = edges.filter(([, , to]) => to === "artifact:grocery_list");

  const inventoryTable = itemNodes.map((item) => ({
    item,
    quantity: state[item]?.quantity ?? null,
    min: state[item]?.min_quantity ?? null,
    daysRemaining: state[item]?.predicted_days_remaining ?? null,
    stock: state[item]?.stock_status ?? null,
    expiry: state[item]?.expiry_status ?? null,
    category: meta[item]?.category ?? null,
  }));

  console.log(`\n=== Predictive Pantry :: ${scenario} ===`);
  console.log(`root: ${graph.root}`);
  console.log(`nodes: ${nodes.length}`);
  console.log(`edges: ${edges.length}`);
  console.log("\nInventory snapshot");
  console.table(inventoryTable);

  console.log("Decision routes");
  console.table(decisionEdges.map(([from, rel, to]) => ({ from, rel, to })));

  console.log("Grocery list routes");
  console.table(groceryEdges.map(([from, rel, to]) => ({ from, rel, to })));

  if (Array.isArray(graph.trail) && graph.trail.length) {
    console.log("Trail");
    console.table(graph.trail);
  }

  if (Array.isArray(result?.artifacts) && result.artifacts.length) {
    console.log("Artifacts");
    console.table(result.artifacts);
  }
}
