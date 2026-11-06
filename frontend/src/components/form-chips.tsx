import { cn } from '@/lib/utils';
import type { Result } from '@/lib/player-stats';

/** Last results as W/L squares, oldest first; the newest one is outlined. */
export function FormChips({
  form,
  className,
}: {
  form: Result[];
  className?: string;
}) {
  const wins = form.filter((r) => r === 'W').length;
  return (
    <span
      role="img"
      aria-label={`Last ${form.length}: ${wins} wins, ${form.length - wins} losses`}
      className={cn('flex flex-wrap gap-1', className)}
    >
      {form.map((result, i) => (
        <span
          key={i}
          aria-hidden="true"
          className={cn(
            'flex size-5 items-center justify-center rounded-[3px] text-[9px] font-bold',
            result === 'W'
              ? 'bg-primary-fill text-primary-foreground'
              : 'border border-muted-foreground/60 text-muted-foreground',
            i === form.length - 1 &&
              'ring-1 ring-primary ring-offset-1 ring-offset-background'
          )}
        >
          {result}
        </span>
      ))}
    </span>
  );
}
