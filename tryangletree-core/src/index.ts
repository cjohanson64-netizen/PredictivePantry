import { parseProgram } from './parser/parser.js';
import { runTat } from './runtime/runTat.js';
import { coreRegistry } from './registry/coreRegistry.js';
import { valueBuiltins } from './runtime/runtime.js';

export const parseTat = (source: string) => parseProgram(source);

export { runTat };
export { coreRegistry };

export * as builtInOps from './ops/index.js';
export { valueBuiltins };
export { actionDirective } from './runtime/action.js';
export { guardDirective } from './runtime/guard.js';

export * as graphUtils from './graph/index.js';

export { err, invariant } from './runtime/errors.js';
export type { TATGardenError } from './runtime/errors.js';

export type {
  ArtifactEnvelope,
  GraphContract,
  WeightContract,
  RunTatResult,
  Node,
  NodeId,
  Edge,
  GraphLike,
  Registry,
  RuntimeContext,
  ActionScaffold,
} from './runtime/types.js';
