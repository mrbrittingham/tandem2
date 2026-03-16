"use client";

import { useState, useRef, useEffect, type ReactNode, type KeyboardEvent, type FormEvent } from "react";
import { Sidebar } from "@tandem/ui-kit";
import { updateMockState } from "@tandem/shared";
import { useActiveLocation } from "@/lib/store-hooks";
import { resolveChatScope } from "@/lib/chat-scope";
import { notifyConfigUpdated } from "@/lib/config-store";
import { ConfirmationCard } from "@/lib/operator-tools/pending-change-renderer";
import type { PendingChange } from "@/lib/operator-tools/tool-definitions";
import {
  applyHoursChange,
  applyFaqChange,
  applyHandoffChange,
  applyBehaviorChange,
  applyBusinessInfoChange,
} from "@/lib/operator-tools/mock-store-updaters";

type MessageType = "text" | "pending_change" | "confirm_success" | "confirm_error";

type Message = {
  id: string;
  role: "user" | "assistant";
  text: string;
  type?: MessageType;
  pendingChange?: PendingChange;
  assistantMessage?: string;
};

const QUICK_ACTIONS = [
  { label: "🚀 Let's get started!", text: "What should I set up first to get my AI assistant ready?" },
  { label: "⚙ Auto-configure my assistant", text: "Can you help me auto-configure my assistant based on my business?" },
  { label: "💡 Tell me what you can do", text: "What can you help me with as a restaurant operator?" },
];

function BotAvatar() {
  return (
    <div
      className="relative mx-auto mb-4 flex h-16 w-16 shrink-0 items-center justify-center rounded-full"
      style={{ background: "radial-gradient(circle at 35% 35%, #5fe3c0 0%, #2bb5e0 40%, #3263d9 80%, #1a2d6b 100%)" }}
    >
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none">
        <circle cx="11" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
        <circle cx="21" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
        <path
          d="M10 20.5 C12 23 20 23 22 20.5"
          stroke="white"
          strokeWidth="2"
          strokeLinecap="round"
          strokeOpacity="0.9"
          fill="none"
        />
      </svg>
    </div>
  );
}

function renderSimpleMarkdown(text: string): ReactNode[] {
  if (!text) return [];
  const lines = text.split("\n");
  const blocks: ReactNode[] = [];
  const listBuffer: string[] = [];
  let key = 0;

  const renderInline = (raw: string, baseKey: string): ReactNode => {
    const parts: ReactNode[] = [];
    const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*)/g;
    let last = 0;
    let m: RegExpExecArray | null;
    let i = 0;
    while ((m = pattern.exec(raw)) !== null) {
      if (m.index > last) parts.push(raw.slice(last, m.index));
      if (m[2]) parts.push(<strong key={`${baseKey}-b${i++}`}>{m[2]}</strong>);
      else if (m[3]) parts.push(<em key={`${baseKey}-i${i++}`}>{m[3]}</em>);
      last = m.index + m[0].length;
    }
    if (last < raw.length) parts.push(raw.slice(last));
    return parts.length === 1 && typeof parts[0] === "string" ? parts[0] : <>{parts}</>;
  };

  const flushList = () => {
    if (listBuffer.length > 0) {
      const items = [...listBuffer];
      listBuffer.length = 0;
      blocks.push(
        <ul key={`list-${key++}`} className="ml-3 mt-1 space-y-0.5 list-disc list-inside">
          {items.map((item, i) => (
            <li key={i} className="text-sm leading-relaxed">{renderInline(item, `li-${key}-${i}`)}</li>
          ))}
        </ul>
      );
    }
  };

  for (const line of lines) {
    const trimmed = line.trimEnd();
    const bullet = trimmed.match(/^(?:[•\-\*]|\d+\.) (.+)$/);
    if (bullet) {
      listBuffer.push(bullet[1]);
    } else {
      flushList();
      if (trimmed.length > 0) {
        blocks.push(
          <p key={`p-${key++}`} className="text-sm leading-relaxed">
            {renderInline(trimmed, `p-${key}`)}
          </p>
        );
      }
    }
  }
  flushList();
  return blocks;
}

