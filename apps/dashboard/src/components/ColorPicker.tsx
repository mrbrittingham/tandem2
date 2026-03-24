import { TextInput } from "./TextInput";

export type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  hint?: string;
};

export function ColorPicker({ label, value, onChange, hint }: ColorPickerProps) {
  return (
    <div className="flex flex-wrap gap-3">
      <label className="flex h-12 w-12 items-center justify-center rounded-2xl border border-[var(--console-border)] bg-[var(--console-bg-card)] shadow-sm">
        <span className="sr-only">{label}</span>
        <input
          type="color"
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="h-10 w-10 cursor-pointer rounded-xl border-0 bg-transparent p-0"
        />
      </label>
      <div className="min-w-[200px] flex-1">
        <TextInput label={label} value={value} onChange={onChange} helperText={hint ?? "Hex value"} />
      </div>
    </div>
  );
}
