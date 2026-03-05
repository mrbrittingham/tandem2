'use client';

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLocation } from "@/lib/store-hooks";

type Props = {
  open: boolean;
  onClose: () => void;
};

export function CreateLocationDialog({ open, onClose }: Props) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [address, setAddress] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState("");
  const [isCreating, setIsCreating] = useState(false);
  const [status, setStatus] = useState<string | null>(null);

  const reset = () => {
    setName("");
    setAddress("");
    setWebsiteUrl("");
    setIsCreating(false);
    setStatus(null);
  };

  if (!open) {
    return null;
  }

  const canContinue = Boolean(name.trim());
  const canCreate = canContinue;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 px-4 py-6">
      <div className="w-full max-w-2xl rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.4em] text-slate-400">Location setup</p>
            <h2 className="mt-2 text-2xl font-semibold text-slate-900">Add location</h2>
            <p className="text-sm text-slate-500">Create a new location and optionally kick off an initial website crawl.</p>
          </div>
          <button
            type="button"
            onClick={() => {
              reset();
              onClose();
            }}
            className="rounded-2xl border border-slate-200 px-3 py-1.5 text-sm font-semibold text-slate-700 hover:border-slate-300"
          >
            Close
          </button>
        </div>

        <div className="mt-6 space-y-4">
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Location name</span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Berlin"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Address (optional)</span>
            <input
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              placeholder="11206 Worcester Hwy, Berlin, MD 21811"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-300 focus:outline-none"
            />
          </label>
          <label className="flex flex-col gap-2 text-sm text-slate-700">
            <span className="font-semibold text-slate-900">Website URL (optional)</span>
            <input
              value={websiteUrl}
              onChange={(event) => setWebsiteUrl(event.target.value)}
              placeholder="https://www.windmillcreekvineyard.com"
              className="rounded-2xl border border-slate-200 px-4 py-3 text-slate-900 focus:border-blue-300 focus:outline-none"
            />
          </label>

          {status ? <p className="text-xs text-slate-600">{status}</p> : null}

          <div className="flex justify-end">
            <button
              type="button"
              disabled={!canCreate || isCreating}
              onClick={async () => {
                setIsCreating(true);
                setStatus(null);

                const location = createLocation({
                  name,
                  address,
                  mode: "fresh",
                });

                const website = websiteUrl.trim();
                const addressText = address.trim();
                let createdBusinessId: string | null = null;
                let createdLocationSlug: string | null = null;

                try {
                  const createResponse = await fetch("/api/locations", {
                    method: "POST",
                    headers: {
                      "content-type": "application/json",
                    },
                    body: JSON.stringify({
                      name: name.trim(),
                      address: addressText || undefined,
                      mode: "fresh",
                    }),
                  });

                  if (createResponse.ok) {
                    const payload = (await createResponse.json().catch(() => ({}))) as {
                      location?: { slug?: string; business_id?: string; businessId?: string };
                    };
                    createdBusinessId = payload.location?.business_id ?? payload.location?.businessId ?? null;
                    createdLocationSlug = payload.location?.slug ?? null;
                  }
                } catch {
                  // local location is already created; this best-effort API sync can fail safely
                }

                if (website) {
                  try {
                    setStatus("Location created. Starting initial website crawl…");
                    const importResponse = await fetch("/api/website-import/start", {
                      method: "POST",
                      headers: {
                        "content-type": "application/json",
                      },
                      body: JSON.stringify({
                        businessId: createdBusinessId,
                        businessSlug: location.businessSlug ?? location.slug,
                        locationSlug: createdLocationSlug ?? location.locationSlug ?? location.slug,
                        url: website,
                      }),
                    });

                    if (importResponse.ok) {
                      setStatus("Initial website crawl started.");
                    } else {
                      setStatus("Location created. Initial crawl could not be started.");
                    }
                  } catch {
                    setStatus("Location created. Initial crawl could not be started.");
                  }
                }

                reset();
                onClose();
                router.push("/locations");
              }}
              className="rounded-2xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {isCreating ? "Creating…" : "Create location"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
