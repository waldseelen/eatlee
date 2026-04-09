interface WHOBadgeProps {
  readonly compliant: boolean;
}

export default function WHOBadge({ compliant }: WHOBadgeProps) {
  if (!compliant) {
    return null;
  }

  return (
    <span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-700">
      WHO ✓
    </span>
  );
}
