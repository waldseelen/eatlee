import { FORMULA_CONFIG } from "./formula.config";
import { buildRankedScores, checkWHOCompliance } from "./scoring";
import { getFirestoreDb } from "./firebase-admin";
import type { Food, Price } from "./types";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";

export interface RecalculateSummary {
  readonly calculatedAt: string;
  readonly foodsProcessed: number;
  readonly foodsSkipped: number;
  readonly skippedFoodIds: readonly string[];
  readonly lastPriceUpdatedAt: string | null;
}

export async function recalculateAllScores(): Promise<RecalculateSummary> {
  const db = getFirestoreDb();

  const [foodsSnap, pricesSnap] = await Promise.all([
    db.collection("foods").orderBy("name").get(),
    db.collection("prices").orderBy("updated_at", "desc").get(),
  ]);

  const foodRows = foodsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
    id: doc.id,
    ...doc.data(),
  })) as Food[];

  const priceRows = pricesSnap.docs.map((doc: QueryDocumentSnapshot) => ({
    id: doc.id,
    ...doc.data(),
  })) as Price[];

  const calculatedAt = new Date().toISOString();

  const { rankedFoods, skippedFoodIds } = buildRankedScores(foodRows, priceRows);

  const complianceUpdates = foodRows.map((food) => ({
    id: food.id,
    who_compliant: checkWHOCompliance(food).compliant,
  }));

  const batch = db.batch();

  for (const update of complianceUpdates) {
    const docRef = db.collection("foods").doc(update.id);
    batch.update(docRef, { who_compliant: update.who_compliant });
  }

  const scoresSnap = await db.collection("scores").get();
  for (const doc of scoresSnap.docs) {
    batch.delete(doc.ref);
  }

  if (rankedFoods.length > 0) {
    for (const row of rankedFoods) {
      const docRef = db.collection("scores").doc(row.food_id);
      batch.set(docRef, {
        food_id: row.food_id,
        pyf_raw: row.pyf_raw,
        pyf_normalized: row.pyf_normalized,
        category_rank: row.category_rank,
        global_rank: row.global_rank,
        tier: row.tier,
        calculated_at: calculatedAt,
      });
    }
  }

  const logRef = db.collection("config_log").doc();
  batch.set(logRef, {
    changed_at: calculatedAt,
    changed_by: "recalculate-scores",
    snapshot: FORMULA_CONFIG as unknown as Record<string, unknown>,
  });

  await batch.commit();

  return {
    calculatedAt,
    foodsProcessed: rankedFoods.length,
    foodsSkipped: skippedFoodIds.length,
    skippedFoodIds,
    lastPriceUpdatedAt: priceRows[0]?.updated_at ?? null,
  };
}
