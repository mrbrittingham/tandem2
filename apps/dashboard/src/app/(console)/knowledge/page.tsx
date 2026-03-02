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
        <h1 className="text-3xl font-semibold text-[var(--console-text-primary)]">Knowledge Base</h1>
        <p className="mt-2 text-sm text-[var(--console-text-tertiary)]">Manage FAQs, policies, suggested questions, and coverage for your assistant.</p>
      </header>

      <div className="grid gap-6 lg:grid-cols-2">
        <SectionCard
          title="FAQs"
          description="Draft the high-signal answers your concierge should surface in seconds."
          actions={<span className="text-[var(--console-text-tertiary)]">{faqs.length} live</span>}
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
                  className="rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
              >
                {editingFaqId ? "Update FAQ" : "Add to library"}
              </button>
            </div>
          </form>
        </SectionCard>

        <SectionCard
          title="Policies"
          description="Document house rules, onboarding steps, or fallback scripts."
          actions={<span className="text-[var(--console-text-tertiary)]">{policies.length} live</span>}
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
                  className="rounded-2xl border border-[var(--console-border)] px-4 py-2 text-sm font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                >
                  Cancel edit
                </button>
              ) : null}
              <button
                type="submit"
                className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)]"
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
          actions={<span className="text-[var(--console-text-tertiary)]">Sorted by freshness</span>}
        >
          {sortedFaqs.length === 0 ? (
            <p className="text-sm text-[var(--console-text-tertiary)]">No FAQs yet. Publish your first answer above.</p>
          ) : (
            <div className="space-y-3">
              {sortedFaqs.map((faq) => (
                <article
                  key={faq.id}
                  className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 shadow-[var(--console-shadow-sm)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--console-text-tertiary)]">
                        <span>{faq.category}</span>
                        <span className="text-[var(--console-border-dark)]">•</span>
                        <span>Updated {formatTimestamp(faq.updatedAt)}</span>
                      </div>
                      <h4 className="text-base font-semibold text-[var(--console-text-primary)]">{faq.question}</h4>
                      <p className="text-sm text-[var(--console-text-secondary)]">{faq.answer}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          faq.showInHelp ? "bg-[var(--console-success-light)] text-[var(--console-success)]" : "bg-[var(--console-bg-hover)] text-[var(--console-text-tertiary)]"
                        }`}
                      >
                        {faq.showInHelp ? "Widget" : "Internal"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startFaqEdit(faq)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => toggleFaqVisibility(faq.id)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                      >
                        {faq.showInHelp ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFaq(faq.id)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-error)] hover:border-[var(--console-error)]"
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
          actions={<span className="text-[var(--console-text-tertiary)]">Sorted by freshness</span>}
        >
          {sortedPolicies.length === 0 ? (
            <p className="text-sm text-[var(--console-text-tertiary)]">No policies yet. Add guidance above to get started.</p>
          ) : (
            <div className="space-y-3">
              {sortedPolicies.map((policy) => (
                <article
                  key={policy.id}
                  className="rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] p-4 shadow-[var(--console-shadow-sm)]"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.2em] text-[var(--console-text-tertiary)]">
                        <span>{policy.category}</span>
                        <span className="text-[var(--console-border-dark)]">•</span>
                        <span>Updated {formatTimestamp(policy.updatedAt)}</span>
                      </div>
                      <h4 className="text-base font-semibold text-[var(--console-text-primary)]">{policy.title}</h4>
                      <p className="text-sm text-[var(--console-text-secondary)]">{policy.description}</p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <span
                        className={`rounded-full px-3 py-1 text-xs font-semibold ${
                          policy.showInHelp ? "bg-[var(--console-info-light)] text-[var(--console-info)]" : "bg-[var(--console-bg-hover)] text-[var(--console-text-tertiary)]"
                        }`}
                      >
                        {policy.showInHelp ? "Widget" : "Internal"}
                      </span>
                      <button
                        type="button"
                        onClick={() => startPolicyEdit(policy)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        onClick={() => togglePolicyVisibility(policy.id)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-text-secondary)] hover:border-[var(--console-border-dark)]"
                      >
                        {policy.showInHelp ? "Hide" : "Show"}
                      </button>
                      <button
                        type="button"
                        onClick={() => removePolicy(policy.id)}
                        className="rounded-2xl border border-[var(--console-border)] px-3 py-1 text-xs font-medium text-[var(--console-error)] hover:border-[var(--console-error)]"
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
          <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
            Coming soon. Suggested questions are not configured yet.
          </p>
        </SectionCard>

        <SectionCard
          title="Coverage"
          description="See where your assistant has strong answers versus content gaps."
        >
          <p className="rounded-2xl border border-dashed border-[var(--console-border)] bg-[var(--console-bg-hover)] px-4 py-3 text-sm text-[var(--console-text-secondary)]">
            Not configured. Coverage analytics will appear here.
          </p>
        </SectionCard>
      </div>

      <SaveBar visible={isDirty || saving} onSave={handleSave} saving={saving} />
    </div>
  );
}
