import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function rerootCore({ input, args }) {
  expectGraph(input, "Reroot");
  if (typeof args.node !== "string") err('Reroot expects node="X"');
  if (!input.nodes.includes(args.node)) err(`Reroot node not found: ${args.node}`);
  return { ...input, root: args.node };
}

export { rerootCore };
