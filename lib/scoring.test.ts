import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  assignRanksAndTiers,
  buildRankedScores,
  calculateAveragePriceMap,
  calculateLatestPriceMap,
  calculatePYFScore,
  calculatePriceReference,
  checkWHOCompliance,
  normalizeScores,
} from "./scoring";
import type { PYFInput, ScoredFood } from "./scoring";
import type { Category, Food, Price } from "./types";

function round(value: number, digits = 6): number {
  const factor = Math.pow(10, digits);
  return Math.round(value * factor) / factor;
}

function manualPYF(input: PYFInput): number {
  const safe = (value: number) => Math.max(value, 1e-9);
  const refs = {
    protein: 20,
    calories: 300,
    fat: 15,
    fiber: 5,
  };

  const Pn = safe(input.protein) / refs.protein;
  const Kn = safe(input.calories) / refs.calories;
  const Yn = safe(input.fat) / refs.fat;
  const Ln = safe(input.fiber) / refs.fiber;
  const Fn = safe(input.pricePerKg) / safe(input.priceReference);

  const PKn =
    safe(input.protein / safe(input.calories)) /
    safe(refs.protein / refs.calories);
  const LKn =
    safe(input.fiber / safe(input.calories)) /
    safe(refs.fiber / refs.calories);
  const PFn =
    safe(input.protein / safe(input.pricePerKg)) /
    safe(refs.protein / safe(input.priceReference));

  const A =
    Math.pow(Pn, 0.32) *
    Math.pow(Kn, -0.18) *
    Math.pow(Yn, -0.18) *
    Math.pow(Fn, -0.12);

  const B =
    Math.pow(Ln, 0.08) *
    Math.pow(PKn, 0.05) *
    Math.pow(LKn, 0.03) *
    Math.pow(PFn, 0.04);

  return A * B;
}

function makeScoredFood(id: string, category: Category, pyf_raw: number): ScoredFood {
  return { food_id: id, category, pyf_raw };
}

describe("calculatePYFScore", () => {
  const cases: ReadonlyArray<{ label: string; input: PYFInput }> = [
    {
      label: "reference food",
      input: {
        protein: 20,
        calories: 300,
        fat: 15,
        fiber: 5,
        pricePerKg: 100,
        priceReference: 100,
      },
    },
    {
      label: "chicken breast",
      input: {
        protein: 31,
        calories: 165,
        fat: 3.6,
        fiber: 0,
        pricePerKg: 247.5,
        priceReference: 180,
      },
    },
    {
      label: "eggs",
      input: {
        protein: 12.6,
        calories: 155,
        fat: 10.6,
        fiber: 0,
        pricePerKg: 135,
        priceReference: 180,
      },
    },
    {
      label: "red lentils",
      input: {
        protein: 25.4,
        calories: 358,
        fat: 1.1,
        fiber: 10.7,
        pricePerKg: 60,
        priceReference: 180,
      },
    },
    {
      label: "oats",
      input: {
        protein: 13.2,
        calories: 379,
        fat: 6.5,
        fiber: 10.1,
        pricePerKg: 65,
        priceReference: 180,
      },
    },
    {
      label: "spinach",
      input: {
        protein: 2.9,
        calories: 23,
        fat: 0.4,
        fiber: 2.2,
        pricePerKg: 42.5,
        priceReference: 180,
      },
    },
    {
      label: "salmon",
      input: {
        protein: 20.4,
        calories: 208,
        fat: 13.4,
        fiber: 0,
        pricePerKg: 975,
        priceReference: 180,
      },
    },
    {
      label: "avocado",
      input: {
        protein: 2,
        calories: 160,
        fat: 14.7,
        fiber: 6.7,
        pricePerKg: 60,
        priceReference: 180,
      },
    },
    {
      label: "almonds",
      input: {
        protein: 21.2,
        calories: 579,
        fat: 49.9,
        fiber: 12.5,
        pricePerKg: 700,
        priceReference: 180,
      },
    },
    {
      label: "butter",
      input: {
        protein: 0.9,
        calories: 717,
        fat: 81.1,
        fiber: 0,
        pricePerKg: 465,
        priceReference: 180,
      },
    },
  ];

  for (const testCase of cases) {
    it(`matches manual calculation for ${testCase.label}`, () => {
      const actual = calculatePYFScore(testCase.input);
      const expected = manualPYF(testCase.input);
      assert.equal(round(actual, 8), round(expected, 8));
    });
  }

  it("rewards lower prices when nutrition is the same", () => {
    const cheap = calculatePYFScore({
      protein: 20,
      calories: 300,
      fat: 15,
      fiber: 5,
      pricePerKg: 50,
      priceReference: 100,
    });
    const expensive = calculatePYFScore({
      protein: 20,
      calories: 300,
      fat: 15,
      fiber: 5,
      pricePerKg: 500,
      priceReference: 100,
    });

    assert.ok(cheap > expensive);
  });

  it("handles zero fiber without blowing up", () => {
    const result = calculatePYFScore({
      protein: 25,
      calories: 200,
      fat: 5,
      fiber: 0,
      pricePerKg: 70,
      priceReference: 100,
    });

    assert.ok(Number.isFinite(result));
    assert.ok(result > 0);
  });
});

