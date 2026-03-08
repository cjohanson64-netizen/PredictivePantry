import { coreRegistry } from "../registry/coreRegistry.js";
import { err } from "./errors.js";
import { isGraphShape, normalizeGraphLike } from "../graph/graphShape.js";
import type { RuntimeContext } from "./types.js";

function cloneGraph(g) {
  return normalizeGraphLike(g, { pairEdges: false });
}

const valueBuiltins = {
  concat: (...xs) => xs.map((x) => (x == null ? "" : String(x))).join(""),
};
const legacyProjectionOps = new Set(["canopy", "trellis", "utterance"]);
const pairEdgeOps = new Set([
  "seedgraph",
  "prune",
  "graft",
  "reroot",
  "swap",
  "retip",
  "entwine",
  "canopy",
  "trellis",
  "wander",
  "select",
  "path",
  "match",
  "utterance",
]);

function resolveData(value, env, input, trace, isTap = false) {
  if (Array.isArray(value))
    return value.map((v) => resolveData(v, env, input, trace, isTap));
  if (value && typeof value === "object") {
    if (value.kind === "Ref") return lookupRef(value.name, env, trace);
    if (value.kind === "Binary") {
      const left = resolveData(value.left, env, input, trace, isTap);
      const right = resolveData(value.right, env, input, trace, isTap);
      switch (value.op) {
        case "+":
          return left + right;
        case "-":
          return Number(left) - Number(right);
        case "*":
          return Number(left) * Number(right);
        case "/":
          return Number(left) / Number(right);
        case "%":
          return Number(left) % Number(right);
        default:
          err(`Unsupported binary operator: ${value.op}`);
      }
    }
    if (value.kind === "Call") {
      const args = (value.args ?? []).map((a) =>
        resolveData(a, env, input, trace, isTap),
      );
      if (
        value.callee?.kind === "Ref" &&
        Object.prototype.hasOwnProperty.call(valueBuiltins, value.callee.name)
      ) {
        return valueBuiltins[value.callee.name](...args);
      }
      const fn = resolveData(value.callee, env, input, trace, isTap);
      if (typeof fn !== "function") err("Cannot call non-function value");
      return fn(...args);
    }
    if (value.kind === "Dot") {
      const base = resolveData(value.left, env, input, trace, isTap);
      if (base == null || typeof base !== "object") {
        err(`Cannot access property on non-object: ${value.right}`);
      }
      return base[value.right];
    }
    if (value.kind === "Index") {
      const coll = resolveData(value.target, env, input, trace, isTap);
      const idx = resolveData(value.index, env, input, trace, isTap);
      if (Array.isArray(coll)) {
        const n = Number(idx);
        return coll[n];
      }
      if (coll && typeof coll === "object") {
        return coll[String(idx)];
      }
      err(`Cannot index into non-collection: ${coll}`);
    }
    if (value.kind === "Expr") {
      // Evaluate nested expression relative to current pipeline input.
      const out = evalExpr(value.expr, env, input, trace, isTap);
      return resolveData(out, env, input, trace, isTap);
    }
    const out = {};
    for (const [k, v] of Object.entries(value))
      out[k] = resolveData(v, env, input, trace, isTap);
    return out;
  }
  return value;
}

function lookupRef(name, env, trace) {
  if (name === "@ctx" || name === "ctx") return env.ctx;
  const parts = String(name).split(".");
  const base = parts[0];

  let value;
  if (env.bindings.has(base)) value = env.bindings.get(base);
  else if (env.targets.has(base)) value = materializeTarget(base, env, trace);
  else err(`Unknown symbol: ${name}`);

  for (let i = 1; i < parts.length; i++) {
    const key = parts[i];
    if (value == null || typeof value !== "object" || !(key in value)) {
      err(`Unknown symbol: ${name}`);
    }
    value = value[key];
  }

  return value;
}

function materializeTarget(name, env, trace, isTap = false) {
  const raw = env.targets.get(name);
  const resolved = resolveData(raw, env, null, trace, isTap);
  if (isGraphShape(resolved)) return cloneGraph(resolved);
  return resolved;
}

function normalizeCoreResult(out) {
  if (
    out &&
    typeof out === "object" &&
    out.ok === true &&
    out.value &&
    out.value.graph
  ) {
    return out.value.graph;
  }
  if (
    out &&
    typeof out === "object" &&
    out.ok === true &&
    Object.prototype.hasOwnProperty.call(out, "value")
  ) {
    return out.value;
  }
  return out;
}

