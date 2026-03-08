import { getItemCategoryOrder, normalizeItemCategory } from "./itemCategory"

function normalizeItemName(value, fallback) {
  if (typeof value === "string" && value.trim().length > 0) return value.trim()
  return fallback
}

export function buildShoppingListRecords({
  priorityRecords,
  itemRecords,
  addedAt,
}) {
  const itemById = new Map((Array.isArray(itemRecords) ? itemRecords : []).map((item) => [item.id, item]))

  const baseRecords = (Array.isArray(priorityRecords) ? priorityRecords : [])
    .filter((priorityRecord) => priorityRecord?.recommendation === "restock-soon")
    .map((priorityRecord) => {
      const itemId = String(priorityRecord.itemId)
      const item = itemById.get(itemId) ?? null
      const itemName = normalizeItemName(item?.name, itemId)
      const category = normalizeItemCategory(item?.category, "Other")

      return {
        itemId,
        itemName,
        category,
        rank: -1,
        sourceRecommendation: "restock-soon",
        sourcePriority:
          typeof priorityRecord?.priority === "number" && Number.isFinite(priorityRecord.priority)
            ? priorityRecord.priority
            : 0,
        sourceStatus: typeof priorityRecord?.sourceStatus === "string" ? priorityRecord.sourceStatus : "unknown",
        sourceRank:
          typeof priorityRecord?.rank === "number" && Number.isFinite(priorityRecord.rank)
            ? priorityRecord.rank
            : Number.MAX_SAFE_INTEGER,
        addedAt,
      }
    })

  baseRecords.sort((a, b) => {
    const categoryOrderDiff = getItemCategoryOrder(a.category) - getItemCategoryOrder(b.category)
    if (categoryOrderDiff !== 0) return categoryOrderDiff
    if (a.sourceRank !== b.sourceRank) return a.sourceRank - b.sourceRank
    return a.itemName.localeCompare(b.itemName)
  })

  return baseRecords.map((record, index) => ({
    itemId: record.itemId,
    itemName: record.itemName,
    category: record.category,
    rank: index + 1,
    sourceRecommendation: record.sourceRecommendation,
    sourcePriority: record.sourcePriority,
    sourceStatus: record.sourceStatus,
    addedAt: record.addedAt,
  }))
}
