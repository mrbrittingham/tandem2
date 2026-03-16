"use client";

/**
 * Pending Change Renderer — ConfirmationCard component
 *
 * Displayed in ConsoleSidebar when the operator AI proposes a configuration
 * change. Shows a structured summary of what will change, plus Confirm/Cancel
 * buttons which are wired to /api/operator-chat/confirm.
 */

import type { PendingChange } from "./tool-definitions";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function asStr(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function asArr(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

// ---------------------------------------------------------------------------
// Tool-specific preview renderers
// ---------------------------------------------------------------------------

function PreviewSetBusinessHours({ args }: { args: Record<string, unknown> }) {
  const narrative = asStr(args.hoursNarrative);
  const blocks = asArr(args.hoursBlocks) as Record<string, unknown>[];

  return (
    <div className="space-y-2">
      {narrative && (
        <div className="rounded-md bg-white/6 px-3 py-2 text-xs text-white/80">
          <span className="font-medium text-white/50 block mb-0.5">Hours description</span>
          {narrative}
        </div>
      )}
      {blocks.length > 0 && (
        <div className="space-y-1">
          {blocks.map((b, i) => (
            <div key={i} className="flex items-center gap-2 text-xs text-white/75">
              <span className="text-white/40">{asStr(b.label)}:</span>
              <span>{asArr(b.days).join(", ")}</span>
              <span className="text-white/40">·</span>
              <span>
                {asStr(b.open)} – {asStr(b.close)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PreviewAddFaq({ args }: { args: Record<string, unknown> }) {
  const question = asStr(args.question);
  const answer = asStr(args.answer);
  const category = asStr(args.category) || "general";

  return (
    <div className="rounded-md border border-white/10 bg-white/5 p-3 space-y-1.5">
      <div className="text-xs font-medium text-white/90">{question}</div>
      <div className="text-xs text-white/65 leading-relaxed">{answer}</div>
      <div className="text-xs text-white/35 uppercase tracking-wide">{category}</div>
    </div>
  );
}

function PreviewUpdateFaq({ args }: { args: Record<string, unknown> }) {
  const id = asStr(args.id);
  const fields: string[] = [];
  if (args.question !== undefined) fields.push("question");
  if (args.answer !== undefined) fields.push("answer");
  if (args.category !== undefined) fields.push("category");

  return (
    <div className="text-xs text-white/70 space-y-1">
      <div>
        <span className="text-white/40">FAQ id: </span>
        <code className="text-white/70 font-mono">{id}</code>
      </div>
      {fields.length > 0 && (
        <div>
          <span className="text-white/40">Updating: </span>
          {fields.join(", ")}
        </div>
      )}
    </div>
  );
}

function PreviewRemoveFaq({ args }: { args: Record<string, unknown> }) {
  return (
    <div className="text-xs text-white/70">
      <span className="text-white/40">FAQ id: </span>
      <code className="text-white/70 font-mono">{asStr(args.id)}</code>
    </div>
  );
}

function PreviewSetHandoffContact({ args }: { args: Record<string, unknown> }) {
  const contactType = asStr(args.type);
  const label = asStr(args.label);
  const value = asStr(args.value);
  const enabled = args.enabled !== false;

  const typeIcon: Record<string, string> = {
    phone: "📞",
    email: "✉️",
    sms: "💬",
    link: "🔗",
    form: "📋",
  };

  return (
    <div className="rounded-md bg-white/6 px-3 py-2 text-xs space-y-0.5">
      <div className="flex items-center gap-2">
        <span>{typeIcon[contactType] ?? "📌"}</span>
        <span className="font-medium text-white/90">{label}</span>
        {!enabled && (
          <span className="ml-auto text-white/35 text-[10px] uppercase">disabled</span>
        )}
      </div>
      <div className="text-white/60 pl-5">{value}</div>
    </div>
  );
}

function PreviewRemoveHandoffContact({ args }: { args: Record<string, unknown> }) {
  return (
    <div className="text-xs text-white/70">
      <span className="text-white/40">Contact id: </span>
      <code className="text-white/70 font-mono">{asStr(args.id)}</code>
    </div>
  );
}

function PreviewKeyValues({ args }: { args: Record<string, unknown> }) {
  const entries = Object.entries(args).filter(
    ([, v]) => v !== undefined && v !== null && v !== "",
  );
  if (entries.length === 0) return null;

  return (
    <div className="space-y-1">
      {entries.map(([k, v]) => (
        <div key={k} className="flex gap-2 text-xs">
          <span className="text-white/40 min-w-[120px]">{k}</span>
          <span className="text-white/80 break-all">
            {Array.isArray(v) ? v.join(", ") : String(v)}
          </span>
        </div>
      ))}
    </div>
  );
}

function ChangePreview({
  toolName,
  toolArgs,
}: {
  toolName: string;
  toolArgs: Record<string, unknown>;
}) {
  switch (toolName) {
    case "set_business_hours":
      return <PreviewSetBusinessHours args={toolArgs} />;
    case "add_faq":
      return <PreviewAddFaq args={toolArgs} />;
    case "update_faq":
      return <PreviewUpdateFaq args={toolArgs} />;
    case "remove_faq":
      return <PreviewRemoveFaq args={toolArgs} />;
    case "set_handoff_contact":
      return <PreviewSetHandoffContact args={toolArgs} />;
    case "remove_handoff_contact":
      return <PreviewRemoveHandoffContact args={toolArgs} />;
    case "update_handoff_settings":
    case "set_behavior_rules":
    case "update_business_info":
      return <PreviewKeyValues args={toolArgs} />;
    default:
      return null;
  }
}

// ---------------------------------------------------------------------------
// Tool name → human-readable label
// ---------------------------------------------------------------------------

const TOOL_LABELS: Record<string, string> = {
  set_business_hours: "Update Hours",
  add_faq: "Add FAQ",
  update_faq: "Edit FAQ",
  remove_faq: "Remove FAQ",
  set_handoff_contact: "Update Contact",
  remove_handoff_contact: "Remove Contact",
  update_handoff_settings: "Update Handoff Settings",
  set_behavior_rules: "Update Behavior Rules",
  update_business_info: "Update Business Info",
};

// Map tool name → config section label for operator context
const TOOL_SECTION: Record<string, string> = {
  set_business_hours: "Knowledge",
  add_faq: "Knowledge",
  update_faq: "Knowledge",
  remove_faq: "Knowledge",
  set_handoff_contact: "Handoff",
  remove_handoff_contact: "Handoff",
  update_handoff_settings: "Handoff",
  set_behavior_rules: "Behavior",
  update_business_info: "Business Info",
};

// ---------------------------------------------------------------------------
// ConfirmationCard component
// ---------------------------------------------------------------------------

type ConfirmationCardProps = {
  pendingChange: PendingChange;
  assistantMessage: string;
  isConfirming?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmationCard({
  pendingChange,
  assistantMessage,
  isConfirming = false,
  onConfirm,
  onCancel,
}: ConfirmationCardProps) {
  const toolLabel = TOOL_LABELS[pendingChange.toolName] ?? pendingChange.toolName;
  const section = TOOL_SECTION[pendingChange.toolName];

  return (
    <div className="rounded-xl border border-white/15 bg-white/6 p-3 space-y-3 text-sm">
      {/* Assistant explanation */}
      {assistantMessage && (
        <p className="text-white/80 text-xs leading-relaxed">{assistantMessage}</p>
      )}

      {/* Change type badge + section */}
      <div className="flex items-center gap-2 flex-wrap">
        <span className="rounded-full bg-[var(--color-primary)]/20 border border-[var(--color-primary)]/30 px-2.5 py-0.5 text-[11px] font-medium text-[var(--color-primary)]">
          {toolLabel}
        </span>
        {section && (
          <span className="text-[10px] font-medium text-white/35 uppercase tracking-wide">
            {section}
          </span>
        )}
      </div>

      {/* Structured preview of the proposed change */}
      <ChangePreview
        toolName={pendingChange.toolName}
        toolArgs={pendingChange.toolArgs}
      />

      {/* Action buttons */}
      <div className="flex gap-2 pt-1">
        <button
          type="button"
          onClick={onConfirm}
          disabled={isConfirming}
          className="flex-1 rounded-lg bg-[var(--color-primary)] px-3 py-1.5 text-xs font-medium text-white transition-opacity hover:opacity-90 disabled:opacity-50"
        >
          {isConfirming ? "Saving…" : "Apply change"}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={isConfirming}
          className="flex-1 rounded-lg border border-white/15 bg-white/5 px-3 py-1.5 text-xs font-medium text-white/70 transition-colors hover:bg-white/10 disabled:opacity-50"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
