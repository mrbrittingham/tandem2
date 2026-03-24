"use client";

import { useRef } from "react";

export type ColorSwatchPickerProps = {
  value: string;
  onChange: (hex: string) => void;
  label: string;
};

/**
 * Circular swatch button that opens a native <input type="color"> picker on click.
 * Shared between WebsiteImportPanel (knowledge scan) and WidgetEditor (appearance page).
 */
export function ColorSwatchPicker({ value, onChange, label }: ColorSwatchPickerProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="relative flex items-center justify-center">
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="group relative h-10 w-10 rounded-full border-2 border-white shadow-md ring-2 ring-amber-400 ring-offset-1 transition-transform hover:scale-110 focus:outline-none focus:ring-blue-400"
        style={{ background: value || undefined }}
        title={`Edit ${label}: ${value}`}
      >
        <span
          className="absolute inset-0 flex items-center justify-center rounded-full opacity-0 transition-opacity group-hover:opacity-100"
          style={{ background: "rgba(0,0,0,0.28)" }}
        >
          <svg
            className="h-3.5 w-3.5 drop-shadow"
            style={{ color: "#fff" }}
            viewBox="0 0 16 16"
            fill="currentColor"
            aria-hidden
          >
            <path d="M12.854.146a.5.5 0 0 0-.707 0L4.5 7.793 3.354 6.646a.5.5 0 1 0-.708.708l1.5 1.5a.5.5 0 0 0 .708 0l8-8a.5.5 0 0 0 0-.708zM1 13.5A1.5 1.5 0 0 0 2.5 15h11a1.5 1.5 0 0 0 1.5-1.5v-6a.5.5 0 0 0-1 0v6a.5.5 0 0 1-.5.5h-11a.5.5 0 0 1-.5-.5v-11a.5.5 0 0 1 .5-.5H9a.5.5 0 0 0 0-1H2.5A1.5 1.5 0 0 0 1 2.5v11z" />
          </svg>
        </span>
      </button>
      <input
        ref={inputRef}
        type="color"
        value={value || "#000000"}
        onChange={(e) => onChange(e.target.value)}
        className="sr-only"
        aria-label={label}
      />
    </div>
  );
}
