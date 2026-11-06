import { useEffect, useSyncExternalStore, type CSSProperties } from 'react';

const subscribe = (onChange: () => void) => {
  const viewport = window.visualViewport;
  viewport?.addEventListener('resize', onChange);
  viewport?.addEventListener('scroll', onChange);
  return () => {
    viewport?.removeEventListener('resize', onChange);
    viewport?.removeEventListener('scroll', onChange);
  };
};
const unsubscribed = () => () => {};
// A string, so an unchanged viewport is an unchanged snapshot.
const snapshot = () => {
  const viewport = window.visualViewport;
  return viewport ? `${viewport.offsetTop} ${viewport.height}` : '';
};
const none = () => '';

/**
 * Places a full-screen layer over the part of the screen the on-screen keyboard
 * leaves visible, and holds the page behind it still. An `inset-0` layer runs
 * on under the iOS keyboard, so the end of a list inside it can't be reached.
 */
export function useVisibleViewport(active: boolean): CSSProperties | undefined {
  const box = useSyncExternalStore(
    active ? subscribe : unsubscribed,
    active ? snapshot : none,
    none
  );

  useEffect(() => {
    if (!active) return;
    const root = document.documentElement;
    const previous = root.style.overflow;
    root.style.overflow = 'hidden';
    return () => {
      root.style.overflow = previous;
    };
  }, [active]);

  if (!box) return undefined;
  const [top, height] = box.split(' ').map(Number);
  return { top, height };
}
