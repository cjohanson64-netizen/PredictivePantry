import { useEffect, useMemo, useRef, useState } from "react"
import type { NewItemInput } from "../../pantry/utils/consoleInputIntents"
import { getDefaultShelfLifeDays } from "../../pantry/utils/itemCategory"
import type { PantryInventoryView } from "../hooks/useInventoryViewModel"

function asNumber(value: unknown, fallback = 0) {
  return typeof value === "number" && Number.isFinite(value) ? value : fallback
}

type SortColumn = "item" | "total" | "policy" | "category" | "status"

function statusSortRank(status: string) {
  switch (status) {
    case "expired":
      return 0
    case "expiring-soon":
      return 1
    case "replenish-soon":
      return 2
    case "low-stock":
      return 3
    case "healthy":
      return 4
    case "new":
      return 5
    default:
      return 6
  }
}

function policySortRank(policy: string) {
  switch (policy) {
    case "always":
      return 0
    case "learn":
      return 1
    case "never":
      return 2
    default:
      return 3
  }
}

function compareText(a: string, b: string) {
  return a.localeCompare(b, undefined, { sensitivity: "base" })
}

function statusClassName(status: string) {
  switch (status) {
    case "healthy":
      return "status-healthy"
    case "low-stock":
      return "status-low-stock"
    case "replenish-soon":
      return "status-replenish-soon"
    case "expiring-soon":
      return "status-expiring-soon"
    case "expired":
      return "status-expired"
    case "new":
      return "status-new"
    default:
      return "status-new"
  }
}

type InventoryPanelProps = {
  inventoryRecords: PantryInventoryView[]
  itemNameById: Record<string, string>
  itemCategoryById: Record<string, string>
  itemShelfLifeById: Record<string, number>
  categoryOptions: string[]
  analysisStatusByItemId: Record<string, string>
  restockPolicyByItemId: Record<string, "always" | "never" | "learn">
  newItemInput: NewItemInput
  derivedNewItemId: string
  onChangeNewItemInput: (patch: Partial<NewItemInput>) => void
  onCreateNewItem: () => void
  onRequestBatchAddStock: () => void
  onAddQuantity: (itemId: string) => void
  onConsumeQuantity: (itemId: string) => void
  onSetThreshold: (itemId: string, value: number) => void
  onSetShelfLife: (itemId: string, value: number) => void
  onUpdateRestockPolicy: (itemId: string, policy: "always" | "never" | "learn") => void
  onUpdateItemCategory: (itemId: string, category: string) => void
  onUpdateItemName: (itemId: string, name: string) => { ok: boolean; message: string }
  onRemoveItem: (itemId: string) => void
  showDebugJson: boolean
  debugItems: Array<Record<string, unknown>>
  debugInventoryRecords: Array<Record<string, unknown>>
  debugInventoryHistoryRecords: Array<Record<string, unknown>>
}

