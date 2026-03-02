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
      <section className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Tandem</p>
        <h1 className="mt-3 text-2xl font-semibold text-slate-900">Dashboard sign in</h1>
        <p className="mt-1 text-sm text-slate-500">Use your operator account to access businesses and conversations.</p>

        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <label className="block text-sm text-slate-700">
            <span className="mb-1 block">Email</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-400 focus:outline-none"
              placeholder="you@company.com"
            />
          </label>

          <label className="block text-sm text-slate-700">
            <span className="mb-1 block">Password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-slate-300 px-3 py-2 text-slate-900 focus:border-blue-400 focus:outline-none"
              placeholder="••••••••"
            />
          </label>

          {error ? <p className="rounded-xl bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p> : null}
          {status ? <p className="rounded-xl bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{status}</p> : null}

          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-60"
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
          className="mt-4 text-sm font-medium text-blue-600 hover:text-blue-500"
        >
          {isSigningUp ? "Have an account? Sign in" : "Need an account? Create one"}
        </button>
      </section>
    </main>
  );
}
