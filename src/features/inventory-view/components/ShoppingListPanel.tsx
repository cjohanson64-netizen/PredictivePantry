type ShoppingListPanelProps = {
  shoppingList: Record<string, unknown>
  categoryOptions: string[]
  onGenerateShoppingList: () => void
  showDebugJson: boolean
  debugShoppingListRecords: Array<Record<string, unknown>>
}

export default function ShoppingListPanel({
  shoppingList,
  categoryOptions,
  onGenerateShoppingList,
  showDebugJson,
  debugShoppingListRecords,
}: ShoppingListPanelProps) {
  const records = Array.isArray(shoppingList?.records) ? shoppingList.records : []

  const grouped = categoryOptions
    .map((category) => ({
      category,
      records: records.filter((record) => String(record?.category ?? "Other") === category),
    }))
    .filter((group) => group.records.length > 0)

  return (
    <section className="shopping-list-panel">
      <div className="shopping-list-panel-header">
        <h2>Shopping List</h2>
      </div>
      <div className="recommendations-panel-actions">
        <button className="recommendations-panel-button" onClick={onGenerateShoppingList}>
          Generate Shopping List
        </button>
      </div>

      <div className="shopping-list-panel-content">
        {grouped.length === 0 ? (
          <div className="shopping-list-empty">No shopping items yet.</div>
        ) : (
          <div className="shopping-list-groups">
            {grouped.map((group) => (
              <div key={group.category} className="shopping-list-group">
                <h3 className="shopping-list-group-title">{group.category}</h3>
                <ul className="shopping-list-items">
                  {group.records.map((record) => (
                    <li key={String(record?.itemId)} className="shopping-list-item">
                      {String(record?.itemName ?? record?.itemId ?? "Unknown Item")}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}

        {showDebugJson ? (
          <div className="panel-debug-json">
            <div className="panel-debug-json-section">
              <div className="panel-debug-json-title">Shopping List</div>
              <pre className="panel-json">{JSON.stringify(debugShoppingListRecords, null, 2)}</pre>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  )
}
