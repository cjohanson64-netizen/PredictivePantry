export type TATGardenError = Error & { meta?: unknown };

function err(msg: string, meta?: unknown): never {
  const e = new Error(msg) as TATGardenError;
  e.name = "TAT_GARDEN_ERROR";
  if (meta !== undefined) e.meta = meta;
  throw e;
}

function invariant(cond: unknown, msg: string, meta?: unknown): void {
  if (!cond) err(msg, meta);
}

export { err, invariant };
