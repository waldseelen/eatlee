"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import type { Category, FoodWithDetails, MacroPriority } from "@/lib/types";
import CompareModal from "./CompareModal";
import FilterBar from "./FilterBar";
import FoodRow from "./FoodRow";

interface FoodTableProps {
  readonly foods: ReadonlyArray<FoodWithDetails>;
}

type SortKey =
  | "name"
  | "category"
  | "protein"
  | "calories"
  | "fat"
  | "fiber"
  | "carbs"
  | "price"
  | "score";

interface SortState {
  readonly key: SortKey;
  readonly direction: "asc" | "desc";
}

const MAX_COMPARE = 4;

const COLUMN_HEADERS: ReadonlyArray<{
  key: SortKey;
  label: string;
  className?: string;
}> = [
  { key: "name", label: "Food" },
  { key: "category", label: "Category", className: "hidden md:table-cell" },
  { key: "protein", label: "Protein" },
  { key: "calories", label: "Calories" },
  { key: "fat", label: "Fat", className: "hidden lg:table-cell" },
  { key: "fiber", label: "Fiber", className: "hidden lg:table-cell" },
  { key: "carbs", label: "Carbs", className: "hidden xl:table-cell" },
  { key: "price", label: "Price/kg" },
  { key: "score", label: "PYF" },
];

function getSortValue(food: FoodWithDetails, key: SortKey): number | string {
  switch (key) {
    case "name":
      return food.name.toLocaleLowerCase("tr-TR");
    case "category":
      return food.category;
    case "protein":
      return food.protein;
    case "calories":
      return food.calories;
    case "fat":
      return food.fat;
    case "fiber":
      return food.fiber;
    case "carbs":
      return food.carbs;
    case "price":
      return food.price?.price_per_kg ?? -1;
    case "score":
      return food.score?.pyf_normalized ?? -1;
  }
}

function getSecondaryMacroValue(food: FoodWithDetails, priority: MacroPriority) {
  switch (priority) {
    case "protein_first":
      return food.protein;
    case "carb_first":
      return food.carbs;
    default:
      return 0;
  }
}

function FoodTableInner({ foods }: FoodTableProps) {
  const searchParams = useSearchParams();
  const activeCategory = (searchParams.get("category") ?? "all") as
    | Category
    | "all";
  const activePriority = (searchParams.get("priority") ?? "default") as MacroPriority;

  const [sort, setSort] = useState<SortState>({
    key: "score",
    direction: "desc",
  });
  const [selectedIds, setSelectedIds] = useState<ReadonlyArray<string>>([]);
  const [showCompare, setShowCompare] = useState(false);

  const handleSort = useCallback((key: SortKey) => {
    setSort((current) => {
      if (current.key === key) {
        return {
          key,
          direction: current.direction === "asc" ? "desc" : "asc",
        };
      }

      return {
        key,
        direction: key === "name" || key === "category" ? "asc" : "desc",
      };
    });
  }, []);

  const toggleSelection = useCallback((foodId: string) => {
    setSelectedIds((current) => {
      if (current.includes(foodId)) {
        return current.filter((id) => id !== foodId);
      }

      if (current.length >= MAX_COMPARE) {
        return current;
      }

      return [...current, foodId];
    });
  }, []);

  const filteredFoods = useMemo(() => {
    const subset =
      activeCategory === "all"
        ? foods
        : foods.filter((food) => food.category === activeCategory);

    return [...subset].sort((left, right) => {
      const leftValue = getSortValue(left, sort.key);
      const rightValue = getSortValue(right, sort.key);
      const direction = sort.direction === "asc" ? 1 : -1;

      if (typeof leftValue === "string" && typeof rightValue === "string") {
        const result = leftValue.localeCompare(rightValue, "tr");
        if (result !== 0) {
          return result * direction;
        }
      } else {
        const result = (leftValue as number) - (rightValue as number);
        if (result !== 0) {
          return result * direction;
        }
      }

      return (
        getSecondaryMacroValue(right, activePriority) -
        getSecondaryMacroValue(left, activePriority)
      );
    });
  }, [activeCategory, activePriority, foods, sort]);

  const selectedFoods = useMemo(
    () => foods.filter((food) => selectedIds.includes(food.id)),
    [foods, selectedIds]
  );

  const selectionAtMax = selectedIds.length >= MAX_COMPARE;

  return (
    <div className="flex flex-col gap-5">
      <Suspense fallback={<div className="h-28 animate-pulse rounded-2xl bg-eatlee-mist" />}>
        <FilterBar />
      </Suspense>

      <div className="flex flex-col gap-2 text-sm text-eatlee-green/60 sm:flex-row sm:items-center sm:justify-between">
        <span>
          Showing {filteredFoods.length} food{filteredFoods.length === 1 ? "" : "s"}
        </span>
        <span>Select 2–4 foods to compare.</span>
      </div>

      {filteredFoods.length === 0 ? (
        <div className="rounded-3xl border border-dashed border-eatlee-green/20 bg-eatlee-cream px-6 py-14 text-center text-sm text-eatlee-green/60">
          No foods match the selected filters.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-3xl border border-eatlee-mist">
          <table className="w-full min-w-[780px] bg-white text-sm">
            <thead className="bg-eatlee-mist/60 text-left text-xs uppercase tracking-[0.16em] text-eatlee-green/55">
              <tr>
                <th className="w-10 px-3 py-3" />
                {COLUMN_HEADERS.map((column) => (
                  <th
                    key={column.key}
                    className={`px-3 py-3 ${column.className ?? ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => handleSort(column.key)}
                      className="inline-flex items-center gap-1 font-semibold transition-colors hover:text-eatlee-green"
                    >
                      {column.label}
                      {sort.key === column.key && (
                        <span className="text-eatlee-green">
                          {sort.direction === "asc" ? "↑" : "↓"}
                        </span>
                      )}
                    </button>
                  </th>
                ))}
                <th className="px-3 py-3 text-center">WHO</th>
              </tr>
            </thead>
            <tbody>
              {filteredFoods.map((food) => (
                <FoodRow
                  key={food.id}
                  food={food}
                  selected={selectedIds.includes(food.id)}
                  selectionDisabled={selectionAtMax}
                  onToggle={toggleSelection}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}

      {selectedIds.length >= 2 && (
        <button
          type="button"
          onClick={() => setShowCompare(true)}
          className="fixed bottom-6 right-6 z-40 rounded-full bg-eatlee-accent px-5 py-3 text-sm font-semibold text-eatlee-green shadow-soft transition-transform hover:-translate-y-0.5"
        >
          Compare ({selectedIds.length})
        </button>
      )}

      {showCompare && (
        <CompareModal foods={selectedFoods} onClose={() => setShowCompare(false)} />
      )}
    </div>
  );
}

export default function FoodTable({ foods }: FoodTableProps) {
  return (
    <Suspense
      fallback={
        <div className="rounded-3xl border border-eatlee-mist bg-white px-6 py-14 text-center text-sm text-eatlee-green/50">
          Loading food table...
        </div>
      }
    >
      <FoodTableInner foods={foods} />
    </Suspense>
  );
}
