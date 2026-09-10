import { Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OpenFlagBadgeProps {
  count: number;
  /**
   * 'label' spells the count out ("3 open") for list rows; 'count' is the
   * bare pill used inside nav items, where the label supplies the context.
   */
  variant?: 'label' | 'count';
  className?: string;
}

// Renders nothing when there is nothing to flag, so call sites don't repeat
// the guard.
export function OpenFlagBadge({
  count,
  variant = 'label',
  className,
}: OpenFlagBadgeProps) {
  if (count <= 0) return null;

  if (variant === 'label') {
    return (
      <Badge variant="destructive" className={className}>
        <Flag className="mr-1 h-3 w-3" />
        {count} open
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground',
        className
      )}
      aria-label={`${count} open flags`}
    >
      {count}
    </span>
  );
}
