import type { ReactNode } from 'react';
import { useLocation } from '@tanstack/react-router';
import { AppLink } from '@/components/app-link';
import { StatusIndicator } from '@/components/status-indicator';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface NavbarNavProps {
  path: string;
  isPrimary?: boolean;
  children?: ReactNode;
  badge?: number | boolean;
}

export function NavbarNav({
  path,
  isPrimary = false,
  children,
  badge,
}: NavbarNavProps) {
  // Exact string equality, never prefix matching: /org/league/player/x must not
  // light up Home, and Home lights up only at the league root. This is why the
  // items are not `activeProps` links.
  const pathname = useLocation({ select: (location) => location.pathname });
  const isActive = path === pathname;

  return (
    <Button
      asChild
      variant={isPrimary ? 'default' : 'ghost'}
      className={cn('h-16 min-w-16 flex-1', {
        'text-primary hover:text-primary': !isPrimary && isActive,
      })}
    >
      {/* AppLink, not Link: these paths are built at runtime from slugs and
          ids, so they cannot be expressed as literal route ids. It is still a
          router navigation, not a document load. */}
      <AppLink to={path}>
        {children}
        {badge ? (
          <div className="relative">
            <StatusIndicator
              variant="primary"
              className="absolute -right-3 -top-6"
            >
              {typeof badge === 'number' ? badge : null}
            </StatusIndicator>
          </div>
        ) : null}
      </AppLink>
    </Button>
  );
}
