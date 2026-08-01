import { Suspense, lazy, type ComponentType } from 'react';
import { ClientOnly } from '@tanstack/react-router';

/**
 * Wraps a `React.lazy`-loaded chart implementation in the two guards Carbon
 * needs:
 *  - `ClientOnly`, because `@carbon/charts-react` touches `document`/`d3` at
 *    module scope and throws during SSR;
 *  - `Suspense`, because the implementation is code-split so Carbon (and its
 *    stylesheet) never enters the main bundle.
 *
 * The fallback is `null` on both: the Svelte app rendered nothing before the
 * chart mounted either.
 */
export function clientChart<P extends object>(
  load: () => Promise<{ default: ComponentType<P> }>
): ComponentType<P> {
  const Lazy = lazy(load);
  return function ClientChart(props: P) {
    return (
      <ClientOnly fallback={null}>
        <Suspense fallback={null}>
          <Lazy {...props} />
        </Suspense>
      </ClientOnly>
    );
  };
}
