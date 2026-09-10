import { Flag } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

interface OpenFlagBadgeProps {
  count: number;
  variant?: 'label' | 'count';
  className?: string;
}

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
        {`${count} open`}
      </Badge>
    );
  }

  return (
    <span
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1.5 text-xs font-semibold text-destructive-foreground',
        className
      )}
      aria-label={`${`${count} open`} flags`}
    >
      {count}
    </span>
  );
}
