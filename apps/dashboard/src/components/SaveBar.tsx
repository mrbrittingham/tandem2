import { useEffect } from "react";

type SaveBarProps = {
  visible: boolean;
  onSave: () => void;
  saving?: boolean;
  label?: string;
};

export function SaveBar({ visible, onSave, saving = false, label = "Unsaved changes" }: SaveBarProps) {
  useEffect(() => {
    if (!visible || saving || typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Enter" || event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) return;

      const target = event.target as HTMLElement | null;
      if (!target) return;

      const tagName = target.tagName.toLowerCase();
      if (tagName === "textarea" || target.isContentEditable || target.closest("form")) return;

      event.preventDefault();
      onSave();
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onSave, saving, visible]);

  return (
    <div
      className={`fixed right-6 top-1/2 z-50 -translate-y-1/2 transition-all duration-300 ${
        visible ? "opacity-100 translate-x-0 pointer-events-auto" : "opacity-0 translate-x-8 pointer-events-none"
      }`}
    >
      <div className="flex flex-col items-end gap-2.5 rounded-2xl border border-[var(--console-border)] bg-white px-5 py-4 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.14),0_2px_8px_-2px_rgba(0,0,0,0.08)]">
        <span className="text-xs font-semibold uppercase tracking-widest text-[var(--console-text-secondary)]">
          {saving ? "Saving…" : label}
        </span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 rounded-xl bg-[var(--color-primary)] px-5 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-[var(--color-primary-hover)] hover:shadow-md active:scale-95 disabled:opacity-60"
        >
          {saving ? (
            <>
              <svg className="animate-spin" width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                <path d="M7 1v2M7 11v2M1 7H3M11 7h2M2.93 2.93l1.41 1.41M9.66 9.66l1.41 1.41M2.93 11.07l1.41-1.41M9.66 4.34l1.41-1.41" />
              </svg>
              Saving
            </>
          ) : (
            <>
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M11.5 2.5H3a.5.5 0 0 0-.5.5v8a.5.5 0 0 0 .5.5h8a.5.5 0 0 0 .5-.5V3.5l-1.5-1Z" />
                <path d="M9.5 11.5v-4h-5v4M4.5 2.5v3h4" />
              </svg>
              Save changes
            </>
          )}
        </button>
      </div>
    </div>
  );
}
