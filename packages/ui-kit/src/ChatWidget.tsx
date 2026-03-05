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
import { resolveWidgetRuntimeConfig } from "./runtime-config";

type CSSVarStyles = CSSProperties & Record<string, string>;

type MessageRole = "user" | "assistant" | "system";

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

type QuickAction = "hours" | "reservations" | "menu";

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
  headerBackground: string;
  headerTextColor: string;
  quickActionColor: string;
  quickActionTextColor: string;
  quickActionBorderColor: string;
  quickActionHoverColor: string;
  sendButtonColor: string;
  sendButtonHoverColor: string;
  sendButtonPressedColor: string;
  sendButtonTextColor: string;
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
  showLauncher?: boolean;
  onClose?: () => void;
  businessId?: string;
  locationSlug?: string;
  apiBaseUrl?: string;
  hydrateHistory?: boolean;
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
  accentTextColor: "#1A1A1A",
  surfaceColor: "var(--widget-bg-card)",
  surfaceElevatedColor: "var(--widget-bg-elevated)",
  surfaceHoverColor: "var(--widget-bg-hover)",
  surfaceMutedColor: "var(--widget-bg-page)",
  surfaceContrastColor: "#1A1A1A",
  borderColor: "var(--widget-border)",
  borderLightColor: "var(--widget-border-light)",
  mutedColor: "#666666",
  textPrimaryColor: "#1A1A1A",
  textSecondaryColor: "#666666",
  textTertiaryColor: "#999999",
  textOnPrimaryColor: "#FFFFFF",
  headerBackground: "var(--widget-primary)",
  headerTextColor: "#FFFFFF",
  quickActionColor: "var(--widget-primary-light)",
  quickActionTextColor: "#0F172A",
  quickActionBorderColor: "var(--widget-primary)",
  quickActionHoverColor: "#DDE8FF",
  sendButtonColor: "var(--widget-primary)",
  sendButtonHoverColor: "var(--widget-primary-hover)",
  sendButtonPressedColor: "var(--widget-primary-pressed)",
  sendButtonTextColor: "#FFFFFF",
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
  userBubbleBg: "var(--widget-primary)",
  userBubbleText: "#FFFFFF",
  assistantBubbleBg: "#F5F5F5",
  assistantBubbleText: "#1A1A1A",
  systemBubbleBg: "#FAFAFA",
  systemBubbleText: "#666666",
  secondaryColor: "#F5F5F5",
  secondaryHoverColor: "#E5E5E5",
  secondaryTextColor: "#1A1A1A",
  ctaBg: "var(--widget-primary)",
  ctaText: "var(--widget-text-inverse)",
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

const RESERVATIONS_URL = "https://tables.toasttab.com/restaurants/5141cf5b-aa25-4949-ba69-e6d787c6355b/findTime";

const WEEKDAY_ORDER = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"] as const;

const FALLBACK_HOURS: Record<(typeof WEEKDAY_ORDER)[number], string> = {
  Sunday: "10:00 AM – 8:00 PM",
  Monday: "11:00 AM – 9:00 PM",
  Tuesday: "11:00 AM – 9:00 PM",
  Wednesday: "11:00 AM – 9:00 PM",
  Thursday: "11:00 AM – 10:00 PM",
  Friday: "11:00 AM – 11:00 PM",
  Saturday: "10:00 AM – 11:00 PM",
};