function evalInvoke(node, input, env, trace, isTap = false) {
  const has = (m) => node.markers?.includes(m);
  if (has("???"))
    console.log(`[??? before @${node.name}]`, JSON.stringify(input, null, 2));

  let out;
  const rawName = String(node.name ?? "");
  const key = rawName.replace(/^@+/, "").toLowerCase();
  const core = coreRegistry[key];
  if (typeof core === "function") {
    if (isGraphShape(input)) env.ctx.graph = input;
    const args =
      key === "action" || key === "guard"
        ? (node.args ?? {})
        : resolveData(node.args, env, input, trace, isTap);
    const normalizedInput =
      pairEdgeOps.has(key) && isGraphShape(input)
        ? normalizeGraphLike(input, { pairEdges: true })
        : input;
    out = core({ input: normalizedInput, args, env, ctx: env.ctx });
    if (isGraphShape(out)) env.ctx.graph = out;
  } else if (env.targets.has(rawName) || env.targets.has(key)) {
    out = materializeTarget(env.targets.has(rawName) ? rawName : key, env, trace, isTap);
    if (isGraphShape(out)) env.ctx.graph = out;
  } else {
    err(`Unknown invoke target: @${rawName.replace(/^@+/, "")}`);
  }

  out = normalizeCoreResult(out);
  if (trace) console.log(`[@${node.name}]`, JSON.stringify(out, null, 2));
  if (has("???"))
    console.log(`[??? after @${node.name}]`, JSON.stringify(out, null, 2));
  if (has("!!!")) err(`HALT !!! after @${node.name}`);

  if (!isTap && legacyProjectionOps.has(key)) {
    console.warn(
      `[TAT] Warning: -> @${node.name} now transforms pipeline value. Use <> for projection/tap behavior.`,
    );
  }

  if (isTap) {
    const meta: { via: any; markers: any; role?: string } = {
      via: node.name,
      markers: node.markers ?? [],
    };
    if (has(":::")) {
      meta.role = "primary";
      if (out && typeof out === "object") {
        if (!out.meta || typeof out.meta !== "object") out.meta = {};
        out.meta.role = "primary";
      }
    }
    env.artifacts.push({
      type: key,
      value: out,
      meta,
    });
  }

  return out;
}

function evalExpr(node, env, input, trace, isTap = false) {
  if (!node) return null;
  switch (node.kind) {
    case "Pipe": {
      const left = evalExpr(node.lhs, env, input, trace, false);
      return evalExpr(node.rhs, env, left, trace, false);
    }
    case "Tap": {
      const left = evalExpr(node.lhs, env, input, trace, false);
      evalExpr(node.rhs, env, left, trace, true);
      return left;
    }
    case "Invoke":
      return evalInvoke(node, input, env, trace, isTap);
    case "Literal":
      return resolveData(node.value, env, input, trace, isTap);
    default:
      err(`Unsupported expr kind: ${node.kind}`);
  }
}

function runProgram(
  ast,
  {
    trace = false,
    mode,
    flags,
    meta,
    source,
  }: {
    trace?: boolean;
    mode?: string;
    flags?: Record<string, boolean>;
    meta?: { trellisName?: string; source?: string };
    source?: string;
  } = {},
) {
  const ctx: RuntimeContext = {
    graph: null,
    registry: coreRegistry,
    env: {
      mode,
      debug: Boolean(trace),
      flags: flags && typeof flags === "object" ? { ...flags } : undefined,
    },
    meta: {
      trellisName: meta?.trellisName,
      source: meta?.source ?? source,
    },
  };

  const env = {
    targets: new Map(),
    bindings: new Map(),
    artifacts: [],
    ctx,
  };

  let last = null;

  for (const node of ast.body) {
    if (node.kind === "TargetDecl") {
      env.targets.set(node.name, node.body);
      continue;
    }

    if (node.kind === "Bind") {
      const v = evalExpr(node.expr, env, last, trace);
      env.bindings.set(node.name, v);
      last = v;
      if (trace) console.log(`[bind ${node.name}]`, JSON.stringify(v, null, 2));
      continue;
    }

    last = evalExpr(node, env, last, trace);
  }

  return { value: last, artifacts: env.artifacts };
}

export { runProgram };
export { valueBuiltins };
