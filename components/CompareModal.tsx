"use client";

import { useCallback, useEffect, useRef } from "react";
import { CATEGORY_LABELS, type FoodWithDetails } from "@/lib/types";
import ScoreBadge from "./ScoreBadge";
import WHOBadge from "./WHOBadge";

interface CompareModalProps {
  readonly foods: ReadonlyArray<FoodWithDetails>;
  readonly onClose: () => void;
}

interface CompareRow {
  readonly label: string;
  readonly unit?: string;
  readonly getValue: (food: FoodWithDetails) => string;
}

function fmt(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

const COMPARE_ROWS: ReadonlyArray<CompareRow> = [
  {
    label: "Category",
    getValue: (food) => CATEGORY_LABELS[food.category],
  },
  { label: "Protein", unit: "g", getValue: (food) => fmt(food.protein) },
  { label: "Calories", unit: "kcal", getValue: (food) => fmt(food.calories) },
  { label: "Fat", unit: "g", getValue: (food) => fmt(food.fat) },
  {
    label: "Saturated fat",
    unit: "g",
    getValue: (food) => fmt(food.saturated_fat),
  },
  { label: "Fiber", unit: "g", getValue: (food) => fmt(food.fiber) },
  { label: "Carbs", unit: "g", getValue: (food) => fmt(food.carbs) },
  {
    label: "Net carbs",
    unit: "g",
    getValue: (food) => fmt(food.net_carbs),
  },
  {
    label: "Price/kg",
    getValue: (food) => (food.price ? `₺${fmt(food.price.price_per_kg)}` : "—"),
  },
];

export default function CompareModal({ foods, onClose }: CompareModalProps) {
  const overlayRef = useRef<HTMLDivElement>(null);

  const handleEscape = useCallback(
    (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    document.addEventListener("keydown", handleEscape);
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [handleEscape]);

  if (foods.length < 2) {
    return null;
  }

  return (
    <div
      ref={overlayRef}
      onClick={(event) => {
        if (event.target === overlayRef.current) {
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Compare foods"
    >
      <div className="relative max-h-[90vh] w-full max-w-5xl overflow-auto rounded-[2rem] bg-white p-5 shadow-soft sm:p-6">
        <button
          type="button"
          onClick={onClose}
          className="absolute right-4 top-4 rounded-full bg-eatlee-mist p-2 text-eatlee-green transition-colors hover:bg-eatlee-accent"
          aria-label="Close comparison"
        >
          ✕
        </button>

        <div className="mb-6">
          <h2 className="font-heading text-2xl font-bold text-eatlee-green">
            Compare foods
          </h2>
          <p className="mt-2 text-sm text-eatlee-green/60">
            Side-by-side comparison of macros, price, PYF score, and WHO badge.
          </p>
        </div>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-eatlee-mist">
                <th className="py-3 pr-4 text-left text-xs font-semibold uppercase tracking-[0.18em] text-eatlee-green/50">
                  Metric
                </th>
                {foods.map((food) => (
                  <th
                    key={food.id}
                    className="px-3 py-3 text-center font-semibold text-eatlee-green"
                  >
                    {food.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {COMPARE_ROWS.map((row) => (
                <tr key={row.label} className="border-b border-eatlee-mist/80">
                  <td className="py-3 pr-4 text-xs font-medium uppercase tracking-[0.12em] text-eatlee-green/50">
                    {row.label}
                    {row.unit ? ` (${row.unit})` : ""}
                  </td>
                  {foods.map((food) => (
                    <td key={food.id} className="px-3 py-3 text-center tabular-nums">
                      {row.getValue(food)}
                    </td>
                  ))}
                </tr>
              ))}
              <tr className="border-b border-eatlee-mist/80">
                <td className="py-3 pr-4 text-xs font-medium uppercase tracking-[0.12em] text-eatlee-green/50">
                  PYF score
                </td>
                {foods.map((food) => (
                  <td key={food.id} className="px-3 py-3 text-center">
                    {food.score ? (
                      <ScoreBadge score={food.score.pyf_normalized} tier={food.score.tier} />
                    ) : (
                      "—"
                    )}
                  </td>
                ))}
              </tr>
              <tr>
                <td className="py-3 pr-4 text-xs font-medium uppercase tracking-[0.12em] text-eatlee-green/50">
                  WHO
                </td>
                {foods.map((food) => (
                  <td key={food.id} className="px-3 py-3 text-center">
                    <WHOBadge compliant={food.who_compliant} />
                    {!food.who_compliant && (
                      <span className="text-xs text-eatlee-green/30">—</span>
                    )}
                  </td>
                ))}
              </tr>
            </tbody>
          </table>
        </div>

        <div className="grid gap-4 md:hidden">
          {foods.map((food) => (
            <section
              key={food.id}
              className="rounded-2xl border border-eatlee-mist p-4"
            >
              <div className="mb-4 flex items-start justify-between gap-3">
                <div>
                  <h3 className="font-heading text-lg font-bold text-eatlee-green">
                    {food.name}
                  </h3>
                  <p className="mt-1 text-sm text-eatlee-green/60">
                    {CATEGORY_LABELS[food.category]}
                  </p>
                </div>
                {food.score && (
                  <ScoreBadge score={food.score.pyf_normalized} tier={food.score.tier} />
                )}
              </div>

              <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
                {COMPARE_ROWS.map((row) => (
                  <div key={row.label} className="contents">
                    <dt className="text-eatlee-green/50">
                      {row.label}
                      {row.unit ? ` (${row.unit})` : ""}
                    </dt>
                    <dd className="text-right tabular-nums text-eatlee-green">
                      {row.getValue(food)}
                    </dd>
                  </div>
                ))}
              </dl>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm text-eatlee-green/50">WHO</span>
                <WHOBadge compliant={food.who_compliant} />
              </div>
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
