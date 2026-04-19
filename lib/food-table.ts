import type { Category, FoodWithDetails, MacroPriority } from "./types";

export type FoodTableSortKey =
  | "name"
  | "category"
  | "protein"
  | "calories"
  | "fat"
  | "fiber"
  | "carbs"
  | "price"
  | "score";

export interface FoodTableSortState {
  readonly key: FoodTableSortKey;
  readonly direction: "asc" | "desc";
}

function getSortValue(food: FoodWithDetails, key: FoodTableSortKey): number | string {
  switch (key) {
    case "name":
      return food.name.toLocaleLowerCase("tr-TR");
    case "category":
      return food.category;
    case "protein":
      return food.protein;
    case "calories":
      return food.calories;
    case "fat":
      return food.fat;
    case "fiber":
      return food.fiber;
    case "carbs":
      return food.carbs;
    case "price":
      return food.price?.price_per_kg ?? -1;
    case "score":
      return food.score?.pyf_normalized ?? -1;
  }
}

function getPriorityValue(food: FoodWithDetails, priority: MacroPriority): number {
  switch (priority) {
    case "protein_first":
      return food.protein;
    case "carb_first":
      return food.carbs;
    default:
      return 0;
  }
}

function compareScoreDesc(left: FoodWithDetails, right: FoodWithDetails): number {
  return (right.score?.pyf_normalized ?? -1) - (left.score?.pyf_normalized ?? -1);
}

function compareNameAsc(left: FoodWithDetails, right: FoodWithDetails): number {
  return left.name.localeCompare(right.name, "tr");
}

export function filterFoodsByCategory(
  foods: readonly FoodWithDetails[],
  activeCategory: Category | "all"
): FoodWithDetails[] {
  return activeCategory === "all"
    ? [...foods]
    : foods.filter((food) => food.category === activeCategory);
}

export function getVisibleFoods(options: {
  readonly foods: readonly FoodWithDetails[];
  readonly activeCategory: Category | "all";
  readonly activePriority: MacroPriority;
  readonly sort: FoodTableSortState;
}): FoodWithDetails[] {
  const { foods, activeCategory, activePriority, sort } = options;
  const subset = filterFoodsByCategory(foods, activeCategory);

  return subset.sort((left, right) => {
    if (activePriority !== "default" && sort.key === "score") {
      const priorityResult = getPriorityValue(right, activePriority) - getPriorityValue(left, activePriority);
      if (priorityResult !== 0) {
        return priorityResult;
      }

      const scoreResult = compareScoreDesc(left, right);
      if (scoreResult !== 0) {
        return scoreResult;
      }

      return compareNameAsc(left, right);
    }

    const leftValue = getSortValue(left, sort.key);
    const rightValue = getSortValue(right, sort.key);
    const direction = sort.direction === "asc" ? 1 : -1;

    if (typeof leftValue === "string" && typeof rightValue === "string") {
      const result = leftValue.localeCompare(rightValue, "tr");
      if (result !== 0) {
        return result * direction;
      }
    } else {
      const result = (leftValue as number) - (rightValue as number);
      if (result !== 0) {
        return result * direction;
      }
    }

    if (activePriority !== "default") {
      const priorityResult = getPriorityValue(right, activePriority) - getPriorityValue(left, activePriority);
      if (priorityResult !== 0) {
        return priorityResult;
      }
    }

    const scoreResult = compareScoreDesc(left, right);
    if (scoreResult !== 0) {
      return scoreResult;
    }

    return compareNameAsc(left, right);
  });
}
