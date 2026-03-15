'use client';

import { createContext, useContext, type ReactNode } from "react";
import type { WidgetThemeSettings } from "@tandem/shared";

type PreviewDockContextValue = {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  draftTheme?: WidgetThemeSettings;
  setDraftTheme: (theme?: WidgetThemeSettings) => void;
};

const PreviewDockContext = createContext<PreviewDockContextValue>({
  isOpen: false,
  open: () => undefined,
  close: () => undefined,
  draftTheme: undefined,
  setDraftTheme: () => undefined,
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
