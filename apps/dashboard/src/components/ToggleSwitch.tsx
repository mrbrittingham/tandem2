type ToggleSwitchProps = {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  helperText?: string;
};

export function ToggleSwitch({ label, checked, onChange, helperText }: ToggleSwitchProps) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className="flex items-center justify-between rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-left text-sm text-[var(--color-text-secondary)] transition hover:bg-[var(--color-surface-hover)]"
    >
      <span>
        <span className="font-semibold text-[var(--color-text)]">{label}</span>
        {helperText ? <p className="text-xs text-[var(--color-text-muted)]">{helperText}</p> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-[var(--color-primary)]" : "bg-[var(--color-border)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-[var(--color-surface)] shadow transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
