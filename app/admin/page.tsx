"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getAccessToken } from "@/lib/auth";
import { CATEGORY_LABELS, type Category, type Food, type Price } from "@/lib/types";
import { getBrowserClient } from "@/lib/supabase";

interface FoodWithPrice extends Food {
  currentPrice: number | null;
}

interface SaveResponse {
  success: boolean;
  message?: string;
  summary?: {
    calculatedAt: string;
    foodsProcessed: number;
    foodsSkipped: number;
  };
}

function isValidPrice(value: string): boolean {
  if (value.trim() === "") {
    return true;
  }

  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0;
}

function formatTimestamp(value: string | null): string {
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

export default function AdminPage() {
  const [foods, setFoods] = useState<readonly FoodWithPrice[]>([]);
  const [priceInputs, setPriceInputs] = useState<ReadonlyMap<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [filterCategory, setFilterCategory] = useState<Category | "all">("all");
  const [lastUpdated, setLastUpdated] = useState<string | null>(null);
  const [toast, setToast] = useState<{
    type: "success" | "error";
    message: string;
  } | null>(null);

  const showToast = useCallback((message: string, type: "success" | "error") => {
    setToast({ message, type });
    window.clearTimeout((showToast as typeof showToast & { timer?: number }).timer);
    (showToast as typeof showToast & { timer?: number }).timer = window.setTimeout(
      () => setToast(null),
      4000
    );
  }, []);

  const fetchFoods = useCallback(async () => {
    setLoading(true);
    const supabase = getBrowserClient();

    const [{ data: foodRows, error: foodsError }, { data: priceRows, error: pricesError }] =
      await Promise.all([
        supabase.from("foods").select("*").order("category").order("name"),
        supabase.from("prices").select("*").order("updated_at", { ascending: false }),
      ]);

    if (foodsError || pricesError) {
      showToast(
        foodsError?.message ?? pricesError?.message ?? "Data could not be loaded.",
        "error"
      );
      setLoading(false);
      return;
    }

    const latestPriceMap = new Map<string, Price>();
    for (const price of (priceRows ?? []) as Price[]) {
      if (!latestPriceMap.has(price.food_id)) {
        latestPriceMap.set(price.food_id, price);
      }
    }

    const mappedFoods = ((foodRows ?? []) as Food[]).map((food) => ({
      ...food,
      currentPrice: latestPriceMap.get(food.id)?.price_per_kg ?? null,
    }));

    setFoods(mappedFoods);
    setLastUpdated((priceRows as Price[] | null)?.[0]?.updated_at ?? null);
    setPriceInputs(
      new Map(
        mappedFoods.map((food) => [
          food.id,
          food.currentPrice !== null ? String(food.currentPrice) : "",
        ])
      )
    );
    setLoading(false);
  }, [showToast]);

  useEffect(() => {
    fetchFoods();
  }, [fetchFoods]);

  const filteredFoods = useMemo(() => {
    return filterCategory === "all"
      ? foods
      : foods.filter((food) => food.category === filterCategory);
  }, [filterCategory, foods]);

  const changedPrices = useMemo(() => {
    return foods
      .map((food) => {
        const nextValue = priceInputs.get(food.id) ?? "";
        const currentValue = food.currentPrice !== null ? String(food.currentPrice) : "";

        if (nextValue.trim() === "" || nextValue === currentValue || !isValidPrice(nextValue)) {
          return null;
        }

        return {
          foodId: food.id,
          name: food.name,
          pricePerKg: Number(nextValue),
        };
      })
      .filter((row): row is { foodId: string; name: string; pricePerKg: number } => row !== null);
  }, [foods, priceInputs]);

  const invalidPriceExists = useMemo(() => {
    return [...priceInputs.values()].some((value) => !isValidPrice(value));
  }, [priceInputs]);

  async function handleSaveAll() {
    if (changedPrices.length === 0) {
      showToast("No price changes to save.", "error");
      return;
    }

    if (invalidPriceExists) {
      showToast("Some prices are invalid. Fix them before saving.", "error");
      return;
    }

    const accessToken = await getAccessToken();

    if (!accessToken) {
      showToast("Admin session missing. Sign in again.", "error");
      return;
    }

    setSaving(true);

    try {
      const response = await fetch("/api/admin/prices", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${accessToken}`,
        },
        body: JSON.stringify({ prices: changedPrices }),
      });

      const payload = (await response.json().catch(() => ({}))) as SaveResponse;

      if (!response.ok || !payload.success) {
        showToast(payload.message ?? "Prices could not be saved.", "error");
        setSaving(false);
        return;
      }

      showToast(
        `${changedPrices.length} price update(s) saved. Scores recalculated.`,
        "success"
      );
      await fetchFoods();
    } catch (error) {
      showToast(
        error instanceof Error ? error.message : "Unexpected save error.",
        "error"
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="rounded-[2rem] bg-white px-6 py-16 text-center text-eatlee-green/60 shadow-soft">
        Loading foods...
      </div>
    );
  }

  return (
    <section className="space-y-5">
      {toast && (
        <div
          className={`fixed right-4 top-4 z-50 rounded-2xl px-4 py-3 text-sm shadow-soft ${
            toast.type === "success"
              ? "bg-emerald-50 text-emerald-700"
              : "bg-red-50 text-red-700"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="rounded-[2rem] bg-white p-5 shadow-soft sm:p-6">
        <div className="flex flex-col gap-4 border-b border-eatlee-mist pb-5 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="font-heading text-2xl font-bold text-eatlee-green">
              Monthly price entry
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-eatlee-green/60">
              Save new price rows to the <code>prices</code> table and trigger a
              full PYF recalculation for every food.
            </p>
            <p className="mt-2 text-sm text-eatlee-green/50">
              Last updated: {formatTimestamp(lastUpdated)}
            </p>
          </div>

          <button
            type="button"
            onClick={handleSaveAll}
            disabled={saving || changedPrices.length === 0}
            className="rounded-full bg-eatlee-accent px-5 py-3 text-sm font-semibold text-eatlee-green transition hover:brightness-95 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {saving
              ? "Saving..."
              : `Save all${changedPrices.length > 0 ? ` (${changedPrices.length})` : ""}`}
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2 text-sm text-eatlee-green/60">
            <label htmlFor="category-filter" className="font-medium text-eatlee-green">
              Category
            </label>
            <select
              id="category-filter"
              value={filterCategory}
              onChange={(event) => setFilterCategory(event.target.value as Category | "all")}
              className="rounded-full border border-eatlee-mist bg-white px-3 py-2 text-sm text-eatlee-green outline-none focus:border-eatlee-green"
            >
              <option value="all">All categories</option>
              {(Object.entries(CATEGORY_LABELS) as [Category, string][]).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
          <p className="text-sm text-eatlee-green/50">
            {filteredFoods.length} food{filteredFoods.length === 1 ? "" : "s"}
          </p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-[2rem] bg-white shadow-soft">
        <table className="w-full min-w-[640px] text-sm">
          <thead className="bg-eatlee-mist/60 text-left text-xs uppercase tracking-[0.16em] text-eatlee-green/55">
            <tr>
              <th className="px-4 py-3">Food</th>
              <th className="px-4 py-3">Category</th>
              <th className="px-4 py-3 text-right">Current price / kg</th>
            </tr>
          </thead>
          <tbody>
            {filteredFoods.map((food, index) => {
              const value = priceInputs.get(food.id) ?? "";
              const changed = value !== (food.currentPrice !== null ? String(food.currentPrice) : "");
              const valid = isValidPrice(value);

              return (
                <tr
                  key={food.id}
                  className={`border-b border-eatlee-mist/80 last:border-b-0 ${
                    index % 2 === 0 ? "bg-white" : "bg-eatlee-cream/40"
                  }`}
                >
                  <td className="px-4 py-3 font-medium text-eatlee-green">{food.name}</td>
                  <td className="px-4 py-3 text-eatlee-green/60">
                    {CATEGORY_LABELS[food.category]}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <input
                      type="text"
                      inputMode="decimal"
                      value={value}
                      onChange={(event) => {
                        const nextValue = event.target.value;
                        setPriceInputs((current) => {
                          const next = new Map(current);
                          next.set(food.id, nextValue);
                          return next;
                        });
                      }}
                      className={`w-28 rounded-full border px-3 py-2 text-right tabular-nums outline-none transition ${
                        !valid
                          ? "border-red-300 bg-red-50"
                          : changed
                          ? "border-eatlee-accent bg-eatlee-accent/10"
                          : "border-eatlee-mist bg-white"
                      }`}
                      aria-label={`${food.name} price per kilogram`}
                    />
                  </td>
                </tr>
              );
            })}

            {filteredFoods.length === 0 && (
              <tr>
                <td colSpan={3} className="px-4 py-12 text-center text-eatlee-green/50">
                  No foods found for this category.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}
