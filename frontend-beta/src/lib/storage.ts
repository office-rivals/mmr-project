// Web Storage throws when it is disabled, full or blocked by the browser's
// site-data settings. Remembering a preference is best effort and must never
// break the action that sets it, such as submitting a match.
type Area = 'local' | 'session';

const storage = (area: Area) =>
  area === 'local' ? window.localStorage : window.sessionStorage;

export function readStorage(area: Area, key: string): string | null {
  try {
    return storage(area).getItem(key);
  } catch {
    return null;
  }
}

export function writeStorage(area: Area, key: string, value: string): void {
  try {
    storage(area).setItem(key, value);
  } catch {
    // Not remembered; nothing else depends on it.
  }
}
