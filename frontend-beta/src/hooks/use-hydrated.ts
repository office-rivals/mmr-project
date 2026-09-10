import { useSyncExternalStore } from 'react';

// React switches snapshots once hydration commits; no subscription is needed.
const subscribe = () => () => {};
const getSnapshot = () => true;
const getServerSnapshot = () => false;

// Use to disable JavaScript-only controls until their handlers are attached.
export function useHydrated(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