export default function InventoryPanel({
  inventoryRecords,
  itemNameById,
  itemCategoryById,
  itemShelfLifeById,
  categoryOptions,
  analysisStatusByItemId,
  restockPolicyByItemId,
  newItemInput,
  derivedNewItemId,
  onChangeNewItemInput,
  onCreateNewItem,
  onRequestBatchAddStock,
  onAddQuantity,
  onConsumeQuantity,
  onSetThreshold,
  onSetShelfLife,
  onUpdateRestockPolicy,
  onUpdateItemCategory,
  onUpdateItemName,
  onRemoveItem,
  showDebugJson,
  debugItems,
  debugInventoryRecords,
  debugInventoryHistoryRecords,
}: InventoryPanelProps) {
  type EditableField = "threshold" | "shelfLifeDays"

  const [editingNameByItemId, setEditingNameByItemId] = useState<Record<string, string>>({})
  const [nameErrorByItemId, setNameErrorByItemId] = useState<Record<string, string>>({})
  const [deleteModalItemId, setDeleteModalItemId] = useState<string | null>(null)
  const [editingCell, setEditingCell] = useState<{ itemId: string; field: EditableField } | null>(null)
  const [editingValue, setEditingValue] = useState("")
  const [editError, setEditError] = useState<string | null>(null)
  const [sortColumn, setSortColumn] = useState<SortColumn>("item")
  const editingInputRef = useRef<HTMLInputElement | null>(null)
  const skipBlurCommitRef = useRef(false)

  useEffect(() => {
    if (!editingCell || !editingInputRef.current) return
    editingInputRef.current.focus()
    editingInputRef.current.select()
  }, [editingCell])

  function startCellEdit(itemId: string, field: EditableField, value: number) {
    setEditingCell({ itemId, field })
    setEditingValue(String(Math.max(0, Math.round(value))))
    setEditError(null)
  }

  function cancelCellEdit() {
    setEditingCell(null)
    setEditingValue("")
    setEditError(null)
  }

  function commitCellEdit({
    itemId,
    field,
    currentValue,
  }: {
    itemId: string
    field: EditableField
    currentValue: number
  }) {
    const parsed = Number(editingValue)
    if (!Number.isFinite(parsed)) {
      setEditError("Enter a valid number.")
      return
    }

    const minimum = field === "shelfLifeDays" ? 1 : 0
    if (parsed < minimum) {
      setEditError(`Value must be at least ${minimum}.`)
      return
    }

    const nextValue = Math.round(parsed)
    if (nextValue !== Math.round(currentValue)) {
      if (field === "threshold") {
        onSetThreshold(itemId, nextValue)
      } else {
        onSetShelfLife(itemId, nextValue)
      }
    }

    cancelCellEdit()
  }

  const sortedInventoryRecords = useMemo(() => {
    return [...inventoryRecords]
      .map((record, index) => ({ record, index }))
      .sort((left, right) => {
        const a = left.record
        const b = right.record
        const aItemId = String(a.itemId)
        const bItemId = String(b.itemId)

        let comparison = 0
        switch (sortColumn) {
          case "item": {
            const aName = String(itemNameById[aItemId] ?? aItemId)
            const bName = String(itemNameById[bItemId] ?? bItemId)
            comparison = compareText(aName, bName)
            break
          }
          case "total":
            comparison = asNumber(a.totalQuantity, 0) - asNumber(b.totalQuantity, 0)
            break
          case "policy": {
            const aPolicy = String(restockPolicyByItemId[aItemId] ?? "learn")
            const bPolicy = String(restockPolicyByItemId[bItemId] ?? "learn")
            comparison = policySortRank(aPolicy) - policySortRank(bPolicy)
            break
          }
          case "category": {
            const aCategory = String(itemCategoryById[aItemId] ?? "Other")
            const bCategory = String(itemCategoryById[bItemId] ?? "Other")
            comparison = compareText(aCategory, bCategory)
            break
          }
          case "status": {
            const aStatus = String(analysisStatusByItemId[aItemId] ?? "new")
            const bStatus = String(analysisStatusByItemId[bItemId] ?? "new")
            comparison = statusSortRank(aStatus) - statusSortRank(bStatus)
            break
          }
          default:
            comparison = 0
        }

        if (comparison === 0) return left.index - right.index
        return comparison
      })
      .map((entry) => entry.record)
  }, [
    analysisStatusByItemId,
    inventoryRecords,
    itemCategoryById,
    itemNameById,
    itemShelfLifeById,
    restockPolicyByItemId,
    sortColumn,
  ])

  return (
    <section className="inventory-panel">
      <div className="inventory-panel-header">
        <h2>Inventory</h2>
      </div>
      <div className="inventory-panel-toolbar">
        <label className="inventory-panel-sort">
          <span className="inventory-panel-sort-label">Sort by</span>
          <select
            className="inventory-panel-control inventory-panel-sort-control"
            value={sortColumn}
            onChange={(event) => setSortColumn(event.target.value as SortColumn)}
          >
            <option value="item">Name</option>
            <option value="total">Total</option>
            <option value="policy">Policy</option>
            <option value="category">Category</option>
            <option value="status">Status</option>
          </select>
        </label>
        <button className="inventory-table-name-edit-button" onClick={onRequestBatchAddStock}>
          Batch Add Stock
        </button>
      </div>
      <table className="inventory-table">
        <thead>
          <tr className="inventory-table-row">
            <th className="inventory-table-cell inventory-col-item">Item</th>
            <th className="inventory-table-cell inventory-col-total">Total</th>
            <th className="inventory-table-cell inventory-col-healthy">Healthy</th>
            <th className="inventory-table-cell inventory-col-threshold">Threshold</th>
            <th className="inventory-table-cell inventory-col-policy">Restock Policy</th>
            <th className="inventory-table-cell inventory-col-category">Category</th>
            <th className="inventory-table-cell inventory-col-shelf-life">Shelf Life (days)</th>
            <th className="inventory-table-cell inventory-col-actions">Actions</th>
          </tr>
        </thead>
        <tbody>
          <tr className="inventory-table-row inventory-table-row--new">
            <td className="inventory-table-cell inventory-col-item">
              <input
                className="inventory-panel-control"
                placeholder="New item name"
                value={newItemInput.name}
                onChange={(event) => onChangeNewItemInput({ name: event.target.value })}
              />
              <div className="inventory-panel-hint">{derivedNewItemId || "item:..."}</div>
            </td>
            <td className="inventory-table-cell inventory-col-total">{Math.max(0, Number(newItemInput.quantity) || 0)}</td>
            <td className="inventory-table-cell inventory-col-healthy">
              <input
                className="inventory-panel-control"
                type="number"
                value={newItemInput.quantity}
                onChange={(event) => onChangeNewItemInput({ quantity: Number(event.target.value) })}
              />
            </td>
            <td className="inventory-table-cell inventory-col-threshold">
              <input
                className="inventory-panel-control"
                type="number"
                value={newItemInput.threshold}
                onChange={(event) => onChangeNewItemInput({ threshold: Number(event.target.value) })}
              />
            </td>
            <td className="inventory-table-cell inventory-col-policy">
              <select
                className="inventory-panel-control"
                value={newItemInput.restockPolicy}
                onChange={(event) =>
                  onChangeNewItemInput({
                    restockPolicy: event.target.value as "always" | "never" | "learn",
                  })
                }
              >
                <option value="always">Always</option>
                <option value="learn">Learn</option>
                <option value="never">Never</option>
              </select>
            </td>
            <td className="inventory-table-cell inventory-col-category">
              <select
                className="inventory-panel-control"
                value={newItemInput.category}
                onChange={(event) =>
                  onChangeNewItemInput({
                    category: event.target.value,
                    shelfLifeDays: getDefaultShelfLifeDays(event.target.value),
                  })
                }
              >
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </td>
            <td className="inventory-table-cell inventory-col-shelf-life">
              <input
                className="inventory-panel-control"
                type="number"
                min={1}
                value={newItemInput.shelfLifeDays}
                onChange={(event) =>
                  onChangeNewItemInput({
                    shelfLifeDays: Math.max(1, Number(event.target.value) || 1),
                  })
                }
              />
            </td>
            <td className="inventory-table-cell inventory-col-actions">
              <div className="inventory-table-counter">
                <button className="inventory-table-counter-button" onClick={onCreateNewItem}>
                  +
                </button>
              </div>
            </td>
          </tr>

          {sortedInventoryRecords.map((record) => {
            const totalQuantity = asNumber(record.totalQuantity, 0)
            const healthyCount = asNumber(record.healthyCount, 0)
            const threshold = asNumber(record.lowStockThreshold, 0)
            const itemId = String(record.itemId)
            const restockPolicy = restockPolicyByItemId[itemId] ?? "learn"
            const category = itemCategoryById[itemId] ?? "Other"
            const shelfLifeDays = Math.max(1, Number(itemShelfLifeById[itemId] ?? 30))
            const rawStatus = String(analysisStatusByItemId[itemId] ?? "new")
            const normalizedStatus =
              rawStatus === "healthy" ||
              rawStatus === "low-stock" ||
              rawStatus === "replenish-soon" ||
              rawStatus === "expiring-soon" ||
              rawStatus === "expired"
                ? rawStatus
                : "new"

            return (
              <tr key={itemId} className="inventory-table-row">
                <td className="inventory-table-cell inventory-col-item">
                  {Object.prototype.hasOwnProperty.call(editingNameByItemId, itemId) ? (
                    <div className="inventory-table-name-edit">
                      <input
                        className="inventory-panel-control"
                        value={editingNameByItemId[itemId]}
                        onChange={(event) =>
                          {
                            const nextValue = event.target.value
                            setEditingNameByItemId((prev) => ({
                              ...prev,
                              [itemId]: nextValue,
                            }))
                            setNameErrorByItemId((prev) => {
                              if (!Object.prototype.hasOwnProperty.call(prev, itemId)) return prev
                              const next = { ...prev }
                              delete next[itemId]
                              return next
                            })
                          }
                        }
                      />
                      <button
                        className="inventory-table-name-edit-button"
                        onClick={() => {
                          const nextName = (editingNameByItemId[itemId] ?? "").trim()
                          if (!nextName) return
                          const result = onUpdateItemName(itemId, nextName)
                          if (!result.ok) {
                            setNameErrorByItemId((prev) => ({
                              ...prev,
                              [itemId]: result.message || "Rename failed.",
                            }))
                            return
                          }
                          setEditingNameByItemId((prev) => {
                            const next = { ...prev }
                            delete next[itemId]
                            return next
                          })
                          setNameErrorByItemId((prev) => {
                            if (!Object.prototype.hasOwnProperty.call(prev, itemId)) return prev
                            const next = { ...prev }
                            delete next[itemId]
                            return next
                          })
                        }}
                      >
                        Save
                      </button>
                      <button
                        className="inventory-table-name-edit-button"
                        onClick={() =>
                          {
                            setEditingNameByItemId((prev) => {
                              const next = { ...prev }
                              delete next[itemId]
                              return next
                            })
                            setNameErrorByItemId((prev) => {
                              if (!Object.prototype.hasOwnProperty.call(prev, itemId)) return prev
                              const next = { ...prev }
                              delete next[itemId]
                              return next
                            })
                          }
                        }
                      >
                        Cancel
                      </button>
                      {nameErrorByItemId[itemId] ? (
                        <div className="inventory-table-name-error">{nameErrorByItemId[itemId]}</div>
                      ) : null}
                    </div>
                  ) : (
                    <div className="inventory-table-name-view">
                      <span className="inventory-item-name-with-status">
                        <span className={`status-dot ${statusClassName(normalizedStatus)}`} aria-hidden="true" />
                        <span className="inventory-item-name">{itemNameById[itemId] ?? itemId}</span>
                      </span>
                    </div>
                  )}
                </td>
                <td className="inventory-table-cell inventory-col-total">{totalQuantity}</td>
                <td className="inventory-table-cell inventory-col-healthy">
                  <div className="inventory-table-counter">
                    <button
                      className={`inventory-table-counter-button ${
                        healthyCount === 0 ? "inventory-table-counter-button--disabled" : ""
                      }`}
                      disabled={healthyCount === 0}
                      onClick={() => onConsumeQuantity(itemId)}
                    >
                      -
                    </button>
                    <span className="inventory-table-counter-value">{healthyCount}</span>
                    <button className="inventory-table-counter-button" onClick={() => onAddQuantity(itemId)}>
                      +
                    </button>
                  </div>
                </td>
                <td className="inventory-table-cell inventory-col-threshold">
                  {editingCell?.itemId === itemId && editingCell?.field === "threshold" ? (
                    <div className="inventory-table-editing-cell">
                      <input
                        ref={editingInputRef}
                        className="inventory-table-editing-input"
                        type="number"
                        min={0}
                        value={editingValue}
                        onChange={(event) => {
                          setEditingValue(event.target.value)
                          setEditError(null)
                        }}
                        onBlur={() => {
                          if (skipBlurCommitRef.current) {
                            skipBlurCommitRef.current = false
                            return
                          }
                          commitCellEdit({ itemId, field: "threshold", currentValue: threshold })
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            commitCellEdit({ itemId, field: "threshold", currentValue: threshold })
                          } else if (event.key === "Escape") {
                            event.preventDefault()
                            skipBlurCommitRef.current = true
                            cancelCellEdit()
                          }
                        }}
                      />
                      {editError ? <div className="inventory-table-name-error">{editError}</div> : null}
                    </div>
                  ) : (
                    <button
                      className="inventory-table-editable-value"
                      onClick={() => startCellEdit(itemId, "threshold", threshold)}
                    >
                      <span className="inventory-table-cell-value inventory-table-cell-value--editable">{threshold}</span>
                    </button>
                  )}
                </td>
                <td className="inventory-table-cell inventory-col-policy">
                  <select
                    className="inventory-panel-control"
                    value={restockPolicy}
                    onChange={(event) =>
                      onUpdateRestockPolicy(itemId, event.target.value as "always" | "never" | "learn")
                    }
                  >
                    <option value="always">Always</option>
                    <option value="learn">Learn</option>
                    <option value="never">Never</option>
                  </select>
                </td>
                <td className="inventory-table-cell inventory-col-category">
                  <select
                    className="inventory-panel-control"
                    value={category}
                    onChange={(event) => onUpdateItemCategory(itemId, event.target.value)}
                  >
                    {categoryOptions.map((option) => (
                      <option key={`${itemId}:${option}`} value={option}>
                        {option}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="inventory-table-cell inventory-col-shelf-life">
                  {editingCell?.itemId === itemId && editingCell?.field === "shelfLifeDays" ? (
                    <div className="inventory-table-editing-cell">
                      <input
                        ref={editingInputRef}
                        className="inventory-table-editing-input"
                        type="number"
                        min={1}
                        value={editingValue}
                        onChange={(event) => {
                          setEditingValue(event.target.value)
                          setEditError(null)
                        }}
                        onBlur={() => {
                          if (skipBlurCommitRef.current) {
                            skipBlurCommitRef.current = false
                            return
                          }
                          commitCellEdit({ itemId, field: "shelfLifeDays", currentValue: shelfLifeDays })
                        }}
                        onKeyDown={(event) => {
                          if (event.key === "Enter") {
                            event.preventDefault()
                            commitCellEdit({ itemId, field: "shelfLifeDays", currentValue: shelfLifeDays })
                          } else if (event.key === "Escape") {
                            event.preventDefault()
                            skipBlurCommitRef.current = true
                            cancelCellEdit()
                          }
                        }}
                      />
                      {editError ? <div className="inventory-table-name-error">{editError}</div> : null}
                    </div>
                  ) : (
                    <button
                      className="inventory-table-editable-value"
                      onClick={() => startCellEdit(itemId, "shelfLifeDays", shelfLifeDays)}
                    >
                      <span className="inventory-table-cell-value inventory-table-cell-value--editable">
                        {shelfLifeDays}
                      </span>
                    </button>
                  )}
                </td>
                <td className="inventory-table-cell inventory-col-actions">
                  <div className="inventory-table-row-actions">
                    <button
                      className="inventory-table-icon-button"
                      aria-label={`Edit name for ${itemNameById[itemId] ?? itemId}`}
                      title={`Edit name for ${itemNameById[itemId] ?? itemId}`}
                      onClick={() =>
                        setEditingNameByItemId((prev) => ({
                          ...prev,
                          [itemId]: itemNameById[itemId] ?? itemId,
                        }))
                      }
                    >
                      <span aria-hidden="true">✎</span>
                    </button>
                    <button
                      className="inventory-table-icon-button inventory-table-icon-button--danger"
                      aria-label={`Delete ${itemNameById[itemId] ?? itemId}`}
                      title={`Delete ${itemNameById[itemId] ?? itemId}`}
                      onClick={() => setDeleteModalItemId(itemId)}
                    >
                      <span aria-hidden="true">🗑</span>
                    </button>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>

      {deleteModalItemId ? (
        <div
          className="inventory-delete-modal-backdrop"
          onClick={() => setDeleteModalItemId(null)}
        >
          <div
            className="inventory-delete-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="inventory-delete-title"
            onClick={(event) => event.stopPropagation()}
            onKeyDown={(event) => {
              if (event.key === "Escape") setDeleteModalItemId(null)
            }}
          >
            <h3 id="inventory-delete-title" className="inventory-delete-modal-title">Delete item?</h3>
            <p className="inventory-delete-modal-body">
              Are you sure you want to delete {itemNameById[deleteModalItemId] ?? deleteModalItemId} from inventory?
            </p>
            <div className="inventory-delete-modal-actions">
              <button
                className="inventory-table-name-edit-button"
                onClick={() => setDeleteModalItemId(null)}
              >
                Cancel
              </button>
              <button
                className="inventory-table-name-edit-button inventory-table-name-edit-button--danger"
                onClick={() => {
                  const itemIdToDelete = deleteModalItemId
                  if (!itemIdToDelete) return
                  onRemoveItem(itemIdToDelete)
                  setDeleteModalItemId(null)
                  setEditingNameByItemId((prev) => {
                    const next = { ...prev }
                    delete next[itemIdToDelete]
                    return next
                  })
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {showDebugJson ? (
        <div className="panel-debug-json">
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Items</div>
            <pre className="panel-json">{JSON.stringify(debugItems, null, 2)}</pre>
          </div>
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Inventory</div>
            <pre className="panel-json">{JSON.stringify(debugInventoryRecords, null, 2)}</pre>
          </div>
          <div className="panel-debug-json-section">
            <div className="panel-debug-json-title">Inventory History</div>
            <pre className="panel-json">{JSON.stringify(debugInventoryHistoryRecords, null, 2)}</pre>
          </div>
        </div>
      ) : null}
    </section>
  )
}
