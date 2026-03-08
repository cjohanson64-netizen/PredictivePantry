import { err } from "../runtime/errors.js";

const entwinesWith = "entwinesWith";

export function normalizeTrellis(input) {
  const src = input && typeof input === "object" ? input : {};
  return {
    ...src,
    nodes: Array.isArray(src.nodes) ? src.nodes.slice() : [],
    edges: Array.isArray(src.edges) ? src.edges.map((e) => (Array.isArray(e) ? [...e] : e)) : [],
    state: src.state && typeof src.state === "object" ? { ...src.state } : {},
    meta: src.meta && typeof src.meta === "object" ? { ...src.meta } : {},
    root: src.root ?? null,
    ...(Array.isArray(src.trail) ? { trail: src.trail.slice() } : {}),
  };
}

function ensureStateEntity(trellis, entity) {
  if (typeof entity !== "string" || !entity) err("state entity must be a non-empty string");
  const cur = trellis.state[entity];
  trellis.state[entity] = cur && typeof cur === "object" ? { ...cur } : {};
}

function ensureMetaEntity(trellis, entity) {
  if (typeof entity !== "string" || !entity) err("meta entity must be a non-empty string");
  const cur = trellis.meta[entity];
  trellis.meta[entity] = cur && typeof cur === "object" ? { ...cur } : {};
}

function getArg(args, key, fallback = null) {
  if (args && Object.prototype.hasOwnProperty.call(args, key)) return args[key];
  return fallback;
}

function getPosArg(args, index, fallback = null) {
  const pos = args?.__pos;
  if (Array.isArray(pos) && index >= 0 && index < pos.length) return pos[index];
  return fallback;
}

function validateString(value, label) {
  if (typeof value !== "string" || value.length === 0) err(`${label} must be a non-empty string`);
}

function edgeKey(a, r, b) {
  return `${a}::${r}::${b}`;
}

function graftBranch({ input, args }) {
  const trellis = normalizeTrellis(input);
  const subject = getArg(args, "subject", getArg(args, "a", getArg(args, "node", getPosArg(args, 0))));
  const relation = getArg(
    args,
    "relation",
    getArg(args, "via", getArg(args, "verb", getPosArg(args, 1, entwinesWith))),
  );
  const object = getArg(args, "object", getArg(args, "b", getArg(args, "target", getPosArg(args, 2))));

  validateString(subject, "subject");
  validateString(relation, "relation");
  validateString(object, "object");

  const key = edgeKey(subject, relation, object);
  const seen = new Set(
    trellis.edges
      .filter((e) => Array.isArray(e) && e.length >= 3)
      .map((e) => edgeKey(String(e[0]), String(e[1]), String(e[2]))),
  );

  if (!seen.has(key)) trellis.edges.push([subject, relation, object]);
  return trellis;
}

function graftBud({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const dimension = getArg(args, "dimension", getArg(args, "key", getPosArg(args, 1)));
  const value = getArg(args, "value", getPosArg(args, 2));

  validateString(entity, "entity");
  validateString(dimension, "dimension");

  ensureStateEntity(trellis, entity);
  trellis.state[entity][dimension] = value;
  return trellis;
}

function graftLeaf({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const key = getArg(args, "key", getPosArg(args, 1));
  const value = getArg(args, "value", getPosArg(args, 2));

  validateString(entity, "entity");
  validateString(key, "key");

  ensureMetaEntity(trellis, entity);
  trellis.meta[entity][key] = value;
  return trellis;
}

function graftVine({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const dimension = getArg(args, "dimension", getArg(args, "key", getPosArg(args, 1)));
  const from = Object.prototype.hasOwnProperty.call(args ?? {}, "from")
    ? args.from
    : getArg(args, "from_", getPosArg(args, 2));
  const to = getArg(args, "to", getPosArg(args, 3));
  const trail = getArg(args, "trail", getArg(args, "optionaltrail", getPosArg(args, 4)));

  validateString(entity, "entity");
  validateString(dimension, "dimension");

  ensureStateEntity(trellis, entity);
  const current = trellis.state[entity][dimension];

  if (from !== undefined && from !== null && current !== from) {
    err(`graftVine from mismatch for ${entity}.${dimension}: expected ${from}, got ${current}`);
  }

  trellis.state[entity][dimension] = to;

  if (Array.isArray(trellis.trail)) {
    trellis.trail.push({ entity, dimension, from: current ?? null, to });
  } else if (trail != null) {
    trellis.trail = [{ entity, dimension, from: current ?? null, to, trail }];
  }

  return trellis;
}

function pruneBranch({ input, args }) {
  const trellis = normalizeTrellis(input);
  const subject = getArg(args, "subject", getArg(args, "a", getArg(args, "node", getPosArg(args, 0))));
  const relation = getArg(
    args,
    "relation",
    getArg(args, "via", getArg(args, "verb", getPosArg(args, 1, entwinesWith))),
  );
  const object = getArg(args, "object", getArg(args, "b", getArg(args, "target", getPosArg(args, 2))));

  validateString(subject, "subject");
  validateString(relation, "relation");
  validateString(object, "object");

  trellis.edges = trellis.edges.filter(
    (e) => !(Array.isArray(e) && e[0] === subject && e[1] === relation && e[2] === object),
  );
  return trellis;
}

function pruneBud({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const dimension = getArg(args, "dimension", getArg(args, "key", getPosArg(args, 1)));

  validateString(entity, "entity");
  validateString(dimension, "dimension");

  ensureStateEntity(trellis, entity);
  delete trellis.state[entity][dimension];
  return trellis;
}

function pruneLeaf({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const key = getArg(args, "key", getPosArg(args, 1));

  validateString(entity, "entity");
  validateString(key, "key");

  ensureMetaEntity(trellis, entity);
  delete trellis.meta[entity][key];
  return trellis;
}

function pruneVine({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "node", getPosArg(args, 0)));
  const dimension = getArg(args, "dimension", getArg(args, "key", getPosArg(args, 1)));

  validateString(entity, "entity");
  validateString(dimension, "dimension");

  ensureStateEntity(trellis, entity);
  trellis.state[entity][dimension] = null;
  return trellis;
}

function assay({ input, args }) {
  const trellis = normalizeTrellis(input);
  const entity = getArg(args, "entity", getArg(args, "subject", getPosArg(args, 0)));
  const metric = getArg(args, "metric", getPosArg(args, 1));
  const value = getArg(args, "value", getPosArg(args, 2));
  const meta = getArg(args, "meta", getPosArg(args, 3));

  validateString(entity, "entity");
  validateString(metric, "metric");

  ensureStateEntity(trellis, entity);
  trellis.state[entity][metric] = value;
  if (meta !== undefined) {
    if (!trellis.meta || typeof trellis.meta !== "object") trellis.meta = {};
    if (!trellis.meta[entity] || typeof trellis.meta[entity] !== "object") trellis.meta[entity] = {};
    trellis.meta[entity][`assay:${metric}`] = meta;
  }
  return trellis;
}

export {
  entwinesWith,
  graftBranch,
  graftBud,
  graftLeaf,
  graftVine,
  pruneBranch,
  pruneBud,
  pruneLeaf,
  pruneVine,
  assay,
};
