import { useMemo, useState } from "react"
import {
  buildExpiringItemsCopyText,
  buildFullPantryCopyText,
  buildRecipePromptCopyText,
} from "../../pantry/utils/pantryCopyHelpers"

type RecommendationsPanelProps = {
  pantryItems: Array<Record<string, unknown>>
  recommendations: Array<Record<string, unknown>>
  priorities: Array<Record<string, unknown>>
  onMakeRecommendations: () => void
  onRankPriorities: () => void
  onResolveRecommendation: (args: {
    itemId: string
    recommendation: "check-item" | "use-soon" | "restock-soon"
    resolution: "still-good" | "discarded" | "used" | "done" | "bought"
    quantity?: number
  }) => void
  onRequestFreshStockForRecommendation: (itemId: string) => void
  showDebugJson: boolean
  debugItemAnalysisRecords: Array<Record<string, unknown>>
  debugRecommendationRecords: Array<Record<string, unknown>>
  debugPriorityRecords: Array<Record<string, unknown>>
}

function itemNameById(items: Array<Record<string, unknown>>) {
  const map = new Map<string, string>()
  for (const item of items) {
    const id = typeof item?.id === "string" ? item.id : null
    if (!id) continue
    const name = typeof item?.name === "string" && item.name.trim().length > 0 ? item.name.trim() : id
    map.set(id, name)
  }
  return map
}

export default function RecommendationsPanel({
  pantryItems,
  recommendations,
  priorities,
  onMakeRecommendations,
  onRankPriorities,
  onResolveRecommendation,
  onRequestFreshStockForRecommendation,
  showDebugJson,
  debugItemAnalysisRecords,
  debugRecommendationRecords,
  debugPriorityRecords,
}: RecommendationsPanelProps) {
  const [copyFeedback, setCopyFeedback] = useState<string | null>(null)

  const namesById = useMemo(() => itemNameById(pantryItems), [pantryItems])

  const actionableRecommendations = useMemo(
    () =>
      recommendations.filter((record) => {
        const recommendation = String(record?.recommendation ?? "none")
        return recommendation === "check-item" || recommendation === "use-soon" || recommendation === "restock-soon"
      }),
    [recommendations],
  )

  async function copyText(text: string, successMessage: string) {
    try {
      if (!navigator?.clipboard?.writeText) throw new Error("Clipboard API unavailable")
      await navigator.clipboard.writeText(text)
      setCopyFeedback(successMessage)
    } catch {
      setCopyFeedback("Copy failed")
    }
  }

  return (
    <section className="recommendations-panel">
      <div className="recommendations-panel-header">
        <h2>Recommendations</h2>
      </div>

      <div className="recommendations-panel-toolbar">
        <div className="recommendations-panel-primary-actions">
          <button className="recommendations-panel-button recommendations-panel-button--primary" onClick={onMakeRecommendations}>
            Refresh AI
          </button>
          <button className="recommendations-panel-button recommendations-panel-button--primary" onClick={onRankPriorities}>
            Rank Priorities
          </button>
        </div>
        <div className="recommendations-panel-secondary-actions">
          <button
            className="recommendations-panel-button recommendations-panel-button--secondary"
            onClick={() =>
              copyText(buildExpiringItemsCopyText({ pantryItems, recommendations }), "Copied expiring items")
            }
          >
            Copy Expiring Items
          </button>
          <button
            className="recommendations-panel-button recommendations-panel-button--secondary"
            onClick={() => copyText(buildFullPantryCopyText({ pantryItems }), "Copied pantry list")}
          >
            Copy Full Pantry
          </button>
          <button
            className="recommendations-panel-button recommendations-panel-button--secondary"
            onClick={() =>
              copyText(buildRecipePromptCopyText({ pantryItems, recommendations }), "Copied recipe prompt")
            }
          >
            Copy Recipe Prompt
          </button>
        </div>
      </div>
      {copyFeedback ? <div className="recommendations-panel-copy-feedback">{copyFeedback}</div> : null}

      <div className="recommendations-panel-content">
        {actionableRecommendations.length > 0 ? (
          <div className="recommendations-panel-lines">
            {actionableRecommendations.map((record) => {
              const itemId = String(record.itemId ?? "")
              const itemName = namesById.get(itemId) ?? itemId
              const recommendation = String(record.recommendation ?? "none")
              const line =
                recommendation === "check-item"
                  ? `Check ${itemName} before consuming`
                  : recommendation === "use-soon"
                    ? `Use ${itemName} soon`
                    : `Restock ${itemName}`

              return (
                <div key={`${itemId}:${recommendation}`} className="recommendations-panel-card">
                  <div className="recommendations-panel-line">{line}</div>
                  <div className="recommendations-panel-card-actions">
                    {recommendation === "check-item" ? (
                      <>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() =>
                            onResolveRecommendation({
                              itemId,
                              recommendation: "check-item",
                              resolution: "still-good",
                            })
                          }
                        >
                          Still Good
                        </button>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() =>
                            onResolveRecommendation({
                              itemId,
                              recommendation: "check-item",
                              resolution: "discarded",
                            })
                          }
                        >
                          Discarded
                        </button>
                      </>
                    ) : null}
                    {recommendation === "use-soon" ? (
                      <>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() =>
                            onResolveRecommendation({
                              itemId,
                              recommendation: "use-soon",
                              resolution: "used",
                            })
                          }
                        >
                          Used
                        </button>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() =>
                            onResolveRecommendation({
                              itemId,
                              recommendation: "use-soon",
                              resolution: "done",
                            })
                          }
                        >
                          Done
                        </button>
                      </>
                    ) : null}
                    {recommendation === "restock-soon" ? (
                      <>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() => onRequestFreshStockForRecommendation(itemId)}
                        >
                          Bought
                        </button>
                        <button
                          className="recommendations-panel-button recommendations-panel-button--secondary"
                          onClick={() =>
                            onResolveRecommendation({
                              itemId,
                              recommendation: "restock-soon",
                              resolution: "done",
                            })
                          }
                        >
                          Done
                        </button>
                      </>
                    ) : null}
                  </div>
                </div>
              )
            })}
          </div>
        ) : (
          <div className="recommendations-panel-empty">No actionable recommendations right now.</div>
        )}
      </div>

      {showDebugJson ? (
        <div className="panel-debug-json">
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Analysis</div>
            <pre className="panel-json">{JSON.stringify(debugItemAnalysisRecords, null, 2)}</pre>
          </div>
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Recommendations</div>
            <pre className="panel-json">{JSON.stringify(debugRecommendationRecords, null, 2)}</pre>
          </div>
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Priorities</div>
            <pre className="panel-json">{JSON.stringify(debugPriorityRecords, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </section>
  )
}
