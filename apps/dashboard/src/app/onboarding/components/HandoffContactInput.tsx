"use client";

import { useState, type FormEvent } from "react";

type HandoffData = {
  phone: string;
  link: string;
  email: string;
};

type Props = {
  locationId: string;
  businessId: string;
  prefillPhone?: string;
  prefillLink?: string;
  onSave: (data: HandoffData) => void;
  onSkip: () => void;
  disabled?: boolean;
};

/**
 * Embedded handoff contact form for Stage 5.
 * Saves directly via PUT /api/location-config with the operator's contact info.
 * Tool-calling upgrade deferred to Phase 5 per implementation plan.
 */
export function HandoffContactInput({
  locationId,
  businessId,
  prefillPhone = "",
  prefillLink = "",
  onSave,
  onSkip,
  disabled = false,
}: Props) {
  const [phone, setPhone] = useState(prefillPhone);
  const [link, setLink] = useState(prefillLink);
  const [email, setEmail] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const hasInput = phone.trim() || link.trim() || email.trim();

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasInput || isSaving || disabled) return;

    setIsSaving(true);
    setError(null);

    try {
      const contactMethods: Array<{
        id: string;
        type: "phone" | "link" | "email";
        label: string;
        value: string;
        enabled: boolean;
      }> = [];

      const phoneTrimmed = phone.trim();
      const linkTrimmed = link.trim();
      const emailTrimmed = email.trim();

      if (phoneTrimmed) {
        contactMethods.push({
          id: crypto.randomUUID(),
          type: "phone",
          label: "Phone",
          value: phoneTrimmed,
          enabled: true,
        });
      }
      if (linkTrimmed) {
        contactMethods.push({
          id: crypto.randomUUID(),
          type: "link",
          label: "Reservations",
          value: linkTrimmed,
          enabled: true,
        });
      }
      if (emailTrimmed) {
        contactMethods.push({
          id: crypto.randomUUID(),
          type: "email",
          label: "Email",
          value: emailTrimmed,
          enabled: true,
        });
      }

      const response = await fetch("/api/location-config", {
        method: "PUT",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          locationId,
          businessId,
          handoffConfig: {
            contactMethods,
            headline: "Need more help?",
            status: "online",
            statusDetail: "",
            supportHoursLabel: "",
            offlineMessage: "",
          },
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error ?? "Failed to save contact information");
      }

      onSave({ phone: phoneTrimmed, link: linkTrimmed, email: emailTrimmed });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save contact information");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-3 rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 space-y-3"
    >
      <div className="space-y-2">
        <label className="block text-xs font-medium text-[var(--console-text-secondary)]">
          <span className="flex items-center gap-1.5 mb-1">
            <span>📞</span>
            <span>Phone number</span>
          </span>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={isSaving || disabled}
            placeholder="+1 (555) 000-0000"
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--console-text-secondary)]">
          <span className="flex items-center gap-1.5 mb-1">
            <span>🔗</span>
            <span>Reservation link</span>
          </span>
          <input
            type="url"
            value={link}
            onChange={(e) => setLink(e.target.value)}
            disabled={isSaving || disabled}
            placeholder="https://resy.com/…"
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>

        <label className="block text-xs font-medium text-[var(--console-text-secondary)]">
          <span className="flex items-center gap-1.5 mb-1">
            <span>📧</span>
            <span>Email</span>
          </span>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            disabled={isSaving || disabled}
            placeholder="hello@yourrestaurant.com"
            className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-[var(--console-bg)] px-3 py-2 text-sm text-[var(--console-text-primary)] placeholder:text-[var(--console-text-tertiary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)] disabled:cursor-not-allowed disabled:opacity-60"
          />
        </label>
      </div>

      {error ? (
        <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-xs text-[var(--console-error)]">
          {error}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2 pt-1">
        <button
          type="submit"
          disabled={!hasInput || isSaving || disabled}
          className="rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isSaving ? "Saving…" : "Save contact method"}
        </button>
        <button
          type="button"
          onClick={onSkip}
          disabled={isSaving || disabled}
          className="rounded-[var(--console-radius-sm)] border border-[var(--console-border)] bg-transparent px-4 py-2 text-sm font-medium text-[var(--console-text-secondary)] transition hover:border-[var(--console-border-hover)] hover:text-[var(--console-text-primary)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          Skip for now
        </button>
      </div>
    </form>
  );
}
