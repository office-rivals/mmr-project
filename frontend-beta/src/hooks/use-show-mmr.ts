import { useSyncExternalStore } from 'react';

// Parity with `frontend/src/stores/show-mmr.ts`: a module-level singleton
// persisted in localStorage under `show-mmr` with the string values
// "true"/"false", defaulting to OFF. It is a plain external store rather than a
// context because the Svelte version is a module singleton with no provider —
// any component may read it, and there is exactly one value per client session.
export const SHOW_MMR_KEY = 'show-mmr';

let value = false;
let hydratedFromStorage = false;
const listeners = new Set<() => void>();

function readStoredValue(): boolean {
  try {
    return window.localStorage.getItem(SHOW_MMR_KEY) === 'true';
  } catch {
    // Private-mode / disabled storage: fall back to the default rather than
    // taking the whole tree down.
    return false;
  }
}

function subscribe(onStoreChange: () => void): () => void {
  listeners.add(onStoreChange);
  return () => listeners.delete(onStoreChange);
}

function getSnapshot(): boolean {
  // Deferred until the first browser read so the store never touches
  // localStorage during module evaluation (which also runs on the server).
  if (!hydratedFromStorage) {
    hydratedFromStorage = true;
    value = readStoredValue();
  }
  return value;
}

// The server always reports OFF, exactly like the Svelte store's `browser`
// guard, so SSR output is deterministic.
function getServerSnapshot(): boolean {
  return false;
}

export function setShowMmr(next: boolean): void {
  if (next === getSnapshot()) return;
  value = next;
  try {
    window.localStorage.setItem(SHOW_MMR_KEY, next.toString());
  } catch {
    // Ignore: the in-memory value is still updated for this session.
  }
  for (const listener of listeners) listener();
}

/** `[showMmr, setShowMmr]` — the React equivalent of the `showMmr` store. */
export function useShowMmr(): [boolean, (next: boolean) => void] {
  const showMmr = useSyncExternalStore(
    subscribe,
    getSnapshot,
    getServerSnapshot
  );
  return [showMmr, setShowMmr];
}
