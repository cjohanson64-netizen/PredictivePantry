import { runTat } from "../dist/index.js";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function assertGraph(value, label) {
  assert(value && typeof value === "object", `${label}: expected object`);
  assert(Array.isArray(value.nodes), `${label}: expected nodes`);
  assert(Array.isArray(value.edges), `${label}: expected edges`);
}

function runCase(name, source, check) {
  const out = runTat(source);
  check(out.value, out);
  console.log(`[ok] ${name}`);
}

const seed = `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  state: {}
  meta: {}
  root: "order"

g := @seed
order := "order"
`;

// Callable action contract referenced by symbol.
const setupCallable = `
doer := @action(
  params: [n],
  handlers: { link: entwinesWith },
  body: "graft.branch(n, link, invoice)"
)
`;

runCase(
  "A missing symbol => null",
  `
${seed}
${setupCallable}
x := "missing"
out := @guard(x, doer)
out
`,
  (value) => {
    assert(value === null, "case A should return null");
  },
);

runCase(
  "B non-callable thunk => null",
  `
${seed}
x := "order"
out := @guard(x, x)
out
`,
  (value) => {
    assert(value === null, "case B should return null");
  },
);

runCase(
  "C callable action runs",
  `
${seed}
${setupCallable}
out := @guard(order, doer)
out
`,
  (value) => {
    assertGraph(value, "case C");
    assert(
      value.edges.some((e) => Array.isArray(e) && e[0] === "order" && e[1] === "entwinesWith"),
      "case C should add guarded edge",
    );
  },
);

runCase(
  "D guard works inside action lexical scope",
  `
${seed}
${setupCallable}
runner := @action(
  params: [n],
  handlers: { link: entwinesWith },
  body: "guard(n, doer)"
)
out := @guard(order, runner)
out
`,
  (value) => {
    assertGraph(value, "case D");
    assert(
      value.edges.some((e) => Array.isArray(e) && e[0] === "order" && e[1] === "entwinesWith"),
      "case D should execute guarded action in lexical scope",
    );
  },
);

runCase(
  "E repro: a null, b guarded action graph",
  `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  state: {}
  meta: {}
  root: "order"

g := @seed
order := "order"

doer := @action(
  params: [n],
  handlers: { link: entwinesWith },
  body: "graft.branch(n, link, invoice)"
)

missing := "missing"
a := @guard(missing, doer)
b := @guard(order, doer)
{ a: a, b: b }
`,
  (value) => {
    assert(value && typeof value === "object", "case E: expected object payload");
    assert(value.a === null, "case E: expected a === null");
    assertGraph(value.b, "case E.b");
    assert(
      value.b.edges.some((e) => Array.isArray(e) && e[0] === "order" && e[1] === "entwinesWith"),
      "case E: expected guarded edge in b",
    );
  },
);

console.log("[done] guard smoke checks passed");
