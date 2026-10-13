import { useEffect, useRef } from 'react';

// Preserve input typed into the server-rendered DOM before React hydrates.
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
    // Repeating adoption would fight normal controlled input updates.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return ref;
}
