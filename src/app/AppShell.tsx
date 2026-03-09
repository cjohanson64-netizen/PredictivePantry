import { useState } from "react";
import InventoryView from "../features/inventory-view/InventoryView";
import ScenarioView from "../features/scenario-view/ScenarioView";
import { usePantryWorkspaceRuntime } from "../lib/runtime/usePantryWorkspaceRuntime";
import Logo from "../assets/TAT Logo.svg";

type AppView = "inventory" | "scenario";

export default function AppShell() {
  const [activeView, setActiveView] = useState<AppView>("inventory");
  const runtime = usePantryWorkspaceRuntime();

  return (
    <div className="app-shell">
      <header>
        <div className="app-brand">
          <img src={Logo} alt="" className="app-logo" />
          <div>
            <h1 className="app-title">Predictive Pantry</h1>
            <p className="app-subtitle">Make your pantry intelligent</p>
            <p className="app-subtitle">Powered of TryAngleTree</p>
          </div>
        </div>
      </header>
      <div className="app-shell-view-toggle">
        <button
          className={`app-shell-view-toggle-button ${
            activeView === "inventory"
              ? "app-shell-view-toggle-button--active"
              : ""
          }`}
          onClick={() => setActiveView("inventory")}
        >
          Inventory View
        </button>
        <button
          className={`app-shell-view-toggle-button ${
            activeView === "scenario"
              ? "app-shell-view-toggle-button--active"
              : ""
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
            dispatchAiRefreshPipeline={runtime.dispatchAiRefreshPipeline}
            resetRuntime={runtime.resetRuntime}
          />
        ) : (
          <ScenarioView />
        )}
      </div>
    </div>
  );
}
