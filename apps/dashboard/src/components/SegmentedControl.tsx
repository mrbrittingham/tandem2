type SegmentedOption<T extends string> = {
  value: T;
  label: string;
};

type SegmentedControlProps<T extends string> = {
  value: T;
  options: SegmentedOption<T>[];
  onChange: (next: T) => void;
  ariaLabel: string;
};

export function SegmentedControl<T extends string>({ value, options, onChange, ariaLabel }: SegmentedControlProps<T>) {
  return (
    <div className="inline-flex rounded-xl border border-slate-200 bg-white p-1" role="tablist" aria-label={ariaLabel}>
      {options.map((option) => {
        const active = option.value === value;
        return (
          <button
            key={option.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(option.value)}
            className={`rounded-lg px-4 py-2 text-sm font-semibold transition ${
              active ? "bg-[var(--console-primary)] text-white" : "text-slate-600 hover:bg-slate-100"
            }`}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
