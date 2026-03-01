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
    "w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-100";

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    onChange(event.target.value);
  };

  return (
    <label className="flex flex-col gap-2 text-sm text-slate-600">
      <span className="font-semibold text-slate-800">{label}</span>
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
      {helperText ? <span className="text-xs text-slate-400">{helperText}</span> : null}
    </label>
  );
}
