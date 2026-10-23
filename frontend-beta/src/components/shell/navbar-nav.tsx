import { Plus, type LucideIcon } from 'lucide-react';
import { AppLink } from '@/components/app-link';
import { cn } from '@/lib/utils';

interface NavbarNavProps {
  path: string;
  icon: LucideIcon;
  /** Sidebar label; also the bottom-bar label unless `shortLabel` is set. */
  label: string;
  shortLabel?: string;
  /** Which layout shows the link; the other one removes it entirely. */
  show?: 'both' | 'mobile' | 'desktop';
  badge?: number;
  badgeLabel?: string;
}

// One element serves both the bottom bar and the sidebar so the page keeps a
// single primary navigation landmark at every width.
export function NavbarNav({
  path,
  icon: Icon,
  label,
  shortLabel,
  show = 'both',
  badge,
  badgeLabel,
}: NavbarNavProps) {
  const hasBadge = badge != null && badge > 0;

  return (
    <AppLink
      to={path}
      activeOptions={{ exact: true, includeSearch: false }}
      className={cn(
        'group relative flex h-12 min-w-16 flex-1 flex-col items-center justify-center gap-0.5 rounded-md text-[10px] font-medium tracking-[0.1em] text-muted-foreground uppercase transition-colors hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring focus-visible:outline-none',
        'data-[status=active]:font-semibold data-[status=active]:text-primary',
        'lg:h-11 lg:min-w-0 lg:flex-none lg:flex-row lg:justify-start lg:gap-3 lg:px-3 lg:text-sm lg:tracking-normal lg:normal-case lg:hover:bg-muted/60 lg:data-[status=active]:bg-muted',
        show === 'mobile' && 'lg:hidden',
        show === 'desktop' && 'hidden lg:flex'
      )}
    >
      <span className="relative flex">
        <Icon aria-hidden="true" className="size-5 lg:size-[18px]" />
        {hasBadge ? (
          <span
            aria-hidden="true"
            className="absolute -top-1.5 -right-2.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary-fill px-1 text-[10px] leading-none font-bold tracking-normal text-primary-foreground lg:hidden"
          >
            {badge}
          </span>
        ) : null}
      </span>
      <span className="leading-3 lg:hidden">{shortLabel ?? label}</span>
      <span className="hidden lg:inline">{label}</span>
      {hasBadge ? (
        <>
          <span
            aria-hidden="true"
            className="ml-auto hidden h-5 min-w-5 items-center justify-center rounded-full bg-primary-fill px-1.5 text-[11px] font-bold text-primary-foreground lg:inline-flex"
          >
            {badge}
          </span>
          {badgeLabel ? <span className="sr-only">{badgeLabel}</span> : null}
        </>
      ) : null}
    </AppLink>
  );
}

/**
 * The plus in the middle of the bottom bar. Its tile rises 14px above the bar,
 * into the match-found strip's empty centre when that shows.
 */
export function NavbarSubmit({ path }: { path: string }) {
  return (
    <AppLink
      to={path}
      activeOptions={{ exact: true, includeSearch: false }}
      className="group flex h-12 min-w-16 flex-1 flex-col items-center justify-end gap-0.5 pb-1 text-[10px] font-semibold tracking-[0.1em] text-foreground uppercase focus-visible:outline-none lg:hidden"
    >
      <span className="-mt-3.5 flex h-11 w-13 items-center justify-center rounded-xl bg-primary-fill text-primary-foreground shadow-[0_0_0_4px_hsl(var(--background))] transition-colors group-hover:bg-primary/90 group-focus-visible:ring-2 group-focus-visible:ring-ring group-focus-visible:ring-offset-2 group-focus-visible:ring-offset-background">
        <Plus aria-hidden="true" className="size-6" strokeWidth={2.5} />
      </span>
      <span className="leading-3 group-data-[status=active]:text-primary">
        Submit
      </span>
    </AppLink>
  );
}