export function ConsoleSidebar() {
  const activeBusiness = useActiveLocation();
  const scope = resolveChatScope(activeBusiness ?? undefined);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  // Set of message IDs currently awaiting /api/operator-chat/confirm response
  const [confirmingIds, setConfirmingIds] = useState<Set<string>>(new Set());
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // ── Confirm handler ────────────────────────────────────────────────────
  const handleConfirm = async (messageId: string, pendingChange: PendingChange) => {
    setConfirmingIds((prev) => new Set(prev).add(messageId));

    try {
      const res = await fetch("/api/operator-chat/confirm", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ pendingChange }),
      });

      const body: { ok?: boolean; error?: string } = await res.json().catch(() => ({}));

      if (res.ok && body.ok) {
        // Replace the ConfirmationCard with a success message
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  type: "confirm_success" as MessageType,
                  text: `Done! ${pendingChange.humanSummary}`,
                  pendingChange: undefined,
                  assistantMessage: undefined,
                }
              : m,
          ),
        );

        // Apply mock store update so dashboard UI reflects the change immediately
        const toolName = pendingChange.toolName;
        const toolArgs = pendingChange.toolArgs;
        const locationId = scope.locationId;

        if (locationId) {
          updateMockState((draft) => {
            const idx = draft.businesses.findIndex((b) => b.id === locationId);
            if (idx < 0) return;
            const profile = draft.businesses[idx];

            if (toolName === "set_business_hours") {
              draft.businesses[idx] = applyHoursChange(profile, toolArgs);
            } else if (
              toolName === "add_faq" ||
              toolName === "update_faq" ||
              toolName === "remove_faq"
            ) {
              draft.businesses[idx] = applyFaqChange(
                profile,
                toolArgs,
                toolName as "add_faq" | "update_faq" | "remove_faq",
              );
            } else if (
              toolName === "set_handoff_contact" ||
              toolName === "remove_handoff_contact" ||
              toolName === "update_handoff_settings"
            ) {
              draft.businesses[idx] = applyHandoffChange(
                profile,
                toolArgs,
                toolName as "set_handoff_contact" | "remove_handoff_contact" | "update_handoff_settings",
              );
            } else if (toolName === "set_behavior_rules") {
              draft.businesses[idx] = applyBehaviorChange(profile, toolArgs);
            } else if (toolName === "update_business_info") {
              draft.businesses[idx] = applyBusinessInfoChange(profile, toolArgs);
            }
          });
        }

        // Notify config-store subscribers to re-fetch from server
        notifyConfigUpdated();
      } else {
        const errMsg = body.error ?? "Something went wrong. Please try again.";
        setMessages((prev) =>
          prev.map((m) =>
            m.id === messageId
              ? {
                  ...m,
                  type: "confirm_error" as MessageType,
                  text: `Error: ${errMsg}`,
                  pendingChange: undefined,
                  assistantMessage: undefined,
                }
              : m,
          ),
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === messageId
            ? {
                ...m,
                type: "confirm_error" as MessageType,
                text: "Failed to connect. Please try again.",
                pendingChange: undefined,
                assistantMessage: undefined,
              }
            : m,
        ),
      );
    } finally {
      setConfirmingIds((prev) => {
        const next = new Set(prev);
        next.delete(messageId);
        return next;
      });
    }
  };

  // ── Cancel handler ─────────────────────────────────────────────────────
  const handleCancel = (messageId: string) => {
    setMessages((prev) =>
      prev.map((m) =>
        m.id === messageId
          ? {
              ...m,
              type: "text" as MessageType,
              text: "Got it — no changes were made.",
              pendingChange: undefined,
              assistantMessage: undefined,
            }
          : m,
      ),
    );
  };

  const sendMessage = async (text: string) => {
    const trimmed = text.trim();
    if (!trimmed || isLoading) return;

    const userId = `u-${Date.now()}`;
    const assistantId = `a-${Date.now() + 1}`;
    const userMsg: Message = { id: userId, role: "user", text: trimmed, type: "text" };
    const assistantMsg: Message = {
      id: assistantId,
      role: "assistant",
      text: "",
      type: "text",
    };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setInput("");
    setIsLoading(true);

    if (!scope.locationId) {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Please select a location first so I can give you accurate answers." }
            : m,
        ),
      );
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/operator-chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          businessId: scope.businessId,
          businessSlug: scope.businessSlug,
          locationId: scope.locationId,
          locationSlug: scope.locationSlug,
          messages: [...messages, userMsg].map((m) => ({ role: m.role, content: m.text })),
        }),
      });

      if (!response.ok || !response.body) throw new Error("Failed");

      const contentType = response.headers.get("content-type") ?? "";

      if (contentType.includes("application/json")) {
        // Tool-call response — AI is proposing a config change
        const body: { pendingChange?: PendingChange; assistantMessage?: string; error?: string } =
          await response.json().catch(() => ({}));

        if (body.pendingChange) {
          setMessages((prev) =>
            prev.map((m) =>
              m.id === assistantId
                ? {
                    ...m,
                    type: "pending_change" as MessageType,
                    text: "",
                    pendingChange: body.pendingChange,
                    assistantMessage: body.assistantMessage ?? "",
                  }
                : m,
            ),
          );
        } else {
          // JSON response but no pending change — show message or error text
          const fallback = body.assistantMessage ?? body.error ?? "Something went wrong.";
          setMessages((prev) =>
            prev.map((m) => (m.id === assistantId ? { ...m, text: fallback } : m)),
          );
        }
      } else {
        // Streaming text response — read chunks
        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            setMessages((prev) =>
              prev.map((m) => (m.id === assistantId ? { ...m, text: m.text + chunk } : m)),
            );
          }
        }
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) =>
          m.id === assistantId
            ? { ...m, text: "Sorry, I couldn't connect. Please try again." }
            : m,
        ),
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage(input);
    }
  };

  const hasMessages = messages.length > 0;

  const inputBar = (
    <div className="shrink-0 border-t border-white/8 px-3 pb-3 pt-2">
      <form onSubmit={handleSubmit} className="relative">
        <textarea
          ref={inputRef}
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message…"
          rows={1}
          className="w-full resize-none rounded-xl border border-white/10 bg-white/8 px-3 py-2.5 pr-10 text-sm text-white placeholder-white/35 outline-none transition-colors focus:border-white/25 focus:bg-white/12"
          style={{ minHeight: "42px", maxHeight: "120px" }}
        />
        <button
          type="submit"
          disabled={!input.trim() || isLoading}
          aria-label="Send"
          className="absolute right-2 top-1/2 -translate-y-1/2 flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--color-primary)] text-white transition-opacity disabled:opacity-30"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 7H2M7 2l5 5-5 5" />
          </svg>
        </button>
      </form>
      <div className="mt-2 flex items-center justify-between px-0.5">
        <button
          type="button"
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/6 px-2.5 py-1 text-xs text-white/60 transition-colors hover:bg-white/10 hover:text-white/80"
        >
          Mode: Ask
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M2 3.5 5 6.5 8 3.5" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round" />
          </svg>
        </button>
        <button
          type="button"
          aria-label="Voice"
          className="flex h-6 w-6 items-center justify-center rounded-lg text-white/40 transition-colors hover:text-white/70"
        >
          <svg width="13" height="13" viewBox="0 0 13 13" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <rect x="4" y="1" width="5" height="7" rx="2.5" />
            <path d="M1.5 6.5a5 5 0 0 0 10 0" />
            <path d="M6.5 11.5v1" />
          </svg>
        </button>
      </div>
    </div>
  );

  return (
    <Sidebar className="sticky top-0 h-screen">
      {/* Header */}
      <div className="flex shrink-0 items-center justify-between px-4 pt-4 pb-3">
        <div className="flex items-center gap-2">
          <span
            className="flex h-7 w-7 items-center justify-center rounded-lg text-xs font-bold text-white"
            style={{ background: "var(--color-primary)" }}
          >
            T
          </span>
          <span className="text-sm font-semibold text-white tracking-tight">Tandem</span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            aria-label="Menu"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
          >
            <svg width="15" height="15" viewBox="0 0 15 15" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M2 4h11M2 7.5h11M2 11h11" />
            </svg>
          </button>
          <button
            type="button"
            aria-label="Expand"
            className="flex h-7 w-7 items-center justify-center rounded-md text-white/50 hover:text-white/90 hover:bg-white/10 transition-colors"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M2 5V2h3M9 2h3v3M12 9v3H9M5 12H2V9" />
            </svg>
          </button>
        </div>
      </div>

      {!hasMessages ? (
        /* Greeting state: input sits below the content, not stuck at screen bottom */
        <div className="flex flex-1 flex-col overflow-y-auto overflow-x-hidden">
          <div className="flex flex-1 flex-col items-center justify-center px-4 py-4 text-center">
            <BotAvatar />
            <h2 className="text-lg font-bold text-white mb-1.5">Hey there!</h2>
            <p className="text-sm text-white/60 leading-relaxed mb-5">
              Ask me questions or commands. Or just use my advice to boost your performance.
            </p>
            <div className="flex w-full flex-col gap-2">
              {QUICK_ACTIONS.map((qa) => (
                <button
                  key={qa.label}
                  type="button"
                  onClick={() => sendMessage(qa.text)}
                  className="w-full rounded-xl border border-white/10 bg-white/6 px-3 py-2 text-left text-sm text-white/80 transition-all hover:border-white/20 hover:bg-white/10 hover:text-white"
                >
                  {qa.label}
                </button>
              ))}
            </div>
          </div>
          {inputBar}
        </div>
      ) : (
        /* Messages state: messages scroll, input pinned at bottom */
        <>
          <div className="flex flex-1 flex-col gap-3 overflow-y-auto overflow-x-hidden px-3 py-3">
            {messages.map((msg) => {
              const isAssistant = msg.role === "assistant";
              const avatar = isAssistant ? (
                <div
                  className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full mt-1"
                  style={{
                    background:
                      "radial-gradient(circle at 35% 35%, #5fe3c0 0%, #2bb5e0 40%, #3263d9 80%, #1a2d6b 100%)",
                  }}
                >
                  <svg width="12" height="12" viewBox="0 0 32 32" fill="none">
                    <circle cx="11" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
                    <circle cx="21" cy="14" r="2.5" fill="white" fillOpacity="0.9" />
                    <path d="M10 20.5 C12 23 20 23 22 20.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeOpacity="0.9" fill="none" />
                  </svg>
                </div>
              ) : null;

              // Pending change — show ConfirmationCard
              if (isAssistant && msg.type === "pending_change" && msg.pendingChange) {
                return (
                  <div key={msg.id} className="flex justify-start">
                    {avatar}
                    <div className="min-w-0 flex-1">
                      <ConfirmationCard
                        pendingChange={msg.pendingChange}
                        assistantMessage={msg.assistantMessage ?? ""}
                        isConfirming={confirmingIds.has(msg.id)}
                        onConfirm={() => handleConfirm(msg.id, msg.pendingChange!)}
                        onCancel={() => handleCancel(msg.id)}
                      />
                    </div>
                  </div>
                );
              }

              // Confirm success
              if (isAssistant && msg.type === "confirm_success") {
                return (
                  <div key={msg.id} className="flex justify-start">
                    {avatar}
                    <div className="max-w-[85%] min-w-0 break-words rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed bg-emerald-500/20 text-emerald-200">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // Confirm error
              if (isAssistant && msg.type === "confirm_error") {
                return (
                  <div key={msg.id} className="flex justify-start">
                    {avatar}
                    <div className="max-w-[85%] min-w-0 break-words rounded-2xl rounded-tl-sm px-3 py-2 text-sm leading-relaxed bg-red-500/20 text-red-200">
                      {msg.text}
                    </div>
                  </div>
                );
              }

              // Default text message (user or assistant)
              return (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
                >
                  {isAssistant && avatar}
                  <div
                    className={`max-w-[85%] min-w-0 break-words rounded-2xl px-3 py-2 text-sm leading-relaxed ${
                      msg.role === "user"
                        ? "rounded-tr-sm bg-[var(--color-primary)] text-white"
                        : "rounded-tl-sm bg-white/10 text-white/90"
                    }`}
                  >
                    {isAssistant ? (
                      msg.text ? (
                        <div className="space-y-1">{renderSimpleMarkdown(msg.text)}</div>
                      ) : (
                        <span className="inline-flex gap-1 items-center opacity-60">
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:0ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:150ms]" />
                          <span className="h-1.5 w-1.5 rounded-full bg-white animate-bounce [animation-delay:300ms]" />
                        </span>
                      )
                    ) : (
                      msg.text
                    )}
                  </div>
                </div>
              );
            })}
            <div ref={messagesEndRef} />
          </div>
          {inputBar}
        </>
      )}
    </Sidebar>
  );
}
