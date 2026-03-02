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

import "./tandem-widget-tokens.css";
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

type InlineComposerError = {
  message: string;
  devHint?: string;
};

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
  primaryColor: "var(--widget-primary)",
  primaryHoverColor: "var(--widget-primary-hover)",
  primaryPressedColor: "var(--widget-primary-pressed)",
  primaryTextColor: "var(--widget-text-inverse)",
  accentColor: "var(--widget-primary)",
  accentLightColor: "var(--widget-primary-light)",
  accentTextColor: "var(--widget-text-primary)",
  surfaceColor: "var(--widget-bg-card)",
  surfaceElevatedColor: "var(--widget-bg-elevated)",
  surfaceHoverColor: "var(--widget-bg-hover)",
  surfaceMutedColor: "var(--widget-bg-page)",
  surfaceContrastColor: "var(--widget-text-primary)",
  borderColor: "var(--widget-border)",
  borderLightColor: "var(--widget-border-light)",
  mutedColor: "var(--widget-text-secondary)",
  textPrimaryColor: "var(--widget-text-primary)",
  textSecondaryColor: "var(--widget-text-secondary)",
  textTertiaryColor: "var(--widget-text-tertiary)",
  textOnPrimaryColor: "var(--widget-text-inverse)",
  panelShadow: "var(--widget-shadow-lg)",
  shadowSoft: "var(--widget-shadow-sm)",
  shadowMedium: "var(--widget-shadow-md)",
  shadowDeep: "var(--widget-shadow-lg)",
  shadowLauncher: "var(--widget-shadow-launcher)",
  panelRadius: "var(--widget-radius-lg)",
  bubbleRadius: "var(--widget-radius-bubble)",
  buttonRadius: "var(--widget-radius-md)",
  inputRadius: "var(--widget-radius-md)",
  launcherRadius: "var(--widget-radius-full)",
  userBubbleBg: "var(--widget-primary)",
  userBubbleText: "var(--widget-text-inverse)",
  assistantBubbleBg: "var(--widget-bg-page)",
  assistantBubbleText: "var(--widget-text-primary)",
  systemBubbleBg: "var(--widget-bg-page)",
  systemBubbleText: "var(--widget-text-secondary)",
  secondaryColor: "var(--widget-bg-page)",
  secondaryHoverColor: "var(--widget-bg-hover)",
  secondaryTextColor: "var(--widget-text-primary)",
  ctaBg: "var(--widget-primary)",
  ctaText: "var(--widget-text-inverse)",
  space4: "calc(var(--widget-space-1) / 2)",
  space8: "var(--widget-space-1)",
  space12: "calc(var(--widget-space-1) + 4px)",
  space16: "var(--widget-space-2)",
  space20: "calc(var(--widget-space-2) + 4px)",
  space24: "var(--widget-space-3)",
  space32: "var(--widget-space-4)",
  fontDisplay: "var(--widget-font-family)",
  fontBody: "var(--widget-font-family)",
  panelWidthMobile: "100vw",
  panelWidthDesktop: "var(--widget-width-desktop)",
  panelMaxHeight: "var(--widget-max-height)",
  launcherSize: "var(--widget-launcher-size)",
  headerHeight: "var(--widget-header-height)",
  inputHeight: "var(--widget-input-height)",
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
  const conversationsApiUrl = `${normalizedApiBaseUrl}/api/conversations`;
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
  const [composerError, setComposerError] = useState<InlineComposerError | null>(null);
  const [lastSubmittedMessage, setLastSubmittedMessage] = useState<string | null>(null);
  const [isHydratingHistory, setIsHydratingHistory] = useState(false);
  const [historyLoaded, setHistoryLoaded] = useState(false);

  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const shouldAutoScrollRef = useRef(true);
  const abortControllerRef = useRef<AbortController | null>(null);
  const historyWarnedRef = useRef(false);

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

      const warnHistoryFailure = (detail: { url: string; status: number; bodyPreview: string }) => {
        if (historyWarnedRef.current) {
          return;
        }
        historyWarnedRef.current = true;
        console.warn("Failed to load conversation history", detail);
      };

      const getBodyPreview = async (response: Response) => {
        try {
          const text = await response.text();
          return text.slice(0, 200);
        } catch {
          return "";
        }
      };

      try {
        const params = new URLSearchParams({ businessId: resolvedBusinessId });
        const historyListUrl = `${conversationsApiUrl}?${params.toString()}`;
        const response = await fetch(historyListUrl, {
          method: "GET",
          signal: controller.signal,
        });
        if (response.ok) {
          const data = await response.json();
          if (cancelled) {
            return;
          }

          const sessions = Array.isArray(data.sessions) ? data.sessions : [];
          const latestSessionId = sessions[0]?.id;

          if (latestSessionId) {
            const historyDetailUrl = `${conversationsApiUrl}/${encodeURIComponent(latestSessionId)}`;
            const detailResponse = await fetch(historyDetailUrl, {
              method: "GET",
              signal: controller.signal,
            });

            if (detailResponse.ok) {
              const detailData = await detailResponse.json();
              if (cancelled) {
                return;
              }

              if (Array.isArray(detailData.messages) && detailData.messages.length) {
                setMessages(
                  detailData.messages.map((message: { role: MessageRole; content: string }) => ({
                    id: createId(),
                    role: message.role,
                    text: message.content,
                  })),
                );
                return;
              }
            } else {
              const bodyPreview = await getBodyPreview(detailResponse);
              warnHistoryFailure({
                url: historyDetailUrl,
                status: detailResponse.status,
                bodyPreview,
              });
            }
          }
        } else {
          const bodyPreview = await getBodyPreview(response);
          warnHistoryFailure({
            url: historyListUrl,
            status: response.status,
            bodyPreview,
          });
        }
      } catch (error) {
        if (!cancelled) {
          if (!historyWarnedRef.current) {
            historyWarnedRef.current = true;
            console.warn("Failed to hydrate chat history", error);
          }
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
  }, [conversationsApiUrl, historyLoaded, resolvedBusinessId]);

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
      setComposerError(null);
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
          const payload = await response
            .json()
            .catch(() => ({ error: "Assistant failed to respond." }));
          const serverMessage =
            typeof payload.error === "string" && payload.error.trim().length > 0
              ? payload.error
              : "Assistant failed to respond.";
          const missingEnv = Array.isArray(payload.missingEnv)
            ? payload.missingEnv.filter((entry: unknown) => typeof entry === "string")
            : [];

          const isConfigError = response.status >= 500 && /server not configured/i.test(serverMessage);

          throw new Error(
            JSON.stringify({
              status: response.status,
              serverMessage,
              isConfigError,
              missingEnv,
            }),
          );
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
        let friendlyMessage = "We couldn’t send that message. Please try again.";
        let devHint: string | undefined;

        if (!isAbort && error instanceof Error) {
          try {
            const parsed = JSON.parse(error.message) as {
              serverMessage?: string;
              isConfigError?: boolean;
              missingEnv?: string[];
            };

            if (parsed.isConfigError) {
              friendlyMessage = "Chat is not configured yet. Ask an admin to set the API key.";
              if (process.env.NODE_ENV !== "production") {
                const hintFromArray = parsed.missingEnv?.[0];
                const hintFromMessage = parsed.serverMessage?.match(/missing\s+([A-Z0-9_]+)/)?.[1];
                const envName = hintFromArray || hintFromMessage;
                if (envName && typeof window !== "undefined" && window.location.port === "3100") {
                  devHint = `Missing ${envName}`;
                }
              }
            }
          } catch {
            friendlyMessage = "We couldn’t send that message. Please try again.";
          }
        }

        setMessages((prev) => prev.filter((message) => message.id !== assistantMessageId));

        if (!isAbort) {
          setComposerError({ message: friendlyMessage, devHint });
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
    setLastSubmittedMessage(trimmed);

    await startAssistantResponse(conversationSnapshot, assistantMessageId);
  }, [inputValue, isHydratingHistory, isStreaming, messages, startAssistantResponse]);

  const retryLastMessage = useCallback(async () => {
    const retryText = lastSubmittedMessage?.trim();
    if (!retryText || isStreaming || isHydratingHistory) {
      return;
    }

    const userMessage: Message = {
      id: createId(),
      role: "user",
      text: retryText,
    };

    const assistantMessageId = createId();
    const assistantPlaceholder: Message = {
      id: assistantMessageId,
      role: "assistant",
      text: "",
    };

    const conversationSnapshot = [...messages, userMessage];
    setMessages([...conversationSnapshot, assistantPlaceholder]);
    setComposerError(null);

    await startAssistantResponse(conversationSnapshot, assistantMessageId);
  }, [isHydratingHistory, isStreaming, lastSubmittedMessage, messages, startAssistantResponse]);

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
                {isStreaming || composerError ? (
                  <div className={styles.inputStatusRow} aria-live="polite">
                    {isStreaming ? (
                      <p className={styles.typingIndicator}>Assistant is responding...</p>
                    ) : null}
                    {composerError ? (
                      <div className={styles.errorRow}>
                        <p className={styles.errorText}>
                          {composerError.message}
                          {composerError.devHint ? ` (${composerError.devHint})` : ""}
                        </p>
                        <button
                          type="button"
                          onClick={() => {
                            void retryLastMessage();
                          }}
                          disabled={!lastSubmittedMessage || isStreaming || isHydratingHistory}
                          className={styles.retryButton}
                        >
                          Retry
                        </button>
                      </div>
                    ) : null}
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
