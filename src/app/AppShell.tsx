import { useState } from "react"
import InventoryView from "../features/inventory-view/InventoryView"
import ScenarioView from "../features/scenario-view/ScenarioView"
import { usePantryWorkspaceRuntime } from "../lib/runtime/usePantryWorkspaceRuntime"

type AppView = "inventory" | "scenario"

export default function AppShell() {
  const [activeView, setActiveView] = useState<AppView>("inventory")
  const runtime = usePantryWorkspaceRuntime()

  return (
    <div className="app-shell">
      <div className="app-shell-view-toggle">
        <button
          className={`app-shell-view-toggle-button ${
            activeView === "inventory" ? "app-shell-view-toggle-button--active" : ""
          }`}
          onClick={() => setActiveView("inventory")}
        >
          Inventory View
        </button>
        <button
          className={`app-shell-view-toggle-button ${
            activeView === "scenario" ? "app-shell-view-toggle-button--active" : ""
          }`}
          onClick={() => setActiveView("scenario")}
        >
          Scenario View
        </button>
      </div>

      <div className="app-shell-workspace">
        {activeView === "inventory" ? (
          <InventoryView
            snapshot={runtime.snapshot}
            dispatchRuntimeAction={runtime.dispatchRuntimeAction}
            resetRuntime={runtime.resetRuntime}
          />
        ) : (
          <ScenarioView />
        )}
      </div>
    </div>
  )
}
