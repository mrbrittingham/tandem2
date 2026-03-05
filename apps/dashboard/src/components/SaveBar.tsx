type SaveBarProps = {
  visible: boolean;
  onSave: () => void;
  saving?: boolean;
  label?: string;
};

export function SaveBar({ visible, onSave, saving = false, label = "Unsaved changes" }: SaveBarProps) {
  return (
    <div
      className={`pointer-events-none fixed inset-x-0 bottom-6 flex justify-center transition-opacity ${
        visible ? "opacity-100" : "opacity-0"
      }`}
    >
      <div className="pointer-events-auto flex items-center gap-4 rounded-[var(--console-radius-full)] border border-[var(--console-border)] bg-[var(--console-bg-card)] px-5 py-3 text-sm text-[var(--console-text-secondary)] shadow-[var(--console-shadow-lg)]">
        <span className="font-medium text-[var(--console-text-primary)]">{saving ? "Saving..." : label}</span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-[var(--console-radius-full)] bg-[var(--console-primary)] px-4 py-2 text-sm font-semibold text-[var(--console-text-inverse)] transition hover:bg-[var(--console-primary-hover)] disabled:opacity-60"
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}
