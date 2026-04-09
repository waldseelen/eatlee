import FoodTable from "@/components/FoodTable";
import { buildFoodWithDetails, formatLastUpdated } from "@/lib/data";
import { getPublicClient, hasPublicSupabaseEnv } from "@/lib/supabase";
import type { Food, Price, Score } from "@/lib/types";

async function getHomeData() {
  if (!hasPublicSupabaseEnv()) {
    return {
      foods: [],
      lastUpdated: null,
      error: null,
      setupRequired: true,
    };
  }

  const supabase = getPublicClient();
  const [{ data: foods, error: foodsError }, { data: prices, error: pricesError }, { data: scores, error: scoresError }] =
    await Promise.all([
      supabase.from("foods").select("*").order("name"),
      supabase.from("prices").select("*").order("updated_at", { ascending: false }),
      supabase.from("scores").select("*").order("global_rank"),
    ]);

  const error = foodsError ?? pricesError ?? scoresError;

  if (error) {
    return {
      foods: [],
      lastUpdated: null,
      error: error.message,
      setupRequired: false,
    };
  }

  const priceRows = (prices ?? []) as Price[];

  return {
    foods: buildFoodWithDetails(
      (foods ?? []) as Food[],
      priceRows,
      (scores ?? []) as Score[]
    ),
    lastUpdated: priceRows[0]?.updated_at ?? null,
    error: null,
    setupRequired: false,
  };
}

function SetupState() {
  return (
    <div className="rounded-3xl border border-dashed border-eatlee-green/20 bg-white p-8 text-sm text-eatlee-green/80 shadow-soft">
      <h2 className="font-heading text-2xl font-bold text-eatlee-green">
        Supabase connection required
      </h2>
      <p className="mt-3 max-w-2xl leading-7">
        Add <code>NEXT_PUBLIC_SUPABASE_URL</code> and
        <code> NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to start loading foods,
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
  const { foods, lastUpdated, error, setupRequired } = await getHomeData();

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:px-8">
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
