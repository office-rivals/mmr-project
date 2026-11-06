import { cn } from '@/lib/utils';
import type { ReactNode } from 'react';

/** The surface for the thing that is about the viewer. */
export const featuredCard =
  'rounded-lg border border-primary/50 bg-gradient-to-br from-primary/15 via-primary/5 to-transparent';
export const plainCard = 'rounded-lg border bg-card';

export function StatusPill({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        'shrink-0 rounded-full border border-primary/60 bg-primary/10 px-2.5 py-0.5 text-[11px] font-semibold tracking-wider text-primary uppercase',
        className
      )}
    >
      {children}
    </span>
  );
}
