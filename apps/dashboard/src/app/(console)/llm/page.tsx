'use client';

import { useEffect, useState } from "react";
import { SectionCard } from "@/components/SectionCard";

type StatusResponse = {
  provider: string;
  model: string;
  hasKey: boolean;
};

type TestResponse = {
  provider: string;
  model: string;
  latencyMs: number;
  text?: string;
  error?: string;
};

export default function LLMStatusPage() {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [statusError, setStatusError] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<TestResponse | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    const loadStatus = async () => {
      try {
        const response = await fetch("/api/llm-test", { cache: "no-store" });
        if (!response.ok) {
          throw new Error("Unable to load LLM status");
        }
        const data: StatusResponse = await response.json();
        if (!cancelled) {
          setStatus(data);
        }
      } catch (error) {
        if (!cancelled) {
          setStatusError(error instanceof Error ? error.message : "Failed to load status");
        }
      }
    };

    loadStatus();

    return () => {
      cancelled = true;
    };
  }, []);

  const handleTest = async () => {
    setTesting(true);
    setTestError(null);

    try {
      const response = await fetch("/api/llm-test", { method: "POST" });
      const data: TestResponse = await response.json();
      if (!response.ok) {
        throw new Error(data.error || "LLM test failed");
      }
      setTestResult(data);
    } catch (error) {
      setTestError(error instanceof Error ? error.message : "LLM test failed");
    } finally {
      setTesting(false);
    }
  };

  const keyStatus = status?.hasKey ? "Connected" : "Missing";
  const keyStatusClasses = status?.hasKey
    ? "bg-emerald-50 text-emerald-700"
    : "bg-rose-50 text-rose-700";

  return (
    <div className="space-y-8">
      <SectionCard
        title="LLM configuration"
        description="Environment-based configuration shared across chatbot and console."
      >
        {statusError ? (
          <p className="text-sm text-rose-600">{statusError}</p>
        ) : (
          <dl className="grid gap-4 sm:grid-cols-3">
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Provider</dt>
              <dd className="mt-2 text-lg font-semibold text-slate-900">
                {status?.provider ?? 'Loading...'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">Model</dt>
              <dd className="mt-2 text-lg font-semibold text-slate-900">
                {status?.model ?? 'Loading...'}
              </dd>
            </div>
            <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <dt className="text-xs font-semibold uppercase tracking-[0.3em] text-slate-500">API key</dt>
              <dd className="mt-2 text-lg font-semibold text-slate-900">
                {status ? (
                  <span className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-semibold ${keyStatusClasses}`}>
                    {keyStatus}
                  </span>
                ) : (
                  'Checking...'
                )}
              </dd>
            </div>
          </dl>
        )}
      </SectionCard>

      <SectionCard
        title="Connection test"
        description="Run a live call against the configured provider to verify connectivity."
      >
        <div className="flex flex-col gap-4">
          <button
            type="button"
            onClick={handleTest}
            disabled={testing || status?.hasKey === false}
            className="w-fit rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {testing ? 'Testing...' : 'Test LLM'}
          </button>
          {testError ? <p className="text-sm text-rose-600">{testError}</p> : null}
          {testResult ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
              <p><span className="font-semibold">Provider:</span> {testResult.provider}</p>
              <p><span className="font-semibold">Model:</span> {testResult.model}</p>
              {typeof testResult.latencyMs === 'number' ? (
                <p><span className="font-semibold">Latency:</span> {testResult.latencyMs}ms</p>
              ) : null}
              {testResult.text ? (
                <p className="mt-2 rounded-2xl bg-white px-3 py-2 text-slate-900">{testResult.text}</p>
              ) : null}
            </div>
          ) : (
            <p className="text-sm text-slate-500">Run a test to see the most recent response.</p>
          )}
        </div>
      </SectionCard>
    </div>
  );
}
