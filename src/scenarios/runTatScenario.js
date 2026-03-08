import { tatFeatureRegistries } from "../features/Directory.jsx"
import { bootTatApp } from "../lib/runtime/bootTatApp.js"
import { createRuntimeError } from "../lib/runtime/createRuntimeError.js"
import {
  clearPersistedRuntimeState,
  loadPersistedRuntimeState,
  readPersistedRuntimeEnvelope,
  savePersistedRuntimeState,
  RUNTIME_PERSISTENCE_KEY,
} from "../lib/runtime/runtimePersistence.js"
import { reduceDomainState } from "../state/pantryStateEngine"

function clone(value) {
  return typeof structuredClone === "function" ? structuredClone(value) : JSON.parse(JSON.stringify(value))
}

function defaultRuntimeUtils() {
  return {
    stateReducer: ({ state, eventLog, stateUpdates, newEvents }) =>
      reduceDomainState({
        state,
        eventLog: [...eventLog, ...newEvents],
        stateUpdates,
      }),
  }
}

function validateStep(step, stepIndex, scenarioName) {
  if (!step || typeof step !== "object") {
    return createRuntimeError({
      type: "SCENARIO_STEP_INVALID",
      layer: "runtime",
      featureName: null,
      programName: null,
      actionName: null,
      message: `Scenario step ${stepIndex} is not an object`,
      details: { scenarioName, step },
    })
  }

  if (typeof step.featureName !== "string" || typeof step.programName !== "string") {
    return createRuntimeError({
      type: "SCENARIO_STEP_INVALID",
      layer: "runtime",
      featureName: step.featureName ?? null,
      programName: step.programName ?? null,
      actionName: step.actionName ?? null,
      message: `Scenario step ${stepIndex} requires featureName and programName`,
      details: { scenarioName, step },
    })
  }

  return null
}

function getEventsForStep(previousSnapshot, nextSnapshot) {
  const previousCount = Array.isArray(previousSnapshot?.eventLog) ? previousSnapshot.eventLog.length : 0
  const nextEvents = Array.isArray(nextSnapshot?.eventLog) ? nextSnapshot.eventLog : []
  return clone(nextEvents.slice(previousCount))
}

function createMemoryStorage() {
  const store = new Map()
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null
    },
    setItem(key, value) {
      store.set(key, String(value))
    },
    removeItem(key) {
      store.delete(key)
    },
  }
}

function serializeStateForCompare(state) {
  try {
    return JSON.stringify(state)
  } catch {
    return ""
  }
}

function getByPath(value, path) {
  if (!Array.isArray(path)) return undefined
  return path.reduce((acc, key) => (acc && typeof acc === "object" ? acc[key] : undefined), value)
}

