import { useEffect, useRef, useState } from "react"

type FreshInventoryModalProps = {
  itemName: string
  currentSummary?: string
  onCancel: () => void
  onConfirm: (quantity: number) => void
}

export default function FreshInventoryModal({
  itemName,
  currentSummary,
  onCancel,
  onConfirm,
}: FreshInventoryModalProps) {
  const [quantity, setQuantity] = useState("1")
  const [error, setError] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!inputRef.current) return
    inputRef.current.focus()
    inputRef.current.select()
  }, [])

  function handleConfirm() {
    const parsed = Number(quantity)
    if (!Number.isFinite(parsed) || parsed <= 0 || !Number.isInteger(parsed)) {
      setError("Enter a valid positive whole number.")
      return
    }
    onConfirm(parsed)
  }

  return (
    <div className="fresh-inventory-modal-backdrop" onClick={onCancel}>
      <div
        className="fresh-inventory-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fresh-inventory-title"
        onClick={(event) => event.stopPropagation()}
        onKeyDown={(event) => {
          if (event.key === "Escape") onCancel()
        }}
      >
        <h3 id="fresh-inventory-title" className="fresh-inventory-modal-title">
          Add Fresh Stock
        </h3>
        <p className="fresh-inventory-modal-body">Add fresh inventory for {itemName}</p>
        {currentSummary ? <p className="fresh-inventory-modal-summary">{currentSummary}</p> : null}
        <label className="fresh-inventory-modal-label" htmlFor="fresh-inventory-quantity">
          Quantity
        </label>
        <input
          id="fresh-inventory-quantity"
          ref={inputRef}
          className="inventory-panel-control"
          type="number"
          min={1}
          step={1}
          value={quantity}
          onChange={(event) => {
            setQuantity(event.target.value)
            setError(null)
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault()
              handleConfirm()
            }
          }}
        />
        {error ? <div className="inventory-table-name-error">{error}</div> : null}
        <div className="fresh-inventory-modal-actions">
          <button className="inventory-table-name-edit-button" onClick={onCancel}>
            Cancel
          </button>
          <button className="inventory-table-name-edit-button" onClick={handleConfirm}>
            Add Stock
          </button>
        </div>
      </div>
    </div>
  )
}
