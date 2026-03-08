import pantryRootRaw from "./programs/pantry-root.tat?raw"
import itemRootRaw from "./programs/item-root.tat?raw"
import inventoryRootRaw from "./programs/inventory-root.tat?raw"
import addItemRaw from "./programs/add-item.tat?raw"
import consumeItemRaw from "./programs/consume-item.tat?raw"
import removeItemRaw from "./programs/remove-item.tat?raw"
import analyzeInventoryRaw from "./programs/analyze-inventory.tat?raw"
import analyzeItemByIdRaw from "./programs/analyze-item-by-id.tat?raw"
import recommendPantryActionsRaw from "./programs/recommend-pantry-actions.tat?raw"
import rankPantryPrioritiesRaw from "./programs/rank-pantry-priorities.tat?raw"
import updateRestockPolicyRaw from "./programs/update-restock-policy.tat?raw"
import updateItemCategoryRaw from "./programs/update-item-category.tat?raw"
import updateItemNameRaw from "./programs/update-item-name.tat?raw"
import updateItemShelfLifeRaw from "./programs/update-item-shelf-life.tat?raw"
import resolveRecommendationRaw from "./programs/resolve-recommendation.tat?raw"
import generateShoppingListRaw from "./programs/generate-shopping-list.tat?raw"
import resolveItemStatusRaw from "./programs/resolve-item-status.tat?raw"
import { createTatProgram } from "../../../lib/tat/createTatProgram.js"
import {
  addItemHandler,
  analyzeInventoryHandler,
  analyzeItemByIdHandler,
  consumeItemHandler,
  removeItemHandler,
  inventoryRootHandler,
  itemRootHandler,
  pantryRootHandler,
  rankPantryPrioritiesHandler,
  recommendPantryActionsHandler,
  generateShoppingListHandler,
  updateItemCategoryHandler,
  updateItemNameHandler,
  updateItemShelfLifeHandler,
  resolveRecommendationHandler,
  updateRestockPolicyHandler,
} from "../handlers/pantryHandlers"

const pantryRoot = createTatProgram({
  rawText: pantryRootRaw,
  fileName: "src/features/pantry/data/programs/pantry-root.tat",
  featureName: "pantry",
  registryKey: "pantryRoot",
})

const itemRoot = createTatProgram({
  rawText: itemRootRaw,
  fileName: "src/features/pantry/data/programs/item-root.tat",
  featureName: "pantry",
  registryKey: "itemRoot",
})

const inventoryRoot = createTatProgram({
  rawText: inventoryRootRaw,
  fileName: "src/features/pantry/data/programs/inventory-root.tat",
  featureName: "pantry",
  registryKey: "inventoryRoot",
})

const addItem = createTatProgram({
  rawText: addItemRaw,
  fileName: "src/features/pantry/data/programs/add-item.tat",
  featureName: "pantry",
  registryKey: "addItem",
})

const consumeItem = createTatProgram({
  rawText: consumeItemRaw,
  fileName: "src/features/pantry/data/programs/consume-item.tat",
  featureName: "pantry",
  registryKey: "consumeItem",
})

const removeItem = createTatProgram({
  rawText: removeItemRaw,
  fileName: "src/features/pantry/data/programs/remove-item.tat",
  featureName: "pantry",
  registryKey: "removeItem",
})

const analyzeInventory = createTatProgram({
  rawText: analyzeInventoryRaw,
  fileName: "src/features/pantry/data/programs/analyze-inventory.tat",
  featureName: "pantry",
  registryKey: "analyzeInventory",
})

const analyzeItemById = createTatProgram({
  rawText: analyzeItemByIdRaw,
  fileName: "src/features/pantry/data/programs/analyze-item-by-id.tat",
  featureName: "pantry",
  registryKey: "analyzeItemById",
})

const recommendPantryActions = createTatProgram({
  rawText: recommendPantryActionsRaw,
  fileName: "src/features/pantry/data/programs/recommend-pantry-actions.tat",
  featureName: "pantry",
  registryKey: "recommendPantryActions",
})

const rankPantryPriorities = createTatProgram({
  rawText: rankPantryPrioritiesRaw,
  fileName: "src/features/pantry/data/programs/rank-pantry-priorities.tat",
  featureName: "pantry",
  registryKey: "rankPantryPriorities",
})

