"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";
import type { WidgetContentConfig } from "@tandem/shared";

import styles from "./ChatWidget.module.css";

type CSSVarStyles = CSSProperties & Record<string, string>;

type MessageRole = "user" | "assistant" | "system";
type ViewState = "chat" | "help";

export type MessageCTA = {
  label: string;
  href: string;
};

export type MessageDescriptor = {
  role: MessageRole;
  text: string;
  cta?: MessageCTA;
};

type Message = MessageDescriptor & { id: string };

const VIEW_OPTIONS: Array<{ value: ViewState; label: string }> = [
  { value: "chat", label: "Chat" },
  { value: "help", label: "Help" },
];

const SCROLL_STICKY_THRESHOLD = 48;

const isNearBottom = (node: HTMLDivElement | null): boolean => {
  if (!node) {
    return true;
  }
  const distanceFromBottom = node.scrollHeight - node.scrollTop - node.clientHeight;
  return distanceFromBottom <= SCROLL_STICKY_THRESHOLD;
};

const scrollToBottom = (node: HTMLDivElement | null, behavior: ScrollBehavior = "auto") => {
  if (!node) {
    return;
  }
  node.scrollTo({
    top: node.scrollHeight,
    behavior,
  });
};


export type ThemeTokens = {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  primaryHoverColor: string;
  primaryPressedColor: string;
  primaryTextColor: string;
  accentColor: string;
  accentLightColor: string;
  accentTextColor: string;
  surfaceColor: string;
  surfaceElevatedColor: string;
  surfaceHoverColor: string;
  surfaceMutedColor: string;
  surfaceContrastColor: string;
  borderColor: string;
  borderLightColor: string;
  mutedColor: string;
  textPrimaryColor: string;
  textSecondaryColor: string;
  textTertiaryColor: string;
  textOnPrimaryColor: string;
  panelShadow: string;
  shadowSoft: string;
  shadowMedium: string;
  shadowDeep: string;
  shadowLauncher: string;
  panelRadius: string;
  bubbleRadius: string;
  buttonRadius: string;
  inputRadius: string;
  launcherRadius: string;
  userBubbleBg: string;
  userBubbleText: string;
  assistantBubbleBg: string;
  assistantBubbleText: string;
  systemBubbleBg: string;
  systemBubbleText: string;
  secondaryColor: string;
  secondaryHoverColor: string;
  secondaryTextColor: string;
  ctaBg: string;
  ctaText: string;
  space4: string;
  space8: string;
  space12: string;
  space16: string;
  space20: string;
  space24: string;
  space32: string;
  fontDisplay: string;
  fontBody: string;
  panelWidthMobile: string;
  panelWidthDesktop: string;
  panelMaxHeight: string;
  launcherSize: string;
  headerHeight: string;
  inputHeight: string;
};

export type ChatWidgetProps = {
  theme?: Partial<ThemeTokens>;
  initialMessages?: MessageDescriptor[];
  config?: WidgetContentConfig;
  initiallyOpen?: boolean;
  businessId?: string;
  apiBaseUrl?: string;
};

