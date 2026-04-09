import { CATEGORY_LABELS, type FoodWithDetails } from "@/lib/types";
import ScoreBadge from "./ScoreBadge";
import WHOBadge from "./WHOBadge";

interface FoodRowProps {
  readonly food: FoodWithDetails;
  readonly selected: boolean;
  readonly selectionDisabled: boolean;
  readonly onToggle: (id: string) => void;
}

function fmt(value: number): string {
  return value % 1 === 0 ? String(value) : value.toFixed(1);
}

export default function FoodRow({
  food,
  selected,
  selectionDisabled,
  onToggle,
}: FoodRowProps) {
  return (
    <tr className="border-b border-eatlee-mist last:border-b-0 hover:bg-eatlee-mist/40">
      <td className="px-3 py-3 text-center align-middle">
        <input
          type="checkbox"
          checked={selected}
          disabled={!selected && selectionDisabled}
          onChange={() => onToggle(food.id)}
          className="h-4 w-4 cursor-pointer rounded border-slate-300 text-eatlee-green accent-eatlee-green disabled:cursor-not-allowed disabled:opacity-40"
          aria-label={`Select ${food.name} for comparison`}
        />
      </td>

      <td className="px-3 py-3 align-middle">
        <div className="font-medium text-eatlee-green">{food.name}</div>
        <div className="mt-1 text-xs text-eatlee-green/50 md:hidden">
          {CATEGORY_LABELS[food.category]}
        </div>
      </td>

      <td className="hidden px-3 py-3 text-sm text-eatlee-green/60 md:table-cell">
        {CATEGORY_LABELS[food.category]}
      </td>

      <td className="px-3 py-3 text-right tabular-nums">{fmt(food.protein)}</td>
      <td className="px-3 py-3 text-right tabular-nums">{fmt(food.calories)}</td>
      <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">
        {fmt(food.fat)}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums lg:table-cell">
        {fmt(food.fiber)}
      </td>
      <td className="hidden px-3 py-3 text-right tabular-nums xl:table-cell">
        {fmt(food.carbs)}
      </td>
      <td className="px-3 py-3 text-right tabular-nums">
        {food.price ? `₺${fmt(food.price.price_per_kg)}` : "—"}
      </td>
      <td className="px-3 py-3 text-center">
        {food.score ? (
          <ScoreBadge score={food.score.pyf_normalized} tier={food.score.tier} />
        ) : (
          <span className="text-sm text-eatlee-green/40">—</span>
        )}
      </td>
      <td className="px-3 py-3 text-center">
        <WHOBadge compliant={food.who_compliant} />
        {!food.who_compliant && (
          <span className="text-xs text-eatlee-green/30">—</span>
        )}
      </td>
    </tr>
  );
}
