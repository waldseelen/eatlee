import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { filterFoodsByCategory, getVisibleFoods, type FoodTableSortState } from "./food-table";
import type { Category, FoodWithDetails, Tier } from "./types";

function makeFood(input: {
  id: string;
  name: string;
  category: Category;
  protein: number;
  carbs: number;
  score: number;
  tier?: Tier;
}): FoodWithDetails {
  return {
    id: input.id,
    name: input.name,
    category: input.category,
    protein: input.protein,
    calories: 100,
    fat: 5,
    saturated_fat: 1,
    fiber: 3,
    carbs: input.carbs,
    net_carbs: Math.max(input.carbs - 3, 0),
    sodium: 50,
    is_processed: false,
    who_compliant: true,
    usda_fdc_id: input.id,
    created_at: "2026-04-09T00:00:00.000Z",
    price: {
      id: `price-${input.id}`,
      food_id: input.id,
      price_per_kg: 100,
      updated_at: "2026-04-09T00:00:00.000Z",
    },
    average_price_per_kg: 100,
    score: {
      id: `score-${input.id}`,
      food_id: input.id,
      pyf_raw: input.score / 100,
      pyf_normalized: input.score,
      category_rank: 1,
      global_rank: 1,
      tier: input.tier ?? "good",
      calculated_at: "2026-04-09T00:00:00.000Z",
    },
  };
}

const DEFAULT_SORT: FoodTableSortState = {
  key: "score",
  direction: "desc",
};

describe("food table filters", () => {
  const foods: FoodWithDetails[] = [
    makeFood({
      id: "1",
      name: "High Score Low Protein",
      category: "vegetables",
      protein: 5,
      carbs: 10,
      score: 95,
    }),
    makeFood({
      id: "2",
      name: "High Protein",
      category: "vegetables",
      protein: 30,
      carbs: 12,
      score: 80,
    }),
    makeFood({
      id: "3",
      name: "High Carb",
      category: "legumes_grains",
      protein: 12,
      carbs: 65,
      score: 75,
    }),
  ];

  it("filters by category", () => {
    const filtered = filterFoodsByCategory(foods, "vegetables");
    assert.equal(filtered.length, 2);
    assert.ok(filtered.every((food) => food.category === "vegetables"));
  });

  it("keeps score-first ordering for default priority", () => {
    const visible = getVisibleFoods({
      foods,
      activeCategory: "all",
      activePriority: "default",
      sort: DEFAULT_SORT,
    });

    assert.deepEqual(
      visible.map((food) => food.name),
      ["High Score Low Protein", "High Protein", "High Carb"]
    );
  });

  it("moves highest-protein foods first when protein-first is selected", () => {
    const visible = getVisibleFoods({
      foods,
      activeCategory: "all",
      activePriority: "protein_first",
      sort: DEFAULT_SORT,
    });

    assert.deepEqual(
      visible.map((food) => food.name),
      ["High Protein", "High Carb", "High Score Low Protein"]
    );
  });

  it("moves highest-carb foods first when carb-first is selected", () => {
    const visible = getVisibleFoods({
      foods,
      activeCategory: "all",
      activePriority: "carb_first",
      sort: DEFAULT_SORT,
    });

    assert.deepEqual(
      visible.map((food) => food.name),
      ["High Carb", "High Protein", "High Score Low Protein"]
    );
  });

  it("still respects explicit column sorting when a header sort is chosen", () => {
    const visible = getVisibleFoods({
      foods,
      activeCategory: "all",
      activePriority: "protein_first",
      sort: {
        key: "name",
        direction: "asc",
      },
    });

    assert.deepEqual(
      visible.map((food) => food.name),
      ["High Carb", "High Protein", "High Score Low Protein"]
    );
  });
});
