import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

/** Small uppercase label above a value or a heading. */
export function Eyebrow({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p
      className={cn(
        'text-[10px] font-medium tracking-[0.14em] text-muted-foreground uppercase',
        className
      )}
    >
      {children}
    </p>
  );
}