const defaultTheme: ThemeTokens = {
  brandName: "Tandem",
  logoUrl: undefined,
  primaryColor: "#2563EB",
  primaryHoverColor: "#1D4ED8",
  primaryPressedColor: "#1E40AF",
  primaryTextColor: "#FFFFFF",
  accentColor: "#3B82F6",
  accentLightColor: "#DBEAFE",
  accentTextColor: "#1A1A1A",
  surfaceColor: "#FFFFFF",
  surfaceElevatedColor: "#FAFAFA",
  surfaceHoverColor: "#F5F5F5",
  surfaceMutedColor: "#FAFAFA",
  surfaceContrastColor: "#1A1A1A",
  borderColor: "#E5E5E5",
  borderLightColor: "#F0F0F0",
  mutedColor: "#666666",
  textPrimaryColor: "#1A1A1A",
  textSecondaryColor: "#666666",
  textTertiaryColor: "#999999",
  textOnPrimaryColor: "#FFFFFF",
  panelShadow: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  shadowSoft: "0 1px 2px 0 rgba(0, 0, 0, 0.03), 0 1px 3px 0 rgba(0, 0, 0, 0.04)",
  shadowMedium: "0 4px 6px -1px rgba(0, 0, 0, 0.06), 0 2px 4px -1px rgba(0, 0, 0, 0.04)",
  shadowDeep: "0 20px 25px -5px rgba(0, 0, 0, 0.08), 0 10px 10px -5px rgba(0, 0, 0, 0.04)",
  shadowLauncher: "0 8px 16px -4px rgba(0, 0, 0, 0.1), 0 4px 8px -2px rgba(0, 0, 0, 0.06)",
  panelRadius: "16px",
  bubbleRadius: "18px",
  buttonRadius: "12px",
  inputRadius: "12px",
  launcherRadius: "28px",
  userBubbleBg: "#1A1A1A",
  userBubbleText: "#FFFFFF",
  assistantBubbleBg: "#F5F5F5",
  assistantBubbleText: "#1A1A1A",
  systemBubbleBg: "#FAFAFA",
  systemBubbleText: "#666666",
  secondaryColor: "#F5F5F5",
  secondaryHoverColor: "#E5E5E5",
  secondaryTextColor: "#1A1A1A",
  ctaBg: "#2563EB",
  ctaText: "#FFFFFF",
  space4: "4px",
  space8: "8px",
  space12: "12px",
  space16: "16px",
  space20: "20px",
  space24: "24px",
  space32: "32px",
  fontDisplay: "'Lilita One', sans-serif",
  fontBody: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif",
  panelWidthMobile: "100vw",
  panelWidthDesktop: "400px",
  panelMaxHeight: "700px",
  launcherSize: "56px",
  headerHeight: "64px",
  inputHeight: "52px",
};

const defaultMessages: MessageDescriptor[] = [
  {
    role: "system",
    text: "You are chatting with Tandem Concierge.",
  },
  {
    role: "assistant",
    text: "Hi, I'm Tandem. How can I help you today?",
  },
];

const defaultContentConfig: WidgetContentConfig = {
  businessName: "Tandem Concierge",
  tagline: "Concierge for modern hospitality",
  welcomeMessage: "Ask about hours, menus, policies, or talk to a person anytime.",
  intents: [
    {
      id: "intent-hours",
      label: "Hours & location",
      description: "Driving directions and parking details",
      prompt: "What are your hours and where are you located?",
      routeType: "knowledge",
    },
    {
      id: "intent-menu",
      label: "Menu",
      description: "Tonight's tasting lineup",
      prompt: "Show me the latest menu",
      routeType: "knowledge",
    },
    {
      id: "intent-person",
      label: "Talk to a person",
      description: "Reach the live concierge",
      prompt: "I'd like to speak with someone",
      routeType: "handoff",
      routeHint: "Escalates to concierge",
    },
  ],
  faqs: [
    {
      id: "faq-reservations",
      question: "Do you accept walk-ins?",
      answer: "We keep a few bar seats open nightly. Otherwise tap Reservations to join the waitlist.",
      category: "Reservations",
    },
    {
      id: "faq-dietary",
      question: "Can you accommodate allergies?",
      answer: "Yes—we can prepare vegetarian, vegan, gluten-free, and nut-free menus with 48 hours notice.",
      category: "Dietary",
    },
  ],
  categories: [
    { id: "reservations", label: "Reservations", description: "Bookings and group policies" },
    { id: "policies", label: "Policies", description: "Cancellations and deposits" },
    { id: "dietary", label: "Dietary", description: "Allergies and accommodations" },
  ],
  handoff: {
    label: "Concierge team",
    status: "online",
    detail: "Replies within 2 minutes",
    actionLabel: "Talk to a person",
    actionValue: "",
  },
};

