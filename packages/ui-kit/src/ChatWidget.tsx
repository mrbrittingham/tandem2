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

import styles from "./ChatWidget.module.css";

type CSSVarStyles = CSSProperties & Record<string, string>;

type MessageRole = "user" | "assistant";

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

export type ThemeTokens = {
  brandName: string;
  logoUrl?: string;
  primaryColor: string;
  primaryTextColor: string;
  accentColor: string;
  accentTextColor: string;
  surfaceColor: string;
  surfaceMutedColor: string;
  surfaceContrastColor: string;
  borderColor: string;
  mutedColor: string;
  panelShadow: string;
  panelRadius: string;
  bubbleRadius: string;
  userBubbleBg: string;
  userBubbleText: string;
  assistantBubbleBg: string;
  assistantBubbleText: string;
  ctaBg: string;
  ctaText: string;
};

export type ChatWidgetProps = {
  theme?: Partial<ThemeTokens>;
  initialMessages?: MessageDescriptor[];
};

const defaultTheme: ThemeTokens = {
  brandName: "Tandem",
  logoUrl: undefined,
  primaryColor: "#111827",
  primaryTextColor: "#ffffff",
  accentColor: "#6366f1",
  accentTextColor: "#ffffff",
  surfaceColor: "#ffffff",
  surfaceMutedColor: "#f4f4f5",
  surfaceContrastColor: "#0f172a",
  borderColor: "#e4e4e7",
  mutedColor: "#6b7280",
  panelShadow: "0 25px 60px rgba(15, 23, 42, 0.25)",
  panelRadius: "20px",
  bubbleRadius: "16px",
  userBubbleBg: "#2563eb",
  userBubbleText: "#ffffff",
  assistantBubbleBg: "#ffffff",
  assistantBubbleText: "#0f172a",
  ctaBg: "#0f172a",
  ctaText: "#ffffff",
};

const defaultMessages: MessageDescriptor[] = [
  {
    role: "assistant",
    text: "Hi, I'm Tandem. How can I help you today?",
  },
];

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
  "--tandem-primary-text": tokens.primaryTextColor,
  "--tandem-accent": tokens.accentColor,
  "--tandem-accent-text": tokens.accentTextColor,
  "--tandem-surface": tokens.surfaceColor,
  "--tandem-surface-muted": tokens.surfaceMutedColor,
  "--tandem-surface-contrast": tokens.surfaceContrastColor,
  "--tandem-border": tokens.borderColor,
  "--tandem-muted": tokens.mutedColor,
  "--tandem-shadow": tokens.panelShadow,
  "--tandem-shadow-hover": tokens.panelShadow,
  "--tandem-radius": tokens.panelRadius,
  "--tandem-bubble-radius": tokens.bubbleRadius,
  "--tandem-user-bg": tokens.userBubbleBg,
  "--tandem-user-text": tokens.userBubbleText,
  "--tandem-assistant-bg": tokens.assistantBubbleBg,
  "--tandem-assistant-text": tokens.assistantBubbleText,
  "--tandem-cta-bg": tokens.ctaBg,
  "--tandem-cta-text": tokens.ctaText,
});

export function ChatWidget({ theme, initialMessages }: ChatWidgetProps) {
  const mergedTheme = useMemo(
    () => ({ ...defaultTheme, ...theme }),
    [theme]
  );
  const cssVarStyle = useMemo(
    () => themeToCSSVariables(mergedTheme),
    [mergedTheme]
  );

  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>(() =>
    hydrateMessages(initialMessages)
  );

  const pendingReplyRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const messagesRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  const closePanel = useCallback(() => {
    setIsOpen(false);
  }, []);

  useEffect(() => {
    return () => {
      if (pendingReplyRef.current) {
        clearTimeout(pendingReplyRef.current);
      }
    };
  }, []);

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

    inputRef.current?.focus();
    messagesRef.current?.scrollTo({
      top: messagesRef.current.scrollHeight,
    });
  }, [isOpen]);

  useEffect(() => {
    if (messagesRef.current) {
      messagesRef.current.scrollTop = messagesRef.current.scrollHeight;
    }
  }, [messages]);

  const sendMessage = useCallback(() => {
    const trimmed = inputValue.trim();
    if (!trimmed) {
      return;
    }

    const newMessage: Message = {
      id: createId(),
      role: "user",
      text: trimmed,
    };

    setMessages((prev) => [...prev, newMessage]);
    setInputValue("");

    if (pendingReplyRef.current) {
      clearTimeout(pendingReplyRef.current);
    }

    pendingReplyRef.current = setTimeout(() => {
      const assistantMessage: Message = {
        id: createId(),
        role: "assistant",
        text: `Got it: ${trimmed}`,
      };

      setMessages((prev) => [...prev, assistantMessage]);
    }, 500 + Math.round(Math.random() * 300));
  }, [inputValue]);

  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  };

  const isSendDisabled = inputValue.trim().length === 0;

  return (
    <div className={styles.themeScope} style={cssVarStyle}>
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : `Open ${mergedTheme.brandName} chat`}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        className={styles.launcher}
      >
        {isOpen ? "Close" : "Chat"}
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
                <p className={styles.brandSubtitle}>Always-on concierge</p>
              </div>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close chat panel"
              className={styles.closeButton}
            >
              ×
            </button>
          </header>

          <div ref={messagesRef} className={styles.messageList}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>

          <form
            className={styles.inputRow}
            onSubmit={(event) => {
              event.preventDefault();
              sendMessage();
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
            <button
              type="submit"
              className={styles.sendButton}
              disabled={isSendDisabled}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";
  const className = `${styles.messageBubble} ${
    isUser ? styles.userBubble : styles.assistantBubble
  }`;

  return (
    <div className={className}>
      <span>{message.text}</span>
      {!isUser && message.cta ? (
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
