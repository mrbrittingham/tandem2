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
      <div className="pointer-events-auto flex items-center gap-4 rounded-full border border-slate-200 bg-white px-5 py-3 text-sm text-slate-700 shadow-xl shadow-slate-900/10">
        <span className="font-medium text-slate-900">{saving ? "Saving..." : label}</span>
        <button
          type="button"
          onClick={onSave}
          disabled={saving}
          className="rounded-full bg-blue-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-500 disabled:opacity-60"
        >
          {saving ? "Saving" : "Save"}
        </button>
      </div>
    </div>
  );
}
