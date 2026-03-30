import type { ChangeEvent } from "react";

export type TextInputProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  helperText?: string;
  type?: string;
  multiline?: boolean;
  rows?: number;
};

export function TextInput({
  label,
  value,
  onChange,
  placeholder,
  helperText,
  type = "text",
  multiline = false,
  rows = 3,
}: TextInputProps) {
  const sharedClasses =
    "w-full rounded-[var(--radius-md)] border border-[var(--color-border)] bg-[var(--color-surface)] px-4 py-3 text-sm text-[var(--color-text)] placeholder:text-[var(--color-text-muted)] focus:border-[var(--color-primary)] focus:outline-none focus:ring-2 focus:ring-[var(--color-primary-light)]";

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <label className="flex flex-col gap-2 text-sm text-[var(--color-text-secondary)]">
      <span className="font-semibold text-[var(--color-text)]">{label}</span>
      {multiline ? (
        <textarea
          rows={rows}
          className={sharedClasses}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
        />
      ) : (
        <input
          className={sharedClasses}
          placeholder={placeholder}
          value={value}
          onChange={handleChange}
          type={type}
        />
      )}
      {helperText ? <span className="text-xs text-[var(--color-text-muted)]">{helperText}</span> : null}
    </label>
  );
}
