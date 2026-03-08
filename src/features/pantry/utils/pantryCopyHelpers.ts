type PantryItemLike = {
  id?: unknown
  name?: unknown
}

type RecommendationLike = {
  itemId?: unknown
  recommendation?: unknown
}

function toDisplayName(item: PantryItemLike) {
  const id = typeof item?.id === "string" ? item.id : "item:unknown"
  const rawName = typeof item?.name === "string" ? item.name.trim() : ""
  if (rawName.length > 0) return rawName
  const fromId = id.replace(/^item:/, "").replace(/-/g, " ").trim()
  return fromId.length > 0 ? fromId.charAt(0).toUpperCase() + fromId.slice(1) : id
}

function createNameByIdMap(items: Array<PantryItemLike>) {
  const map = new Map<string, string>()
  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id : null
    if (!id) continue
    map.set(id, toDisplayName(item))
  }
  return map
}

function getExpiringGroups({
  pantryItems,
  recommendations,
}: {
  pantryItems: Array<PantryItemLike>
  recommendations: Array<RecommendationLike>
}) {
  const nameById = createNameByIdMap(pantryItems)
  const useSoon: string[] = []
  const checkItem: string[] = []

  for (const record of recommendations) {
    const itemId = typeof record?.itemId === "string" ? record.itemId : null
    if (!itemId) continue
    const recommendation = typeof record?.recommendation === "string" ? record.recommendation : "none"
    const name = nameById.get(itemId) ?? toDisplayName({ id: itemId })
    if (recommendation === "use-soon") useSoon.push(name)
    if (recommendation === "check-item") checkItem.push(name)
  }

  return { useSoon, checkItem }
}

function formatBulletedList(lines: string[]) {
  return lines.map((line) => `- ${line}`).join("\n")
}

export function buildExpiringItemsCopyText({
  pantryItems,
  recommendations,
}: {
  pantryItems: Array<PantryItemLike>
  recommendations: Array<RecommendationLike>
}) {
  const { useSoon, checkItem } = getExpiringGroups({ pantryItems, recommendations })
  if (useSoon.length === 0 && checkItem.length === 0) {
    return "No items currently marked as use-soon or check-item."
  }

  const sections: string[] = []
  if (useSoon.length > 0) {
    sections.push(`Use soon:\n${formatBulletedList(useSoon)}`)
  }
  if (checkItem.length > 0) {
    sections.push(`Check before consuming:\n${formatBulletedList(checkItem)}`)
  }
  return sections.join("\n\n")
}

export function buildFullPantryCopyText({
  pantryItems,
}: {
  pantryItems: Array<PantryItemLike>
}) {
  const names = pantryItems.map((item) => toDisplayName(item)).filter((name) => name.length > 0)
  if (names.length === 0) {
    return "Current pantry inventory:\n- (empty)"
  }
  return `Current pantry inventory:\n${formatBulletedList(names)}`
}

export function buildRecipePromptCopyText({
  pantryItems,
  recommendations,
}: {
  pantryItems: Array<PantryItemLike>
  recommendations: Array<RecommendationLike>
}) {
  const { useSoon, checkItem } = getExpiringGroups({ pantryItems, recommendations })
  const allNames = pantryItems.map((item) => toDisplayName(item)).filter((name) => name.length > 0)
  const riskNames = new Set([...useSoon, ...checkItem])
  const alsoAvailable = allNames.filter((name) => !riskNames.has(name))

  const lines: string[] = ["I have these ingredients in my pantry and want recipe ideas.", ""]

  if (useSoon.length > 0) {
    lines.push("Use soon:")
    lines.push(formatBulletedList(useSoon))
    lines.push("")
  }

  if (checkItem.length > 0) {
    lines.push("Check before consuming:")
    lines.push(formatBulletedList(checkItem))
    lines.push("")
  }

  if (alsoAvailable.length > 0) {
    lines.push("Also available:")
    lines.push(formatBulletedList(alsoAvailable))
    lines.push("")
  }

  lines.push("Suggest simple meals that prioritize the items I should use soon.")
  return lines.join("\n")
}
