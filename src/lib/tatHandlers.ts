export type TatHandlerContext = {
  featureName: string
  programName: string
  actionName: string
  payload: Record<string, unknown>
  state: Record<string, unknown>
  eventLog: Array<Record<string, unknown>>
  utils: Record<string, unknown>
  runtime: Record<string, unknown>
  meta: Record<string, unknown>
}

export type TatHandlerResult = {
  ok: boolean
  stateUpdates: Record<string, unknown>
  events: Array<Record<string, unknown>>
  outputs: Array<Record<string, unknown>>
  errors: Array<Record<string, unknown>>
  warnings: Array<Record<string, unknown>>
}

export type TatHandler = (context: TatHandlerContext) => TatHandlerResult

export function createTatHandlerResult(partial: Partial<TatHandlerResult> = {}): TatHandlerResult {
  return {
    ok: partial.ok ?? true,
    stateUpdates: partial.stateUpdates ?? {},
    events: partial.events ?? [],
    outputs: partial.outputs ?? [],
    errors: partial.errors ?? [],
    warnings: partial.warnings ?? [],
  }
}
