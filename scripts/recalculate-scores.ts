import { recalculateAllScores } from "../lib/recalculate";
import { loadLocalEnv } from "./load-env";

loadLocalEnv();

async function main() {
  const startedAt = Date.now();
  const summary = await recalculateAllScores();

  console.log("[recalculate] Score recalculation completed.");
  console.log(`[recalculate] Foods processed: ${summary.foodsProcessed}`);
  console.log(`[recalculate] Foods skipped: ${summary.foodsSkipped}`);
  console.log(`[recalculate] Calculated at: ${summary.calculatedAt}`);

  if (summary.skippedFoodIds.length > 0) {
    console.log(
      `[recalculate] Skipped food ids: ${summary.skippedFoodIds.join(", ")}`
    );
  }

  console.log(`[recalculate] Finished in ${Date.now() - startedAt}ms.`);
}

main().catch((error) => {
  console.error("[recalculate] Fatal error", error);
  process.exit(1);
});
