import type { Page } from '@playwright/test';

// The SSR markup is interactive-looking before SvelteKit has hydrated and
// attached its handlers, and the dev server can finish hydrating after the
// `load` event `goto` waits for. A click or keypress in that window is silently
// swallowed (or gets the browser's default). Waiting for the network to settle
// is a cheap gate that keeps specs which interact straight after navigating
// deterministic.
export const gotoHydrated = (page: Page, url: string) =>
  page.goto(url, { waitUntil: 'networkidle' });