const createId = () =>
  `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const hydrateMessages = (presets?: MessageDescriptor[]): Message[] => {
  const source = presets?.length ? presets : defaultMessages;
  return source.map((entry) => ({
    ...entry,
    id: createId(),
    cta: entry.role === "assistant" ? entry.cta : undefined,
  }));
};

const themeToCSSVariables = (tokens: ThemeTokens): CSSVarStyles => ({
  "--tandem-primary": tokens.primaryColor,
  "--tandem-primary-hover": tokens.primaryHoverColor,
  "--tandem-primary-pressed": tokens.primaryPressedColor,
  "--tandem-primary-text": tokens.primaryTextColor,
  "--tandem-text-on-primary": tokens.textOnPrimaryColor,
  "--tandem-accent": tokens.accentColor,
  "--tandem-accent-light": tokens.accentLightColor,
  "--tandem-accent-text": tokens.accentTextColor,
  "--tandem-surface": tokens.surfaceColor,
  "--tandem-surface-elevated": tokens.surfaceElevatedColor,
  "--tandem-surface-hover": tokens.surfaceHoverColor,
  "--tandem-surface-muted": tokens.surfaceMutedColor,
  "--tandem-surface-contrast": tokens.surfaceContrastColor,
  "--tandem-border": tokens.borderColor,
  "--tandem-border-light": tokens.borderLightColor,
  "--tandem-muted": tokens.mutedColor,
  "--tandem-text-primary": tokens.textPrimaryColor,
  "--tandem-text-secondary": tokens.textSecondaryColor,
  "--tandem-text-tertiary": tokens.textTertiaryColor,
  "--tandem-shadow": tokens.shadowDeep,
  "--tandem-shadow-soft": tokens.shadowSoft,
  "--tandem-shadow-medium": tokens.shadowMedium,
  "--tandem-shadow-deep": tokens.shadowDeep,
  "--tandem-shadow-launcher": tokens.shadowLauncher,
  "--tandem-radius": tokens.panelRadius,
  "--tandem-radius-widget": tokens.panelRadius,
  "--tandem-bubble-radius": tokens.bubbleRadius,
  "--tandem-radius-button": tokens.buttonRadius,
  "--tandem-radius-input": tokens.inputRadius,
  "--tandem-radius-launcher": tokens.launcherRadius,
  "--tandem-user-bg": tokens.userBubbleBg,
  "--tandem-user-text": tokens.userBubbleText,
  "--tandem-assistant-bg": tokens.assistantBubbleBg,
  "--tandem-assistant-text": tokens.assistantBubbleText,
  "--tandem-system-bubble-bg": tokens.systemBubbleBg,
  "--tandem-system-bubble-text": tokens.systemBubbleText,
  "--tandem-secondary": tokens.secondaryColor,
  "--tandem-secondary-hover": tokens.secondaryHoverColor,
  "--tandem-secondary-text": tokens.secondaryTextColor,
  "--tandem-cta-bg": tokens.ctaBg,
  "--tandem-cta-text": tokens.ctaText,
  "--tandem-space-4": tokens.space4,
  "--tandem-space-8": tokens.space8,
  "--tandem-space-12": tokens.space12,
  "--tandem-space-16": tokens.space16,
  "--tandem-space-20": tokens.space20,
  "--tandem-space-24": tokens.space24,
  "--tandem-space-32": tokens.space32,
  "--tandem-font-display": tokens.fontDisplay,
  "--tandem-font-body": tokens.fontBody,
  "--tandem-panel-width-mobile": tokens.panelWidthMobile,
  "--tandem-panel-width-desktop": tokens.panelWidthDesktop,
  "--tandem-panel-max-height": tokens.panelMaxHeight,
  "--tandem-launcher-size": tokens.launcherSize,
  "--tandem-header-height": tokens.headerHeight,
  "--tandem-input-height": tokens.inputHeight,
});

export function ChatWidget({
  theme,
  initialMessages,
  config,
  initiallyOpen = false,
  businessId,
  apiBaseUrl,
}: ChatWidgetProps) {
  const mergedTheme = useMemo(
    () => ({ ...defaultTheme, ...theme, brandName: config?.businessName ?? defaultTheme.brandName }),
    [theme, config]
  );
  const cssVarStyle = useMemo(
    () => themeToCSSVariables(mergedTheme),
    [mergedTheme]
  );
  const resolvedBusinessId = businessId ?? "default";
  const normalizedApiBaseUrl = useMemo(() => {
    const trimmed = apiBaseUrl?.trim() ?? "";
    if (!trimmed) {
      return "";
    }
    return trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  }, [apiBaseUrl]);
  const chatApiUrl = `${normalizedApiBaseUrl}/api/chat`;
  const contentConfig = useMemo(() => {
    return {
      ...defaultContentConfig,
      ...config,
      intents: config?.intents?.length ? config.intents : defaultContentConfig.intents,
      faqs: config?.faqs?.length ? config.faqs : defaultContentConfig.faqs,
      categories: config?.categories?.length ? config.categories : defaultContentConfig.categories,
      handoff: {
        ...defaultContentConfig.handoff,
        ...(config?.handoff ?? {}),
      },
    } satisfies WidgetContentConfig;
  }, [config]);

  const [isOpen, setIsOpen] = useState(initiallyOpen);
  const [inputValue, setInputValue] = useState("");
  const [view, setView] = useState<ViewState>("chat");
  const [helpSearch, setHelpSearch] = useState("");
  const [showAllFaqs, setShowAllFaqs] = useState(false);
  const [messages, setMessages] = useState<Message[]>(() => hydrateMessages(initialMessages));
  const [isStreaming, setIsStreaming] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    setMessages(hydrateMessages(initialMessages));
    setHistoryLoaded(false);
  }, [initialMessages, resolvedBusinessId]);

  useEffect(() => {
    if (historyLoaded) {
      return;
    }

    let cancelled = false;
    const controller = new AbortController();

    const loadHistory = async () => {
      setIsHydratingHistory(true);
      try {
        const params = new URLSearchParams({ businessId: resolvedBusinessId });
        const response = await fetch(`${chatApiUrl}?${params.toString()}`, {
          method: "GET",
          signal: controller.signal,
        });
        if (!response.ok) {
          throw new Error("Failed to load conversation history");
        }
        const data = await response.json();
        if (cancelled) {
          return;
        }
        if (Array.isArray(data.messages) && data.messages.length) {
          setMessages(
            data.messages.map((message: { role: MessageRole; content: string }) => ({
              id: createId(),
              role: message.role,
              text: message.content,
            })),
          );
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Failed to hydrate chat history", error);
        }
      } finally {
        if (!cancelled) {
          setIsHydratingHistory(false);
          setHistoryLoaded(true);
        }
      }
    };

    loadHistory();

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [chatApiUrl, historyLoaded, resolvedBusinessId]);

  const handleViewChange = useCallback((next: ViewState) => {
    setView(next);
    if (next === "help") {
      setShowAllFaqs(false);
    }
  }, []);
  const isChatView = view === "chat";

  const handlePromptInsert = useCallback((prompt: string) => {
    setView("chat");
    setInputValue(prompt);
    if (typeof window !== "undefined") {
      window.requestAnimationFrame(() => {
        inputRef.current?.focus();
      });
    }
  }, []);

  const handleHandoffAction = useCallback(() => {
    const value = contentConfig.handoff.actionValue;
    if (value?.startsWith("http")) {
      window.open(value, "_blank", "noopener");
      return;
    }
    if (value?.includes("@")) {
      window.location.href = `mailto:${value}`;
      return;
    }
    handlePromptInsert("I'd like to talk to a person.");
  }, [contentConfig.handoff.actionValue, handlePromptInsert]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
    };
  }, []);

  useEffect(() => {
    if (!isOpen && abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        closePanel();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [closePanel, isOpen]);

  useEffect(() => {
    if (!isOpen || view !== "chat") {
      return;
    }

    shouldAutoScrollRef.current = true;
    inputRef.current?.focus();
    scrollToBottom(messagesRef.current, "auto");

    const node = messagesRef.current;
    if (!node) {
      return;
    }

    const handleScroll = () => {
      shouldAutoScrollRef.current = isNearBottom(node);
    };

    handleScroll();
    node.addEventListener("scroll", handleScroll, { passive: true });
    return () => node.removeEventListener("scroll", handleScroll);
  }, [isOpen, view]);

  useEffect(() => {
    if (!isOpen || view !== "chat") {
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom(messagesRef.current, "smooth");
    }
  }, [messages, isOpen, view]);

  const startAssistantResponse = useCallback(
    async (history: Message[], assistantMessageId: string) => {
      setErrorMessage(null);
      setIsStreaming(true);

      const controller = new AbortController();
      abortControllerRef.current = controller;

      try {
        const latestUserMessage = [...history].reverse().find((message) => message.role === "user");
        if (!latestUserMessage) {
          throw new Error("No user message to send");
        }

        const response = await fetch(chatApiUrl, {
          method: "POST",
          headers: {
            "content-type": "application/json",
          },
          body: JSON.stringify({
            businessId: resolvedBusinessId,
            messages: [
              {
                role: latestUserMessage.role,
                content: latestUserMessage.text,
              },
            ],
          }),
          signal: controller.signal,
        });

        if (!response.ok || !response.body) {
          const errorText = await response.text().catch(() => "");
          throw new Error(errorText || "Assistant failed to respond.");
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();

        while (true) {
          const { value, done } = await reader.read();
          if (done) {
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          if (chunk) {
            setMessages((prev) =>
              prev.map((message) =>
                message.id === assistantMessageId
                  ? { ...message, text: message.text + chunk }
                  : message,
              ),
            );
          }
        }

        const finalChunk = decoder.decode();
        if (finalChunk) {
          setMessages((prev) =>
            prev.map((message) =>
              message.id === assistantMessageId
                ? { ...message, text: message.text + finalChunk }
                : message,
            ),
          );
        }
      } catch (error) {
        const isAbort = error instanceof DOMException && error.name === "AbortError";
        const fallback = isAbort
          ? "Generation stopped."
          : error instanceof Error
            ? error.message
            : "Something went wrong. Please try again.";

        setMessages((prev) =>
          prev.map((message) =>
            message.id === assistantMessageId
              ? { ...message, role: "system", text: fallback }
              : message,
          ),
        );

        if (!isAbort) {
          setErrorMessage(fallback);
        }
      } finally {
        if (abortControllerRef.current === controller) {
          abortControllerRef.current = null;
        }
        setIsStreaming(false);
      }
    },
    [chatApiUrl, resolvedBusinessId],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!trimmed || isStreaming || isHydratingHistory) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    const assistantMessageId = createId();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
    };

    const conversationSnapshot = [...messages, userMessage];
    setMessages([...conversationSnapshot, assistantPlaceholder]);
    setInputValue("");

    await startAssistantResponse(conversationSnapshot, assistantMessageId);
  }, [inputValue, isHydratingHistory, isStreaming, messages, startAssistantResponse]);

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendMessage();
    }
  };

  const isSendDisabled = inputValue.trim().length === 0 || isStreaming || isHydratingHistory;
  const helpQuery = helpSearch.trim().toLowerCase();
  const filteredFaqs = contentConfig.faqs.filter((faq) => {
    if (!helpQuery) {
      return true;
    }
    return (
      faq.question.toLowerCase().includes(helpQuery) ||
      faq.answer.toLowerCase().includes(helpQuery) ||
      faq.category.toLowerCase().includes(helpQuery)
    );
  });
  const visibleFaqs = (helpQuery || showAllFaqs ? filteredFaqs : filteredFaqs.slice(0, 4)).slice(0, 8);

  return (
    <div className={styles.themeScope} style={cssVarStyle}>
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : `Open ${mergedTheme.brandName} chat`}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        className={styles.launcher}
      >
        <LauncherIcon />
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`${mergedTheme.brandName} chat panel`}
          className={styles.panel}
        >
          <header className={styles.header}>
            <div className={styles.brand}>
              {mergedTheme.logoUrl ? (
                <img
                  src={mergedTheme.logoUrl}
                  alt={`${mergedTheme.brandName} logo`}
                  className={styles.logo}
                />
              ) : null}
              <div className={styles.brandText}>
                <p className={styles.brandName}>{mergedTheme.brandName}</p>
                <p className={styles.brandSubtitle}>{contentConfig.tagline ?? "Always-on concierge"}</p>
              </div>
            </div>
            <div className={styles.headerActions}>
              <div
                className={styles.viewSwitch}
                role="tablist"
                aria-label="Chat views"
              >
                {VIEW_OPTIONS.map((option) => {
                  const isActive = option.value === view;
                  const classNames = [styles.viewSwitchButton];
                  if (isActive) {
                    classNames.push(styles.viewSwitchButtonActive);
                  }

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="tab"
                      aria-selected={isActive}
                      className={classNames.join(" ")}
                      onClick={() => handleViewChange(option.value)}
                    >
                      {option.label}
                    </button>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={closePanel}
                aria-label="Close chat panel"
                className={styles.closeButton}
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>
          </header>

          <div className={styles.panelBody}>
            {isChatView ? (
              <>
                <div className={styles.chatContent}>
                  <div ref={messagesRef} className={styles.chatScroller}>
                    <section className={styles.chatIntro}>
                      <p className={styles.chatEyebrow}>Live concierge</p>
                      <h2 className={styles.chatTitle}>
                        Hi, I'm the concierge for {contentConfig.businessName}.
                      </h2>
                      <p className={styles.chatSubtitle}>{contentConfig.welcomeMessage}</p>
                      <div className={styles.intentChips}>
                        {contentConfig.intents.map((intent) => (
                          <button
                            key={intent.id}
                            type="button"
                            className={styles.intentChip}
                            onClick={() => handlePromptInsert(intent.prompt)}
                          >
                            <span className={styles.intentLabel}>{intent.label}</span>
                            <span className={styles.intentDescription}>{intent.description}</span>
                          </button>
                        ))}
                      </div>
                      <button
                        type="button"
                        className={styles.handoffButton}
                        onClick={handleHandoffAction}
                      >
                        <span>{contentConfig.handoff.actionLabel}</span>
                        <span className={styles.handoffStatus}>{contentConfig.handoff.detail}</span>
                      </button>
                    </section>
                    <div className={styles.messageList}>
                      {messages.map((message) => (
                        <MessageBubble key={message.id} message={message} />
                      ))}
                    </div>
                  </div>
                </div>

                <form
                  className={styles.inputRow}
                  onSubmit={(event) => {
                    event.preventDefault();
                    void sendMessage();
                  }}
                >
                  <input
                    ref={inputRef}
                    type="text"
                    value={inputValue}
                    onChange={(event) => setInputValue(event.target.value)}
                    onKeyDown={handleInputKeyDown}
                    placeholder={`Ask ${mergedTheme.brandName} anything`}
                    className={styles.inputField}
                  />
                  {isStreaming ? (
                    <button
                      type="button"
                      className={styles.stopButton}
                      onClick={stopStreaming}
                    >
                      Stop
                    </button>
                  ) : null}
                  <button
                    type="submit"
                    className={styles.sendButton}
                    disabled={isSendDisabled}
                  >
                    Send
                  </button>
                </form>
                {isStreaming || errorMessage ? (
                  <div className={styles.inputStatusRow} aria-live="polite">
                    {isStreaming ? (
                      <p className={styles.typingIndicator}>Assistant is responding...</p>
                    ) : null}
                    {errorMessage ? <p className={styles.errorText}>{errorMessage}</p> : null}
                  </div>
                ) : null}
              </>
            ) : (
              <div className={styles.helpView} role="region" aria-label="Help center">
                <div className={styles.helpSearchRow}>
                  <input
                    type="search"
                    value={helpSearch}
                    onChange={(event) => setHelpSearch(event.target.value)}
                    placeholder="Search policies, FAQs, menu notes"
                    className={styles.helpSearchInput}
                  />
                  {helpQuery ? (
                    <button
                      type="button"
                      className={styles.clearSearchButton}
                      onClick={() => setHelpSearch("")}
                    >
                      Clear
                    </button>
                  ) : null}
                </div>
                <div className={styles.helpCategories}>
                  {contentConfig.categories.map((category) => (
                    <article key={category.id} className={styles.helpCategoryCard}>
                      <div>
                        <p className={styles.helpCategoryLabel}>{category.label}</p>
                        <p className={styles.helpCategoryDescription}>{category.description}</p>
                      </div>
                      <button
                        type="button"
                        className={styles.helpCategoryButton}
                        onClick={() => handlePromptInsert(`Tell me about ${category.label}.`)}
                      >
                        Ask
                      </button>
                    </article>
                  ))}
                </div>
                <div className={styles.helpFaqList}>
                  {visibleFaqs.length ? (
                    visibleFaqs.map((faq) => (
                      <article key={faq.id} className={styles.faqCard}>
                        <div>
                          <p className={styles.faqCategory}>{faq.category}</p>
                          <h4 className={styles.faqQuestion}>{faq.question}</h4>
                          <p className={styles.faqAnswer}>{faq.answer}</p>
                        </div>
                        <button
                          type="button"
                          className={styles.faqActionButton}
                          onClick={() => handlePromptInsert(faq.question)}
                        >
                          Ask about this
                        </button>
                      </article>
                    ))
                  ) : (
                    <p className={styles.emptyHelpMessage}>No articles match your search.</p>
                  )}
                </div>
                {filteredFaqs.length > 4 && !helpQuery ? (
                  <button
                    type="button"
                    className={styles.showAllButton}
                    onClick={() => setShowAllFaqs((prev) => !prev)}
                  >
                    {showAllFaqs ? "Show fewer" : "View all"}
                  </button>
                ) : null}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const classNames = [styles.messageBubble];

  if (message.role === "user") {
    classNames.push(styles.userBubble);
  } else if (message.role === "assistant") {
    classNames.push(styles.assistantBubble);
  } else {
    classNames.push(styles.systemBubble);
  }

  return (
    <div className={classNames.join(" ")}>
      <span>{message.text}</span>
      {message.role === "assistant" && message.cta ? (
        <a
          className={styles.ctaButton}
          href={message.cta.href}
          target="_blank"
          rel="noreferrer"
        >
          {message.cta.label}
        </a>
      ) : null}
    </div>
  );
}

function LauncherIcon() {
  return (
    <svg
      className={styles.launcherIcon}
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M4 6.5C4 5.11929 5.11929 4 6.5 4H17.5C18.8807 4 20 5.11929 20 6.5V14.5C20 15.8807 18.8807 17 17.5 17H9.41421L6 20.4142V17H6.5C5.11929 17 4 15.8807 4 14.5V6.5Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="8" cy="10.5" r="1" fill="currentColor" />
      <circle cx="12" cy="10.5" r="1" fill="currentColor" />
      <circle cx="16" cy="10.5" r="1" fill="currentColor" />
    </svg>
  );
}
