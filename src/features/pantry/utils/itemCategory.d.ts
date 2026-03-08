export const ITEM_CATEGORIES: string[]
export const CATEGORY_DEFAULT_SHELF_LIFE_DAYS: Record<string, number>
export function normalizeItemCategory(value: unknown, fallback?: string): string
export function getItemCategoryOrder(category: string): number
export function getDefaultShelfLifeDays(category: string): number
