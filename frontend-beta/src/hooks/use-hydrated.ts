import { useSyncExternalStore } from 'react';

// No external store to subscribe to — the value only ever changes once, when
// React swaps the server snapshot for the client one at the end of hydration.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

/**
 * `false` during SSR and the hydration render, `true` from the first commit
 * after hydration.
 *
 * Buttons whose only behaviour lives in a React `onClick`/`onSubmit` do nothing
 * at all while the page is still SSR HTML, and a click landing in that window is
 * silently swallowed rather than replayed. Gating `disabled` on this makes the
 * dead window explicit instead of invisible.
 */
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
