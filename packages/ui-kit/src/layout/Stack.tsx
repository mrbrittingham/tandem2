import { type ReactNode } from "react";
import { cn } from "../lib/cn";

export type StackProps = {
  children: ReactNode;
  /** flex direction */
  direction?: "column" | "row";
  /** Tailwind gap class (e.g. "gap-4"). Defaults to "gap-4". */
  gap?: string;
  className?: string;
  as?: React.ElementType;
};

export function Stack({
  children,
  direction = "column",
  gap = "gap-4",
  className,
  as: Comp = "div",
}: StackProps) {
  return (
    <Comp
      className={cn(
        "flex",
        direction === "column" ? "flex-col" : "flex-row",
        gap,
        className,
      )}
    >
      {children}
    </Comp>
  );
}
