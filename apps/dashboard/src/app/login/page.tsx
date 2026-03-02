'use client';

import { FormEvent, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTo = searchParams.get("redirectTo") || "/overview";
  const supabase = useMemo(() => createSupabaseBrowserClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isSigningUp, setIsSigningUp] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [status, setStatus] = useState<string | null>(null);

  const onSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setIsSubmitting(true);
    setError(null);
    setStatus(null);

    try {
      if (isSigningUp) {
        const { error: signUpError } = await supabase.auth.signUp({
          email,
          password,
        });

        if (signUpError) {
          throw signUpError;
        }

        setStatus("Account created. Check your email if confirmation is enabled, then sign in.");
        setIsSigningUp(false);
        return;
      }

      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        throw signInError;
      }

      router.replace(redirectTo);
      router.refresh();
    } catch (authError) {
      setError(authError instanceof Error ? authError.message : "Authentication failed");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--bg)] px-4 py-10">
      <section className="w-full max-w-md rounded-[var(--console-radius-lg)] border border-[var(--console-border)] bg-[var(--console-bg-card)] p-8 shadow-[var(--console-shadow-sm)]">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-[var(--console-text-tertiary)]">Tandem</p>
        <h1 className="mt-3 text-2xl font-semibold text-[var(--console-text-primary)]">Dashboard sign in</h1>
        <p className="mt-1 text-sm text-[var(--console-text-secondary)]">Use your operator account to access businesses and conversations.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-[var(--console-text-secondary)]">
            <span className="mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] px-3 py-2 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              placeholder="you@company.com"
            />
          </label>

          <label className="block text-sm text-[var(--console-text-secondary)]">
            <span className="mb-1 block">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-[var(--console-radius-sm)] border border-[var(--console-border)] px-3 py-2 text-[var(--console-text-primary)] focus:border-[var(--console-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--console-primary-light)]"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-error-light)] px-3 py-2 text-sm text-[var(--console-error)]">{error}</p> : null}
          {status ? <p className="rounded-[var(--console-radius-sm)] bg-[var(--console-success-light)] px-3 py-2 text-sm text-[var(--console-success)]">{status}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-[var(--console-radius-sm)] bg-[var(--console-primary)] px-4 py-2.5 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isSubmitting ? "Working…" : isSigningUp ? "Create account" : "Sign in"}
          </button>
        </form>

        <button
          type="button"
          onClick={() => {
            setIsSigningUp((value) => !value);
            setError(null);
            setStatus(null);
          }}
          className="mt-4 text-sm font-medium text-[var(--console-primary)] hover:text-[var(--console-primary-hover)]"
        >
          {isSigningUp ? "Have an account? Sign in" : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
}
