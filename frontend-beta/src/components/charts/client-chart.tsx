import { Suspense, lazy, type ComponentType } from 'react';
import { ClientOnly } from '@tanstack/react-router';

// Keep DOM-dependent chart code out of server rendering.
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
