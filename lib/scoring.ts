import { FORMULA_CONFIG } from "./formula.config";
import type { Category, Food, Price, Tier } from "./types";

export interface PYFInput {
  readonly protein: number;
  readonly calories: number;
  readonly fat: number;
  readonly fiber: number;
  readonly pricePerKg: number;
  readonly priceReference: number;
}

export interface ScoredFood {
  readonly food_id: string;
  readonly category: Category;
  readonly pyf_raw: number;
}

export interface RankedFood {
  readonly food_id: string;
  readonly category: Category;
  readonly pyf_raw: number;
  readonly pyf_normalized: number;
  readonly category_rank: number;
  readonly global_rank: number;
  readonly tier: Tier;
}

export interface WHOComplianceResult {
  readonly compliant: boolean;
  readonly violations: readonly string[];
}

export interface ScoreComputationResult {
  readonly rankedFoods: readonly RankedFood[];
  readonly averagePriceMap: ReadonlyMap<string, number>;
  readonly latestPriceMap: ReadonlyMap<string, Price>;
  readonly priceReference: number;
  readonly skippedFoodIds: readonly string[];
}

const EPSILON = 1e-9;

function safePositive(value: number): number {
  return Math.max(value, EPSILON);
}

function normalize(value: number, reference: number): number {
  return safePositive(value) / safePositive(reference);
}

