import { runTat } from "@tryangletree/core"
import { pantryTatRegistry } from "../data/registry"

let cachedResolverNodes = null

function toStatusNode(entryKey, entryState) {
  const status = String(entryKey).replace(/^status:/, "")
  const weight = Number(entryState?.weight)
  const flag = String(entryState?.flag ?? "")

  if (!status || !Number.isFinite(weight) || !flag) {
    return null
  }

  return {
    status,
    weight,
    flag,
  }
}

/**
 * Retrieves the compiled TAT source for the resolver program from the registry.
 * This uses the parsed TatProgram.source (the body after the --- divider in the
 * spec file), which is pure executable TAT — never the raw spec file with its
 * YAML-style header. Passing the full spec file to runTat() would cause a
 * parser error ("Trailing characters near: : resolveItemStatus") because runTat
 * calls parseProgram() directly and does not understand spec headers.
 */
function getResolverTatSource() {
  const entry = pantryTatRegistry.programs?.resolveItemStatus
  const source = entry?.tatProgram?.source
  if (!source || typeof source !== "string") {
    throw new Error(
      "resolveItemStatus: tatProgram.source missing from registry. " +
        "Ensure resolve-item-status.tat is registered with createTatProgram()."
    )
  }
  return source
}

function getResolverNodesFromTat() {
  if (Array.isArray(cachedResolverNodes)) {
    return cachedResolverNodes
  }

  const source = getResolverTatSource()
  const result = runTat(source)
  const graph = result?.value ?? result
  const state = graph?.state ?? {}

  const nodes = Object.entries(state)
    .filter(([key]) => String(key).startsWith("status:"))
    .map(([key, nodeState]) => toStatusNode(key, nodeState))
    .filter((node) => !!node)
    .sort((a, b) => b.weight - a.weight)

  cachedResolverNodes = nodes
  return nodes
}

export function resolveItemStatusFromTat({ flags }) {
  const resolverNodes = getResolverNodesFromTat()

  const active = resolverNodes.filter((node) => flags?.[node.flag] === true)
  if (active.length === 0) {
    return {
      status: "healthy",
      weightedMatches: [],
    }
  }

  return {
    status: active[0].status,
    weightedMatches: active,
  }
}