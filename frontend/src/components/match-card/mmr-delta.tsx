import { cn } from '@/lib/utils';

interface MmrDeltaProps {
  delta?: number | null;
}

export function MmrDelta({ delta = null }: MmrDeltaProps) {
  if (delta == null) return null;
  return (
    <span
      className={cn(
        'text-xs font-normal',
        delta >= 0 ? 'text-green-400' : 'text-red-400'
      )}
    >
      {`(${delta > 0 ? '+' : ''}${delta})`}
    </span>
  );
}
