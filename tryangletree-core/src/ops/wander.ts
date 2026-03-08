import { err } from "../runtime/errors.js";
import { expectGraph } from "../graph/graphShape.js";

function mulberry32(seed) {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = Math.imul(t ^ (t >>> 15), t | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function pickWeightedIndex(weights, rand) {
  const total = weights.reduce((a, b) => a + b, 0);
  if (!(total > 0)) return -1;
  let r = rand() * total;
  for (let i = 0; i < weights.length; i++) {
    r -= weights[i];
    if (r <= 0) return i;
  }
  return weights.length - 1;
}

function wanderCore({ input, args }) {
  expectGraph(input, "Wander");

  const steps = Number(args.steps);
  if (!Number.isInteger(steps) || steps <= 0) err("Wander expects steps as a positive integer");
  if (!input.root) err("Wander requires input.root");

  const strategy = args.strategy ?? "random";
  if (strategy !== "random" && strategy !== "weighted") {
    err('Wander strategy must be "random" or "weighted"');
  }

  const weights = args.weights ?? {};
  if (weights && typeof weights === "object") {
    for (const [k, v] of Object.entries(weights)) {
      if (!Number.isFinite(Number(v))) err(`Wander weight must be finite for edge: ${k}`);
    }
  } else if (args.weights != null) {
    err("Wander weights must be an object");
  }

  const rand = Number.isInteger(Number(args.seed))
    ? mulberry32(Number(args.seed))
    : Math.random;

  const adj = {};
  for (const n of input.nodes) adj[n] = [];
  for (const [a, b] of input.edges) {
    if (!adj[a]) adj[a] = [];
    adj[a].push(b);
  }

  const path = [];
  let cur = input.root;
  for (let i = 0; i < steps; i++) {
    path.push(cur);
    const nexts = adj[cur] ?? [];
    if (!nexts.length) break;

    if (strategy === "random") {
      const idx = Math.floor(rand() * nexts.length);
      cur = nexts[idx];
      continue;
    }

    const w = nexts.map((nxt) => {
      const key = `${cur}→${nxt}`;
      const val = weights[key];
      return Number.isFinite(Number(val)) ? Number(val) : 1;
    });
    const idx = pickWeightedIndex(w, rand);
    cur = idx >= 0 ? nexts[idx] : nexts[Math.floor(rand() * nexts.length)];
  }

  return path;
}

export { wanderCore };
