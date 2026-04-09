"use client";

import { useCallback } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { CATEGORY_LABELS, type Category, type MacroPriority } from "@/lib/types";

const ALL_CATEGORIES: ReadonlyArray<Category | "all"> = [
  "all",
  "meat_fish",
  "dairy_eggs",
  "legumes_grains",
  "vegetables",
  "other",
];

const CATEGORY_TAB_LABELS: Record<Category | "all", string> = {
  all: "All",
  ...CATEGORY_LABELS,
};

const MACRO_OPTIONS: ReadonlyArray<{ value: MacroPriority; label: string }> = [
  { value: "default", label: "Default" },
  { value: "protein_first", label: "Protein-first" },
  { value: "carb_first", label: "Carb-first" },
];

export default function FilterBar() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();

  const activeCategory = (searchParams.get("category") ?? "all") as
    | Category
    | "all";
  const activePriority = (searchParams.get("priority") ?? "default") as MacroPriority;

  const updateParam = useCallback(
    (key: string, value: string) => {
      const params = new URLSearchParams(searchParams.toString());

      if (value === "all" || value === "default") {
        params.delete(key);
      } else {
        params.set(key, value);
      }

      const queryString = params.toString();
      router.push(queryString ? `${pathname}?${queryString}` : pathname, {
        scroll: false,
      });
    },
    [pathname, router, searchParams]
  );

  return (
    <div className="flex flex-col gap-4 rounded-2xl bg-eatlee-cream p-4">
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-eatlee-green/50">
          Category
        </p>
        <div className="flex flex-wrap gap-2">
          {ALL_CATEGORIES.map((category) => {
            const active = activeCategory === category;
            return (
              <button
                key={category}
                type="button"
                onClick={() => updateParam("category", category)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-eatlee-green text-white"
                    : "bg-white text-eatlee-green hover:bg-eatlee-accent/40"
                }`}
              >
                {CATEGORY_TAB_LABELS[category]}
              </button>
            );
          })}
        </div>
      </div>

      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-[0.18em] text-eatlee-green/50">
          Macro priority
        </p>
        <div className="flex flex-wrap gap-2">
          {MACRO_OPTIONS.map((option) => {
            const active = activePriority === option.value;
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => updateParam("priority", option.value)}
                className={`rounded-full px-3.5 py-2 text-sm font-medium transition-colors ${
                  active
                    ? "bg-eatlee-green text-white"
                    : "bg-white text-eatlee-green hover:bg-eatlee-accent/40"
                }`}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
