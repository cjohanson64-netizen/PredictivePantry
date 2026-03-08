# @tryangletree/core

Standalone TAT v1.1 language engine extracted from the Language app.

## Locked v0.X Language Spec

Canonical botanical tokens:

- `@graft.branch(a, via, b)`
- `@graft.bud(node, key, value)`
- `@graft.leaf(node, key, value)`
- `@graft.vine(node, key, from, to, trail?)`
- `@prune.branch(a, via, b)`
- `@prune.bud(node, key)`
- `@prune.leaf(node, key)`
- `@prune.vine(node, key)`
- `@assay(subject, metric, value, meta?)`

Locked relation token for structural branch edges: `entwinesWith`.

Trellis programs are graph-compatible and must produce at least:

```ts
{ nodes: [], edges: [], root }
```

Canonical `@action` syntax is reserved as:

```tat
@action([params], { handlers }) { ... }
```

Semantics lock:

- `params` are nodes
- `handlers` are edges

`@ctx` is a stable runtime context object per run, available in actions/ops. It influences behavior, not graph identity.

Current parser/runtime support executable `@action(...) { ... }` bodies with lexical bindings.

Tiny working example:

```tat
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
```

## Build

```bash
npm install
npm run build
```

## Usage

```ts
import { runTat } from "@tryangletree/core";

const tatSource = `
@g:
  nodes: ["A", "B"]
  edges: [["A", "B"]]
  root: "A"

g := @g
g -> @wander(steps: 2)
`;

const result = runTat(tatSource);
console.log(result.value);
console.log(result.artifacts);
```

## Smoke Examples

Run locked-language smoke checks:

```bash
npm run smoke:locked-spec
```

From monorepo root:

```bash
npm --prefix tryangletree-core run smoke:locked-spec
```
