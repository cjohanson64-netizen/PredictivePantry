import { err } from "./errors.js";

function splitTopLevelArgs(text) {
  const s = String(text ?? "").trim();
  if (!s) return [];
  const out = [];
  let cur = "";
  let inStr = null;
  let p = 0;
  let b = 0;
  let c = 0;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      cur += ch;
      if (ch === "\\") {
        if (i + 1 < s.length) cur += s[++i];
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      cur += ch;
      continue;
    }
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;
    if (p === 0 && b === 0 && c === 0 && ch === ",") {
      out.push(cur.trim());
      cur = "";
      continue;
    }
    cur += ch;
  }
  out.push(cur.trim());
  return out.filter(Boolean);
}

function resolveCtxPath(base, pathText) {
  const path = String(pathText ?? "")
    .replace(/\?\./g, ".")
    .replace(/^\./, "");
  if (!path) return base;
  const parts = path.split(".").filter(Boolean);
  let value = base;
  for (const key of parts) {
    if (value == null || typeof value !== "object") return undefined;
    value = value[key];
  }
  return value;
}

function splitTernary(text) {
  const s = String(text ?? "");
  let inStr = null;
  let p = 0;
  let b = 0;
  let c = 0;
  let qIdx = -1;
  for (let i = 0; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;
    if (p === 0 && b === 0 && c === 0 && ch === "?" && s[i + 1] !== ".") {
      qIdx = i;
      break;
    }
  }
  if (qIdx < 0) return null;
  inStr = null;
  p = 0;
  b = 0;
  c = 0;
  for (let i = qIdx + 1; i < s.length; i++) {
    const ch = s[i];
    if (inStr) {
      if (ch === "\\") {
        i++;
        continue;
      }
      if (ch === inStr) inStr = null;
      continue;
    }
    if (ch === '"' || ch === "'") {
      inStr = ch;
      continue;
    }
    if (ch === "(") p++;
    else if (ch === ")") p--;
    else if (ch === "[") b++;
    else if (ch === "]") b--;
    else if (ch === "{") c++;
    else if (ch === "}") c--;
    if (p === 0 && b === 0 && c === 0 && ch === ":") {
      return [s.slice(0, qIdx).trim(), s.slice(qIdx + 1, i).trim(), s.slice(i + 1).trim()];
    }
  }
  return null;
}

function coerceSymbol(value) {
  if (value && typeof value === "object" && value.kind === "Ref" && typeof value.name === "string") {
    return value.name;
  }
  if (typeof value === "string") return value;
  return String(value);
}

function toParams(params) {
  if (!Array.isArray(params)) return [];
  return params.map((p) => coerceSymbol(p));
}

function toHandlers(handlers) {
  if (!handlers || typeof handlers !== "object" || Array.isArray(handlers)) return {};
  const out = {};
  for (const [alias, relation] of Object.entries(handlers)) {
    out[String(alias)] = coerceSymbol(relation);
  }
  return out;
}

function createActionContract({ params, handlers, body }) {
  return {
    kind: "action.scaffold",
    params,
    handlers,
    body,
    __tatCallable: true,
  };
}

function isActionContract(value) {
  return !!(
    value &&
    typeof value === "object" &&
    value.kind === "action.scaffold" &&
    value.__tatCallable === true &&
    Array.isArray(value.params) &&
    value.handlers &&
    typeof value.handlers === "object"
  );
}

function resolveActionToken(raw, scope, ctx, env) {
  const token = String(raw ?? "").trim();
  if (!token) return null;
  const ternary = splitTernary(token);
  if (ternary) {
    const cond = resolveActionToken(ternary[0], scope, ctx, env);
    return cond
      ? resolveActionToken(ternary[1], scope, ctx, env)
      : resolveActionToken(ternary[2], scope, ctx, env);
  }
  if (
    (token.startsWith('"') && token.endsWith('"')) ||
    (token.startsWith("'") && token.endsWith("'"))
  ) {
    return token.slice(1, -1);
  }
  if (token === "true") return true;
  if (token === "false") return false;
  if (token === "null") return null;
  if (/^-?\d+(?:\.\d+)?$/.test(token)) return Number(token);
  if (token.startsWith("@ctx")) {
    return resolveCtxPath(ctx, token.slice(4));
  }
  if (token === "ctx") return ctx;

  if (Object.prototype.hasOwnProperty.call(scope.bindings, token)) {
    return scope.bindings[token];
  }
  if (env?.bindings?.has?.(token)) {
    return env.bindings.get(token);
  }

  // Preserve unresolved bare symbols as relation/node tokens.
  return token;
}

function executeActionBody(body, { graph, scope, ctx, env }) {
  const lines = String(body ?? "")
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l && !l.startsWith("//") && !l.startsWith("#"));

  let current = graph;
  for (const line of lines) {
    const call = line.match(/^([A-Za-z_][A-Za-z0-9_]*(?:\.[A-Za-z_][A-Za-z0-9_]*)*)\s*\(([\s\S]*)\)\s*$/);
    if (!call) continue;
    const opName = call[1];
    const key = opName.toLowerCase();
    const op = ctx?.registry?.[key];
    if (typeof op !== "function") err(`Unknown action handler op: ${opName}`);

    const pos = splitTopLevelArgs(call[2]).map((arg) =>
      resolveActionToken(arg, scope, ctx, env),
    );
    current = op({ input: current, args: { __pos: pos }, env, ctx });
  }
  return current;
}

function executeActionContract(
  contract,
  { graph, ctx, env, seed }: { graph?: any; ctx?: any; env?: any; seed?: any } = {},
) {
  const scope: any = {
    params: contract.params,
    handlers: contract.handlers,
    bindings: {
      "@ctx": ctx ?? null,
      ctx: ctx ?? null,
    },
  };
  for (const p of contract.params) scope.bindings[p] = p;
  for (const [alias, relation] of Object.entries(contract.handlers)) scope.bindings[alias] = relation;
  if (seed != null && contract.params.length > 0) {
    scope.bindings[contract.params[0]] = seed;
    scope.bindings.it = seed;
  }

  if (typeof contract.body === "string" && contract.body.trim().length > 0) {
    return executeActionBody(contract.body, {
      graph: graph ?? null,
      scope,
      ctx: ctx ?? null,
      env,
    });
  }
  return graph ?? null;
}

// @action scaffold: params represent nodes, handlers represent edges.
function actionDirective({ input, args, env, ctx }) {
  const rawPos = Array.isArray(args?.__pos) ? args.__pos : [];
  const paramsRaw = args?.params ?? rawPos[0] ?? [];
  const handlersRaw = args?.handlers ?? rawPos[1] ?? {};
  const params = toParams(paramsRaw);
  const handlers = toHandlers(handlersRaw);
  const body = typeof args?.body === "string" ? args.body : args?.__block ?? null;
  if (paramsRaw != null && !Array.isArray(paramsRaw)) err("@action params must be an array");
  if (
    handlersRaw != null &&
    (!handlersRaw || typeof handlersRaw !== "object" || Array.isArray(handlersRaw))
  ) {
    err("@action handlers must be an object");
  }

  const contract = createActionContract({ params, handlers, body });

  const outputGraph =
    input && typeof input === "object"
      ? executeActionContract(contract, {
          graph: input ?? null,
          ctx: ctx ?? null,
          env,
        })
      : input ?? null;

  const scaffold = { ...contract, input: input ?? null, output: outputGraph };
  if (outputGraph && typeof outputGraph === "object" && Array.isArray(outputGraph.nodes)) {
    return outputGraph;
  }
  return scaffold;
}

export { actionDirective, isActionContract, executeActionContract };
