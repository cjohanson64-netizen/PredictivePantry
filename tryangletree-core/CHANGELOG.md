# Changelog

## Unreleased

### Added
- Added optional seed weights priority map; preserved through normalization and ops.

## v0.2.0 - 2026-02-28

### Added
- Dotted botanical tokens: `graft.branch`, `graft.bud`, `graft.leaf`, `graft.vine`, `prune.branch`, `prune.bud`, `prune.leaf`, `prune.vine`, `assay`.
- `@action` execution with lexical bindings where `params` resolve as node symbols and `handlers` resolve as edge/relation aliases.
- `@ctx` directive and runtime context plumbing, stable per run and accessible from actions and ops.
- Graph boundary normalization for compatibility between canonical trellis outputs and legacy graph consumers.
- Locked-spec smoke examples, including `@action` + `@ctx` coverage.

### Notes
- Backward-compatible legacy registry keys are preserved.
