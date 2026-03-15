import { cn } from "../lib/cn";

export type DividerProps = {
  /** Horizontal (default) or vertical */
  orientation?: "horizontal" | "vertical";
  className?: string;
};

export function Divider({ orientation = "horizontal", className }: DividerProps) {
  return (
    <div
      role="separator"
      aria-orientation={orientation}
      className={cn(
        "shrink-0 bg-[var(--color-border)]",
        orientation === "horizontal" ? "h-px w-full" : "h-full w-px",
        className,
      )}
    />
  );
}