function evaluateExpectation(expectation, snapshot, stepResults, persistenceContext = null) {
  const snapshotForStep = (stepIndex) => {
    if (typeof stepIndex !== "number") return snapshot
    const stepResult = stepResults.find((result) => result.stepIndex === stepIndex)
    return stepResult?.snapshot ?? snapshot
  }

  const targetSnapshot = snapshotForStep(expectation?.stepIndex)
  const type = expectation?.type
  switch (type) {
    case "inventoryItemExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(snapshot?.state?.pantry?.items?.items)
        ? snapshot.state.pantry.items.items.some((item) => item.id === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected inventory item ${itemId} to exist`,
      }
    }
    case "itemExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.items?.items)
        ? targetSnapshot.state.pantry.items.items.some((item) => item.id === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected item ${itemId} to exist`,
      }
    }
    case "itemAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.items?.items)
        ? targetSnapshot.state.pantry.items.items.some((item) => item.id === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect item ${itemId} to exist`,
      }
    }
    case "itemNameEquals": {
      const itemId = expectation.itemId
      const name = expectation.name
      const item = Array.isArray(targetSnapshot?.state?.pantry?.items?.items)
        ? targetSnapshot.state.pantry.items.items.find((entry) => entry.id === itemId)
        : null
      const ok = !!item && item.name === name
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} name to equal ${name}`,
      }
    }
    case "itemFieldEquals": {
      const itemId = expectation.itemId
      const field = expectation.field
      const value = expectation.value
      const item = Array.isArray(targetSnapshot?.state?.pantry?.items?.items)
        ? targetSnapshot.state.pantry.items.items.find((entry) => entry.id === itemId)
        : null
      const ok = !!item && item?.[field] === value
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} field ${field} to equal ${value}`,
      }
    }
    case "itemRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.items?.items)
        ? targetSnapshot.state.pantry.items.items.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected item record count to equal ${count}, got ${size}`,
      }
    }
    case "inventoryRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected grouped inventory record for ${itemId}`,
      }
    }
    case "inventoryRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect grouped inventory record for ${itemId}`,
      }
    }
    case "historyRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(snapshot?.state?.pantry?.inventoryHistory?.records)
        ? snapshot.state.pantry.inventoryHistory.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected inventory history record for ${itemId}`,
      }
    }
    case "historyRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.inventoryHistory?.records)
        ? targetSnapshot.state.pantry.inventoryHistory.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect inventory history record for ${itemId}`,
      }
    }
    case "inventoryQuantityEquals": {
      const itemId = expectation.itemId
      const quantity = expectation.quantity
      const record = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.totalQuantity === quantity
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} quantity to equal ${quantity}`,
      }
    }
    case "inventoryTotalQuantityEquals": {
      const itemId = expectation.itemId
      const totalQuantity = expectation.totalQuantity
      const record = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.totalQuantity === totalQuantity
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} totalQuantity to equal ${totalQuantity}`,
      }
    }
    case "inventoryRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected inventory record count to equal ${count}, got ${size}`,
      }
    }
    case "inventoryHealthyCountEquals": {
      const itemId = expectation.itemId
      const healthyCount = expectation.healthyCount
      const record = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.healthyCount === healthyCount
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} healthyCount to equal ${healthyCount}`,
      }
    }
    case "inventoryFieldEquals": {
      const itemId = expectation.itemId
      const field = expectation.field
      const value = expectation.value
      const record = Array.isArray(targetSnapshot?.state?.pantry?.inventory?.records)
        ? targetSnapshot.state.pantry.inventory.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record?.[field] === value
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} inventory field ${field} to equal ${value}`,
      }
    }
    case "historyConsumedCountEquals": {
      const itemId = expectation.itemId
      const consumedCount = expectation.consumedCount
      const record = Array.isArray(snapshot?.state?.pantry?.inventoryHistory?.records)
        ? snapshot.state.pantry.inventoryHistory.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.consumedCount === consumedCount
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} consumedCount to equal ${consumedCount}`,
      }
    }
    case "analysisRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
        ? snapshot.state.pantry.itemAnalysis.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected item analysis record for ${itemId}`,
      }
    }
    case "analysisRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.itemAnalysis?.records)
        ? targetSnapshot.state.pantry.itemAnalysis.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect item analysis record for ${itemId}`,
      }
    }
    case "analysisStatusEquals": {
      const itemId = expectation.itemId
      const status = expectation.status
      const record = Array.isArray(targetSnapshot?.state?.pantry?.itemAnalysis?.records)
        ? targetSnapshot.state.pantry.itemAnalysis.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.status === status
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} analysis status to equal ${status}`,
      }
    }
    case "analysisReasonIncludes": {
      const itemId = expectation.itemId
      const reason = expectation.reason
      const record = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
        ? snapshot.state.pantry.itemAnalysis.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && Array.isArray(record.reasons) && record.reasons.includes(reason)
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} analysis reasons to include ${reason}`,
      }
    }
    case "analysisFlagEquals": {
      const itemId = expectation.itemId
      const flag = expectation.flag
      const value = expectation.value
      const record = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
        ? snapshot.state.pantry.itemAnalysis.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.flags?.[flag] === value
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} analysis flag ${flag} to equal ${value}`,
      }
    }
    case "analysisMetricEquals": {
      const itemId = expectation.itemId
      const metric = expectation.metric
      const value = expectation.value
      const record = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
        ? snapshot.state.pantry.itemAnalysis.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.metrics?.[metric] === value
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} analysis metric ${metric} to equal ${value}`,
      }
    }
    case "analysisRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(snapshot?.state?.pantry?.itemAnalysis?.records)
        ? snapshot.state.pantry.itemAnalysis.records.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected item analysis record count to equal ${count}, got ${size}`,
      }
    }
    case "recommendationRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected recommendation record for ${itemId}`,
      }
    }
    case "recommendationRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect recommendation record for ${itemId}`,
      }
    }
    case "recommendationRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected recommendation record count to equal ${count}, got ${size}`,
      }
    }
    case "actionableRecommendationCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.filter(
            (entry) =>
              entry.recommendation === "check-item" ||
              entry.recommendation === "use-soon" ||
              entry.recommendation === "restock-soon",
          ).length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected actionable recommendation count to equal ${count}, got ${size}`,
      }
    }
    case "recommendationEquals": {
      const itemId = expectation.itemId
      const recommendation = expectation.recommendation
      const record = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.recommendation === recommendation
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} recommendation to equal ${recommendation}`,
      }
    }
    case "recommendationPriorityEquals": {
      const itemId = expectation.itemId
      const priority = expectation.priority
      const record = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.priority === priority
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} recommendation priority to equal ${priority}`,
      }
    }
    case "recommendationReasonIncludes": {
      const itemId = expectation.itemId
      const reason = expectation.reason
      const record = Array.isArray(snapshot?.state?.pantry?.recommendations?.records)
        ? snapshot.state.pantry.recommendations.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && Array.isArray(record.reasons) && record.reasons.includes(reason)
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} recommendation reasons to include ${reason}`,
      }
    }
    case "recommendationSourceStatusEquals": {
      const itemId = expectation.itemId
      const sourceStatus = expectation.sourceStatus
      const record = Array.isArray(targetSnapshot?.state?.pantry?.recommendations?.records)
        ? targetSnapshot.state.pantry.recommendations.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.sourceStatus === sourceStatus
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} recommendation sourceStatus to equal ${sourceStatus}`,
      }
    }
    case "priorityRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected priority record for ${itemId}`,
      }
    }
    case "priorityRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect priority record for ${itemId}`,
      }
    }
    case "priorityRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected priority record count to equal ${count}, got ${size}`,
      }
    }
    case "priorityRankEquals": {
      const itemId = expectation.itemId
      const rank = expectation.rank
      const record = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.rank === rank
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} rank to equal ${rank}`,
      }
    }
    case "priorityRecommendationEquals": {
      const itemId = expectation.itemId
      const recommendation = expectation.recommendation
      const record = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.recommendation === recommendation
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} priority recommendation to equal ${recommendation}`,
      }
    }
    case "priorityItemNameEquals": {
      const itemId = expectation.itemId
      const itemName = expectation.itemName
      const record = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.itemName === itemName
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} priority itemName to equal ${itemName}`,
      }
    }
    case "priorityMetricEquals": {
      const itemId = expectation.itemId
      const metric = expectation.metric
      const value = expectation.value
      const record = Array.isArray(snapshot?.state?.pantry?.priorities?.records)
        ? snapshot.state.pantry.priorities.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.metrics?.[metric] === value
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} priority metric ${metric} to equal ${value}`,
      }
    }
    case "priorityOrderStartsWith": {
      const expectedItemIds = Array.isArray(expectation.itemIds) ? expectation.itemIds : []
      const actualItemIds = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records
            .map((entry) => entry.itemId)
            .slice(0, expectedItemIds.length)
        : []
      const ok =
        expectedItemIds.length === actualItemIds.length &&
        expectedItemIds.every((itemId, index) => actualItemIds[index] === itemId)
      return {
        ok,
        message: ok
          ? ""
          : `Expected priority order prefix ${expectedItemIds.join(", ")} but got ${actualItemIds.join(", ")}`,
      }
    }
    case "priorityOrderEquals": {
      const expectedItemIds = Array.isArray(expectation.itemIds) ? expectation.itemIds : []
      const actualItemIds = Array.isArray(targetSnapshot?.state?.pantry?.priorities?.records)
        ? targetSnapshot.state.pantry.priorities.records.map((entry) => entry.itemId)
        : []
      const ok =
        expectedItemIds.length === actualItemIds.length &&
        expectedItemIds.every((itemId, index) => actualItemIds[index] === itemId)
      return {
        ok,
        message: ok
          ? ""
          : `Expected full priority order ${expectedItemIds.join(", ")} but got ${actualItemIds.join(", ")}`,
      }
    }
    case "shoppingListRecordExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected shopping list record for ${itemId}`,
      }
    }
    case "shoppingListRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect shopping list record for ${itemId}`,
      }
    }
    case "shoppingListRecordCountEquals": {
      const count = expectation.count
      const size = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records.length
        : 0
      const ok = size === count
      return {
        ok,
        message: ok ? "" : `Expected shopping list record count to equal ${count}, got ${size}`,
      }
    }
    case "shoppingListItemCategoryEquals": {
      const itemId = expectation.itemId
      const category = expectation.category
      const record = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.category === category
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} shopping category to equal ${category}`,
      }
    }
    case "shoppingListOrderStartsWith": {
      const expectedItemIds = Array.isArray(expectation.itemIds) ? expectation.itemIds : []
      const actualItemIds = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records
            .map((entry) => entry.itemId)
            .slice(0, expectedItemIds.length)
        : []
      const ok =
        expectedItemIds.length === actualItemIds.length &&
        expectedItemIds.every((itemId, index) => actualItemIds[index] === itemId)
      return {
        ok,
        message: ok
          ? ""
          : `Expected shopping list order prefix ${expectedItemIds.join(", ")} but got ${actualItemIds.join(", ")}`,
      }
    }
    case "shoppingListItemNameEquals": {
      const itemId = expectation.itemId
      const itemName = expectation.itemName
      const record = Array.isArray(targetSnapshot?.state?.pantry?.shoppingList?.records)
        ? targetSnapshot.state.pantry.shoppingList.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.itemName === itemName
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} shopping list itemName to equal ${itemName}`,
      }
    }
    case "restockPolicyExists": {
      const itemId = expectation.itemId
      const exists = Array.isArray(snapshot?.state?.pantry?.restockPolicy?.records)
        ? snapshot.state.pantry.restockPolicy.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: exists,
        message: exists ? "" : `Expected restock policy record for ${itemId}`,
      }
    }
    case "restockPolicyEquals": {
      const itemId = expectation.itemId
      const policy = expectation.policy
      const record = Array.isArray(snapshot?.state?.pantry?.restockPolicy?.records)
        ? snapshot.state.pantry.restockPolicy.records.find((entry) => entry.itemId === itemId)
        : null
      const ok = !!record && record.policy === policy
      return {
        ok,
        message: ok ? "" : `Expected ${itemId} restock policy to equal ${policy}`,
      }
    }
    case "restockPolicyAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.restockPolicy?.records)
        ? targetSnapshot.state.pantry.restockPolicy.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect restock policy record for ${itemId}`,
      }
    }
    case "recommendationResolutionRecordExists": {
      const itemId = expectation.itemId
      const recommendation = expectation.recommendation
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.recommendationResolutions?.records)
        ? targetSnapshot.state.pantry.recommendationResolutions.records.some(
            (record) => record.itemId === itemId && record.recommendation === recommendation,
          )
        : false
      return {
        ok: exists,
        message: exists
          ? ""
          : `Expected recommendation resolution record for ${itemId} / ${recommendation}`,
      }
    }
    case "recommendationResolutionRecordAbsent": {
      const itemId = expectation.itemId
      const recommendation = expectation.recommendation
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.recommendationResolutions?.records)
        ? targetSnapshot.state.pantry.recommendationResolutions.records.some(
            (record) => record.itemId === itemId && record.recommendation === recommendation,
          )
        : false
      return {
        ok: !exists,
        message: !exists
          ? ""
          : `Did not expect recommendation resolution record for ${itemId} / ${recommendation}`,
      }
    }
    case "recommendationResolutionFieldEquals": {
      const itemId = expectation.itemId
      const recommendation = expectation.recommendation
      const field = expectation.field
      const value = expectation.value
      const record = Array.isArray(targetSnapshot?.state?.pantry?.recommendationResolutions?.records)
        ? targetSnapshot.state.pantry.recommendationResolutions.records.find(
            (entry) => entry.itemId === itemId && entry.recommendation === recommendation,
          )
        : null
      const ok = !!record && record?.[field] === value
      return {
        ok,
        message: ok
          ? ""
          : `Expected recommendation resolution field ${field} for ${itemId} / ${recommendation} to equal ${value}`,
      }
    }
    case "activityRecordAbsent": {
      const itemId = expectation.itemId
      const exists = Array.isArray(targetSnapshot?.state?.pantry?.activityLog?.records)
        ? targetSnapshot.state.pantry.activityLog.records.some((record) => record.itemId === itemId)
        : false
      return {
        ok: !exists,
        message: !exists ? "" : `Did not expect activity record for ${itemId}`,
      }
    }
    case "eventTypeSeen": {
      const eventType = expectation.eventType
      const found = stepResults.some((result) => Array.isArray(result.events) && result.events.some((event) => event.type === eventType))
      return {
        ok: found,
        message: found ? "" : `Expected event ${eventType} to be emitted`,
      }
    }
    case "eventTypeNotSeen": {
      const eventType = expectation.eventType
      const found = stepResults.some((result) => Array.isArray(result.events) && result.events.some((event) => event.type === eventType))
      return {
        ok: !found,
        message: !found ? "" : `Expected event ${eventType} to not be emitted`,
      }
    }
    case "errorTypeSeen": {
      const errorType = expectation.errorType
      const found = stepResults.some(
        (result) => Array.isArray(result.errors) && result.errors.some((error) => error.type === errorType),
      )
      return {
        ok: found,
        message: found ? "" : `Expected error ${errorType} to be present`,
      }
    }
    case "persistedSnapshotExists": {
      const exists = !!persistenceContext?.envelope?.state
      return {
        ok: exists,
        message: exists ? "" : "Expected persisted runtime snapshot to exist",
      }
    }
    case "persistedSnapshotMissing": {
      const exists = !!persistenceContext?.envelope?.state
      return {
        ok: !exists,
        message: !exists ? "" : "Expected persisted runtime snapshot to be missing",
      }
    }
    case "persistedItemExists": {
      const itemId = expectation.itemId
      const items = persistenceContext?.envelope?.state?.pantry?.items?.items
      const exists = Array.isArray(items) ? items.some((entry) => entry.id === itemId) : false
      return {
        ok: exists,
        message: exists ? "" : `Expected persisted item ${itemId} to exist`,
      }
    }
    case "persistedInventoryFieldEquals": {
      const itemId = expectation.itemId
      const field = expectation.field
      const value = expectation.value
      const records = persistenceContext?.envelope?.state?.pantry?.inventory?.records
      const record = Array.isArray(records) ? records.find((entry) => entry.itemId === itemId) : null
      const ok = !!record && record?.[field] === value
      return {
        ok,
        message: ok ? "" : `Expected persisted inventory field ${field} for ${itemId} to equal ${value}`,
      }
    }
    case "persistedSessionFieldEquals": {
      const field = expectation.field
      const value = expectation.value
      const actual = persistenceContext?.envelope?.state?.session?.[field]
      const ok = actual === value
      return {
        ok,
        message: ok ? "" : `Expected persisted session field ${field} to equal ${value}`,
      }
    }
    case "persistedPathEquals": {
      const path = expectation.path
      const value = expectation.value
      const actual = getByPath(persistenceContext?.envelope?.state, path)
      const ok = actual === value
      return {
        ok,
        message: ok ? "" : `Expected persisted path ${Array.isArray(path) ? path.join(".") : ""} to equal ${value}`,
      }
    }
    default:
      return {
        ok: true,
        message: "",
      }
  }
}

function evaluateExpectations(expectations, snapshot, stepResults, scenarioName, persistenceContext = null) {
  if (!Array.isArray(expectations) || expectations.length === 0) return []

  const errors = []
  for (const expectation of expectations) {
    const result = evaluateExpectation(expectation, snapshot, stepResults, persistenceContext)
    if (result.ok) continue

    errors.push(
      createRuntimeError({
        type: "SCENARIO_EXPECTATION_FAILED",
        layer: "runtime",
        featureName: null,
        programName: null,
        actionName: null,
        message: result.message || "Scenario expectation failed",
        details: { scenarioName, expectation },
      }),
    )
  }

  return errors
}

export function runTatScenario({
  scenario,
  registries = tatFeatureRegistries,
  utils = defaultRuntimeUtils(),
} = {}) {
  const scenarioName = String(scenario?.name ?? "unnamed-scenario")

  if (!scenario || typeof scenario !== "object") {
    return {
      ok: false,
      scenarioName,
      bootInfo: {
        status: "failed",
        seedMode: false,
        loadedFeatures: [],
        loadedPrograms: [],
        initialProgram: null,
        timestamp: new Date().toISOString(),
      },
      stepResults: [],
      finalSnapshot: null,
      errors: [
        createRuntimeError({
          type: "SCENARIO_DEFINITION_INVALID",
          layer: "runtime",
          featureName: null,
          programName: null,
          actionName: null,
          message: "Scenario definition must be an object",
          details: { scenario },
        }),
      ],
    }
  }

  const persistenceEnabled = !!scenario.persistence?.enabled
  const persistenceStorage = persistenceEnabled ? createMemoryStorage() : null
  const persistenceKey =
    typeof scenario.persistence?.storageKey === "string" && scenario.persistence.storageKey.length > 0
      ? scenario.persistence.storageKey
      : RUNTIME_PERSISTENCE_KEY

  if (persistenceEnabled && typeof scenario.persistence?.seedRaw === "string") {
    persistenceStorage.setItem(persistenceKey, scenario.persistence.seedRaw)
  } else if (persistenceEnabled && scenario.persistence?.seedEnvelope) {
    persistenceStorage.setItem(persistenceKey, JSON.stringify(scenario.persistence.seedEnvelope))
  }

  const persistedState = persistenceEnabled
    ? loadPersistedRuntimeState({
        storage: persistenceStorage,
        storageKey: persistenceKey,
      })
    : null

  const boot = bootTatApp({
    registries,
    hydratedState: persistedState,
    seedMode: !!scenario.seedMode,
    seedState: scenario.seedState ?? null,
    utils,
    initialProgram: scenario.initialProgram ?? null,
  })

  if (!boot.ok || !boot.runtime || !boot.snapshot) {
    return {
      ok: false,
      scenarioName,
      bootInfo: boot.bootInfo,
      stepResults: [],
      finalSnapshot: null,
      errors: Array.isArray(boot.errors) ? boot.errors : [],
    }
  }

  const stepResults = []
  const scenarioErrors = []
  const steps = Array.isArray(scenario.steps) ? scenario.steps : []
  const scenarioNow = typeof scenario.now === "string" && scenario.now.length > 0 ? scenario.now : null

  for (let index = 0; index < steps.length; index += 1) {
    const step = steps[index]
    const stepError = validateStep(step, index, scenarioName)
    if (stepError) {
      scenarioErrors.push(stepError)
      stepResults.push({
        stepIndex: index,
        step: clone(step),
        ok: false,
        snapshot: boot.runtime.getSnapshot(),
        outputs: [],
        warnings: [],
        errors: [stepError],
        events: [],
      })
      continue
    }

    const previousSnapshot = boot.runtime.getSnapshot()
    const nextSnapshot = boot.runtime.dispatch({
      featureName: step.featureName,
      programName: step.programName,
      actionName: step.actionName,
      payload: step.payload ?? {},
      meta: {
        ...(scenarioNow ? { now: scenarioNow } : {}),
        ...(step.meta ?? {}),
      },
    })

    const historyEntry = Array.isArray(nextSnapshot.history)
      ? nextSnapshot.history[nextSnapshot.history.length - 1] ?? null
      : null
    const stepOk = historyEntry ? historyEntry.ok === true && nextSnapshot.currentErrors.length === 0 : false
    const stepEvents = getEventsForStep(previousSnapshot, nextSnapshot)

    const stepResult = {
      stepIndex: index,
      step: clone(step),
      ok: stepOk,
      snapshot: clone(nextSnapshot),
      outputs: clone(nextSnapshot.currentOutputs),
      warnings: clone(nextSnapshot.currentWarnings),
      errors: clone(nextSnapshot.currentErrors),
      events: stepEvents,
    }

    stepResults.push(stepResult)

    if (persistenceEnabled && stepOk) {
      const didStateChange =
        serializeStateForCompare(previousSnapshot?.state) !== serializeStateForCompare(nextSnapshot?.state)
      if (didStateChange) {
        savePersistedRuntimeState({
          snapshot: nextSnapshot,
          storage: persistenceStorage,
          storageKey: persistenceKey,
        })
      }
    }
  }

  if (persistenceEnabled && scenario.persistence?.resetAfterRun) {
    clearPersistedRuntimeState({
      storage: persistenceStorage,
      storageKey: persistenceKey,
    })
    boot.runtime.reset()
  }

  const finalSnapshot = boot.runtime.getSnapshot()
  const persistenceContext = persistenceEnabled
    ? readPersistedRuntimeEnvelope({
        storage: persistenceStorage,
        storageKey: persistenceKey,
      })
    : null
  const hasExpectations = Array.isArray(scenario.expectations) && scenario.expectations.length > 0
  const expectationErrors = evaluateExpectations(
    scenario.expectations,
    finalSnapshot,
    stepResults,
    scenarioName,
    persistenceContext,
  )
  const unexpectedStepErrors = hasExpectations
    ? []
    : stepResults.flatMap((result) =>
        result.ok
          ? []
          : result.errors.map((error) => ({
              ...error,
              details: {
                ...(error?.details ?? {}),
                scenarioName,
                stepIndex: result.stepIndex,
              },
            })),
      )
  const errors = [...scenarioErrors, ...unexpectedStepErrors, ...expectationErrors]

  return {
    ok: errors.length === 0,
    scenarioName,
    bootInfo: boot.bootInfo,
    stepResults,
    finalSnapshot,
    errors,
  }
}

export function runTatScenarios({ scenarios, registries = tatFeatureRegistries, utils = defaultRuntimeUtils() } = {}) {
  const list = Array.isArray(scenarios) ? scenarios : []
  const results = list.map((scenario) => runTatScenario({ scenario, registries, utils }))

  return {
    ok: results.every((result) => result.ok),
    total: results.length,
    passed: results.filter((result) => result.ok).length,
    failed: results.filter((result) => !result.ok).length,
    results,
  }
}
