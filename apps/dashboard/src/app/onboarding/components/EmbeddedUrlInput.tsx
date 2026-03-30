"use client";

import { useState, type FormEvent } from "react";

type Props = {
  onScan: (url: string) => void;
  onSkip: () => void;
  disabled?: boolean;
};

function isValidUrl(raw: string): boolean {
  const trimmed = raw.trim();
  if (!trimmed) return false;
  // Allow bare domains — these get normalized to https:// by the API
  try {
    const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
    const parsed = new URL(withScheme);
    return parsed.hostname.includes(".");
  } catch {
    return false;
  }
}

/**
 * URL input component embedded inside the AI chat stream.
 * Renders inline with the assistant message for Stage 1 (website URL collection).
 */
export function EmbeddedUrlInput({ onScan, onSkip, disabled = false }: Props) {
  const [url, setUrl] = useState("");
  const [touched, setTouched] = useState(false);

  const trimmed = url.trim();
  const showError = touched && trimmed.length > 0 && !isValidUrl(trimmed);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!isValidUrl(trimmed) || disabled) return;
    onScan(trimmed);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] p-4"
    >
      <label className="mb-2 flex items-center gap-1.5 text-xs font-medium text-[var(--color-text-secondary)]">
        <span>🌐</span>
        <span>Your website URL</span>
      </label>

      <input
        type="text"
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        onBlur={() => setTouched(true)}
        disabled={disabled}
        placeholder="https://yourrestaurant.com"
        className="w-full rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-2 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
      />

      {showError ? (
        <p className="mt-1 text-xs text-[var(--color-danger)]">
          Please enter a valid website URL (e.g. yourrestaurant.com)
        </p>
      ) : null}

      <div className="mt-3 flex flex-wrap gap-2">
        <button
          type="submit"
          disabled={!isValidUrl(trimmed) || disabled}
          className="rounded-[var(--radius-sm)] bg-[var(--color-primary)] px-4 py-2 text-sm font-semibold text-[var(--color-text-inverse)] transition hover:bg-[var(--color-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Scan my website
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={disabled}
          className="rounded-[var(--radius-sm)] border border-[var(--color-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--color-text-secondary)] transition hover:border-[var(--color-border-strong)] hover:text-[var(--color-text)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
