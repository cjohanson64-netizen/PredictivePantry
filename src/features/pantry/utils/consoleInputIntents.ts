export type SourceMeta = {
  kind: "seed" | "user"
  label: string
}

export type NewItemInput = {
  name: string
  quantity: number
  threshold: number
  shelfLifeDays: number
  location: string
  restockPolicy: "always" | "never" | "learn"
  category: string
}

export type ExistingItemInput = {
  itemId: string
  addQuantity: number
  consumeQuantity: number
  threshold: number
  expiringSoonCount: number
  expiredCount: number
  shelfLifeDays?: number
  restockPolicy?: "always" | "never" | "learn"
  category?: string
}

function toSlug(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
}

function asNonNegativeNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

function asPositiveNumber(value: number) {
  return Number.isFinite(value) ? Math.max(0, value) : 0
}

export function deriveItemIdFromName(name: string) {
  const slug = toSlug(name)
  return slug.length > 0 ? `item:${slug}` : ""
}

export function buildAddNewItemPayload(input: NewItemInput) {
  const itemId = deriveItemIdFromName(input.name)
  return {
    itemId,
    name: input.name.trim(),
    quantity: asPositiveNumber(input.quantity),
    location: input.location.trim() || "location:unknown",
    lowStockThreshold: asNonNegativeNumber(input.threshold),
    shelfLifeDays: Math.max(1, asNonNegativeNumber(input.shelfLifeDays)),
    restockPolicy: input.restockPolicy,
    category: typeof input.category === "string" && input.category.length > 0 ? input.category : "Other",
    source: {
      kind: "user",
      label: "console-input",
    } as SourceMeta,
  }
}

export function buildAddExistingQuantityPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    quantity: asPositiveNumber(input.addQuantity),
    source: {
      kind: "user",
      label: "console-input",
    } as SourceMeta,
  }
}

export function buildConsumeQuantityPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    amount: asPositiveNumber(input.consumeQuantity),
  }
}

export function buildUpdateThresholdPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    quantity: 0,
    lowStockThreshold: asNonNegativeNumber(input.threshold),
    source: {
      kind: "user",
      label: "console-input",
    } as SourceMeta,
  }
}

export function buildUpdateExpirationPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    quantity: 0,
    expiringSoonCount: asNonNegativeNumber(input.expiringSoonCount),
    expiredCount: asNonNegativeNumber(input.expiredCount),
    source: {
      kind: "user",
      label: "console-input",
    } as SourceMeta,
  }
}

export function buildAnalyzeItemPayload(itemId: string) {
  return {
    itemId,
  }
}

export function buildUpdateRestockPolicyPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    policy: input.restockPolicy ?? "learn",
  }
}

export function buildUpdateItemCategoryPayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    category: input.category ?? "Other",
  }
}

export function buildUpdateItemNamePayload(input: { itemId: string; name: string }) {
  return {
    itemId: input.itemId,
    name: typeof input.name === "string" ? input.name.trim() : "",
  }
}

export function buildRemoveItemPayload(input: { itemId: string }) {
  return {
    itemId: input.itemId,
  }
}

export function buildUpdateItemShelfLifePayload(input: ExistingItemInput) {
  return {
    itemId: input.itemId,
    shelfLifeDays: asNonNegativeNumber(input.shelfLifeDays ?? 0),
  }
}
