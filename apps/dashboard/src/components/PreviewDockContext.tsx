'use client';

import { createContext, useContext, type ReactNode } from "react";

type PreviewDockContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
};

const PreviewDockContext = createContext<PreviewDockContextValue>({
  isOpen: false,
  open: () => undefined,
  close: () => undefined,
});

export function PreviewDockProvider({
  value,
  children,
}: {
  value: PreviewDockContextValue;
  children: ReactNode;
}) {
  return <PreviewDockContext.Provider value={value}>{children}</PreviewDockContext.Provider>;
}

export function usePreviewDock() {
  return useContext(PreviewDockContext);
}
