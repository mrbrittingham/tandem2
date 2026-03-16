/**
 * Config Store — lightweight in-memory pub/sub for server config version tracking.
 *
 * When an operator AI tool change is confirmed and written to Supabase, callers
 * invoke notifyConfigUpdated(). Dashboard pages that subscribe will re-fetch
 * from /api/location-config to sync the latest state.
 *
 * Storage: in-memory only (not localStorage). Resets on page reload by design.
 * Pattern mirrors packages/shared/src/mock-store.ts.
 */

export type ConfigStoreState = {
  /** Increments on every confirmed AI write. */
  version: number;
  /** ISO timestamp of the last update. */
  lastUpdatedAt: string;
};

type Listener = () => void;

let state: ConfigStoreState = {
  version: 0,
  lastUpdatedAt: new Date().toISOString(),
};

const listeners = new Set<Listener>();

/** Subscribe to config updates. Returns an unsubscribe function. */
export function subscribeToConfigStore(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Return the current config store snapshot. */
export function getConfigStoreState(): ConfigStoreState {
  return state;
}

/**
 * Call after a confirmed operator AI tool write succeeds.
 * Increments the version counter and notifies all subscribers.
 */
export function notifyConfigUpdated(): void {
  state = {
    version: state.version + 1,
    lastUpdatedAt: new Date().toISOString(),
  };
  listeners.forEach((l) => l());
}
