'use client';

import { useEffect, useState, useTransition } from "react";
import { useSearchParams } from "next/navigation";
import { authAction } from "./actions";

export default function LoginPageClient() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/overview";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);

    setError(null);
    setStatus(null);

    startTransition(async () => {
      const result = await authAction(formData);

      if (result?.switchToSignIn) {
        setIsSigningUp(false);
      }

      if (result?.error) {
        setError(result.error);
        return;
      }

      if (result?.message) {
        setStatus(result.message);
        return;
      }

      if (result?.success) {
        window.location.href = redirectTo;
      }
    });
  };

  if (!mounted) return null;

  return (
    <main className="flex min-h-screen">
      <section className="hidden w-1/2 flex-col justify-between bg-[var(--color-sidebar-bg)] p-12 text-white [background:var(--color-sidebar-bg-gradient)] md:flex">
        <div>
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-[var(--color-primary)] text-xl font-bold text-white shadow-sm">
              T
            </span>
            <span className="text-2xl font-semibold tracking-tight text-white">Tandem</span>
          </div>
          <div className="mt-24 max-w-md">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              The AI-powered customer engagement platform
            </h2>
            <ul className="mt-8 space-y-4 text-[var(--color-sidebar-text-muted)]">
              <li className="flex items-center gap-3">
                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Keep customers informed</span>
              </li>
              <li className="flex items-center gap-3">
                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Automate common questions</span>
              </li>
              <li className="flex items-center gap-3">
                <svg className="h-5 w-5 text-[var(--color-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                <span>Seamless handoff</span>
              </li>
            </ul>
          </div>
        </div>
        <div className="max-w-md text-sm text-[var(--color-sidebar-text-muted)]">
          <p>"Tandem has transformed how we interact with our customers. The AI handles the routine, freeing our team for what matters."</p>
        </div>
      </section>

      <section className="flex w-full flex-col justify-center bg-[var(--color-surface)] px-4 py-10 md:w-1/2 md:px-12 lg:px-24">
        <div className="mx-auto w-full max-w-sm">
          <h1 className="text-3xl font-bold text-[var(--console-text-primary)]">Dashboard sign in</h1>
          <p className="mt-2 text-sm text-[var(--console-text-secondary)]">Use your operator account to access businesses and conversations.</p>

          <form className="mt-8 space-y-5" onSubmit={onSubmit}>
            <input type="hidden" name="mode" value={isSigningUp ? "signup" : "signin"} />

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--console-text-tertiary)]">Email</span>
              <input
                type="email"
                name="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className="flex h-11 w-full rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--color-surface)] px-3 text-[var(--text-base)] text-[var(--color-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                placeholder="you@company.com"
              />
            </label>

            <label className="block">
              <span className="mb-1.5 block text-xs font-semibold uppercase tracking-wide text-[var(--console-text-tertiary)]">Password</span>
              <input
                type="password"
                name="password"
                autoComplete="current-password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="flex h-11 w-full rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--color-surface)] px-3 text-[var(--text-base)] text-[var(--color-text)] shadow-[inset_0_1px_2px_rgba(0,0,0,0.04)] transition-colors placeholder:text-[var(--color-text-muted)] focus-visible:border-[var(--color-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--color-primary)]"
                placeholder="••••••••"
              />
            </label>

            {error ? (
              <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-sm text-[var(--console-error)]">{error}</p>
            ) : null}
            {status ? (
              <div className="rounded-[var(--console-radius-sm)] bg-[var(--console-success-light)] px-3 py-2">
                <p className="text-sm text-[var(--console-success)]">{status}</p>
                <p className="mt-1 text-xs text-[var(--console-text-secondary)]">
                  No email? Your Supabase project may have email confirmation disabled — just sign in directly.
                </p>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className="mt-2 flex h-11 w-full items-center justify-center gap-2 rounded-xl bg-[var(--color-primary)] text-base font-semibold text-[var(--color-text-inverse)] shadow-[0_1px_0_rgba(255,255,255,0.12)_inset,0_1px_2px_rgba(0,0,0,0.12)] transition-all duration-[var(--duration-fast)] hover:bg-[var(--color-primary-hover)] active:scale-[0.98] active:bg-[var(--color-primary-pressed)] disabled:pointer-events-none disabled:opacity-50"
            >
              {isPending ? "Working…" : isSigningUp ? "Create account" : "Sign in"}
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setIsSigningUp((value) => !value);
              setError(null);
              setStatus(null);
            }}
            className="mt-6 text-sm font-medium text-[var(--console-primary)] transition-colors hover:text-[var(--console-primary-hover)]"
          >
            {isSigningUp ? "Have an account? Sign in" : "Need an account? Create one"}
          </button>
        </div>
      </section>
    </main>
  );
}