const updateRestockPolicy = createTatProgram({
  rawText: updateRestockPolicyRaw,
  fileName: "src/features/pantry/data/programs/update-restock-policy.tat",
  featureName: "pantry",
  registryKey: "updateRestockPolicy",
})

const updateItemCategory = createTatProgram({
  rawText: updateItemCategoryRaw,
  fileName: "src/features/pantry/data/programs/update-item-category.tat",
  featureName: "pantry",
  registryKey: "updateItemCategory",
})

const updateItemName = createTatProgram({
  rawText: updateItemNameRaw,
  fileName: "src/features/pantry/data/programs/update-item-name.tat",
  featureName: "pantry",
  registryKey: "updateItemName",
})

const updateItemShelfLife = createTatProgram({
  rawText: updateItemShelfLifeRaw,
  fileName: "src/features/pantry/data/programs/update-item-shelf-life.tat",
  featureName: "pantry",
  registryKey: "updateItemShelfLife",
})

const resolveRecommendation = createTatProgram({
  rawText: resolveRecommendationRaw,
  fileName: "src/features/pantry/data/programs/resolve-recommendation.tat",
  featureName: "pantry",
  registryKey: "resolveRecommendation",
})

const generateShoppingList = createTatProgram({
  rawText: generateShoppingListRaw,
  fileName: "src/features/pantry/data/programs/generate-shopping-list.tat",
  featureName: "pantry",
  registryKey: "generateShoppingList",
})

const resolveItemStatus = createTatProgram({
  rawText: resolveItemStatusRaw,
  fileName: "src/features/pantry/data/programs/resolve-item-status.tat",
  featureName: "pantry",
  registryKey: "resolveItemStatus",
})

function buildPantryProgram(programKey) {
  const program = pantryTatRegistry.programs?.[programKey]
  if (!program) {
    throw new Error(`Unknown pantry program: ${programKey}`)
  }
  return String(program.tatProgram.source ?? "").trim()
}

