'use client';

import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from "react";

type MessageRole = "user" | "assistant";

type Message = {
  id: string;
  role: MessageRole;
  text: string;
};

const createId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;

const palette = {
  slate: "#0f172a",
  slateDark: "#020617",
  border: "#e4e4e7",
  panel: "#ffffff",
  assistantBg: "#f4f4f5",
  userBg: "#2563eb",
  userText: "#ffffff",
  launcher: "#111827",
};

const baseShadow = "0 25px 60px rgba(15, 23, 42, 0.25)";
const spacing = 20;

export function ChatWidget() {
  const [isOpen, setIsOpen] = useState(false);
  const [inputValue, setInputValue] = useState("");
  const [messages, setMessages] = useState<Message[]>([
    {
      id: createId(),
      role: "assistant",
      text: "Hi, I'm Tandem. How can I help you today?",
    },
  ]);
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
    <>
      <button
        type="button"
        aria-label={isOpen ? "Close chat" : "Open Tandem chat"}
        aria-haspopup="dialog"
        onClick={() => setIsOpen((prev) => !prev)}
        style={launcherStyle}
      >
        {isOpen ? "Close" : "Chat"}
      </button>

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Tandem chat panel"
          style={panelStyle}
        >
          <header style={headerStyle}>
            <div>
              <p style={headerTitleStyle}>Tandem</p>
              <p style={headerSubtitleStyle}>Your concierge companion</p>
            </div>
            <button
              type="button"
              onClick={closePanel}
              aria-label="Close chat panel"
              style={closeButtonStyle}
            >
              ×
            </button>
          </header>

          <div ref={messagesRef} style={messageListStyle}>
            {messages.map((message) => (
              <MessageBubble key={message.id} message={message} />
            ))}
          </div>

          <form
            style={inputRowStyle}
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
              placeholder="Ask Tandem anything"
              style={inputStyle}
            />
            <button
              type="submit"
              style={{
                ...sendButtonStyle,
                opacity: isSendDisabled ? 0.5 : 1,
                cursor: isSendDisabled ? "not-allowed" : "pointer",
              }}
              disabled={isSendDisabled}
            >
              Send
            </button>
          </form>
        </div>
      )}
    </>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === "user";

  const bubbleStyle: CSSProperties = {
    alignSelf: isUser ? "flex-end" : "flex-start",
    backgroundColor: isUser ? palette.userBg : palette.assistantBg,
    color: isUser ? palette.userText : palette.slate,
    borderRadius: 14,
    padding: "8px 14px",
    maxWidth: "85%",
    fontSize: 14,
    lineHeight: 1.4,
    boxShadow: isUser ? "none" : "0 4px 12px rgba(15, 23, 42, 0.08)",
  };

  return <div style={bubbleStyle}>{message.text}</div>;
}

const launcherStyle: CSSProperties = {
  position: "fixed",
  right: spacing,
  bottom: spacing,
  borderRadius: "999px",
  border: "none",
  padding: "12px 20px",
  backgroundColor: palette.launcher,
  color: "#fff",
  fontWeight: 600,
  fontSize: 14,
  cursor: "pointer",
  boxShadow: baseShadow,
};

const panelStyle: CSSProperties = {
  position: "fixed",
  right: spacing,
  bottom: spacing,
  width: "min(360px, calc(100vw - 32px))",
  maxHeight: "70vh",
  backgroundColor: palette.panel,
  borderRadius: 20,
  boxShadow: baseShadow,
  border: `1px solid ${palette.border}`,
  display: "flex",
  flexDirection: "column",
  overflow: "hidden",
};

const headerStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "16px 20px",
  borderBottom: `1px solid ${palette.border}`,
};

const headerTitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 16,
  fontWeight: 600,
  color: palette.slate,
};

const headerSubtitleStyle: CSSProperties = {
  margin: 0,
  fontSize: 12,
  color: "#6b7280",
};

const closeButtonStyle: CSSProperties = {
  border: "none",
  background: "transparent",
  fontSize: 20,
  cursor: "pointer",
  color: palette.slate,
  lineHeight: 1,
  padding: 4,
};

const messageListStyle: CSSProperties = {
  flex: 1,
  padding: 20,
  display: "flex",
  flexDirection: "column",
  gap: 10,
  overflowY: "auto",
  background: "#fafafa",
};

const inputRowStyle: CSSProperties = {
  display: "flex",
  gap: 10,
  padding: 16,
  borderTop: `1px solid ${palette.border}`,
  backgroundColor: palette.panel,
};

const inputStyle: CSSProperties = {
  flex: 1,
  borderRadius: 999,
  border: `1px solid ${palette.border}`,
  padding: "10px 14px",
  fontSize: 14,
};

const sendButtonStyle: CSSProperties = {
  borderRadius: 999,
  border: "none",
  padding: "10px 18px",
  fontWeight: 600,
  fontSize: 14,
  backgroundColor: palette.slate,
  color: "#fff",
  cursor: "pointer",
};
