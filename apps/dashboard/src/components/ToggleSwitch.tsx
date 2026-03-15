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
      className="flex items-center justify-between rounded-[var(--console-radius-md)] border border-[var(--console-border)] bg-[var(--console-bg-card)] px-4 py-3 text-left text-sm text-[var(--console-text-secondary)] transition hover:bg-[var(--console-bg-hover)]"
    >
      <span>
        <span className="font-semibold text-[var(--console-text-primary)]">{label}</span>
        {helperText ? <p className="text-xs text-[var(--console-text-tertiary)]">{helperText}</p> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-[var(--console-primary)]" : "bg-[var(--console-border)]"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-[var(--console-bg-card)] shadow transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
