import { parseProgram } from "../parser/parser.js";
import { runProgram } from "./runtime.js";

function runTat(
  source: string,
  _input?: any,
  { trace = false }: { trace?: boolean } = {},
) {
  const ast = parseProgram(source);
  return runProgram(ast, {
    trace,
    source,
    meta: {
      source,
    },
  });
}

export { runTat };
