import { runTat } from "../dist/index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertGraphShape(value, label) {
  assert(value && typeof value === "object", `${label}: expected object`);
  assert(Array.isArray(value.nodes), `${label}: nodes must be an array`);
  assert(Array.isArray(value.edges), `${label}: edges must be an array`);
  assert(Object.prototype.hasOwnProperty.call(value, "root"), `${label}: root must exist`);
}

function runExample(name, source, check) {
  const out = runTat(source);
  check(out.value);
  console.log(`[ok] ${name}`);
}

const ex1 = `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  root: "order"

g := @seed
g -> @graft.branch("order", "entwinesWith", "invoice")
`;

const ex2 = `
@seed:
  nodes: ["score", "note:1"]
  edges: []
  state: {}
  meta: {}
  trail: []
  root: "score"

t := @seed
t
  -> @graft.branch("score", "entwinesWith", "note:1")
  -> @graft.bud("note:1", "velocity", 84)
  -> @graft.bud("note:1", "phase", "draft")
  -> @graft.leaf("note:1", "label", "accent")
  -> @graft.vine("note:1", "phase", "draft", "final", "trace")
  -> @assay("note:1", "stability", 0.97, { source: "smoke" })
  -> @prune.leaf("note:1", "label")
  -> @prune.bud("note:1", "velocity")
  -> @prune.vine("note:1", "phase")
  -> @prune.branch("score", "entwinesWith", "note:1")
`;

const ex3 = `
@action(
  params: ["note:1", "note:2"],
  handlers: { branch: "entwinesWith" },
  body: "params are nodes, handlers are edges"
)
`;

const ex4 = `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  state: {}
  meta: {}
  root: "order"

g := @seed
g -> @action([order, invoice], { link: entwinesWith }) {
  graft.branch(order, link, invoice)
  assay(order, "ctx_debug", @ctx?.env?.debug ? 1 : 0)
}
`;

const ex5 = `
@seedgraph({
  nodes: ["A"],
  edges: [],
  state: {},
  meta: {},
  trail: [],
  root: "A",
  weights: { default: 0.9, motifs: { "motif:why": 0.1 } }
})
`;

const ex6 = `
@seedgraph({
  nodes: ["A"],
  edges: [],
  state: {},
  meta: {},
  trail: [],
  root: "A",
  weights: { default: 0.9, motifs: { "motif:why": 0.1 } }
}) -> @reroot(node: "A") -> @select(nodes: ["A"])
`;

runExample("example 1: graft.branch + entwinesWith", ex1, (value) => {
  assertGraphShape(value, "example 1");
  assert(value.edges.some((e) => Array.isArray(e) && e[0] === "order" && e[1] === "entwinesWith"), "example 1: missing entwinesWith edge");
});

runExample("example 2: all grafts + assay + prunes", ex2, (value) => {
  assertGraphShape(value, "example 2");
  assert(value.state?.["note:1"]?.phase === null, "example 2: expected prune.vine to null phase");
  assert(value.meta?.["note:1"]?.["assay:stability"]?.source === "smoke", "example 2: expected assay meta");
});

runExample("example 3: @action scaffold", ex3, (value) => {
  assert(value?.kind === "action.scaffold", "example 3: expected action scaffold");
  assert(Array.isArray(value.params) && value.params.length === 2, "example 3: expected params");
  assert(value.handlers?.branch === "entwinesWith", "example 3: expected handlers");
});

runExample("example 4: @action lexical + @ctx", ex4, (value) => {
  assertGraphShape(value, "example 4");
  assert(
    value.edges.some(
      (e) => Array.isArray(e) && e[0] === "order" && e[1] === "entwinesWith" && e[2] === "invoice",
    ),
    "example 4: expected graft.branch edge",
  );
  assert(value.state?.order?.ctx_debug === 0 || value.state?.order?.ctx_debug === 1, "example 4: expected ctx_debug assay");
});

runExample("example 5: seedgraph keeps weights", ex5, (value) => {
  assertGraphShape(value, "example 5");
  assert(value.weights?.default === 0.9, "example 5: expected weights.default");
  assert(value.weights?.motifs?.["motif:why"] === 0.1, "example 5: expected motif weight");
});

runExample("example 6: weights survive reroot/select", ex6, (value) => {
  assertGraphShape(value, "example 6");
  assert(value.weights?.default === 0.9, "example 6: expected weights.default");
  assert(value.weights?.motifs?.["motif:why"] === 0.1, "example 6: expected motif weight");
});

console.log("[done] locked language smoke checks passed");
