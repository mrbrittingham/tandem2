"use client";

import Link from "next/link";
import type { BusinessProfile } from "@tandem/shared";
import { buildKnowledgeProgramFromBusiness } from "@/lib/knowledge-program";

type Props = {
  location: BusinessProfile;
  onPromptChip: (prompt: string) => void;
};

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

export function BehaviorPanel({ location, onPromptChip }: Props) {
  // Derive training from the KnowledgeProgram built from the business profile.
  // This mirrors how the knowledge page loads training defaults.
  const program = buildKnowledgeProgramFromBusiness(location);
  const training = program.training;

  const hasTraining =
    training.toneVoice || training.shouldAnswer || training.shouldAvoid;

  return (
    <div className="rounded-2xl border border-[var(--color-border)] bg-[var(--color-surface)] p-5">
      <div className="mb-3 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-[var(--color-text)]">Behavior</h2>
        <Link
          href="/knowledge"
          className="text-xs font-medium text-[var(--color-primary)] hover:underline"
        >
          See full settings →
        </Link>
      </div>

      {hasTraining ? (
        <div className="space-y-2.5">
          {training.toneVoice && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Tone
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-text)]">
                {training.toneVoice}
              </p>
            </div>
          )}
          {training.shouldAnswer && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Answers
              </p>
              <p className="mt-0.5 line-clamp-2 text-sm text-[var(--color-text)]">
                {training.shouldAnswer}
              </p>
            </div>
          )}
          {training.shouldAvoid && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Avoids
              </p>
              <p className="mt-0.5 line-clamp-1 text-sm text-[var(--color-text)]">
                {training.shouldAvoid}
              </p>
            </div>
          )}
          {training.conversionGoals.length > 0 && (
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[var(--color-text-secondary)]">
                Goals
              </p>
              <ul className="mt-0.5 space-y-0.5">
                {training.conversionGoals.slice(0, 3).map((goal, i) => (
                  <li key={i} className="flex items-start gap-1.5 text-sm text-[var(--color-text)]">
                    <span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-[var(--color-primary)]" aria-hidden />
                    {goal}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ) : (
        <p className="text-sm text-[var(--color-text-secondary)]">
          Not customized yet. Using default behavior.
        </p>
      )}

      <div className="mt-3 flex flex-wrap gap-2">
        <PromptChip
          label="Update tone or goals"
          onClick={() => onPromptChip('Update my chatbot\'s tone to "')}
        />
      </div>
    </div>
  );
}
