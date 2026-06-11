import FoodTable from "@/components/FoodTable";
import { buildFoodWithDetails, formatLastUpdated } from "@/lib/data";
import { getFirestoreDb, hasServiceFirebaseEnv } from "@/lib/firebase-admin";
import type { Food, Price, Score, Category } from "@/lib/types";
import type { QueryDocumentSnapshot } from "firebase-admin/firestore";
import * as fs from "node:fs";
import * as path from "node:path";
import { buildRankedScores } from "@/lib/scoring";

interface FallbackFood {
  id?: string;
  name: string;
  category: string;
  protein: number;
  calories: number;
  fat: number;
  saturated_fat: number;
  fiber: number;
  carbs: number;
  net_carbs: number;
  sodium: number;
  is_processed: boolean;
  who_compliant: boolean;
  usda_fdc_id: string | null;
  created_at?: string;
}

function loadCSV(content: string): Array<{ name: string; avg_price: number }> {
  const lines = content.split(/\r?\n/);
  const result: Array<{ name: string; avg_price: number }> = [];
  if (lines.length <= 1) return result;
  
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    const parts = line.split(",");
    if (parts.length >= 2) {
      result.push({
        name: parts[0].trim(),
        avg_price: parseFloat(parts[1].trim()) || 0,
      });
    }
  }
  return result;
}

async function getHomeData() {
  if (!hasServiceFirebaseEnv()) {
    try {
      const dryrunPath = path.resolve(process.cwd(), "scripts/data/eatlee-dryrun.json");
      const pricesPath = path.resolve(process.cwd(), "scripts/data/initial-prices.csv");
      
      if (!fs.existsSync(dryrunPath) || !fs.existsSync(pricesPath)) {
        return {
          foods: [],
          lastUpdated: null,
          error: "Fallback data files not found.",
          setupRequired: true,
          previewMode: false,
        };
      }

      const dryrunFoods = JSON.parse(fs.readFileSync(dryrunPath, "utf8")) as FallbackFood[];
      const foods = dryrunFoods.map((f, idx) => ({
        id: f.id || `food_preview_${idx + 1}`,
        name: f.name,
        category: f.category as Category,
        protein: f.protein,
        calories: f.calories,
        fat: f.fat,
        saturated_fat: f.saturated_fat,
        fiber: f.fiber,
        carbs: f.carbs,
        net_carbs: f.net_carbs,
        sodium: f.sodium,
        is_processed: f.is_processed,
        who_compliant: f.who_compliant,
        usda_fdc_id: f.usda_fdc_id,
        created_at: f.created_at || new Date().toISOString(),
      })) as Food[];

      const csvContent = fs.readFileSync(pricesPath, "utf8");
      const localPrices = loadCSV(csvContent);
      const priceMap = new Map(localPrices.map((p) => [p.name, p.avg_price]));

      const prices = foods.map((f, idx) => {
        const priceVal = priceMap.get(f.name) || 0;
        return {
          id: `price_preview_${idx + 1}`,
          food_id: f.id,
          price_per_kg: priceVal,
          updated_at: new Date().toISOString(),
        };
      }).filter((p) => p.price_per_kg > 0) as Price[];

      const { rankedFoods } = buildRankedScores(foods, prices);
      const scores = rankedFoods.map((row) => ({
        id: `score_preview_${row.food_id}`,
        food_id: row.food_id,
        pyf_raw: row.pyf_raw,
        pyf_normalized: row.pyf_normalized,
        category_rank: row.category_rank,
        global_rank: row.global_rank,
        tier: row.tier,
        calculated_at: new Date().toISOString(),
      })) as Score[];

      return {
        foods: buildFoodWithDetails(foods, prices, scores),
        lastUpdated: prices[0]?.updated_at ?? null,
        error: null,
        setupRequired: false,
        previewMode: true,
      };
    } catch (e) {
      return {
        foods: [],
        lastUpdated: null,
        error: e instanceof Error ? e.message : "Failed to load preview data.",
        setupRequired: true,
        previewMode: false,
      };
    }
  }

  try {
    const db = getFirestoreDb();
    const [foodsSnap, pricesSnap, scoresSnap] = await Promise.all([
      db.collection("foods").orderBy("name").get(),
      db.collection("prices").orderBy("updated_at", "desc").get(),
      db.collection("scores").orderBy("global_rank").get(),
    ]);

    const foods = foodsSnap.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    })) as Food[];

    const prices = pricesSnap.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    })) as Price[];

    const scores = scoresSnap.docs.map((doc: QueryDocumentSnapshot) => ({
      id: doc.id,
      ...doc.data(),
    })) as Score[];

    return {
      foods: buildFoodWithDetails(foods, prices, scores),
      lastUpdated: prices[0]?.updated_at ?? null,
      error: null,
      setupRequired: false,
      previewMode: false,
    };
  } catch (error) {
    return {
      foods: [],
      lastUpdated: null,
      error: error instanceof Error ? error.message : "Data could not be loaded.",
      setupRequired: false,
      previewMode: false,
    };
  }
}

