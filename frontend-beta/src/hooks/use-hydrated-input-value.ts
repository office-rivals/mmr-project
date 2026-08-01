import { useEffect, useRef } from 'react';

/**
 * Adopts whatever a server-rendered input already holds when React hydrates.
 *
 * An SSR'd `<input>` is typeable the moment it paints, but its `onChange`
 * handler only exists once hydration commits. Characters typed in that window
 * land in the DOM node and nowhere else: React keeps the hydrated node's value
 * as-is, so nothing ever triggers the re-render that would resync them, and the
 * field stays permanently ahead of the state driving the UI. Under a dev server
 * (unbundled modules) that window is long enough for e2e automation to hit.
 *
 * Attaching the returned ref makes the component read the node once on mount
 * and push the value into state, closing that window. After hydration this is a
 * no-op, and for inputs mounted later it always is.
 */
export function useHydratedInputValue(
  value: string,
  onAdopt: (fromDom: string) => void
) {
  const ref = useRef<HTMLInputElement>(null);
  const onAdoptRef = useRef(onAdopt);
  onAdoptRef.current = onAdopt;

  useEffect(() => {
    const node = ref.current;
    if (node && node.value !== value) onAdoptRef.current(node.value);
    // Mount-only on purpose: from here on `onChange` keeps the two in sync,
    // and re-running would fight the controlled value during normal typing.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
