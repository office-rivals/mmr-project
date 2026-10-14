import { cn } from '@/lib/utils';

interface MmrDeltaProps {
  delta?: number | null;
}

export function MmrDelta({ delta = null }: MmrDeltaProps) {
  if (delta == null) return null;
  return (
    <span className={cn('text-xs', delta >= 0 ? 'positive' : 'destructive')}>
      {`(${delta > 0 ? '+' : ''}${delta})`}
    </span>
  );
}
