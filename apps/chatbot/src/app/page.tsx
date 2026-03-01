import { ChatWidget } from "@tandem/ui-kit";
import { getActiveBusiness, getMockState } from "@tandem/shared";

export default function Home() {
  const snapshot = getMockState();
  const businessId = getActiveBusiness(snapshot)?.slug ?? "default";
  return (
    <div className="relative min-h-screen bg-gradient-to-b from-slate-50 via-white to-slate-100 p-6 text-slate-900">
      <section className="mx-auto max-w-3xl space-y-6 rounded-3xl border border-white/60 bg-white/80 p-10 shadow-2xl backdrop-blur-sm">
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-[0.35em] text-slate-500">
            Tandem 2.0
          </p>
          <h1 className="text-4xl font-semibold">Chatbot Preview</h1>
          <p className="text-base text-slate-600">
            Launch the floating widget in the bottom-right corner to try intents,
            help-center articles, and live handoff. This page mimics how the kit
            will feel once embedded on a real site.
          </p>
        </div>

        <div className="grid gap-4 text-sm text-slate-600 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="font-semibold text-slate-800">1. Open the widget</p>
            <p>Tap the Tandem bubble to expand the concierge panel.</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4">
            <p className="font-semibold text-slate-800">2. Stress test flows</p>
            <p>Trigger intents, search FAQs, and try the handoff button.</p>
          </div>
        </div>

        <div className="rounded-2xl border border-dashed border-slate-300 bg-slate-50/60 p-4 text-sm text-slate-500">
          The widget is rendered via <code className="font-mono text-xs">@tandem/ui-kit</code> so
          any tweaks here stay in sync with production installs.
        </div>
      </section>

      <ChatWidget businessId={businessId} />
    </div>
  );
}
