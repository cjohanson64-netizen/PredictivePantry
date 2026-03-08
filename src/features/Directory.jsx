import { pantryTatRegistry } from "./pantry/data/registry"

const featureRegistries = [pantryTatRegistry]

const seedProfileValue = String(import.meta.env.VITE_TAT_SEED_PROFILE ?? "none").toLowerCase()
const activeSeedProfile = seedProfileValue === "demo" ? "demo" : "none"

function splitProgramId(programId) {
  const [featureName, programKey] = String(programId).split(".")
  return { featureName, programKey }
}

function getRegistryByFeature(featureName) {
  return featureRegistries.find((registry) => registry.featureName === featureName) ?? null
}

function getProgramById(programId) {
  const { featureName, programKey } = splitProgramId(programId)
  const registry = getRegistryByFeature(featureName)
  if (!registry) return null
  const program = registry.programs?.[programKey]
  if (!program) return null
  return { registry, featureName, programKey, program }
}

export function resolveTatProgramSource(programId) {
  const found = getProgramById(programId)
  if (!found) {
    throw new Error(`Unknown TAT program: ${programId}`)
  }

  const { registry, programKey, program } = found

  if (registry.handlers?.buildProgram) {
    return registry.handlers.buildProgram(programKey, {
      seedProfile: activeSeedProfile,
      resolveProgramSource: resolveTatProgramSource,
    })
  }

  return String(program.tatProgram?.source ?? "").trim()
}

export function resolveTatProgramDescriptor(programId) {
  const found = getProgramById(programId)
  if (!found) {
    throw new Error(`Unknown TAT program: ${programId}`)
  }

  const { registry, featureName, programKey, program } = found

  return {
    id: `${featureName}.${programKey}`,
    featureName,
    programName: programKey,
    title: program?.title ?? program?.tatProgram?.program ?? programKey,
    description: program?.description ?? program?.tatProgram?.purpose ?? "",
    runtimeActions: Array.isArray(program?.runtimeActions) ? program.runtimeActions : [],
    handlers: registry.handlers ?? {},
    meta: registry.meta ?? {},
    tatProgram: program?.tatProgram ?? null,
  }
}

export function listTatPrograms() {
  const out = []
  for (const registry of featureRegistries) {
    for (const [programKey, program] of Object.entries(registry.programs ?? {})) {
      if (program?.internal) continue
      out.push({
        id: `${registry.featureName}.${programKey}`,
        title: program?.title ?? program?.tatProgram?.program ?? programKey,
        description: program?.description ?? program?.tatProgram?.purpose ?? "",
      })
    }
  }
  return out
}

export function getTatDirectoryEntryProgramId() {
  const firstRegistry = featureRegistries[0]
  if (!firstRegistry) {
    throw new Error("No feature registries configured in Directory.jsx")
  }
  return `${firstRegistry.featureName}.${firstRegistry.entryProgram}`
}

export function getActiveTatSeedProfile() {
  return activeSeedProfile
}

export { featureRegistries as tatFeatureRegistries }
