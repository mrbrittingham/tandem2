'use client';

import { createContext, useContext } from "react";

export type ConsoleDialogContextValue = {
  openCreateLocation: () => void;
  openCreateBusiness: () => void;
};

const ConsoleDialogContext = createContext<ConsoleDialogContextValue | null>(null);

export function ConsoleDialogProvider({
  value,
  children,
}: {
  value: ConsoleDialogContextValue;
  children: React.ReactNode;
}) {
  return <ConsoleDialogContext.Provider value={value}>{children}</ConsoleDialogContext.Provider>;
}

export function useConsoleDialogs(): ConsoleDialogContextValue {
  const ctx = useContext(ConsoleDialogContext);
  if (!ctx) {
    throw new Error("useConsoleDialogs must be used within ConsoleDialogProvider");
  }
  return ctx;
}
