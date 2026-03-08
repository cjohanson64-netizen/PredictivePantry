import { useMemo, useState } from "react"

type BatchRow = {
  itemId: string
  itemName: string
  healthyCount: number
  totalQuantity: number
}

type BatchFreshInventoryModalProps = {
  rows: BatchRow[]
  onCancel: () => void
  onConfirm: (entries: Array<{ itemId: string; quantity: number }>) => void
}

export default function BatchFreshInventoryModal({
  rows,
  onCancel,
  onConfirm,
}: BatchFreshInventoryModalProps) {
  const [quantitiesByItemId, setQuantitiesByItemId] = useState<Record<string, string>>({})
  const [error, setError] = useState<string | null>(null)

  const selectedCount = useMemo(
    () =>
      rows.reduce((count, row) => {
        const raw = quantitiesByItemId[row.itemId]
        if (raw == null || raw === "") return count
        const parsed = Number(raw)
        if (!Number.isFinite(parsed) || parsed <= 0) return count
        return count + 1
      }, 0),
    [rows, quantitiesByItemId],
  )

  function handleConfirm() {
    const entries: Array<{ itemId: string; quantity: number }> = []
    for (const row of rows) {
      const raw = quantitiesByItemId[row.itemId]
      if (raw == null || raw.trim() === "") continue
      const parsed = Number(raw)
      if (!Number.isFinite(parsed) || parsed < 0 || !Number.isInteger(parsed)) {
        setError("All quantities must be whole numbers 0 or greater.")
        return
      }
      if (parsed > 0) {
        entries.push({
          itemId: row.itemId,
          quantity: parsed,
        })
      }
    }
    if (entries.length === 0) {
      setError("Enter a quantity greater than 0 for at least one item.")
      return
    }
    onConfirm(entries)
  }

  return (
    <div className="fresh-inventory-modal-backdrop" onClick={onCancel}>
      <div
        className="batch-fresh-inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="batch-fresh-inventory-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel()
        }}
      >
        <h3 id="batch-fresh-inventory-title" className="fresh-inventory-modal-title">
          Batch Add Fresh Stock
        </h3>
        <p className="fresh-inventory-modal-body">
          Add healthy stock for multiple items. Expiring and expired counts are unchanged.
        </p>

        <table className="batch-fresh-table">
          <thead>
            <tr>
              <th>Item</th>
              <th>Current Healthy</th>
              <th>Total</th>
              <th>Add Quantity</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const raw = quantitiesByItemId[row.itemId] ?? ""
              const parsed = Number(raw)
              const isSelected = raw !== "" && Number.isFinite(parsed) && parsed > 0
              return (
                <tr key={row.itemId} className={isSelected ? "batch-fresh-row--selected" : ""}>
                  <td>{row.itemName}</td>
                  <td>{row.healthyCount}</td>
                  <td>{row.totalQuantity}</td>
                  <td>
                    <input
                      className="inventory-panel-control batch-fresh-quantity-input"
                      type="number"
                      min={0}
                      step={1}
                      value={raw}
                      onChange={(event) => {
                        setQuantitiesByItemId((prev) => ({
                          ...prev,
                          [row.itemId]: event.target.value,
                        }))
                        setError(null)
                      }}
                    />
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>

        <div className="batch-fresh-summary">Selected items: {selectedCount}</div>
        {error ? <div className="inventory-table-name-error">{error}</div> : null}
        <div className="fresh-inventory-modal-actions">
          <button className="inventory-table-name-edit-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="inventory-table-name-edit-button" onClick={handleConfirm}>
            Add Selected Stock
          </button>
        </div>
      </div>
    </div>
  )
}
