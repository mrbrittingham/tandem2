'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { createBusiness } from "../lib/store-hooks";
import type { BusinessProfile } from "@tandem/shared";

const industries = [
  { label: "Restaurant", value: "restaurant" },
  { label: "Salon / wellness", value: "services" },
  { label: "Retail / showroom", value: "retail" },
];

const timezones = [
  { label: "Pacific (PT)", value: "America/Los_Angeles" },
  { label: "Central (CT)", value: "America/Chicago" },
  { label: "Eastern (ET)", value: "America/New_York" },
];

const defaultForm = {
  name: "",
  industry: "restaurant",
  timezone: "America/Los_Angeles",
  contactName: "",
  contactEmail: "",
  contactPhone: "",
  brandColor: "#7c3aed",
  summary: "",
  supportHoursLabel: "Live daily · 10a-10p",
};

type FormState = typeof defaultForm;

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateBusinessWizard({ open, onClose }: Props) {
  const [form, setForm] = useState<FormState>(defaultForm);
  const [isSaving, setIsSaving] = useState(false);
  const [step, setStep] = useState<'form' | 'complete'>('form');
  const [createdBusiness, setCreatedBusiness] = useState<BusinessProfile | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (open) {
      setForm(defaultForm);
      setStep('form');
      setCreatedBusiness(null);
      setCopied(false);
    }
  }, [open]);

  const snippet = useMemo(() => {
    const slug = createdBusiness?.slug ?? 'demo-business';
    return `<script async src="https://cdn.tandem.dev/widget.js" data-business="${slug}"></script>`;
  }, [createdBusiness]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setIsSaving(true);
    try {
      const business = createBusiness(form);
      setCreatedBusiness(business);
      setStep('complete');
    } finally {
      setIsSaving(false);
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Unable to copy snippet', error);
    }
  };

  if (!open) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 px-4 py-8 text-white">
      <div className="w-full max-w-3xl rounded-3xl border border-white/10 bg-[#0b0d15] p-8 shadow-2xl">
        <header className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="text-xs uppercase tracking-[0.3em] text-white/50">Onboarding</p>
            <h2 className="text-2xl font-semibold">
              {step === 'form' ? 'Create a new concierge' : 'Business ready to install'}
            </h2>
            <p className="text-sm text-white/60">
              {step === 'form'
                ? 'Add the basics so Tandem can personalize the widget and next steps.'
                : 'Drop this snippet into your site or open the preview to see the concierge in action.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-white/20 px-4 py-2 text-sm font-medium text-white/70 transition hover:border-white/40 hover:text-white"
          >
            Close
          </button>
        </header>

        {step === 'form' ? (
          <form className="space-y-6" onSubmit={handleSubmit}>
            <div className="grid gap-4 md:grid-cols-2">
              <label className="flex flex-col gap-2 text-sm">
                Business name
                <input
                  required
                  value={form.name}
                  onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white focus:border-white/40 focus:outline-none"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Industry
                <select
                  value={form.industry}
                  onChange={(event) => setForm((prev) => ({ ...prev, industry: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-[#111525] px-4 py-3 text-base"
                >
                  {industries.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0b0d15]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Timezone
                <select
                  value={form.timezone}
                  onChange={(event) => setForm((prev) => ({ ...prev, timezone: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-[#111525] px-4 py-3 text-base"
                >
                  {timezones.map((option) => (
                    <option key={option.value} value={option.value} className="bg-[#0b0d15]">
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Brand color
                <input
                  type="color"
                  value={form.brandColor}
                  onChange={(event) => setForm((prev) => ({ ...prev, brandColor: event.target.value }))}
                  className="h-12 rounded-2xl border border-white/15 bg-transparent px-2"
                />
              </label>
            </div>

            <div className="grid gap-4 md:grid-cols-3">
              <label className="flex flex-col gap-2 text-sm">
                Primary contact
                <input
                  required
                  value={form.contactName}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactName: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Contact email
                <input
                  required
                  type="email"
                  value={form.contactEmail}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactEmail: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white"
                />
              </label>
              <label className="flex flex-col gap-2 text-sm">
                Contact phone
                <input
                  value={form.contactPhone}
                  onChange={(event) => setForm((prev) => ({ ...prev, contactPhone: event.target.value }))}
                  className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white"
                />
              </label>
            </div>

            <label className="flex flex-col gap-2 text-sm">
              Operating hours (for handoff)
              <input
                value={form.supportHoursLabel}
                onChange={(event) => setForm((prev) => ({ ...prev, supportHoursLabel: event.target.value }))}
                className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm">
              Overview blurb (optional)
              <textarea
                rows={3}
                value={form.summary}
                onChange={(event) => setForm((prev) => ({ ...prev, summary: event.target.value }))}
                className="rounded-2xl border border-white/15 bg-transparent px-4 py-3 text-base text-white"
              />
            </label>

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-2xl border border-white/20 px-5 py-3 text-sm font-semibold text-white/80 transition hover:border-white/40"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isSaving}
                className="rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black transition hover:bg-white/90 disabled:opacity-60"
              >
                {isSaving ? 'Saving...' : 'Create business'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            <div className="rounded-3xl border border-white/15 bg-black/20 p-5">
              <p className="text-xs uppercase tracking-[0.4em] text-white/50">Install snippet</p>
              <p className="mt-2 text-sm text-white/70">Paste just before the closing <code>&lt;/body&gt;</code> tag of your site.</p>
              <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/60 p-4 text-sm text-white/90">
                <code>{snippet}</code>
              </pre>
              <div className="mt-3 flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleCopy}
                  className="rounded-2xl bg-white/10 px-4 py-2 text-sm font-semibold text-white transition hover:bg-white/20"
                >
                  {copied ? 'Copied' : 'Copy snippet'}
                </button>
                <Link
                  href="http://localhost:3000"
                  target="_blank"
                  className="rounded-2xl border border-white/30 px-4 py-2 text-sm font-semibold text-white/90 transition hover:border-white"
                >
                  Preview widget
                </Link>
              </div>
            </div>
            <div className="rounded-3xl border border-white/10 bg-black/20 p-5">
              <p className="text-sm text-white/70">
                Tandem automatically applied the {createdBusiness?.industry ?? 'restaurant'} template. Head to {' '}
                <span className="font-semibold text-white">Widget</span> to adjust theme and install docs next.
              </p>
              <button
                type="button"
                onClick={onClose}
                className="mt-4 rounded-2xl bg-white px-6 py-3 text-sm font-semibold text-black"
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
