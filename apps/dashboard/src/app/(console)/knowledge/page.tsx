"use client";

import { useMemo, useState } from "react";
import type { BusinessProfile, FAQItem, PolicyItem } from "@tandem/shared";
import { EmptyState } from "@/components/EmptyState";
import { useConsoleDialogs } from "@/components/ConsoleDialogContext";
import { SaveBar } from "@/components/SaveBar";
import { SectionCard } from "@/components/SectionCard";
import { TextInput } from "@/components/TextInput";
import { ToggleSwitch } from "@/components/ToggleSwitch";
import { SegmentedControl } from "@/components/SegmentedControl";
import { DataTableShell } from "@/components/DataTableShell";
import { StatusBadge } from "@/components/StatusBadge";
import { WebsiteImportPanel, type ImportedKnowledgePayload } from "@/components/WebsiteImportPanel";
import { updateBusiness, useActiveBusiness } from "@/lib/store-hooks";
import { saveLocationConfig } from "@/lib/location-config-client";

type ContentTab = "questions" | "policies";

type BusinessInfoForm = {
  businessName: string;
  shortDescription: string;
  phone: string;
  email: string;
  address: string;
  hours: string;
};

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

function getBusinessFormFromProfile(business: BusinessProfile): BusinessInfoForm {
  const phone = business.contacts.find((entry) => entry.type === "phone")?.value ?? "";
  const email = business.contacts.find((entry) => entry.type === "email")?.value ?? "";

  return {
    businessName: business.businessName ?? business.name ?? "",
    shortDescription: business.summary ?? "",
    phone,
    email,
    address: business.location ?? "",
    hours: business.handoff.supportHoursLabel || business.handoff.statusDetail || "",
  };
}

export default function KnowledgePage() {
  const business = useActiveBusiness();
  const { openCreateLocation } = useConsoleDialogs();

  if (!business) {
    return (
      <EmptyState
        title="No location selected"
        description="Create a location to start adding business details, customer answers, and policies."
        actionLabel="Add location"
        onAction={openCreateLocation}
      />
    );
  }

  return <KnowledgeEditor key={business.id} business={business} />;
}

