import { entwineCore } from "./entwine.js";
import { normalizeCoreResult } from "../graph/normalizeCoreResult.js";

function entwineOpCore({ input, args }) {
  const payload = {
    segments: args.segments ?? args.measures ?? input?.segments ?? input?.measures,
    namespace: args.namespace ?? input?.namespace,
  };
  return normalizeCoreResult(entwineCore({ input: payload }));
}

export { entwineOpCore };