export const pantryTatRegistry = {
  featureName: "pantry",
  entryProgram: "pantryRoot",
  programs: {
    pantryRoot: {
      tatProgram: pantryRoot,
      title: pantryRoot.program,
      description: pantryRoot.purpose,
      internal: true,
    },
    itemRoot: {
      tatProgram: itemRoot,
      title: itemRoot.program,
      description: itemRoot.purpose,
      internal: true,
    },
    inventoryRoot: {
      tatProgram: inventoryRoot,
      title: inventoryRoot.program,
      description: inventoryRoot.purpose,
    },
    addItem: {
      tatProgram: addItem,
      title: addItem.program,
      description: addItem.purpose,
      runtimeActions: [
        {
          actionName: "ADD_ITEM",
          payload: {
            itemId: "item:oats",
            name: "Oats",
            quantity: 1,
            location: "location:pantry",
            lowStockThreshold: 2,
            source: {
              kind: "user",
              label: "console-demo",
            },
          },
        },
      ],
    },
    consumeItem: {
      tatProgram: consumeItem,
      title: consumeItem.program,
      description: consumeItem.purpose,
      runtimeActions: [
        {
          actionName: "CONSUME_ITEM",
          payload: {
            itemId: "item:oats",
            amount: 1,
          },
        },
      ],
    },
    removeItem: {
      tatProgram: removeItem,
      title: removeItem.program,
      description: removeItem.purpose,
      runtimeActions: [
        {
          actionName: "REMOVE_ITEM",
          payload: {
            itemId: "item:oats",
          },
        },
      ],
    },
    analyzeInventory: {
      tatProgram: analyzeInventory,
      title: analyzeInventory.program,
      description: analyzeInventory.purpose,
      runtimeActions: [
        {
          actionName: "ANALYZE_INVENTORY",
          payload: {},
        },
      ],
    },
    analyzeItemById: {
      tatProgram: analyzeItemById,
      title: analyzeItemById.program,
      description: analyzeItemById.purpose,
      runtimeActions: [
        {
          actionName: "ANALYZE_ITEM_BY_ID",
          payload: {
            itemId: "item:oats",
          },
        },
      ],
    },
    recommendPantryActions: {
      tatProgram: recommendPantryActions,
      title: recommendPantryActions.program,
      description: recommendPantryActions.purpose,
      runtimeActions: [
        {
          actionName: "RECOMMEND_PANTRY_ACTIONS",
          payload: {},
        },
      ],
    },
    rankPantryPriorities: {
      tatProgram: rankPantryPriorities,
      title: rankPantryPriorities.program,
      description: rankPantryPriorities.purpose,
      runtimeActions: [
        {
          actionName: "RANK_PANTRY_PRIORITIES",
          payload: {},
        },
      ],
    },
    updateRestockPolicy: {
      tatProgram: updateRestockPolicy,
      title: updateRestockPolicy.program,
      description: updateRestockPolicy.purpose,
      runtimeActions: [
        {
          actionName: "UPDATE_RESTOCK_POLICY",
          payload: {
            itemId: "item:oats",
            policy: "learn",
          },
        },
      ],
    },
    updateItemCategory: {
      tatProgram: updateItemCategory,
      title: updateItemCategory.program,
      description: updateItemCategory.purpose,
      runtimeActions: [
        {
          actionName: "UPDATE_ITEM_CATEGORY",
          payload: {
            itemId: "item:oats",
            category: "Pantry",
          },
        },
      ],
    },
    updateItemName: {
      tatProgram: updateItemName,
      title: updateItemName.program,
      description: updateItemName.purpose,
      runtimeActions: [
        {
          actionName: "UPDATE_ITEM_NAME",
          payload: {
            itemId: "item:oats",
            name: "Rolled Oats",
          },
        },
      ],
    },
    updateItemShelfLife: {
      tatProgram: updateItemShelfLife,
      title: updateItemShelfLife.program,
      description: updateItemShelfLife.purpose,
      runtimeActions: [
        {
          actionName: "UPDATE_ITEM_SHELF_LIFE",
          payload: {
            itemId: "item:oats",
            shelfLifeDays: 180,
          },
        },
      ],
    },
    resolveRecommendation: {
      tatProgram: resolveRecommendation,
      title: resolveRecommendation.program,
      description: resolveRecommendation.purpose,
      runtimeActions: [
        {
          actionName: "RESOLVE_RECOMMENDATION",
          payload: {
            itemId: "item:oats",
            recommendation: "restock-soon",
            resolution: "done",
          },
        },
      ],
    },
    generateShoppingList: {
      tatProgram: generateShoppingList,
      title: generateShoppingList.program,
      description: generateShoppingList.purpose,
      runtimeActions: [
        {
          actionName: "GENERATE_SHOPPING_LIST",
          payload: {},
        },
      ],
    },
    resolveItemStatus: {
      tatProgram: resolveItemStatus,
      title: resolveItemStatus.program,
      description: resolveItemStatus.purpose,
      internal: true,
    },
  },
  handlers: {
    buildProgram: buildPantryProgram,
    pantryRoot: pantryRootHandler,
    itemRoot: itemRootHandler,
    inventoryRoot: inventoryRootHandler,
    addItem: addItemHandler,
    consumeItem: consumeItemHandler,
    removeItem: removeItemHandler,
    analyzeInventory: analyzeInventoryHandler,
    analyzeItemById: analyzeItemByIdHandler,
    recommendPantryActions: recommendPantryActionsHandler,
    rankPantryPriorities: rankPantryPrioritiesHandler,
    updateRestockPolicy: updateRestockPolicyHandler,
    updateItemCategory: updateItemCategoryHandler,
    updateItemName: updateItemNameHandler,
    updateItemShelfLife: updateItemShelfLifeHandler,
    resolveRecommendation: resolveRecommendationHandler,
    generateShoppingList: generateShoppingListHandler,
    pantryRootHandler,
    itemRootHandler,
    inventoryRootHandler,
    addItemHandler,
    consumeItemHandler,
    removeItemHandler,
    analyzeInventoryHandler,
    analyzeItemByIdHandler,
    recommendPantryActionsHandler,
    rankPantryPrioritiesHandler,
    updateRestockPolicyHandler,
    updateItemCategoryHandler,
    updateItemNameHandler,
    updateItemShelfLifeHandler,
    resolveRecommendationHandler,
    generateShoppingListHandler,
  },
  meta: {
    version: "9.6.0",
    description:
      "Pantry Slice 7 registry for Item, Inventory, Analysis, Recommendations, Priorities, Restock Policy, and Shopping List.",
  },
}
