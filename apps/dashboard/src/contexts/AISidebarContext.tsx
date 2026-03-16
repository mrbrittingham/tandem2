"use client";

import { createContext, useCallback, useContext, useRef, type ReactNode } from "react";

/**
 * AISidebarContext
 *
 * Allows any overview component to pre-fill the ConsoleSidebar input
 * without auto-sending. Use prefillInput("example prompt") from prompt chips.
 *
 * The ConsoleSidebar registers a setPrefill callback via registerPrefill().
 * Components call prefillInput() to push text into the sidebar input.
 */

type AISidebarContextValue = {
  /** Pre-fill the sidebar input with a prompt string. Does NOT auto-send. */
  prefillInput: (prompt: string) => void;
  /**
   * Called by ConsoleSidebar to register its input setter.
   * Internal — do not call from page code.
   */
  registerPrefill: (setter: (text: string) => void) => void;
};

const AISidebarContext = createContext<AISidebarContextValue | null>(null);

export function AISidebarProvider({ children }: { children: ReactNode }) {
  // Store the sidebar's setInput function so we can push text into it
  const setterRef = useRef<((text: string) => void) | null>(null);

  const registerPrefill = useCallback((setter: (text: string) => void) => {
    setterRef.current = setter;
  }, []);

  const prefillInput = useCallback((prompt: string) => {
    if (setterRef.current) {
      setterRef.current(prompt);
    }
  }, []);

  return (
    <AISidebarContext.Provider value={{ prefillInput, registerPrefill }}>
      {children}
    </AISidebarContext.Provider>
  );
}

export function useAISidebar(): AISidebarContextValue {
  const ctx = useContext(AISidebarContext);
  if (!ctx) {
    throw new Error("useAISidebar must be used inside <AISidebarProvider>");
  }
  return ctx;
}
