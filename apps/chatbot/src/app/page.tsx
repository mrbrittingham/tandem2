import { ChatWidget } from "@tandem/ui-kit";

export default function Home() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 p-8 font-sans dark:bg-black">
      <main className="flex w-full max-w-3xl flex-col gap-6 rounded-3xl border border-zinc-200 bg-white p-10 shadow-xl dark:border-zinc-800 dark:bg-zinc-900">
        <div className="space-y-2">
          <p className="text-sm uppercase tracking-wide text-zinc-500">
            Tandem 2.0
          </p>
          <h1 className="text-3xl font-semibold text-zinc-900 dark:text-zinc-100">
            Chatbot Preview
          </h1>
          <p className="text-base text-zinc-600 dark:text-zinc-400">
            This page renders the shared UI kit component so we can iterate on
            the vertical slice quickly.
          </p>
        </div>
        <ChatWidget />
      </main>
    </div>
  );
}
