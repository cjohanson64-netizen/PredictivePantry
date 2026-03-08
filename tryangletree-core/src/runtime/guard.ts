import { executeActionContract, isActionContract } from "./action.js";

function safeLookupRef(name, env) {
  const parts = String(name).split(".");
  const base = parts[0];

  let value;
  if (env?.bindings?.has(base)) value = env.bindings.get(base);
  else if (env?.targets?.has(base)) value = env.targets.get(base);
  else return null;

  for (let i = 1; i < parts.length; i++) {
    const key = parts[i];
    if (value == null || typeof value !== "object" || !(key in value)) return null;
    value = value[key];
  }

  return value;
}

function isNodeLike(value, graph) {
  if (typeof value === "string") {
    const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
    return nodes.some((n) => n === value || (n && typeof n === "object" && n.id === value));
  }
  if (value && typeof value === "object") {
    if (typeof value.id === "string") return true;
  }
  return false;
}

function isCallable(value) {
  return typeof value === "function" || isActionContract(value);
}

function resolveRefArg(arg, env) {
  if (arg && typeof arg === "object" && arg.kind === "Ref" && typeof arg.name === "string") {
    return safeLookupRef(arg.name, env);
  }
  return arg;
}

function resolveThunkArg(arg, env, input, ctx) {
  if (arg && typeof arg === "object" && arg.kind === "Ref" && typeof arg.name === "string") {
    return safeLookupRef(arg.name, env);
  }
  if (arg && typeof arg === "object" && arg.kind === "Expr" && arg.expr?.kind === "Invoke") {
    const name = String(arg.expr.name || "").toLowerCase();
    if (name === "action" && ctx?.registry?.action) {
      return ctx.registry.action({ input, args: arg.expr.args ?? {}, env, ctx });
    }
  }
  if (typeof arg === "string") {
    const resolved = safeLookupRef(arg, env);
    return resolved ?? arg;
  }
  return arg;
}

function guardDirective({ input, args, env, ctx }) {
  const pos = Array.isArray(args?.__pos) ? args.__pos : [];
  const refRaw = args?.noderef ?? pos[0];
  const thunkRaw = args?.thunk ?? pos[1];

  const ref = resolveRefArg(refRaw, env);
  if (!isNodeLike(ref, ctx?.graph ?? input)) return null;

  const thunk = resolveThunkArg(thunkRaw, env, input, ctx);
  if (!isCallable(thunk)) return null;

  try {
    if (typeof thunk === "function") {
      const out = thunk(ref, { input, env, ctx });
      return out === undefined ? null : out;
    }
    if (isActionContract(thunk)) {
      const graph = ctx?.graph ?? input ?? null;
      const invokeArgs = Array.isArray(thunk.params) && thunk.params.length > 0 ? [ref] : [];
      const out = executeActionContract(thunk, {
        graph,
        ctx,
        env,
        seed: invokeArgs[0],
      });
      return out === undefined ? null : out;
    }
    return null;
  } catch {
    return null;
  }
}

export { guardDirective, isNodeLike, isCallable };
