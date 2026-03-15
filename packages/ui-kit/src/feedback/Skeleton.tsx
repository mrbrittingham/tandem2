import { cn } from "../lib/cn";

export type SkeletonProps = {
  className?: string;
};

export function Skeleton({ className }: SkeletonProps) {
  return (
    <div
      aria-hidden
      className={cn(
        "animate-pulse rounded-[var(--radius-md)] bg-[var(--color-surface-hover)]",
        className,
      )}
    />
  );
}