function average(values: readonly number[]): number {
  if (values.length === 0) {
    return 0;
  }

  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

export function calculateAveragePriceMap(
  prices: readonly Price[]
): ReadonlyMap<string, number> {
  const grouped = new Map<string, number[]>();

  for (const price of prices) {
    const current = grouped.get(price.food_id) ?? [];
    current.push(price.price_per_kg);
    grouped.set(price.food_id, current);
  }

  return new Map(
    [...grouped.entries()].map(([foodId, values]) => [foodId, average(values)])
  );
}

export function calculateLatestPriceMap(
  prices: readonly Price[]
): ReadonlyMap<string, Price> {
  const sorted = [...prices].sort(
    (left, right) =>
      new Date(right.updated_at).getTime() - new Date(left.updated_at).getTime()
  );
  const latest = new Map<string, Price>();

  for (const price of sorted) {
    if (!latest.has(price.food_id)) {
      latest.set(price.food_id, price);
    }
  }

  return latest;
}

export function calculatePriceReference(averagePrices: readonly number[]): number {
  const validPrices = averagePrices.filter((value) => value > 0);
  return validPrices.length > 0 ? average(validPrices) : 1;
}

export function calculatePYFScore(input: PYFInput): number {
  const { weights, references } = FORMULA_CONFIG;

  const Pn = normalize(input.protein, references.protein);
  const Kn = normalize(input.calories, references.calories);
  const Yn = normalize(input.fat, references.fat);
  const Ln = normalize(input.fiber, references.fiber);
  const Fn = normalize(input.pricePerKg, input.priceReference);

  const proteinPerCalorieRef = references.protein / references.calories;
  const fiberPerCalorieRef = references.fiber / references.calories;
  const proteinPerPriceRef = references.protein / safePositive(input.priceReference);

  const PKn = normalize(
    input.protein / safePositive(input.calories),
    proteinPerCalorieRef
  );
  const LKn = normalize(
    input.fiber / safePositive(input.calories),
    fiberPerCalorieRef
  );
  const PFn = normalize(
    input.protein / safePositive(input.pricePerKg),
    proteinPerPriceRef
  );

  const A =
    Math.pow(Pn, weights.protein) *
    Math.pow(Kn, weights.calories) *
    Math.pow(Yn, weights.fat) *
    Math.pow(Fn, weights.price);

  const B =
    Math.pow(Ln, weights.fiber) *
    Math.pow(PKn, weights.proteinPerCalorie) *
    Math.pow(LKn, weights.fiberPerCalorie) *
    Math.pow(PFn, weights.proteinPerPrice);

  return A * B;
}

export function calculatePYFScoreFromFood(
  food: Food,
  pricePerKg: number,
  priceReference: number
): number {
  return calculatePYFScore({
    protein: food.protein,
    calories: food.calories,
    fat: food.fat,
    fiber: food.fiber,
    pricePerKg,
    priceReference,
  });
}

export function normalizeScores(
  scores: readonly ScoredFood[]
): readonly (ScoredFood & { readonly pyf_normalized: number })[] {
  if (scores.length === 0) {
    return [];
  }

  const maxRaw = Math.max(...scores.map((score) => score.pyf_raw));

  if (maxRaw <= 0) {
    return scores.map((score) => ({ ...score, pyf_normalized: 0 }));
  }

  return scores.map((score) => ({
    ...score,
    pyf_normalized: (score.pyf_raw / maxRaw) * 100,
  }));
}

export function assignRanksAndTiers(
  foods: readonly (ScoredFood & { readonly pyf_normalized: number })[]
): readonly RankedFood[] {
  if (foods.length === 0) {
    return [];
  }

  const { goodTierPercentile } = FORMULA_CONFIG.thresholds;
  const categoryRanks = new Map<string, number>();
  const categoryTiers = new Map<string, Tier>();
  const categories = [...new Set(foods.map((food) => food.category))];

  for (const category of categories) {
    const categoryFoods = foods
      .filter((food) => food.category === category)
      .slice()
      .sort((left, right) => right.pyf_normalized - left.pyf_normalized);

    const goodCount = Math.max(1, Math.ceil(categoryFoods.length * goodTierPercentile));
    const midCount = Math.ceil(categoryFoods.length * 0.4);

    categoryFoods.forEach((food, index) => {
      const rank = index + 1;
      categoryRanks.set(food.food_id, rank);

      let tier: Tier = "low";
      if (rank <= goodCount) {
        tier = "good";
      } else if (rank <= goodCount + midCount) {
        tier = "mid";
      }

      categoryTiers.set(food.food_id, tier);
    });
  }

  const globalSorted = foods
    .slice()
    .sort((left, right) => right.pyf_normalized - left.pyf_normalized);

  return globalSorted.map((food, index) => ({
    food_id: food.food_id,
    category: food.category,
    pyf_raw: food.pyf_raw,
    pyf_normalized: food.pyf_normalized,
    category_rank: categoryRanks.get(food.food_id) ?? 0,
    global_rank: index + 1,
    tier: categoryTiers.get(food.food_id) ?? "low",
  }));
}

export function checkWHOCompliance(
  food: Pick<Food, "saturated_fat" | "calories" | "fiber" | "sodium">
): WHOComplianceResult {
  const violations: string[] = [];
  const { who } = FORMULA_CONFIG;

  const saturatedFatCalories = food.saturated_fat * 9;
  const saturatedFatPct =
    food.calories > 0 ? (saturatedFatCalories / food.calories) * 100 : 0;

  if (saturatedFatPct > who.maxSaturatedFatPct) {
    violations.push(
      `Saturated fat is ${saturatedFatPct.toFixed(1)}% of calories (max ${who.maxSaturatedFatPct}%)`
    );
  }

  if (food.fiber < who.minFiberPer100g) {
    violations.push(
      `Fiber is ${food.fiber}g per 100g (min ${who.minFiberPer100g}g)`
    );
  }

  if (food.sodium > who.maxSodiumPer100g) {
    violations.push(
      `Sodium is ${food.sodium}mg per 100g (max ${who.maxSodiumPer100g}mg)`
    );
  }

  return {
    compliant: violations.length === 0,
    violations,
  };
}

export function buildRankedScores(
  foods: readonly Food[],
  prices: readonly Price[]
): ScoreComputationResult {
  const averagePriceMap = calculateAveragePriceMap(prices);
  const latestPriceMap = calculateLatestPriceMap(prices);
  const priceReference = calculatePriceReference([
    ...averagePriceMap.values(),
  ]);

  const scoredFoods: ScoredFood[] = [];
  const skippedFoodIds: string[] = [];

  for (const food of foods) {
    const averagePrice = averagePriceMap.get(food.id);

    if (!averagePrice || averagePrice <= 0) {
      skippedFoodIds.push(food.id);
      continue;
    }

    scoredFoods.push({
      food_id: food.id,
      category: food.category,
      pyf_raw: calculatePYFScoreFromFood(food, averagePrice, priceReference),
    });
  }

  const normalized = normalizeScores(scoredFoods);
  const rankedFoods = assignRanksAndTiers(normalized);

  return {
    rankedFoods,
    averagePriceMap,
    latestPriceMap,
    priceReference,
    skippedFoodIds,
  };
}
