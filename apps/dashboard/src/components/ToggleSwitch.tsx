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
      className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3 text-left text-sm text-slate-700 transition hover:border-slate-300"
    >
      <span>
        <span className="font-semibold text-slate-900">{label}</span>
        {helperText ? <p className="text-xs text-slate-500">{helperText}</p> : null}
      </span>
      <span
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition ${
          checked ? "bg-blue-600" : "bg-slate-200"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 rounded-full bg-white shadow transition ${
            checked ? "translate-x-5" : "translate-x-1"
          }`}
        />
      </span>
    </button>
  );
}
