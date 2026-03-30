type StatusBadgeTone = "neutral" | "success" | "warning" | "danger" | "info";

type StatusBadgeProps = {
  label: string;
  tone?: StatusBadgeTone;
  className?: string;
};

const toneClassMap: Record<StatusBadgeTone, string> = {
  neutral: "bg-[var(--color-surface-hover)] text-[var(--color-text-secondary)]",
  success: "bg-emerald-100 text-emerald-700",
  warning: "bg-amber-100 text-amber-700",
  danger: "bg-rose-100 text-rose-700",
  info: "bg-sky-100 text-sky-700",
};

export function StatusBadge({ label, tone = "neutral", className }: StatusBadgeProps) {
  const resolvedClassName = [
    "inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold",
    toneClassMap[tone],
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <span className={resolvedClassName}>{label}</span>;
}
