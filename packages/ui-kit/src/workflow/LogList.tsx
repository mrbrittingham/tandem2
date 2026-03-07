"use client";

import { type ReactNode, useRef, useEffect } from "react";
import { cn } from "../lib/cn";

export type LogEntry = {
  /** Timestamp string */
  time?: string;
  /** Log level for coloring */
  level?: "info" | "warn" | "error" | "debug";
  /** Log message */
  message: string;
};

export type LogListProps = {
  entries: LogEntry[];
  /** Auto-scroll to latest entry */
  autoScroll?: boolean;
  /** Max height before scrolling */
  maxHeight?: string;
  className?: string;
};

const levelColors: Record<string, string> = {
  info: "text-[var(--color-info)]",
  warn: "text-[var(--color-warning)]",
  error: "text-[var(--color-danger)]",
  debug: "text-[var(--color-text-muted)]",
};

export function LogList({
  entries,
  autoScroll = true,
  maxHeight = "400px",
  className,
}: LogListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (autoScroll) {
      bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }
  }, [entries.length, autoScroll]);

  return (
    <div
      className={cn(
        "overflow-auto rounded-[var(--radius-lg)] bg-[var(--color-code-bg)] p-4 font-[var(--font-mono)] text-[var(--text-xs)] leading-relaxed",
        className,
      )}
      style={{ maxHeight }}
      role="log"
      aria-live="polite"
    >
      {entries.length === 0 && (
        <span className="text-[var(--color-text-muted)]">No log entries</span>
      )}
      {entries.map((entry, i) => (
        <div key={i} className="flex gap-3 py-px">
          {entry.time && (
            <span className="shrink-0 text-[var(--color-text-muted)] opacity-60">
              {entry.time}
            </span>
          )}
          {entry.level && (
            <span className={cn("w-12 shrink-0 uppercase", levelColors[entry.level])}>
              {entry.level}
            </span>
          )}
          <span className="text-[var(--color-text-inverse)] opacity-90">{entry.message}</span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