function SetupState() {
  return (
    <div className="rounded-3xl border border-dashed border-eatlee-green/20 bg-white p-8 text-sm text-eatlee-green/80 shadow-soft">
      <h2 className="font-heading text-2xl font-bold text-eatlee-green">
        Firebase connection required
      </h2>
      <p className="mt-3 max-w-2xl leading-7">
        Add <code>NEXT_PUBLIC_FIREBASE_PROJECT_ID</code>,
        <code> FIREBASE_CLIENT_EMAIL</code>, and
        <code> FIREBASE_PRIVATE_KEY</code> to start loading foods,
        prices, and scores.
      </p>
    </div>
  );
}

function ErrorState({ message }: { message: string }) {
  return (
    <div className="rounded-3xl border border-eatlee-coral/20 bg-white p-8 text-sm text-eatlee-coral shadow-soft">
      <h2 className="font-heading text-2xl font-bold">Data could not be loaded</h2>
      <p className="mt-3 leading-7">{message}</p>
    </div>
  );
}

export default async function Home() {
  const { foods, lastUpdated, error, setupRequired, previewMode } = await getHomeData();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
      {previewMode && (
        <div className="rounded-2xl bg-amber-50 border border-amber-200 px-4 py-3 text-sm text-amber-800 flex items-center justify-between shadow-soft">
          <span>
            ⚠️ <strong>Preview Mode:</strong> Running offline using local data files. To connect to Cloud Firestore, configure your Firebase environment variables.
          </span>
        </div>
      )}

      <header className="overflow-hidden rounded-[2rem] bg-eatlee-green px-6 py-10 text-white shadow-soft sm:px-10">
        <p className="text-sm uppercase tracking-[0.2em] text-white/70">
          Statistical nutrition reference
        </p>
        <h1 className="mt-4 font-heading text-4xl font-bold sm:text-5xl">
          Eatlee
        </h1>
        <p className="mt-4 max-w-3xl text-base leading-7 text-white/80 sm:text-lg">
          Whole foods ranked by the PYF score so athletes and health-conscious
          users can compare protein, fiber, calories, fat, and price in one
          place.
        </p>
        <div className="mt-6 flex flex-wrap gap-3 text-sm text-white/80">
          <span className="rounded-full border border-white/15 px-3 py-1.5">
            PYF formula from formula.config.ts
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1.5">
            WHO compliance badge per food
          </span>
          <span className="rounded-full border border-white/15 px-3 py-1.5">
            Compare up to 4 foods side-by-side
          </span>
        </div>
      </header>

      <section className="rounded-[2rem] bg-white p-5 shadow-soft sm:p-6">
        <div className="mb-5 flex flex-col gap-3 border-b border-eatlee-mist pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-eatlee-green">
              Food rankings
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-eatlee-green/70">
              Browse by category, switch macro priority, sort by nutrient columns,
              and compare foods without leaving the table.
            </p>
          </div>
          <div className="text-sm text-eatlee-green/60">
            Last updated: {formatLastUpdated(lastUpdated)}
          </div>
        </div>

        {setupRequired ? (
          <SetupState />
        ) : error ? (
          <ErrorState message={error} />
        ) : (
          <FoodTable foods={foods} />
        )}
      </section>

      <footer className="pb-6 text-center text-sm text-eatlee-green/50">
        Eatlee uses USDA FoodData Central values, monthly price updates, and a
        normalized 0–100 PYF score.
      </footer>
    </main>
  );
}
