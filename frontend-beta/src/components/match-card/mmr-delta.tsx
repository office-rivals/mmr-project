import { cn } from '@/lib/utils';

interface MmrDeltaProps {
  delta?: number | null;
}

/**
 * Renders nothing when the delta is absent (unrated / legacy matches).
 *
 * `positive` / `destructive` are bare class names with no CSS rule anywhere in
 * the project — they are inert in the Svelte app too. Kept verbatim so the
 * rendered DOM matches; colouring them would be a deliberate behaviour change.
 */
export function MmrDelta({ delta = null }: MmrDeltaProps) {
  if (delta == null) return null;
  return (
    <span className={cn('text-xs', delta >= 0 ? 'positive' : 'destructive')}>
      ({delta > 0 ? '+' : ''}
      {delta})
    </span>
  );
}