const MENU_OPTIONS = [
  {
    key: "1",
    label: "Appetizers",
    items: ["Crispy Calamari", "Truffle Fries", "Burrata & Tomato"],
  },
  {
    key: "2",
    label: "Sandwiches",
    items: ["Steak Sandwich", "Cedar Chicken Club", "Roasted Veggie Panini"],
  },
  {
    key: "3",
    label: "Entrees",
    items: ["Herb Salmon", "Braised Short Rib", "Wild Mushroom Risotto"],
  },
  {
    key: "4",
    label: "Desserts",
    items: ["Basque Cheesecake", "Dark Chocolate Torte", "Seasonal Sorbet"],
  },
] as const;

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
  "--tandem-header-bg": tokens.headerBackground,
  "--tandem-header-text": tokens.headerTextColor,
  "--tandem-quick-action-bg": tokens.quickActionColor,
  "--tandem-quick-action-text": tokens.quickActionTextColor,
  "--tandem-quick-action-border": tokens.quickActionBorderColor,
  "--tandem-quick-action-hover": tokens.quickActionHoverColor,
  "--tandem-send-bg": tokens.sendButtonColor,
  "--tandem-send-hover": tokens.sendButtonHoverColor,
  "--tandem-send-pressed": tokens.sendButtonPressedColor,
  "--tandem-send-text": tokens.sendButtonTextColor,
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
  "--tandem-user-bg": tokens.sendButtonColor,
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
  showLauncher = true,
  onClose,
  businessId,
  locationSlug,
  apiBaseUrl,
  hydrateHistory = true,
}: ChatWidgetProps) {
  const mergedTheme = useMemo(
    () => ({ ...defaultTheme, ...theme, brandName: config?.businessName ?? defaultTheme.brandName }),
    [theme, config]
  );
  const cssVarStyle = useMemo(
    () => themeToCSSVariables(mergedTheme),
    [mergedTheme]
  );
  const runtimeConfig = useMemo(
    () => resolveWidgetRuntimeConfig({ businessId, locationSlug, apiBaseUrl }),
    [apiBaseUrl, businessId, locationSlug],
  );
  const chatApiUrl = `${runtimeConfig.apiBaseUrl}/api/chat`;
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
  const [awaitingMenuSelection, setAwaitingMenuSelection] = useState(false);
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
    setIsOpen(initiallyOpen);
  }, [initiallyOpen]);

  useEffect(() => {
    if (runtimeConfig.isValid) {
      return;
    }

    if (process.env.NODE_ENV !== "production") {
      console.warn(runtimeConfig.error ?? "Invalid ChatWidget runtime config");
    }
    setComposerError({
      message: "Chat is unavailable right now.",
      devHint: process.env.NODE_ENV !== "production" ? runtimeConfig.error : undefined,
    });
  }, [runtimeConfig.error, runtimeConfig.isValid]);

  useEffect(() => {
    setMessages(hydrateMessages(initialMessages));
    setHistoryLoaded(false);
  }, [initialMessages, runtimeConfig.businessId, runtimeConfig.locationSlug]);

  useEffect(() => {
    if (!hydrateHistory) {
      setIsHydratingHistory(false);
      setHistoryLoaded(true);
      return;
    }

    if (!runtimeConfig.isValid || !runtimeConfig.businessId) {
      setIsHydratingHistory(false);
      setHistoryLoaded(true);
      return;
    }

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
        const params = new URLSearchParams();
        params.set("businessId", runtimeConfig.businessId!);
        if (runtimeConfig.locationSlug) {
          params.set("locationSlug", runtimeConfig.locationSlug);
        }
        const historyUrl = `${chatApiUrl}?${params.toString()}`;
        const response = await fetch(historyUrl, {
          method: "GET",
          signal: controller.signal,
        });
        if (response.ok) {
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
            return;
          }
        } else {
          const bodyPreview = await getBodyPreview(response);
          warnHistoryFailure({
            url: historyUrl,
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
  }, [chatApiUrl, historyLoaded, hydrateHistory, runtimeConfig.businessId, runtimeConfig.isValid, runtimeConfig.locationSlug]);

  const closePanel = useCallback(() => {
    setIsOpen(false);
    onClose?.();
  }, [onClose]);

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
    if (!isOpen) {
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
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) {
      return;
    }

    if (shouldAutoScrollRef.current) {
      scrollToBottom(messagesRef.current, "smooth");
    }
  }, [messages, isOpen]);

  const appendAssistantMessage = useCallback((text: string, cta?: MessageCTA) => {
    setMessages((prev) => [
      ...prev,
      {
        id: createId(),
        role: "assistant",
        text,
        cta,
      },
    ]);
  }, []);

  const formatHoursMessage = useCallback(() => {
    const today = new Date().toLocaleDateString("en-US", { weekday: "long" });
    const orderedDays = WEEKDAY_ORDER.filter((day) => day === today).concat(
      WEEKDAY_ORDER.filter((day) => day !== today),
    );

    const lines = orderedDays.map((day) => {
      const value = FALLBACK_HOURS[day];
      if (day === today) {
        return `Today (${day}): ${value}`;
      }
      return `${day}: ${value}`;
    });

    return `Here are our hours:\n${lines.join("\n")}`;
  }, []);

  const menuPromptMessage = useMemo(
    () =>
      [
        "Which menu would you like to view? Reply with a number:",
        ...MENU_OPTIONS.map((option) => `${option.key}) ${option.label}`),
      ].join("\n"),
    [],
  );

  const resolveMenuOption = useCallback((value: string) => {
    const normalized = value.trim().toLowerCase();
    return MENU_OPTIONS.find(
      (option) =>
        option.key === normalized ||
        option.label.toLowerCase() === normalized ||
        normalized.includes(option.label.toLowerCase()),
    );
  }, []);

  const handleQuickAction = useCallback(
    (action: QuickAction) => {
      setComposerError(null);

      if (action === "hours") {
        setAwaitingMenuSelection(false);
        appendAssistantMessage(formatHoursMessage());
        return;
      }

      if (action === "reservations") {
        setAwaitingMenuSelection(false);
        appendAssistantMessage("You can book a table here:", {
          label: "Open reservations",
          href: RESERVATIONS_URL,
        });
        return;
      }

      setAwaitingMenuSelection(true);
      appendAssistantMessage(menuPromptMessage);
    },
    [appendAssistantMessage, formatHoursMessage, menuPromptMessage],
  );

  const startAssistantResponse = useCallback(
    async (history: Message[], assistantMessageId: string) => {
      if (!runtimeConfig.isValid || !runtimeConfig.businessId) {
        setComposerError({
          message: "Chat is unavailable right now.",
          devHint: process.env.NODE_ENV !== "production" ? runtimeConfig.error : undefined,
        });
        return;
      }

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
            businessId: runtimeConfig.businessId,
            locationSlug: runtimeConfig.locationSlug,
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
    [chatApiUrl, runtimeConfig.businessId, runtimeConfig.error, runtimeConfig.isValid, runtimeConfig.locationSlug],
  );

  const stopStreaming = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
  }, []);

  const sendMessage = useCallback(async () => {
    const trimmed = inputValue.trim();
    if (!runtimeConfig.isValid || !runtimeConfig.businessId) {
      setComposerError({
        message: "Chat is unavailable right now.",
        devHint: process.env.NODE_ENV !== "production" ? runtimeConfig.error : undefined,
      });
      return;
    }

    if (!trimmed || isStreaming || isHydratingHistory) {
      return;
    }

    if (awaitingMenuSelection) {
      const option = resolveMenuOption(trimmed);
      const userMessage: Message = {
        id: createId(),
        role: "user",
        text: trimmed,
      };

      const assistantMessage: Message = option
        ? {
            id: createId(),
            role: "assistant",
            text: `${option.label}:\n${option.items.map((item) => `• ${item}`).join("\n")}`,
          }
        : {
            id: createId(),
            role: "assistant",
            text: "Please choose a menu by replying with 1, 2, 3, or 4.",
          };

      setMessages((prev) => [...prev, userMessage, assistantMessage]);
      setInputValue("");
      setLastSubmittedMessage(trimmed);
      if (option) {
        setAwaitingMenuSelection(false);
      }
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
    setAwaitingMenuSelection(false);

    await startAssistantResponse(conversationSnapshot, assistantMessageId);
  }, [awaitingMenuSelection, inputValue, isHydratingHistory, isStreaming, messages, resolveMenuOption, runtimeConfig.businessId, runtimeConfig.error, runtimeConfig.isValid, startAssistantResponse]);

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

  return (
    <div className={`${styles.themeScope} ${!showLauncher ? styles.embeddedScope : ""}`} style={cssVarStyle}>
      {showLauncher && !isOpen ? (
        <button
          type="button"
          aria-label={isOpen ? "Close chat" : `Open ${mergedTheme.brandName} chat`}
          aria-haspopup="dialog"
          onClick={() => setIsOpen((prev) => !prev)}
          className={styles.launcher}
        >
          <LauncherIcon />
        </button>
      ) : null}

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
            <div className={styles.quickActions} role="toolbar" aria-label="Quick actions">
              <button type="button" className={styles.quickActionButton} onClick={() => handleQuickAction("hours")}>
                <ClockIcon />
                <span>Hours</span>
              </button>
              <button type="button" className={styles.quickActionButton} onClick={() => handleQuickAction("reservations")}>
                <ReservationIcon />
                <span>Reservations</span>
              </button>
              <button type="button" className={styles.quickActionButton} onClick={() => handleQuickAction("menu")}>
                <MenuIcon />
                <span>Menus</span>
              </button>
            </div>
            <div className={styles.headerActions}>
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
            <>
                <div className={styles.chatContent}>
                  <div ref={messagesRef} className={styles.chatScroller}>
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

function ClockIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 7v5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReservationIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <rect x="4" y="5" width="16" height="15" rx="2.5" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 3v4M16 3v4M4 10h16" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

function MenuIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" aria-hidden="true" focusable="false">
      <path d="M6 7h12M6 12h12M6 17h12" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
