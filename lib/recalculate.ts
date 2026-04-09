import { FORMULA_CONFIG } from "./formula.config";
import { buildRankedScores, checkWHOCompliance } from "./scoring";
import { getServiceClient } from "./supabase";
import type { Food, Price } from "./types";

export interface RecalculateSummary {
  readonly calculatedAt: string;
  readonly foodsProcessed: number;
  readonly foodsSkipped: number;
  readonly skippedFoodIds: readonly string[];
  readonly lastPriceUpdatedAt: string | null;
}

export async function recalculateAllScores(): Promise<RecalculateSummary> {
  const supabase = getServiceClient();

  const [{ data: foods, error: foodsError }, { data: prices, error: pricesError }] =
    await Promise.all([
      supabase.from("foods").select("*").order("name"),
      supabase.from("prices").select("*").order("updated_at", { ascending: false }),
    ]);

  if (foodsError) {
    throw new Error(`Failed to fetch foods: ${foodsError.message}`);
  }

  if (pricesError) {
    throw new Error(`Failed to fetch prices: ${pricesError.message}`);
  }

  const foodRows = (foods ?? []) as Food[];
  const priceRows = (prices ?? []) as Price[];
  const calculatedAt = new Date().toISOString();

  const { rankedFoods, skippedFoodIds } = buildRankedScores(foodRows, priceRows);

  const complianceUpdates = foodRows.map((food) => ({
    id: food.id,
    who_compliant: checkWHOCompliance(food).compliant,
  }));

  for (const update of complianceUpdates) {
    const { error } = await supabase
      .from("foods")
      .update({ who_compliant: update.who_compliant })
      .eq("id", update.id);

    if (error) {
      throw new Error(`Failed to update WHO compliance: ${error.message}`);
    }
  }

  const { error: clearError } = await supabase
    .from("scores")
    .delete()
    .not("id", "is", null);

  if (clearError) {
    throw new Error(`Failed to clear scores: ${clearError.message}`);
  }

  if (rankedFoods.length > 0) {
    const { error: insertError } = await supabase.from("scores").insert(
      rankedFoods.map((row) => ({
        food_id: row.food_id,
        pyf_raw: row.pyf_raw,
        pyf_normalized: row.pyf_normalized,
        category_rank: row.category_rank,
        global_rank: row.global_rank,
        tier: row.tier,
        calculated_at: calculatedAt,
      }))
    );

    if (insertError) {
      throw new Error(`Failed to insert scores: ${insertError.message}`);
    }
  }

  const { error: configLogError } = await supabase.from("config_log").insert({
    changed_at: calculatedAt,
    changed_by: "recalculate-scores",
    snapshot: FORMULA_CONFIG as unknown as Record<string, unknown>,
  });

  if (configLogError) {
    throw new Error(`Failed to log formula snapshot: ${configLogError.message}`);
  }

  return {
    calculatedAt,
    foodsProcessed: rankedFoods.length,
    foodsSkipped: skippedFoodIds.length,
    skippedFoodIds,
    lastPriceUpdatedAt: priceRows[0]?.updated_at ?? null,
  };
}
