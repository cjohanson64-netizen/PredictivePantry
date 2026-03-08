function normalizeCoreResult(out) {
  if (out && typeof out === "object" && out.ok === true && out.value && out.value.graph) {
    return out.value.graph;
  }
  if (out && typeof out === "object" && out.ok === true && Object.prototype.hasOwnProperty.call(out, "value")) {
    return out.value;
  }
  return out;
}

export { normalizeCoreResult };
