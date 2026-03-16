"use client";

import { useState } from "react";
import Link from "next/link";
import type { BusinessProfile, FAQItem } from "@tandem/shared";

type Props = {
  location: BusinessProfile;
  onPromptChip: (prompt: string) => void;
};

function FAQRow({ faq }: { faq: FAQItem }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-[var(--color-border)] last:border-0">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left hover:bg-[var(--color-surface-hover)] transition-colors"
      >
        <span className="text-sm text-[var(--color-text)]">{faq.question}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className={`shrink-0 ml-2 text-[var(--color-text-secondary)] transition-transform ${open ? "rotate-180" : ""}`}
          aria-hidden
        >
          <path d="M2 4l4 4 4-4" />
        </svg>
      </button>
      {open && (
        <div className="px-3 pb-2.5 text-xs leading-relaxed text-[var(--color-text-secondary)]">
          {faq.answer}
        </div>
      )}
    </div>
  );
}

function PromptChip({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-full border border-[var(--color-border)] bg-[var(--color-bg)] px-3 py-1 text-xs font-medium text-[var(--color-text-secondary)] transition-colors hover:border-[var(--color-primary)] hover:text-[var(--color-primary)]"
    >
      {label}
    </button>
  );
}

export function KnowledgePanel({ location, onPromptChip }: Props) {
  const faqs = location.faqs ?? [];
  const count = faqs.length;
  const preview = faqs.slice(0, 3);

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-white p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Knowledge / Q&As</h2>
        {count > 0 ? (
          <Link
            href="/knowledge"
            className="text-xs font-medium text-[var(--color-primary)] hover:underline"
          >
            See all →
          </Link>
        ) : null}
      </div>

      {count > 0 ? (
        <>
          <div className="mb-3 flex items-baseline gap-1.5">
            <span className="text-3xl font-bold tabular-nums text-[var(--color-text)]">
              {count}
            </span>
            <span className="text-sm text-[var(--color-text-secondary)]">
              {count === 1 ? "Q&A" : "Q&As"}
            </span>
          </div>
          <div className="overflow-hidden rounded-xl border border-[var(--color-border)]">
            {preview.map((faq) => (
              <FAQRow key={faq.id} faq={faq} />
            ))}
          </div>
        </>
      ) : (
        <div className="rounded-xl border border-orange-100 bg-orange-50 p-3.5">
          <p className="text-sm font-medium text-orange-800">No Q&As yet</p>
          <p className="mt-1 text-xs text-orange-700 leading-relaxed">
            Your chatbot will only answer from general restaurant knowledge.
          </p>
        </div>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <PromptChip
          label="Add a Q&A"
          onClick={() => onPromptChip("Add a FAQ: '")}
        />
        <PromptChip
          label="Remove a Q&A"
          onClick={() => onPromptChip("Remove the FAQ about ")}
        />
      </div>
    </div>
  );
}
