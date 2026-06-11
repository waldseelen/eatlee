import { getFirestoreDb } from "../lib/firebase-admin";
import { recalculateAllScores } from "../lib/recalculate";
import { loadLocalEnv } from "./load-env";
import * as fs from "node:fs";
import * as path from "node:path";
import { parse } from "node:path";

loadLocalEnv();

const ROOT = path.resolve(__dirname, "..");
const DRYRUN_JSON_PATH = path.join(ROOT, "scripts", "data", "eatlee-dryrun.json");
const PRICES_CSV_PATH = path.join(ROOT, "scripts", "data", "initial-prices.csv");

function parseCSV(content: string): Array<{ name: string; avg_price: number }> {
  const lines = content.split(/\r?\n/);
  const result: Array<{ name: string; avg_price: number }> = [];
  
  if (lines.length <= 1) return result;
  
  // Skip header
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

async function migrate() {
  const db = getFirestoreDb();
  console.log("[migration] Firestore client initialized.");

  let foods: any[] = [];
  let prices: any[] = [];

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  let migratedFromRemote = false;

  if (supabaseUrl && serviceRoleKey) {
    console.log("[migration] Attempting to pull data from Supabase REST API...");
    try {
      const foodsRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/foods?select=*`, {
        headers: {
          apikey: serviceRoleKey,
          Authorization: `Bearer ${serviceRoleKey}`,
        },
      });

      if (foodsRes.ok) {
        foods = await foodsRes.json();
        const pricesRes = await fetch(`${supabaseUrl.replace(/\/$/, "")}/rest/v1/prices?select=*`, {
          headers: {
            apikey: serviceRoleKey,
            Authorization: `Bearer ${serviceRoleKey}`,
          },
        });
        if (pricesRes.ok) {
          prices = await pricesRes.json();
          migratedFromRemote = true;
          console.log(`[migration] Successfully fetched ${foods.length} foods and ${prices.length} prices from remote Supabase.`);
        }
      } else {
        console.log(`[migration] Supabase returned status ${foodsRes.status}. Falling back to offline migration.`);
      }
    } catch (err: any) {
      console.log(`[migration] Remote fetch failed (${err.message}). Falling back to offline migration.`);
    }
  } else {
    console.log("[migration] Supabase environment variables not found. Using local data fallback.");
  }

  if (!migratedFromRemote) {
    console.log("[migration] Loading fallback data from eatlee-dryrun.json and initial-prices.csv...");
    if (!fs.existsSync(DRYRUN_JSON_PATH)) {
      throw new Error(`Fallback file not found: ${DRYRUN_JSON_PATH}`);
    }
    if (!fs.existsSync(PRICES_CSV_PATH)) {
      throw new Error(`Fallback file not found: ${PRICES_CSV_PATH}`);
    }

    const dryrunFoods = JSON.parse(fs.readFileSync(DRYRUN_JSON_PATH, "utf8"));
    // Add temporary or generated IDs if missing
    foods = dryrunFoods.map((f: any, idx: number) => ({
      id: f.id || `food_fallback_${idx + 1}`,
      name: f.name,
      category: f.category,
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
    }));

    const localPrices = parseCSV(fs.readFileSync(PRICES_CSV_PATH, "utf8"));
    const priceMap = new Map(localPrices.map((p) => [p.name, p.avg_price]));

    prices = foods.map((f, idx) => {
      const priceVal = priceMap.get(f.name) || 0;
      return {
        id: `price_fallback_${idx + 1}`,
        food_id: f.id,
        price_per_kg: priceVal,
        updated_at: new Date().toISOString(),
      };
    }).filter((p) => p.price_per_kg > 0);

    console.log(`[migration] Prepared ${foods.length} foods and ${prices.length} prices from local offline files.`);
  }

  // Upload to Firestore using batch writes
  console.log("[migration] Uploading to Firestore...");

  // Write foods in batches of 400
  const foodsBatch = db.batch();
  for (const food of foods) {
    const { id, ...data } = food;
    foodsBatch.set(db.collection("foods").doc(id), data);
  }
  await foodsBatch.commit();
  console.log(`[migration] Wrote ${foods.length} foods documents.`);

  // Write prices in batches of 400 (if there are more than 400 prices, we write them in chunks)
  const priceChunks: any[][] = [];
  for (let i = 0; i < prices.length; i += 400) {
    priceChunks.push(prices.slice(i, i + 400));
  }

  for (const chunk of priceChunks) {
    const batch = db.batch();
    for (const price of chunk) {
      const { id, ...data } = price;
      batch.set(db.collection("prices").doc(id), data);
    }
    await batch.commit();
  }
  console.log(`[migration] Wrote ${prices.length} prices documents.`);

  // Trigger score recalculation to buildscores, ranks, tiers, config log
  console.log("[migration] Running initial score recalculation...");
  const summary = await recalculateAllScores();
  console.log("[migration] Score recalculation completed.");
  console.log(`[migration] Foods processed: ${summary.foodsProcessed}`);
  console.log(`[migration] Configuration log recorded.`);
  console.log("[migration] Database migration completed successfully!");
}

migrate().catch((err) => {
  console.error("[migration] Fatal migration error:", err);
  process.exit(1);
});
