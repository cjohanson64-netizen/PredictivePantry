export const ITEM_CATEGORIES = [
  "Produce",
  "Dairy",
  "Meat",
  "Seafood",
  "Bakery",
  "Pantry",
  "Frozen",
  "Snacks",
  "Beverages",
  "Household",
  "Other",
]

export const CATEGORY_DEFAULT_SHELF_LIFE_DAYS = {
  Produce: 7,
  Dairy: 14,
  Meat: 5,
  Seafood: 3,
  Bakery: 6,
  Pantry: 180,
  Frozen: 90,
  Snacks: 60,
  Beverages: 30,
  Household: 30,
  Other: 30,
}

const ITEM_CATEGORY_SET = new Set(ITEM_CATEGORIES)
const ITEM_CATEGORY_ORDER = new Map(ITEM_CATEGORIES.map((category, index) => [category, index]))

export function normalizeItemCategory(value, fallback = "Other") {
  if (typeof value === "string" && ITEM_CATEGORY_SET.has(value)) return value
  return fallback
}

export function getItemCategoryOrder(category) {
  return ITEM_CATEGORY_ORDER.get(category) ?? ITEM_CATEGORY_ORDER.get("Other") ?? ITEM_CATEGORIES.length - 1
}

export function getDefaultShelfLifeDays(category) {
  const normalizedCategory = normalizeItemCategory(category, "Other")
  return CATEGORY_DEFAULT_SHELF_LIFE_DAYS[normalizedCategory] ?? CATEGORY_DEFAULT_SHELF_LIFE_DAYS.Other
}
