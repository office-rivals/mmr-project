import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface KpiProps {
  title: string;
  className?: string;
  children?: ReactNode;
}

/**
 * Stat tile used by the league landing page and the player profile.
 * Markup is 1:1 with `lib/components/kpi.svelte` — the profile e2e asserts
 * exact-text visibility of the titles (`MMR`, `# Matches`, …).
 */
export function Kpi({ title, className, children }: KpiProps) {
  return (
    <div
      className={cn(
        'flex flex-col justify-between gap-2 rounded bg-gray-800 p-4 shadow-sm',
        className
      )}
    >
      <div className="text-base text-gray-300">{title}</div>
      <div className="text-2xl font-bold text-primary">{children}</div>
    </div>
  );
}
