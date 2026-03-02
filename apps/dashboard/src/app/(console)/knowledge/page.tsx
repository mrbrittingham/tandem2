"use client";

import { useMemo, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { SaveBar } from "@/components/SaveBar";

const defaultFaq: Pick<FAQItem, "question" | "answer" | "category" | "showInHelp"> = {
  question: "",
  answer: "",
  category: "General",
  showInHelp: true,
};

const defaultPolicy: Pick<PolicyItem, "title" | "description" | "category" | "showInHelp"> = {
  title: "",
  description: "",
  category: "Policies",
  showInHelp: true,
};

const formatTimestamp = (value: string) =>
  new Date(value).toLocaleDateString(undefined, { month: "short", day: "numeric" });

export default function KnowledgePage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to start curating FAQs, policies, and menu links."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <KnowledgeEditor key={business.id} business={business} />;
}

function KnowledgeEditor({ business }: { business: BusinessProfile }) {
  const [faqs, setFaqs] = useState<FAQItem[]>(() => business.faqs.map((entry) => ({ ...entry })));
  const [policies, setPolicies] = useState<PolicyItem[]>(() => business.policies.map((entry) => ({ ...entry })));
  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify({ faqs: business.faqs, policies: business.policies }),
  );
  const [faqForm, setFaqForm] = useState(defaultFaq);
  const [policyForm, setPolicyForm] = useState(defaultPolicy);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const isDirty = useMemo(() => {
    return JSON.stringify({ faqs, policies }) !== initialSnapshot;
  }, [faqs, policies, initialSnapshot]);

  const startFaqEdit = (faq: FAQItem) => {
    setFaqForm({
      question: faq.question,
      answer: faq.answer,
      category: faq.category,
      showInHelp: faq.showInHelp,
    });
    setEditingFaqId(faq.id);
  };

  const startPolicyEdit = (policy: PolicyItem) => {
    setPolicyForm({
      title: policy.title,
      description: policy.description,
      category: policy.category,
      showInHelp: policy.showInHelp,
    });
    setEditingPolicyId(policy.id);
  };

  const handleFaqSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    if (editingFaqId) {
      setFaqs((prev) =>
        prev.map((faq) =>
          faq.id === editingFaqId
            ? { ...faq, ...faqForm, updatedAt: timestamp }
            : faq
        )
      );
    } else {
      setFaqs((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          question: faqForm.question,
          answer: faqForm.answer,
          category: faqForm.category,
          showInHelp: faqForm.showInHelp,
          updatedAt: timestamp,
        },
      ]);
    }
    setFaqForm(defaultFaq);
    setEditingFaqId(null);
  };

  const handlePolicySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timestamp = new Date().toISOString();
    if (editingPolicyId) {
      setPolicies((prev) =>
        prev.map((policy) =>
          policy.id === editingPolicyId
            ? { ...policy, ...policyForm, updatedAt: timestamp }
            : policy
        )
      );
    } else {
      setPolicies((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          title: policyForm.title,
          description: policyForm.description,
          category: policyForm.category,
          showInHelp: policyForm.showInHelp,
          updatedAt: timestamp,
        },
      ]);
    }
    setPolicyForm(defaultPolicy);
    setEditingPolicyId(null);
  };

  const removeFaq = (id: string) => {
    setFaqs((prev) => prev.filter((faq) => faq.id !== id));
    if (editingFaqId === id) {
      setEditingFaqId(null);
      setFaqForm(defaultFaq);
    }
  };

  const removePolicy = (id: string) => {
    setPolicies((prev) => prev.filter((policy) => policy.id !== id));
    if (editingPolicyId === id) {
      setEditingPolicyId(null);
      setPolicyForm(defaultPolicy);
    }
  };

  const toggleFaqVisibility = (id: string) => {
    const timestamp = new Date().toISOString();
    setFaqs((prev) =>
      prev.map((faq) =>
        faq.id === id ? { ...faq, showInHelp: !faq.showInHelp, updatedAt: timestamp } : faq
      )
    );
  };

  const togglePolicyVisibility = (id: string) => {
    const timestamp = new Date().toISOString();
    setPolicies((prev) =>
      prev.map((policy) =>
        policy.id === id
          ? { ...policy, showInHelp: !policy.showInHelp, updatedAt: timestamp }
          : policy
      )
    );
  };

  const handleSave = () => {
    if (!business) {
      return;
    }
    setSaving(true);
    setTimeout(() => {
      updateBusiness(business.id, (draft) => {
        draft.faqs = faqs;
        draft.policies = policies;
        draft.updatedAt = new Date().toISOString();
      });
      setInitialSnapshot(JSON.stringify({ faqs, policies }));
      setSaving(false);
    }, 600);
  };

  const sortedFaqs = [...faqs].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );
  const sortedPolicies = [...policies].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-3xl font-semibold text-slate-900">Knowledge Base</h1>
        <p className="mt-2 text-sm text-slate-500">Manage FAQs, policies, suggested questions, and coverage for your assistant.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="FAQs"
          description="Draft the high-signal answers your concierge should surface in seconds."
          actions={<span className="text-slate-500">{faqs.length} live</span>}
        >
          <form className="space-y-4" onSubmit={handleFaqSubmit}>
            <TextInput
              label="Question"
              value={faqForm.question}
              onChange={(value) => setFaqForm((prev) => ({ ...prev, question: value }))}
              placeholder="When do you open for brunch?"
            />
            <TextInput
              label="Answer"
              multiline
              rows={4}
              value={faqForm.answer}
              onChange={(value) => setFaqForm((prev) => ({ ...prev, answer: value }))}
              placeholder="We open daily at 10am with a full brunch menu and bar service."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Category"
                value={faqForm.category}
                onChange={(value) => setFaqForm((prev) => ({ ...prev, category: value }))}
                placeholder="General"
              />
              <ToggleSwitch
                label="Show in help center"
                helperText="Controls whether this appears inside the widget's Help tab."
                checked={faqForm.showInHelp}
                onChange={(next) => setFaqForm((prev) => ({ ...prev, showInHelp: next }))}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {editingFaqId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingFaqId(null);
                    setFaqForm(defaultFaq);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                {editingFaqId ? "Update FAQ" : "Add to library"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Policies"
          description="Document house rules, onboarding steps, or fallback scripts."
          actions={<span className="text-slate-500">{policies.length} live</span>}
        >
          <form className="space-y-4" onSubmit={handlePolicySubmit}>
            <TextInput
              label="Policy title"
              value={policyForm.title}
              onChange={(value) => setPolicyForm((prev) => ({ ...prev, title: value }))}
              placeholder="Cancellation policy"
            />
            <TextInput
              label="Details"
              multiline
              rows={4}
              value={policyForm.description}
              onChange={(value) => setPolicyForm((prev) => ({ ...prev, description: value }))}
              placeholder="We offer free cancellation up to 24h ahead of your reservation."
            />
            <div className="grid gap-4 md:grid-cols-2">
              <TextInput
                label="Category"
                value={policyForm.category}
                onChange={(value) => setPolicyForm((prev) => ({ ...prev, category: value }))}
                placeholder="Policies"
              />
              <ToggleSwitch
                label="Expose in widget"
                helperText="Off if you only want teams to reference it internally."
                checked={policyForm.showInHelp}
                onChange={(next) => setPolicyForm((prev) => ({ ...prev, showInHelp: next }))}
              />
            </div>
            <div className="flex flex-wrap justify-end gap-3">
              {editingPolicyId ? (
                <button
                  type="button"
                  onClick={() => {
                    setEditingPolicyId(null);
                    setPolicyForm(defaultPolicy);
                  }}
                  className="rounded-2xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:border-slate-300"
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white transition hover:bg-blue-500"
              >
                {editingPolicyId ? "Update policy" : "Add to library"}
              </button>
            </div>
          </form>
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="FAQ library"
          description="Review and maintain every answer powering your concierge."
          actions={<span className="text-slate-500">Sorted by freshness</span>}
        >
          {sortedFaqs.length === 0 ? (
            <p className="text-sm text-slate-500">No FAQs yet. Publish your first answer above.</p>
          ) : (
            <div className="space-y-3">
              {sortedFaqs.map((faq) => (
                <article
                  key={faq.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        <span>{faq.category}</span>
                        <span className="text-slate-200">•</span>
                        <span>Updated {formatTimestamp(faq.updatedAt)}</span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">{faq.question}</h4>
                      <p className="text-sm text-slate-600">{faq.answer}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          faq.showInHelp ? "bg-emerald-50 text-emerald-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {faq.showInHelp ? "Widget" : "Internal"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startFaqEdit(faq)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFaqVisibility(faq.id)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        {faq.showInHelp ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFaq(faq.id)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-rose-600 hover:border-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard
          title="Policy library"
          description="Keep every escalation script and SOP ready for the AI concierge."
          actions={<span className="text-slate-500">Sorted by freshness</span>}
        >
          {sortedPolicies.length === 0 ? (
            <p className="text-sm text-slate-500">No policies yet. Add guidance above to get started.</p>
          ) : (
            <div className="space-y-3">
              {sortedPolicies.map((policy) => (
                <article
                  key={policy.id}
                  className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm shadow-slate-900/5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-slate-400">
                        <span>{policy.category}</span>
                        <span className="text-slate-200">•</span>
                        <span>Updated {formatTimestamp(policy.updatedAt)}</span>
                      </div>
                      <h4 className="text-base font-semibold text-slate-900">{policy.title}</h4>
                      <p className="text-sm text-slate-600">{policy.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          policy.showInHelp ? "bg-sky-50 text-sky-700" : "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {policy.showInHelp ? "Widget" : "Internal"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startPolicyEdit(policy)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePolicyVisibility(policy.id)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-slate-700 hover:border-slate-300"
                      >
                        {policy.showInHelp ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePolicy(policy.id)}
                        className="rounded-2xl border border-slate-200 px-3 py-1 text-xs font-medium text-rose-600 hover:border-rose-200"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                </article>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="Suggested Questions"
          description="Starter prompts that guide customers to common tasks in chat."
        >
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Coming soon. Suggested questions are not configured yet.
          </p>
        </SectionCard>

        <SectionCard
          title="Coverage"
          description="See where your assistant has strong answers versus content gaps."
        >
          <p className="rounded-2xl border border-dashed border-slate-300 bg-slate-50 px-4 py-3 text-sm text-slate-600">
            Not configured. Coverage analytics will appear here.
          </p>
        </SectionCard>
      </div>

      <SaveBar visible={isDirty || saving} onSave={handleSave} saving={saving} />
    </div>
  );
}
