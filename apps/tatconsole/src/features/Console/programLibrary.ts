export type ProgramEntry = {
  id: string
  title: string
  description: string
  source: string
}

export const PROGRAMS: ProgramEntry[] = [
  {
    id: "seed-graft",
    title: "Seed + Graft Branch",
    description: 'Create a graph and link A -> B using entwinesWith.',
    source: `
@seed:
  nodes: ["A", "B"]
  edges: []
  state: {}
  meta: {}
  root: "A"

g := @seed
g -> @graft.branch("A", "entwinesWith", "B")
`,
  },
  {
    id: "all-grafts-prunes",
    title: "All Grafts + Prunes + Assay",
    description: "Touch all canonical ops once.",
    source: `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  state: {}
  meta: {}
  root: "order"

g := @seed

g
  -> @graft.branch("order", "entwinesWith", "invoice")
  -> @graft.bud("order", "lifecycle", "shipped")
  -> @graft.leaf("order", "label", "priority")
  -> @graft.vine("order", "lifecycle", "shipped", "delivered", "trail:manual")
  -> @assay("order", "latency_ms", 120, "p50-ish")

g
  -> @prune.leaf("order", "label")
  -> @prune.vine("order", "lifecycle")
  -> @prune.branch("order", "entwinesWith", "invoice")
`,
  },
  {
    id: "guard-pass-fail",
    title: "@guard pass/fail",
    description: "Guard blocks when node is missing; applies when present.",
    source: `
@seed:
  nodes: ["order", "invoice"]
  edges: []
  state: {}
  meta: {}
  root: "order"

g := @seed
order := "order"
missing := "missing"

doer := @action([n], { link: entwinesWith }) {
  graft.branch(n, link, "invoice")
}

a := @guard(missing, doer)
b := @guard(order, doer)

b
`,
  },
  {
    id: "action-ctx",
    title: "@action + @ctx",
    description: "Lexical params + ctx env/meta proof.",
    source: `
@seed:
  nodes: ["A", "B"]
  edges: []
  state: {}
  meta: {}
  root: "A"

g := @seed

g -> @action([a, b], { link: entwinesWith }) {
  graft.branch(a, link, b)
  assay(a, "ctx_debug", @ctx.env.debug ? 1 : 0)
  graft.leaf(a, "source_len", @ctx.meta.source.length)
}
`,
  },
]