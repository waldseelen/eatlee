import { calculateAveragePriceMap, calculateLatestPriceMap } from "./scoring";
import type { Food, FoodWithDetails, Price, Score } from "./types";

export function buildFoodWithDetails(
  foods: readonly Food[],
  prices: readonly Price[],
  scores: readonly Score[]
): FoodWithDetails[] {
  const latestPriceMap = calculateLatestPriceMap(prices);
  const averagePriceMap = calculateAveragePriceMap(prices);
  const scoreMap = new Map(scores.map((score) => [score.food_id, score]));

  return foods.map((food) => ({
    ...food,
    price: latestPriceMap.get(food.id) ?? null,
    average_price_per_kg: averagePriceMap.get(food.id) ?? null,
    score: scoreMap.get(food.id) ?? null,
  }));
}

export function formatLastUpdated(value: string | null): string {
  if (!value) {
    return "Not available";
  }

  return new Date(value).toLocaleString("tr-TR", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
