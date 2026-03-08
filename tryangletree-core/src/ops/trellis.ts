import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function trellisCore({ input, args }) {
  expectGraph(input, "Trellis");

  const mode = args.mode ?? "linear";

  if (mode === "linear") {
    const nodes = input.nodes.map((n, i) => ({
      id: n,
      x: i * 60,
      y: 0,
    }));

    return {
      kind: "layout",
      mode,
      nodes,
      edges: input.edges,
    };
  }

  if (mode === "page") {
    const perRow = args.perrow ?? 4;
    const nodes = input.nodes.map((n, i) => ({
      id: n,
      x: (i % perRow) * 80,
      y: Math.floor(i / perRow) * 120,
    }));

    return {
      kind: "layout",
      mode,
      nodes,
      edges: input.edges,
    };
  }

  err(`Unsupported Trellis mode: ${mode}`);
}

export { trellisCore };
