import { useMemo, useState } from "react"
import type { TatRuntimeSnapshot } from "../../lib/createTatRuntime"
import type { PantryRuntimeDispatchArgs } from "../../lib/runtime/usePantryWorkspaceRuntime"
import BatchFreshInventoryModal from "./components/BatchFreshInventoryModal"
import FreshInventoryModal from "./components/FreshInventoryModal"
import InventoryPanel from "./components/InventoryPanel"
import RecommendationsPanel from "./components/RecommendationsPanel"
import ShoppingListPanel from "./components/ShoppingListPanel"
import { useInventoryViewModel } from "./hooks/useInventoryViewModel"
import "./styles/inventory-view.css"

type InventoryViewProps = {
  snapshot: TatRuntimeSnapshot
  dispatchRuntimeAction: (args: PantryRuntimeDispatchArgs) => TatRuntimeSnapshot
  dispatchAiRefreshPipeline: (meta?: Record<string, unknown>) => TatRuntimeSnapshot
  resetRuntime: () => void
}

export default function InventoryView({
  snapshot,
  dispatchRuntimeAction,
  dispatchAiRefreshPipeline,
  resetRuntime,
}: InventoryViewProps) {
  const [showDebugJson, setShowDebugJson] = useState(false)
  const [freshInventoryTarget, setFreshInventoryTarget] = useState<{ itemId: string } | null>(null)
  const [isBatchFreshInventoryOpen, setIsBatchFreshInventoryOpen] = useState(false)

  const vm = useInventoryViewModel({
    snapshot: snapshot as any,
    dispatchRuntimeAction,
    dispatchAiRefreshPipeline,
    resetRuntime,
  })

  const pantryState = (snapshot as any)?.state?.pantry ?? {}
  const debugItems = Array.isArray(pantryState?.items?.items) ? pantryState.items.items : []
  const debugInventoryRecords = Array.isArray(pantryState?.inventory?.records) ? pantryState.inventory.records : []
  const debugInventoryHistoryRecords = Array.isArray(pantryState?.inventoryHistory?.records)
    ? pantryState.inventoryHistory.records
    : []
  const debugItemAnalysisRecords = Array.isArray(pantryState?.itemAnalysis?.records)
    ? pantryState.itemAnalysis.records
    : []
  const debugRecommendationRecords = Array.isArray(pantryState?.recommendations?.records)
    ? pantryState.recommendations.records
    : []
  const debugPriorityRecords = Array.isArray(pantryState?.priorities?.records)
    ? pantryState.priorities.records
    : []
  const debugShoppingListRecords = Array.isArray(pantryState?.shoppingList?.records)
    ? pantryState.shoppingList.records
    : []
  const inventoryByItemId = useMemo(
    () => new Map(vm.inventoryRecords.map((record) => [String(record.itemId), record])),
    [vm.inventoryRecords],
  )
  const freshTargetItemName = freshInventoryTarget
    ? vm.itemNameById[freshInventoryTarget.itemId] ?? freshInventoryTarget.itemId
    : ""
  const freshTargetSummary = freshInventoryTarget
    ? (() => {
        const record = inventoryByItemId.get(freshInventoryTarget.itemId)
        if (!record) return ""
        return `Healthy ${record.healthyCount} | Expiring Soon ${record.expiringSoonCount} | Expired ${record.expiredCount} | Total ${record.totalQuantity}`
      })()
    : ""
  const batchFreshRows = useMemo(
    () =>
      vm.inventoryRecords.map((record) => {
        const itemId = String(record.itemId)
        return {
          itemId,
          itemName: vm.itemNameById[itemId] ?? itemId,
          healthyCount: Number(record.healthyCount) || 0,
          totalQuantity: Number(record.totalQuantity) || 0,
        }
      }),
    [vm.inventoryRecords, vm.itemNameById],
  )

  return (
    <div className="inventory-view">
      <div className="inventory-view-debug-toggle">
        <label>
          <input
            type="checkbox"
            checked={showDebugJson}
            onChange={(event) => setShowDebugJson(event.target.checked)}
          />
          Show Debug JSON
        </label>
        <button className="inventory-view-reset-button" onClick={resetRuntime}>
          Reset Pantry
        </button>
      </div>

      <InventoryPanel
        inventoryRecords={vm.inventoryRecords}
        itemNameById={vm.itemNameById}
        itemCategoryById={vm.itemCategoryById}
        itemShelfLifeById={vm.itemShelfLifeById}
        categoryOptions={vm.categoryOptions}
        analysisStatusByItemId={vm.analysisStatusByItemId}
        restockPolicyByItemId={vm.restockPolicyByItemId}
        newItemInput={vm.newItemInput}
        derivedNewItemId={vm.derivedNewItemId}
        onChangeNewItemInput={(patch) => vm.setNewItemInput((prev) => ({ ...prev, ...patch }))}
        onCreateNewItem={vm.dispatchCreateNewItem}
        onRequestBatchAddStock={() => setIsBatchFreshInventoryOpen(true)}
        onAddQuantity={vm.dispatchAddQuantity}
        onConsumeQuantity={vm.dispatchConsumeQuantity}
        onSetThreshold={vm.dispatchSetThreshold}
        onSetShelfLife={vm.dispatchSetShelfLife}
        onUpdateRestockPolicy={vm.dispatchUpdateRestockPolicy}
        onUpdateItemCategory={vm.dispatchUpdateItemCategory}
        onUpdateItemName={vm.dispatchUpdateItemName}
        onRemoveItem={vm.dispatchRemoveItem}
        showDebugJson={showDebugJson}
        debugItems={debugItems}
        debugInventoryRecords={debugInventoryRecords}
        debugInventoryHistoryRecords={debugInventoryHistoryRecords}
      />

      <RecommendationsPanel
        pantryItems={vm.pantryItems as Array<Record<string, unknown>>}
        inventoryRecords={vm.inventoryRecords as Array<Record<string, unknown>>}
        recommendations={vm.recommendationRecords}
        priorities={vm.priorityRecords}
        onRefreshAi={vm.dispatchRefreshAi}
        onRankPriorities={vm.dispatchRankPantryPriorities}
        onResolveRecommendation={vm.dispatchResolveRecommendation}
        onRequestFreshStockForRecommendation={(itemId) =>
          setFreshInventoryTarget({
            itemId,
          })
        }
        showDebugJson={showDebugJson}
        debugItemAnalysisRecords={debugItemAnalysisRecords}
        debugRecommendationRecords={debugRecommendationRecords}
        debugPriorityRecords={debugPriorityRecords}
      />

      <ShoppingListPanel
        shoppingList={vm.shoppingListView}
        onGenerateShoppingList={vm.dispatchGenerateShoppingList}
        categoryOptions={vm.categoryOptions}
        showDebugJson={showDebugJson}
        debugShoppingListRecords={debugShoppingListRecords}
      />

      {freshInventoryTarget ? (
        <FreshInventoryModal
          itemName={freshTargetItemName}
          currentSummary={freshTargetSummary}
          onCancel={() => setFreshInventoryTarget(null)}
          onConfirm={(quantity) => {
            vm.dispatchResolveRecommendation({
              itemId: freshInventoryTarget.itemId,
              recommendation: "restock-soon",
              resolution: "bought",
              quantity,
            })
            setFreshInventoryTarget(null)
          }}
        />
      ) : null}

      {isBatchFreshInventoryOpen ? (
        <BatchFreshInventoryModal
          rows={batchFreshRows}
          onCancel={() => setIsBatchFreshInventoryOpen(false)}
          onConfirm={(entries) => {
            vm.dispatchBatchAddFreshStock(entries)
            setIsBatchFreshInventoryOpen(false)
          }}
        />
      ) : null}
    </div>
  )
}
