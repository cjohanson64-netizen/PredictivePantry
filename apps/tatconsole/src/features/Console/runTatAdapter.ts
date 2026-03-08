import { runTat } from "@tryangletree/core"

export type RunTatOptions = {
  trace?: boolean
  mode?: string
  flags?: Record<string, boolean>
  meta?: Record<string, any>
}

export type RunTatResult = {
  ok: boolean
  value?: any
  artifacts?: any
  error?: { message: string; stack?: string }
  ms: number
}

/**
 * Adapter layer: app stays stable even if core result shape evolves.
 */
export function runTatSafe(source: string, opts: RunTatOptions = {}): RunTatResult {
  const t0 = performance.now()
  try {
    // Note: core runTat currently accepts (source, _input?, options)
    const result: any = runTat(source, undefined, opts as any)
    const t1 = performance.now()

    return {
      ok: true,
      value: result?.value ?? result,
      artifacts: result?.artifacts ?? null,
      ms: Math.round((t1 - t0) * 1000) / 1000,
    }
  } catch (e: any) {
    const t1 = performance.now()
    return {
      ok: false,
      error: { message: String(e?.message ?? e), stack: e?.stack },
      ms: Math.round((t1 - t0) * 1000) / 1000,
    }
  }
}