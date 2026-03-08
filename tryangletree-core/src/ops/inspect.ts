// src/ops/inspect.ts
import { normalizeTrellis } from "./canonicalTrellis.js";

// Projection-style inspector: returns BOTH the public graph membrane + normalized trellis view.
export function inspectCore({ input }: { input: any }) {
  return {
    kind: "inspect",
    graph: input,                 // preserves nodes/edges/root exactly as your console sees it
    trellis: normalizeTrellis(input), // exposes the deeper canonical trellis shape
  };
}