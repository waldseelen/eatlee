import type { Tier } from "@/lib/types";

interface ScoreBadgeProps {
  readonly score: number;
  readonly tier: Tier;
}

const TIER_STYLES: Record<Tier, string> = {
  good: "bg-eatlee-accent text-eatlee-green",
  mid: "bg-slate-400 text-white",
  low: "bg-eatlee-coral text-white",
};

export default function ScoreBadge({ score, tier }: ScoreBadgeProps) {
  return (
    <span
      className={`inline-flex min-w-12 items-center justify-center rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${TIER_STYLES[tier]}`}
    >
      {score.toFixed(0)}
    </span>
  );
}
