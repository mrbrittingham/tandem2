"use client";

import { type ReactNode, useState, useCallback, useRef } from "react";
import { cn } from "../lib/cn";

export type SplitPanelProps = {
  /** Left/top panel content */
  left: ReactNode;
  /** Right/bottom panel content */
  right: ReactNode;
  /** Split direction */
  direction?: "horizontal" | "vertical";
  /** Default split ratio (0-1, default 0.5) */
  defaultRatio?: number;
  /** Minimum panel size in px */
  minSize?: number;
  className?: string;
};

export function SplitPanel({
  left,
  right,
  direction = "horizontal",
  defaultRatio = 0.5,
  minSize = 200,
  className,
}: SplitPanelProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [ratio, setRatio] = useState(defaultRatio);
  const dragging = useRef(false);

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      dragging.current = true;
      const el = containerRef.current;
      if (!el) return;

      const onMove = (ev: PointerEvent) => {
        if (!dragging.current || !el) return;
        const rect = el.getBoundingClientRect();
        const total = direction === "horizontal" ? rect.width : rect.height;
        const pos = direction === "horizontal" ? ev.clientX - rect.left : ev.clientY - rect.top;
        const clamped = Math.min(Math.max(pos, minSize), total - minSize);
        setRatio(clamped / total);
      };

      const onUp = () => {
        dragging.current = false;
        document.removeEventListener("pointermove", onMove);
        document.removeEventListener("pointerup", onUp);
      };

      document.addEventListener("pointermove", onMove);
      document.addEventListener("pointerup", onUp);
    },
    [direction, minSize],
  );

  const isHoriz = direction === "horizontal";
  const pct = `${ratio * 100}%`;

  return (
    <div
      ref={containerRef}
      className={cn(
        "flex overflow-hidden",
        isHoriz ? "flex-row" : "flex-col",
        className,
      )}
    >
      <div
        className="overflow-auto"
        style={isHoriz ? { width: pct } : { height: pct }}
      >
        {left}
      </div>

      {/* Drag handle */}
      <div
        className={cn(
          "shrink-0 bg-[var(--color-border)] transition-colors hover:bg-[var(--color-primary)]",
          isHoriz ? "w-1 cursor-col-resize" : "h-1 cursor-row-resize",
        )}
        onPointerDown={onPointerDown}
        role="separator"
        aria-orientation={isHoriz ? "vertical" : "horizontal"}
        tabIndex={0}
      />

      <div className="flex-1 overflow-auto">{right}</div>
    </div>
  );
}