describe("price helpers", () => {
  const prices: Price[] = [
    {
      id: "p1",
      food_id: "food-a",
      price_per_kg: 50,
      updated_at: "2026-04-01T10:00:00.000Z",
    },
    {
      id: "p2",
      food_id: "food-a",
      price_per_kg: 70,
      updated_at: "2026-04-03T10:00:00.000Z",
    },
    {
      id: "p3",
      food_id: "food-b",
      price_per_kg: 120,
      updated_at: "2026-04-02T10:00:00.000Z",
    },
  ];

  it("calculates average prices per food", () => {
    const averageMap = calculateAveragePriceMap(prices);
    assert.equal(averageMap.get("food-a"), 60);
    assert.equal(averageMap.get("food-b"), 120);
  });

  it("calculates latest prices per food", () => {
    const latestMap = calculateLatestPriceMap(prices);
    assert.equal(latestMap.get("food-a")?.price_per_kg, 70);
    assert.equal(latestMap.get("food-b")?.price_per_kg, 120);
  });

  it("derives a price reference from average prices", () => {
    const reference = calculatePriceReference([60, 120]);
    assert.equal(reference, 90);
  });
});

describe("normalizeScores", () => {
  it("normalizes raw scores to a 0-100 scale", () => {
    const normalized = normalizeScores([
      makeScoredFood("a", "meat_fish", 2),
      makeScoredFood("b", "vegetables", 1),
      makeScoredFood("c", "other", 0.5),
    ]);

    assert.equal(normalized[0].pyf_normalized, 100);
    assert.equal(normalized[1].pyf_normalized, 50);
    assert.equal(normalized[2].pyf_normalized, 25);
  });

  it("returns an empty array when there is nothing to normalize", () => {
    assert.deepEqual(normalizeScores([]), []);
  });
});

describe("assignRanksAndTiers", () => {
  it("assigns category and global ranks", () => {
    const ranked = assignRanksAndTiers([
      { food_id: "m1", category: "meat_fish", pyf_raw: 3, pyf_normalized: 100 },
      { food_id: "m2", category: "meat_fish", pyf_raw: 2, pyf_normalized: 80 },
      { food_id: "v1", category: "vegetables", pyf_raw: 1.5, pyf_normalized: 60 },
      { food_id: "v2", category: "vegetables", pyf_raw: 1, pyf_normalized: 40 },
    ]);

    assert.equal(ranked.find((row) => row.food_id === "m1")?.category_rank, 1);
    assert.equal(ranked.find((row) => row.food_id === "m2")?.category_rank, 2);
    assert.equal(ranked[0].global_rank, 1);
    assert.equal(ranked[1].global_rank, 2);
  });

  it("uses 30/40/30 tier splits within a category", () => {
    const foods = Array.from({ length: 10 }, (_, index) => ({
      food_id: `f${index + 1}`,
      category: "legumes_grains" as Category,
      pyf_raw: 10 - index,
      pyf_normalized: 100 - index * 5,
    }));

    const ranked = assignRanksAndTiers(foods);
    const tiers = ranked
      .slice()
      .sort((left, right) => left.category_rank - right.category_rank)
      .map((row) => row.tier);

    assert.deepEqual(tiers, [
      "good",
      "good",
      "good",
      "mid",
      "mid",
      "mid",
      "mid",
      "low",
      "low",
      "low",
    ]);
  });
});

describe("checkWHOCompliance", () => {
  it("accepts foods that meet all WHO thresholds", () => {
    const result = checkWHOCompliance({
      saturated_fat: 1,
      calories: 300,
      fiber: 5,
      sodium: 100,
    });

    assert.equal(result.compliant, true);
    assert.equal(result.violations.length, 0);
  });

  it("flags saturated fat, fiber, and sodium issues", () => {
    const result = checkWHOCompliance({
      saturated_fat: 10,
      calories: 200,
      fiber: 1,
      sodium: 900,
    });

    assert.equal(result.compliant, false);
    assert.equal(result.violations.length, 3);
  });
});

describe("buildRankedScores", () => {
  it("builds ranked scores from foods and historical prices", () => {
    const foods: Food[] = [
      {
        id: "food-a",
        name: "Food A",
        category: "meat_fish",
        protein: 30,
        calories: 150,
        fat: 5,
        saturated_fat: 1,
        fiber: 0,
        carbs: 0,
        net_carbs: 0,
        sodium: 90,
        is_processed: false,
        who_compliant: false,
        usda_fdc_id: "1",
        created_at: "2026-04-08T00:00:00.000Z",
      },
      {
        id: "food-b",
        name: "Food B",
        category: "legumes_grains",
        protein: 20,
        calories: 350,
        fat: 2,
        saturated_fat: 0.2,
        fiber: 12,
        carbs: 60,
        net_carbs: 48,
        sodium: 40,
        is_processed: false,
        who_compliant: false,
        usda_fdc_id: "2",
        created_at: "2026-04-08T00:00:00.000Z",
      },
    ];

    const prices: Price[] = [
      {
        id: "price-a-1",
        food_id: "food-a",
        price_per_kg: 200,
        updated_at: "2026-04-01T00:00:00.000Z",
      },
      {
        id: "price-a-2",
        food_id: "food-a",
        price_per_kg: 220,
        updated_at: "2026-04-08T00:00:00.000Z",
      },
      {
        id: "price-b-1",
        food_id: "food-b",
        price_per_kg: 60,
        updated_at: "2026-04-08T00:00:00.000Z",
      },
    ];

    const result = buildRankedScores(foods, prices);

    assert.equal(result.rankedFoods.length, 2);
    assert.equal(result.averagePriceMap.get("food-a"), 210);
    assert.equal(result.latestPriceMap.get("food-a")?.price_per_kg, 220);
    assert.equal(result.skippedFoodIds.length, 0);
    assert.equal(result.rankedFoods[0].global_rank, 1);
  });
});
