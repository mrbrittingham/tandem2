'use client';

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";

export default function OnboardingPage() {
  const router = useRouter();
  const [businessName, setBusinessName] = useState("");
  const [locationName, setLocationName] = useState("");
  const [address, setAddress] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const response = await fetch("/api/locations", {
        method: "POST",
        headers: {
          "content-type": "application/json",
        },
        body: JSON.stringify({
          businessName: businessName.trim(),
          name: locationName.trim(),
          address: address.trim() || undefined,
          mode: "fresh",
        }),
      });

      if (!response.ok) {
        const payload = (await response.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to set up your business");
      }

      router.replace("/overview");
      router.refresh();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to complete onboarding");
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = businessName.trim().length > 0 && locationName.trim().length > 0;

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <section className="w-full max-w-xl rounded-[var(--console-radius-lg)] border border-[var(--console-border)] bg-[var(--console-bg-card)] p-8 shadow-[var(--console-shadow-sm)]">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">Onboarding</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--console-text-primary)]">Create your business</h1>
        <p className="mt-1 text-sm text-[var(--console-text-secondary)]">Set up your business and first location to unlock the dashboard.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-[var(--console-text-secondary)]">
            <span className="mb-1 block">Business name</span>
            <input
              required
              value={businessName}
              onChange={(event) => setBusinessName(event.target.value)}
              className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] px-3 py-2 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              placeholder="Windmill Creek Winery"
            />
          </label>

          <label className="block text-sm text-[var(--console-text-secondary)]">
            <span className="mb-1 block">First location name</span>
            <input
              required
              value={locationName}
              onChange={(event) => setLocationName(event.target.value)}
              className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] px-3 py-2 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              placeholder="Berlin"
            />
          </label>

          <label className="block text-sm text-[var(--console-text-secondary)]">
            <span className="mb-1 block">Address (optional)</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] px-3 py-2 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              placeholder="11206 Worcester Hwy, Berlin, MD 21811"
            />
          </label>

          {error ? <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-sm text-[var(--console-error)]">{error}</p> : null}

          <button
            type="submit"
            disabled={!canSubmit || isSubmitting}
            className="w-full rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Creating…" : "Create business and continue"}
          </button>
        </form>
      </section>
    </main>
  );
}