function KnowledgeEditor({ business }: { business: BusinessProfile }) {
  const [businessInfo, setBusinessInfo] = useState<BusinessInfoForm>(() => getBusinessFormFromProfile(business));
  const [faqs, setFaqs] = useState<FAQItem[]>(() => business.faqs.map((entry) => ({ ...entry })));
  const [policies, setPolicies] = useState<PolicyItem[]>(() => business.policies.map((entry) => ({ ...entry })));
  const [faqForm, setFaqForm] = useState(defaultFaq);
  const [policyForm, setPolicyForm] = useState(defaultPolicy);
  const [editingFaqId, setEditingFaqId] = useState<string | null>(null);
  const [editingPolicyId, setEditingPolicyId] = useState<string | null>(null);
  const [activeContentTab, setActiveContentTab] = useState<ContentTab>("questions");
  const [saving, setSaving] = useState(false);

  const [initialSnapshot, setInitialSnapshot] = useState(() =>
    JSON.stringify({
      businessInfo: getBusinessFormFromProfile(business),
      faqs: business.faqs,
      policies: business.policies,
    }),
  );

  const isDirty = useMemo(
    () => JSON.stringify({ businessInfo, faqs, policies }) !== initialSnapshot,
    [businessInfo, faqs, policies, initialSnapshot],
  );

  const sortedFaqs = useMemo(
    () => [...faqs].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [faqs],
  );
  const sortedPolicies = useMemo(
    () => [...policies].sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()),
    [policies],
  );

  const handleSave = async () => {
    setSaving(true);

    try {
      updateBusiness(business.id, (draft) => {
        const phoneValue = businessInfo.phone.trim();
        const emailValue = businessInfo.email.trim();

        draft.name = businessInfo.businessName.trim() || draft.name;
        draft.businessName = businessInfo.businessName.trim() || draft.businessName || draft.name;
        draft.summary = businessInfo.shortDescription;
        draft.tagline = businessInfo.shortDescription;
        draft.location = businessInfo.address;
        draft.handoff.supportHoursLabel = businessInfo.hours;
        draft.handoff.statusDetail = businessInfo.hours;
        draft.faqs = faqs;
        draft.policies = policies;

        const existingPhone = draft.contacts.find((entry) => entry.type === "phone");
        if (phoneValue) {
          if (existingPhone) {
            existingPhone.value = phoneValue;
            existingPhone.enabled = true;
          } else {
            draft.contacts.unshift({
              id: crypto.randomUUID(),
              type: "phone",
              label: "Phone",
              value: phoneValue,
              enabled: true,
            });
          }
        } else if (existingPhone) {
          existingPhone.enabled = false;
        }

        const existingEmail = draft.contacts.find((entry) => entry.type === "email");
        if (emailValue) {
          if (existingEmail) {
            existingEmail.value = emailValue;
            existingEmail.enabled = true;
          } else {
            draft.contacts.push({
              id: crypto.randomUUID(),
              type: "email",
              label: "Email",
              value: emailValue,
              enabled: true,
            });
          }
        } else if (existingEmail) {
          existingEmail.enabled = false;
        }

        draft.updatedAt = new Date().toISOString();
      });

      // Persist knowledge and core business profile hints so refreshes stay in sync with server-backed data.
      try {
        await saveLocationConfig({
          location: business,
          knowledgeConfig: {
            faqs,
            policies,
            businessProfile: {
              businessName: businessInfo.businessName,
              shortDescription: businessInfo.shortDescription,
              phone: businessInfo.phone,
              email: businessInfo.email,
              address: businessInfo.address,
              hours: businessInfo.hours,
            },
          },
        });
      } catch {
        // Keep local save even if remote sync fails.
      }

      setInitialSnapshot(JSON.stringify({ businessInfo, faqs, policies }));
    } finally {
      setSaving(false);
    }
  };

  const handleFaqSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timestamp = new Date().toISOString();

    if (editingFaqId) {
      setFaqs((current) =>
        current.map((entry) => (entry.id === editingFaqId ? { ...entry, ...faqForm, updatedAt: timestamp } : entry)),
      );
    } else {
      setFaqs((current) => [
        ...current,
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
    setActiveContentTab("questions");
  };

  const handlePolicySubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const timestamp = new Date().toISOString();

    if (editingPolicyId) {
      setPolicies((current) =>
        current.map((entry) => (entry.id === editingPolicyId ? { ...entry, ...policyForm, updatedAt: timestamp } : entry)),
      );
    } else {
      setPolicies((current) => [
        ...current,
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
    setActiveContentTab("policies");
  };

  const applyImportedContent = (payload: ImportedKnowledgePayload) => {
    setBusinessInfo((current) => ({
      businessName: payload.name ?? current.businessName,
      shortDescription: payload.shortDescription ?? current.shortDescription,
      phone: payload.phone ?? current.phone,
      email: payload.email ?? current.email,
      address: payload.address ?? current.address,
      hours: payload.hours ?? current.hours,
    }));

    if (payload.faqs.length > 0) {
      setFaqs(payload.faqs);
    }

    if (payload.policies.length > 0) {
      setPolicies(payload.policies);
    }
  };

  const scrollToAnswers = () => {
    if (typeof window === "undefined") {
      return;
    }
    const section = document.getElementById("answers-for-customers");
    section?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="space-y-10">
      <SectionCard
        eyebrow="Business Information"
        title="Business Information"
        description="Keep your business details up to date so your assistant can answer common questions accurately."
      >
        <div className="grid gap-6 xl:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
            <h3 className="text-lg font-semibold text-slate-900">Business details</h3>
            <p className="mt-1 text-sm text-slate-600">Update your core business information in one place.</p>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <TextInput
                label="Business name"
                value={businessInfo.businessName}
                onChange={(value) => setBusinessInfo((current) => ({ ...current, businessName: value }))}
                placeholder="Windmill Creek Winery & Farm Kitchen"
              />
              <TextInput
                label="Phone"
                value={businessInfo.phone}
                onChange={(value) => setBusinessInfo((current) => ({ ...current, phone: value }))}
                placeholder="(410) 251-6122"
              />
              <div className="md:col-span-2">
                <TextInput
                  label="Short description"
                  value={businessInfo.shortDescription}
                  onChange={(value) => setBusinessInfo((current) => ({ ...current, shortDescription: value }))}
                  placeholder="A winery and farm kitchen for relaxed meals and gatherings."
                />
              </div>
              <TextInput
                label="Email"
                value={businessInfo.email}
                onChange={(value) => setBusinessInfo((current) => ({ ...current, email: value }))}
                placeholder="hello@example.com"
              />
              <TextInput
                label="Hours"
                value={businessInfo.hours}
                onChange={(value) => setBusinessInfo((current) => ({ ...current, hours: value }))}
                placeholder="Wednesday - Sunday 12PM - 8:30PM"
              />
              <div className="md:col-span-2">
                <TextInput
                  label="Address"
                  value={businessInfo.address}
                  onChange={(value) => setBusinessInfo((current) => ({ ...current, address: value }))}
                  placeholder="11206 Worcester Hwy Berlin, MD 21811"
                />
              </div>
            </div>
          </div>

          <WebsiteImportPanel business={business} onApplyImportedContent={applyImportedContent} />
        </div>
      </SectionCard>

      <div id="answers-for-customers">
        <SectionCard
          eyebrow="Customer Knowledge"
          title="Answers for Customers"
          description="Add answers to common questions and important policies so your assistant can respond quickly."
        >
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Common Questions</h3>
              <p className="mt-1 text-sm text-slate-600">Add answers to questions customers ask most often.</p>

              <form className="mt-4 space-y-4" onSubmit={handleFaqSubmit}>
                <TextInput
                  label="Question"
                  value={faqForm.question}
                  onChange={(value) => setFaqForm((current) => ({ ...current, question: value }))}
                  placeholder="Do you take walk-ins?"
                />
                <TextInput
                  label="Answer"
                  multiline
                  rows={4}
                  value={faqForm.answer}
                  onChange={(value) => setFaqForm((current) => ({ ...current, answer: value }))}
                  placeholder="Yes. We reserve a few tables for walk-ins every evening."
                />
                <TextInput
                  label="Category (optional)"
                  value={faqForm.category}
                  onChange={(value) => setFaqForm((current) => ({ ...current, category: value }))}
                  placeholder="Reservations"
                />
                <ToggleSwitch
                  label="Visible to customers"
                  helperText="Turn this off to keep it for internal use only."
                  checked={faqForm.showInHelp}
                  onChange={(next) => setFaqForm((current) => ({ ...current, showInHelp: next }))}
                />

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
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)]"
                  >
                    {editingFaqId ? "Update Answer" : "Save Answer"}
                  </button>
                </div>
              </form>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
              <h3 className="text-lg font-semibold text-slate-900">Policies &amp; House Rules</h3>
              <p className="mt-1 text-sm text-slate-600">Add policies your assistant should reference when helping customers.</p>

              <form className="mt-4 space-y-4" onSubmit={handlePolicySubmit}>
                <TextInput
                  label="Policy title"
                  value={policyForm.title}
                  onChange={(value) => setPolicyForm((current) => ({ ...current, title: value }))}
                  placeholder="Cancellation policy"
                />
                <TextInput
                  label="Policy details"
                  multiline
                  rows={4}
                  value={policyForm.description}
                  onChange={(value) => setPolicyForm((current) => ({ ...current, description: value }))}
                  placeholder="Cancellations are free up to 24 hours before the reservation time."
                />
                <TextInput
                  label="Category (optional)"
                  value={policyForm.category}
                  onChange={(value) => setPolicyForm((current) => ({ ...current, category: value }))}
                  placeholder="Reservations"
                />
                <ToggleSwitch
                  label="Visible to customers"
                  helperText="Turn this off to keep it for internal use only."
                  checked={policyForm.showInHelp}
                  onChange={(next) => setPolicyForm((current) => ({ ...current, showInHelp: next }))}
                />

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
                      Cancel
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className="rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white transition hover:bg-[var(--console-primary-hover)]"
                  >
                    {editingPolicyId ? "Update Policy" : "Save Policy"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        eyebrow="Saved Content"
        title="Saved Content"
        description="Review and manage the answers your assistant can use."
      >
        <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-5">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <SegmentedControl
              value={activeContentTab}
              ariaLabel="Saved content tabs"
              options={[
                { value: "questions", label: "Questions" },
                { value: "policies", label: "Policies" },
              ]}
              onChange={(next) => setActiveContentTab(next)}
            />
          </div>

          {activeContentTab === "questions" ? (
            sortedFaqs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
                <h4 className="text-base font-semibold text-slate-900">No questions added yet</h4>
                <p className="mt-2 text-sm text-slate-600">Start by adding answers to the questions customers ask most often.</p>
                <button
                  type="button"
                  onClick={() => {
                    setActiveContentTab("questions");
                    scrollToAnswers();
                  }}
                  className="mt-4 rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white"
                >
                  Add Question
                </button>
              </div>
            ) : (
              <DataTableShell>
                <table className="min-w-full text-left text-sm">
                  <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                    <tr>
                      <th className="px-4 py-3">Question</th>
                      <th className="px-4 py-3">Category</th>
                      <th className="px-4 py-3">Visibility</th>
                      <th className="px-4 py-3">Last updated</th>
                      <th className="px-4 py-3">Edit</th>
                      <th className="px-4 py-3">Delete</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sortedFaqs.map((faq) => (
                      <tr key={faq.id}>
                        <td className="px-4 py-3 font-medium text-slate-900">{faq.question}</td>
                        <td className="px-4 py-3 text-slate-600">{faq.category}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              const timestamp = new Date().toISOString();
                              setFaqs((current) =>
                                current.map((entry) =>
                                  entry.id === faq.id ? { ...entry, showInHelp: !entry.showInHelp, updatedAt: timestamp } : entry,
                                ),
                              );
                            }}
                            className="rounded-full"
                          >
                            <StatusBadge label={faq.showInHelp ? "Visible" : "Internal"} tone={faq.showInHelp ? "success" : "neutral"} />
                          </button>
                        </td>
                        <td className="px-4 py-3 text-slate-600">{formatTimestamp(faq.updatedAt)}</td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setFaqForm({
                                question: faq.question,
                                answer: faq.answer,
                                category: faq.category,
                                showInHelp: faq.showInHelp,
                              });
                              setEditingFaqId(faq.id);
                              scrollToAnswers();
                            }}
                            className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                          >
                            Edit
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => {
                              setFaqs((current) => current.filter((entry) => entry.id !== faq.id));
                              if (editingFaqId === faq.id) {
                                setEditingFaqId(null);
                                setFaqForm(defaultFaq);
                              }
                            }}
                            className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </DataTableShell>
            )
          ) : sortedPolicies.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-8 text-center">
              <h4 className="text-base font-semibold text-slate-900">No policies added yet</h4>
              <p className="mt-2 text-sm text-slate-600">Add your key policies so customers can get clear answers quickly.</p>
              <button
                type="button"
                onClick={() => {
                  setActiveContentTab("policies");
                  scrollToAnswers();
                }}
                className="mt-4 rounded-2xl bg-[var(--console-primary)] px-5 py-2 text-sm font-semibold text-white"
              >
                Add Policy
              </button>
            </div>
          ) : (
            <DataTableShell>
              <table className="min-w-full text-left text-sm">
                <thead className="bg-slate-50 text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Title</th>
                    <th className="px-4 py-3">Category</th>
                    <th className="px-4 py-3">Visibility</th>
                    <th className="px-4 py-3">Last updated</th>
                    <th className="px-4 py-3">Edit</th>
                    <th className="px-4 py-3">Delete</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sortedPolicies.map((policy) => (
                    <tr key={policy.id}>
                      <td className="px-4 py-3 font-medium text-slate-900">{policy.title}</td>
                      <td className="px-4 py-3 text-slate-600">{policy.category}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            const timestamp = new Date().toISOString();
                            setPolicies((current) =>
                              current.map((entry) =>
                                entry.id === policy.id
                                  ? { ...entry, showInHelp: !entry.showInHelp, updatedAt: timestamp }
                                  : entry,
                              ),
                            );
                          }}
                            className="rounded-full"
                        >
                            <StatusBadge label={policy.showInHelp ? "Visible" : "Internal"} tone={policy.showInHelp ? "success" : "neutral"} />
                        </button>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{formatTimestamp(policy.updatedAt)}</td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPolicyForm({
                              title: policy.title,
                              description: policy.description,
                              category: policy.category,
                              showInHelp: policy.showInHelp,
                            });
                            setEditingPolicyId(policy.id);
                            scrollToAnswers();
                          }}
                          className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700"
                        >
                          Edit
                        </button>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => {
                            setPolicies((current) => current.filter((entry) => entry.id !== policy.id));
                            if (editingPolicyId === policy.id) {
                              setEditingPolicyId(null);
                              setPolicyForm(defaultPolicy);
                            }
                          }}
                          className="rounded-lg border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700"
                        >
                          Delete
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DataTableShell>
          )}
        </div>
      </SectionCard>

      <SaveBar visible={isDirty} onSave={handleSave} saving={saving} label="You have unsaved updates" />
    </div>
  );
}
